// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title SachAccess
/// @notice The single role registry shared by every SachBazaar contract.
contract SachAccess is AccessControl {
    string public constant VERSION = "1.0.0";

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant COOP_AGENT_ROLE = keccak256("COOP_AGENT_ROLE");
    bytes32 public constant BUYER_ROLE = keccak256("BUYER_ROLE");
    bytes32 public constant TRUCKER_ROLE = keccak256("TRUCKER_ROLE");
    bytes32 public constant COLD_STORAGE_ROLE = keccak256("COLD_STORAGE_ROLE");
    bytes32 public constant MANDI_AGENT_ROLE = keccak256("MANDI_AGENT_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    error InvalidAdmin();

    constructor(address admin) {
        if (admin == address(0)) revert InvalidAdmin();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
