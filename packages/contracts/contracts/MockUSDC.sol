// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SachAccess} from "./SachAccess.sol";

/// @title MockUSDC
/// @notice Six-decimal test token used only for local and Amoy demonstrations.
contract MockUSDC is ERC20 {
    string public constant VERSION = "1.0.0";

    SachAccess public immutable access;

    error Unauthorized(address caller);

    constructor(SachAccess access_) ERC20("Mock USD Coin", "mUSDC") {
        access = access_;
    }

    modifier onlyAdmin() {
        if (!access.hasRole(access.ADMIN_ROLE(), msg.sender)) revert Unauthorized(msg.sender);
        _;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external onlyAdmin {
        _mint(to, amount);
    }
}
