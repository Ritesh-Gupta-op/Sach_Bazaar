// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SachAccess} from "./SachAccess.sol";
import {FarmerRegistry} from "./FarmerRegistry.sol";

/// @title BatchRegistry
/// @notice The on-chain tomato batch state machine and hash-chained journey.
contract BatchRegistry is EIP712 {
    string public constant VERSION = "1.0.0";
    uint16 public constant TOMATO_CROP_CODE = 1;
    uint8 public constant MAX_RECORDS = 32;

    enum Stage {
        FARM_GATE,
        IN_TRANSIT,
        COLD_STORAGE,
        MANDI,
        SOLD,
        SETTLED,
        DISPUTED
    }

    struct Batch {
        bytes32 batchId;
        bytes32 farmerId;
        bytes32 coopId;
        uint16 cropCode;
        uint32 weightGrams;
        uint32 pricePerKgPaise;
        bytes32 photoHash;
        bytes32 metadataHash;
        bytes32 geoHash;
        uint8 aiGrade;
        uint16 aiFlags;
        bytes32 lastRecordHash;
        Stage stage;
        uint40 createdAt;
    }

    struct CreateBatchData {
        bytes32 batchId;
        bytes32 farmerId;
        bytes32 coopId;
        uint16 cropCode;
        uint32 weightGrams;
        uint32 pricePerKgPaise;
        bytes32 photoHash;
        bytes32 metadataHash;
        bytes32 geoHash;
        address coopSigner;
        address buyerSigner;
        uint256 coopNonce;
        uint256 buyerNonce;
        uint256 deadline;
    }

    struct HandoverData {
        bytes32 batchId;
        address fromSigner;
        address toSigner;
        Stage nextStage;
        uint32 pricePerKgPaise;
        bytes32 locationHash;
        bytes32 prevRecordHash;
        uint256 fromNonce;
        uint256 toNonce;
        uint256 deadline;
    }

    struct AIAttestation {
        bytes32 batchId;
        uint8 aiGrade;
        uint16 aiFlags;
        bytes32 resultHash;
        address oracleSigner;
        uint256 nonce;
        uint256 deadline;
    }

    struct SaleData {
        bytes32 batchId;
        uint32 finalPricePerKgPaise;
        address buyerSigner;
        address mandiAgentSigner;
        uint256 buyerNonce;
        uint256 mandiNonce;
        uint256 deadline;
    }

    struct Record {
        bytes32 recordHash;
        bytes32 prevRecordHash;
        bytes32 locationHash;
        uint32 pricePerKgPaise;
        Stage stage;
        uint40 timestamp;
        address from;
        address to;
    }

    bytes32 private constant CREATE_TYPEHASH = keccak256(
        "CreateBatch(bytes32 batchId,bytes32 farmerId,bytes32 coopId,uint16 cropCode,uint32 weightGrams,uint32 pricePerKgPaise,bytes32 photoHash,bytes32 metadataHash,bytes32 geoHash,address signer,uint8 signerRole,uint256 nonce,uint256 deadline)"
    );
    bytes32 private constant HANDOVER_TYPEHASH = keccak256(
        "Handover(bytes32 batchId,address fromSigner,address toSigner,uint8 nextStage,uint32 pricePerKgPaise,bytes32 locationHash,bytes32 prevRecordHash,address signer,uint256 nonce,uint256 deadline)"
    );
    bytes32 private constant AI_TYPEHASH = keccak256(
        "AIAttestation(bytes32 batchId,uint8 aiGrade,uint16 aiFlags,bytes32 resultHash,address oracleSigner,uint256 nonce,uint256 deadline)"
    );
    bytes32 private constant SALE_TYPEHASH = keccak256(
        "Sale(bytes32 batchId,uint32 finalPricePerKgPaise,address signer,uint256 nonce,uint256 deadline)"
    );

    SachAccess public immutable access;
    FarmerRegistry public immutable farmerRegistry;
    address public paymentPool;

    mapping(bytes32 batchId => Batch batch) private _batches;
    mapping(bytes32 batchId => address custodian) public custodianOf;
    mapping(bytes32 batchId => Record[] records) private _records;
    mapping(bytes32 photoHash => bytes32 batchId) public photoToBatch;
    mapping(address signer => mapping(uint256 nonce => bool used)) public nonceUsed;
    mapping(bytes32 batchId => Stage priorStage) public disputePriorStage;
    mapping(bytes32 batchId => bytes32 reasonHash) public disputeReason;

    error Unauthorized(address caller);
    error InvalidId();
    error InvalidAddress();
    error InvalidDeadline(uint256 deadline);
    error NonceAlreadyUsed(address signer, uint256 nonce);
    error InvalidSignature(address signer);
    error InvalidRole(address signer);
    error BatchAlreadyExists(bytes32 batchId);
    error BatchNotFound(bytes32 batchId);
    error FarmerInactive(bytes32 farmerId);
    error DuplicatePhoto(bytes32 photoHash, bytes32 existingBatchId);
    error InvalidCrop(uint16 cropCode);
    error InvalidStage(Stage stage);
    error InvalidTransition(Stage from, Stage to);
    error InvalidPreviousRecord(bytes32 expected, bytes32 actual);
    error InvalidAIGrade(uint8 grade);
    error DisputeNotAllowed(bytes32 batchId);
    error NotDisputed(bytes32 batchId);
    error PaymentPoolNotSet();
    error FarmerCoopMismatch(bytes32 farmerId, bytes32 coopId);
    error RecordLimitReached(bytes32 batchId);

    event BatchCreated(bytes32 indexed batchId, bytes32 indexed farmerId, bytes32 indexed coopId, address coopSigner, address buyerSigner);
    event HandoverRecorded(bytes32 indexed batchId, Stage indexed stage, address indexed from, address to, bytes32 recordHash);
    event AIAttested(bytes32 indexed batchId, uint8 aiGrade, uint16 aiFlags, bytes32 resultHash);
    event BatchSold(bytes32 indexed batchId, uint32 finalPricePerKgPaise, address buyerSigner, address mandiAgentSigner);
    event BatchSettled(bytes32 indexed batchId);
    event DisputeRaised(bytes32 indexed batchId, Stage priorStage, bytes32 reasonHash);
    event DisputeResolved(bytes32 indexed batchId, Stage outcome);
    event PaymentPoolUpdated(address indexed paymentPool);

    constructor(SachAccess access_, FarmerRegistry farmerRegistry_)
        EIP712("SachBazaar", "1")
    {
        access = access_;
        farmerRegistry = farmerRegistry_;
    }

    modifier onlyRelayer() {
        if (!access.hasRole(access.RELAYER_ROLE(), msg.sender)) revert Unauthorized(msg.sender);
        _;
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

    function setPaymentPool(address paymentPool_) external onlyAdmin {
        if (paymentPool_ == address(0)) revert InvalidAddress();
        paymentPool = paymentPool_;
        emit PaymentPoolUpdated(paymentPool_);
    }

    function createBatch(CreateBatchData calldata d, bytes calldata coopSig, bytes calldata buyerSig) external onlyRelayer {
        if (d.batchId == bytes32(0) || d.photoHash == bytes32(0)) revert InvalidId();
        if (_batches[d.batchId].batchId != bytes32(0)) revert BatchAlreadyExists(d.batchId);
        if (photoToBatch[d.photoHash] != bytes32(0)) revert DuplicatePhoto(d.photoHash, photoToBatch[d.photoHash]);
        if (d.cropCode != TOMATO_CROP_CODE) revert InvalidCrop(d.cropCode);
        FarmerRegistry.Farmer memory farmer = farmerRegistry.getFarmer(d.farmerId);
        if (!farmer.active) revert FarmerInactive(d.farmerId);
        if (farmer.coopId != d.coopId) revert FarmerCoopMismatch(d.farmerId, d.coopId);
        _checkDeadline(d.deadline);
        _checkUnused(d.coopSigner, d.coopNonce);
        _checkUnused(d.buyerSigner, d.buyerNonce);
        _checkRole(d.coopSigner, access.COOP_AGENT_ROLE());
        _checkRole(d.buyerSigner, access.BUYER_ROLE());
        _checkSignature(_createDigest(d, d.coopSigner, 1, d.coopNonce), d.coopSigner, coopSig);
        _checkSignature(_createDigest(d, d.buyerSigner, 2, d.buyerNonce), d.buyerSigner, buyerSig);
        _useNonce(d.coopSigner, d.coopNonce);
        _useNonce(d.buyerSigner, d.buyerNonce);

        Batch storage batch = _batches[d.batchId];
        batch.batchId = d.batchId;
        batch.farmerId = d.farmerId;
        batch.coopId = d.coopId;
        batch.cropCode = d.cropCode;
        batch.weightGrams = d.weightGrams;
        batch.pricePerKgPaise = d.pricePerKgPaise;
        batch.photoHash = d.photoHash;
        batch.metadataHash = d.metadataHash;
        batch.geoHash = d.geoHash;
        batch.stage = Stage.FARM_GATE;
        batch.createdAt = uint40(block.timestamp);
        custodianOf[d.batchId] = d.buyerSigner;
        photoToBatch[d.photoHash] = d.batchId;

        bytes32 recordHash = keccak256(abi.encode(bytes32(0), d.batchId, d.geoHash, d.pricePerKgPaise, uint8(Stage.FARM_GATE), block.timestamp, d.coopSigner, d.buyerSigner));
        batch.lastRecordHash = recordHash;
        _records[d.batchId].push(Record(recordHash, bytes32(0), d.geoHash, d.pricePerKgPaise, Stage.FARM_GATE, uint40(block.timestamp), d.coopSigner, d.buyerSigner));
        emit BatchCreated(d.batchId, d.farmerId, d.coopId, d.coopSigner, d.buyerSigner);
    }

    function recordHandover(HandoverData calldata h, bytes calldata fromSig, bytes calldata toSig) external onlyRelayer {
        Batch storage batch = _getBatch(h.batchId);
        if (batch.stage == Stage.DISPUTED || batch.stage == Stage.SOLD || batch.stage == Stage.SETTLED) revert InvalidStage(batch.stage);
        if (h.fromSigner != custodianOf[h.batchId]) revert InvalidSignature(h.fromSigner);
        if (h.prevRecordHash != batch.lastRecordHash) revert InvalidPreviousRecord(batch.lastRecordHash, h.prevRecordHash);
        if (h.fromSigner == h.toSigner || h.toSigner == address(0)) revert InvalidAddress();
        if (!_isLegalHandover(batch.stage, h.nextStage)) revert InvalidTransition(batch.stage, h.nextStage);
        if (_records[h.batchId].length >= MAX_RECORDS) revert RecordLimitReached(h.batchId);
        _checkDeadline(h.deadline);
        _checkUnused(h.fromSigner, h.fromNonce);
        _checkUnused(h.toSigner, h.toNonce);
        _checkSenderRole(h.fromSigner, batch.stage);
        _checkReceiverRole(h.toSigner, h.nextStage);
        _checkSignature(_handoverDigest(h, h.fromSigner, h.fromNonce), h.fromSigner, fromSig);
        _checkSignature(_handoverDigest(h, h.toSigner, h.toNonce), h.toSigner, toSig);
        _useNonce(h.fromSigner, h.fromNonce);
        _useNonce(h.toSigner, h.toNonce);

        uint40 timestamp = uint40(block.timestamp);
        bytes32 recordHash = keccak256(abi.encode(h.prevRecordHash, h.batchId, h.locationHash, h.pricePerKgPaise, uint8(h.nextStage), timestamp, h.fromSigner, h.toSigner));
        batch.lastRecordHash = recordHash;
        batch.stage = h.nextStage;
        batch.pricePerKgPaise = h.pricePerKgPaise;
        custodianOf[h.batchId] = h.toSigner;
        _records[h.batchId].push(Record(recordHash, h.prevRecordHash, h.locationHash, h.pricePerKgPaise, h.nextStage, timestamp, h.fromSigner, h.toSigner));
        emit HandoverRecorded(h.batchId, h.nextStage, h.fromSigner, h.toSigner, recordHash);
    }

    function attestAI(AIAttestation calldata a, bytes calldata oracleSig) external onlyRelayer {
        Batch storage batch = _getBatch(a.batchId);
        if (batch.stage == Stage.SETTLED) revert InvalidStage(batch.stage);
        if (a.aiGrade > 4) revert InvalidAIGrade(a.aiGrade);
        _checkDeadline(a.deadline);
        _checkUnused(a.oracleSigner, a.nonce);
        _checkRole(a.oracleSigner, access.ORACLE_ROLE());
        _checkSignature(_aiDigest(a), a.oracleSigner, oracleSig);
        _useNonce(a.oracleSigner, a.nonce);
        batch.aiGrade = a.aiGrade;
        batch.aiFlags = a.aiFlags;
        emit AIAttested(a.batchId, a.aiGrade, a.aiFlags, a.resultHash);
    }

    function markSold(SaleData calldata s, bytes calldata buyerSig, bytes calldata mandiAgentSig) external onlyRelayer {
        Batch storage batch = _getBatch(s.batchId);
        if (batch.stage != Stage.MANDI) revert InvalidStage(batch.stage);
        _checkDeadline(s.deadline);
        _checkUnused(s.buyerSigner, s.buyerNonce);
        _checkUnused(s.mandiAgentSigner, s.mandiNonce);
        _checkRole(s.buyerSigner, access.BUYER_ROLE());
        _checkRole(s.mandiAgentSigner, access.MANDI_AGENT_ROLE());
        _checkSignature(_saleDigest(s, s.buyerSigner, s.buyerNonce), s.buyerSigner, buyerSig);
        _checkSignature(_saleDigest(s, s.mandiAgentSigner, s.mandiNonce), s.mandiAgentSigner, mandiAgentSig);
        _useNonce(s.buyerSigner, s.buyerNonce);
        _useNonce(s.mandiAgentSigner, s.mandiNonce);
        batch.pricePerKgPaise = s.finalPricePerKgPaise;
        batch.stage = Stage.SOLD;
        emit BatchSold(s.batchId, s.finalPricePerKgPaise, s.buyerSigner, s.mandiAgentSigner);
    }

    function raiseDispute(bytes32 batchId, bytes32 reasonHash) external onlyRelayerOrAdmin {
        Batch storage batch = _getBatch(batchId);
        if (batch.stage == Stage.SETTLED || batch.stage == Stage.DISPUTED) revert DisputeNotAllowed(batchId);
        disputePriorStage[batchId] = batch.stage;
        disputeReason[batchId] = reasonHash;
        batch.stage = Stage.DISPUTED;
        emit DisputeRaised(batchId, disputePriorStage[batchId], reasonHash);
    }

    function resolveDispute(bytes32 batchId, Stage outcome) external onlyAdmin {
        Batch storage batch = _getBatch(batchId);
        if (batch.stage != Stage.DISPUTED) revert NotDisputed(batchId);
        if (outcome == Stage.DISPUTED || outcome == Stage.SOLD || outcome == Stage.SETTLED) revert InvalidStage(outcome);
        batch.stage = outcome;
        emit DisputeResolved(batchId, outcome);
    }

    function markSettled(bytes32 batchId) external {
        if (paymentPool == address(0)) revert PaymentPoolNotSet();
        if (msg.sender != paymentPool) revert Unauthorized(msg.sender);
        Batch storage batch = _getBatch(batchId);
        if (batch.stage != Stage.SOLD) revert InvalidStage(batch.stage);
        batch.stage = Stage.SETTLED;
        emit BatchSettled(batchId);
    }

    function getBatch(bytes32 batchId) external view returns (Batch memory) {
        return _getBatch(batchId);
    }

    function getRecords(bytes32 batchId) external view returns (Record[] memory) {
        _getBatch(batchId);
        return _records[batchId];
    }

    function recordCount(bytes32 batchId) external view returns (uint256) {
        _getBatch(batchId);
        return _records[batchId].length;
    }

    function verifyRecordChain(bytes32 batchId) external view returns (bool) {
        _getBatch(batchId);
        Record[] storage records = _records[batchId];
        bytes32 previous = bytes32(0);
        for (uint256 i; i < MAX_RECORDS; ++i) {
            if (i == records.length) break;
            Record storage record = records[i];
            if (record.prevRecordHash != previous) return false;
            bytes32 expected = keccak256(abi.encode(record.prevRecordHash, batchId, record.locationHash, record.pricePerKgPaise, uint8(record.stage), record.timestamp, record.from, record.to));
            if (expected != record.recordHash) return false;
            previous = record.recordHash;
        }
        return previous == _batches[batchId].lastRecordHash;
    }

    function createDigest(CreateBatchData calldata d, address signer, uint8 signerRole) external view returns (bytes32) {
        return _createDigest(d, signer, signerRole, signer == d.coopSigner ? d.coopNonce : d.buyerNonce);
    }

    function handoverDigest(HandoverData calldata h, address signer, uint256 nonce) external view returns (bytes32) {
        return _handoverDigest(h, signer, nonce);
    }

    function aiDigest(AIAttestation calldata a) external view returns (bytes32) {
        return _aiDigest(a);
    }

    function saleDigest(SaleData calldata s, address signer, uint256 nonce) external view returns (bytes32) {
        return _saleDigest(s, signer, nonce);
    }

    function _createDigest(CreateBatchData calldata d, address signer, uint8 signerRole, uint256 nonce) internal view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(CREATE_TYPEHASH, d.batchId, d.farmerId, d.coopId, d.cropCode, d.weightGrams, d.pricePerKgPaise, d.photoHash, d.metadataHash, d.geoHash, signer, signerRole, nonce, d.deadline)));
    }

    function _handoverDigest(HandoverData calldata h, address signer, uint256 nonce) internal view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(HANDOVER_TYPEHASH, h.batchId, h.fromSigner, h.toSigner, uint8(h.nextStage), h.pricePerKgPaise, h.locationHash, h.prevRecordHash, signer, nonce, h.deadline)));
    }

    function _aiDigest(AIAttestation calldata a) internal view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(AI_TYPEHASH, a.batchId, a.aiGrade, a.aiFlags, a.resultHash, a.oracleSigner, a.nonce, a.deadline)));
    }

    function _saleDigest(SaleData calldata s, address signer, uint256 nonce) internal view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(SALE_TYPEHASH, s.batchId, s.finalPricePerKgPaise, signer, nonce, s.deadline)));
    }

    function _checkDeadline(uint256 deadline) internal view {
        if (deadline < block.timestamp) revert InvalidDeadline(deadline);
    }

    function _checkUnused(address signer, uint256 nonce) internal view {
        if (nonceUsed[signer][nonce]) revert NonceAlreadyUsed(signer, nonce);
    }

    function _useNonce(address signer, uint256 nonce) internal {
        nonceUsed[signer][nonce] = true;
    }

    function _checkSignature(bytes32 digest, address signer, bytes calldata signature) internal view {
        if (!SignatureChecker.isValidSignatureNow(signer, digest, signature)) revert InvalidSignature(signer);
    }

    function _checkRole(address signer, bytes32 role) internal view {
        if (!access.hasRole(role, signer)) revert InvalidRole(signer);
    }

    function _checkSenderRole(address signer, Stage stage) internal view {
        if (stage == Stage.FARM_GATE) _checkRole(signer, access.BUYER_ROLE());
        else if (stage == Stage.IN_TRANSIT) _checkRole(signer, access.TRUCKER_ROLE());
        else if (stage == Stage.COLD_STORAGE) _checkRole(signer, access.COLD_STORAGE_ROLE());
        else revert InvalidStage(stage);
    }

    function _checkReceiverRole(address signer, Stage stage) internal view {
        if (stage == Stage.IN_TRANSIT) _checkRole(signer, access.TRUCKER_ROLE());
        else if (stage == Stage.COLD_STORAGE) _checkRole(signer, access.COLD_STORAGE_ROLE());
        else if (stage == Stage.MANDI) _checkRole(signer, access.MANDI_AGENT_ROLE());
        else revert InvalidStage(stage);
    }

    function _isLegalHandover(Stage from, Stage to) internal pure returns (bool) {
        return (from == Stage.FARM_GATE && to == Stage.IN_TRANSIT)
            || (from == Stage.IN_TRANSIT && to == Stage.COLD_STORAGE)
            || (from == Stage.COLD_STORAGE && to == Stage.MANDI);
    }

    function _getBatch(bytes32 batchId) internal view returns (Batch storage batch) {
        batch = _batches[batchId];
        if (batch.batchId == bytes32(0)) revert BatchNotFound(batchId);
    }

}
