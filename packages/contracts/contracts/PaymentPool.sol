// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {SachAccess} from "./SachAccess.sol";
import {BatchRegistry} from "./BatchRegistry.sol";

/// @title PaymentPool
/// @notice Escrow and pull-payment split for a sold produce batch.
contract PaymentPool is ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    string public constant VERSION = "1.0.0";
    uint16 public constant BPS_DENOMINATOR = 10_000;
    uint16 public constant MIN_FARMER_BPS = 5_000;

    struct CropPolicy {
        uint16 farmerBps;
        uint16 coopBps;
        uint16 truckerBps;
        uint16 coldStorageBps;
        uint16 mandiAgentBps;
        uint16 platformBps;
        uint16 minimumFarmerBps;
    }

    struct PayoutRecipients {
        address farmer;
        address coop;
        address trucker;
        address coldStorage;
        address mandiAgent;
        address platform;
    }

    IERC20 public immutable stablecoin;
    SachAccess public immutable access;
    BatchRegistry public immutable batchRegistry;

    mapping(uint16 cropCode => CropPolicy policy) public cropPolicies;
    mapping(bytes32 batchId => uint256 amount) public escrowOf;
    mapping(bytes32 batchId => address depositor) public depositorOf;
    mapping(bytes32 batchId => bool settled) public settled;
    mapping(address recipient => uint256 amount) public claimable;

    error Unauthorized(address caller);
    error InvalidAddress();
    error InvalidAmount();
    error InvalidPolicy();
    error PolicyNotConfigured(uint16 cropCode);
    error EscrowAlreadyFunded(bytes32 batchId);
    error EscrowNotFunded(bytes32 batchId);
    error BatchAlreadySettled(bytes32 batchId);
    error InvalidBatchStage(BatchRegistry.Stage stage);
    error PayoutUnavailable(address recipient);

    event BatchFunded(bytes32 indexed batchId, address indexed buyer, uint256 amount);
    event BatchSettled(bytes32 indexed batchId, uint256 amount, uint16 cropCode);
    event PolicyUpdated(uint16 indexed cropCode, CropPolicy policy);
    event Withdrawal(address indexed account, address indexed payoutAddress, uint256 amount);

    constructor(IERC20 stablecoin_, SachAccess access_, BatchRegistry batchRegistry_) {
        if (address(stablecoin_) == address(0) || address(access_) == address(0) || address(batchRegistry_) == address(0)) {
            revert InvalidAddress();
        }
        stablecoin = stablecoin_;
        access = access_;
        batchRegistry = batchRegistry_;
    }

    modifier onlyAdmin() {
        if (!access.hasRole(access.ADMIN_ROLE(), msg.sender)) revert Unauthorized(msg.sender);
        _;
    }

    modifier onlyRelayerOrAdmin() {
        if (!access.hasRole(access.RELAYER_ROLE(), msg.sender) && !access.hasRole(access.ADMIN_ROLE(), msg.sender)) {
            revert Unauthorized(msg.sender);
        }
        _;
    }

    modifier onlyBuyer() {
        if (!access.hasRole(access.BUYER_ROLE(), msg.sender)) revert Unauthorized(msg.sender);
        _;
    }

    function setCropPolicy(uint16 cropCode, CropPolicy calldata policy) external onlyAdmin {
        if (cropCode == 0 || policy.minimumFarmerBps < MIN_FARMER_BPS || policy.farmerBps < policy.minimumFarmerBps) revert InvalidPolicy();
        uint256 total = uint256(policy.farmerBps) + policy.coopBps + policy.truckerBps + policy.coldStorageBps + policy.mandiAgentBps + policy.platformBps;
        if (total != BPS_DENOMINATOR) revert InvalidPolicy();
        cropPolicies[cropCode] = policy;
        emit PolicyUpdated(cropCode, policy);
    }

    function fundBatch(bytes32 batchId, uint256 amount) external onlyBuyer whenNotPaused nonReentrant {
        if (amount == 0) revert InvalidAmount();
        BatchRegistry.Batch memory batch = batchRegistry.getBatch(batchId);
        if (batch.stage == BatchRegistry.Stage.SETTLED) revert InvalidBatchStage(batch.stage);
        if (depositorOf[batchId] != address(0)) revert EscrowAlreadyFunded(batchId);
        depositorOf[batchId] = msg.sender;
        escrowOf[batchId] = amount;
        stablecoin.safeTransferFrom(msg.sender, address(this), amount);
        emit BatchFunded(batchId, msg.sender, amount);
    }

    function settle(bytes32 batchId, PayoutRecipients calldata recipients) external onlyRelayerOrAdmin whenNotPaused nonReentrant {
        if (settled[batchId]) revert BatchAlreadySettled(batchId);
        uint256 escrow = escrowOf[batchId];
        if (escrow == 0) revert EscrowNotFunded(batchId);
        BatchRegistry.Batch memory batch = batchRegistry.getBatch(batchId);
        if (batch.stage != BatchRegistry.Stage.SOLD) revert InvalidBatchStage(batch.stage);
        CropPolicy memory policy = cropPolicies[batch.cropCode];
        if (policy.minimumFarmerBps == 0) revert PolicyNotConfigured(batch.cropCode);
        _checkRecipients(recipients);

        uint256 farmerAmount = escrow * policy.farmerBps / BPS_DENOMINATOR;
        uint256 coopAmount = escrow * policy.coopBps / BPS_DENOMINATOR;
        uint256 truckerAmount = escrow * policy.truckerBps / BPS_DENOMINATOR;
        uint256 coldStorageAmount = escrow * policy.coldStorageBps / BPS_DENOMINATOR;
        uint256 mandiAgentAmount = escrow * policy.mandiAgentBps / BPS_DENOMINATOR;
        uint256 platformAmount = escrow * policy.platformBps / BPS_DENOMINATOR;
        uint256 distributed = farmerAmount + coopAmount + truckerAmount + coldStorageAmount + mandiAgentAmount + platformAmount;
        farmerAmount += escrow - distributed;

        settled[batchId] = true;
        escrowOf[batchId] = 0;
        claimable[recipients.farmer] += farmerAmount;
        claimable[recipients.coop] += coopAmount;
        claimable[recipients.trucker] += truckerAmount;
        claimable[recipients.coldStorage] += coldStorageAmount;
        claimable[recipients.mandiAgent] += mandiAgentAmount;
        claimable[recipients.platform] += platformAmount;
        batchRegistry.markSettled(batchId);
        emit BatchSettled(batchId, escrow, batch.cropCode);
    }

    function withdraw() external nonReentrant whenNotPaused {
        _withdraw(msg.sender, msg.sender);
    }

    function withdrawFor(address recipient, address payoutAddress) external onlyRelayerOrAdmin nonReentrant whenNotPaused {
        if (payoutAddress == address(0)) revert InvalidAddress();
        _withdraw(recipient, payoutAddress);
    }

    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }

    function _withdraw(address account, address payoutAddress) internal {
        uint256 amount = claimable[account];
        if (amount == 0) revert PayoutUnavailable(account);
        claimable[account] = 0;
        stablecoin.safeTransfer(payoutAddress, amount);
        emit Withdrawal(account, payoutAddress, amount);
    }

    function _checkRecipients(PayoutRecipients calldata recipients) internal pure {
        if (
            recipients.farmer == address(0)
                || recipients.coop == address(0)
                || recipients.trucker == address(0)
                || recipients.coldStorage == address(0)
                || recipients.mandiAgent == address(0)
                || recipients.platform == address(0)
        ) revert InvalidAddress();
    }
}
