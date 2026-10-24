// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SachAccess} from "./SachAccess.sol";

/// @title FarmerRegistry
/// @notice Stores pseudonymous farmer commitments without storing farmer PII.
contract FarmerRegistry {
    string public constant VERSION = "1.0.0";

    struct Farmer {
        bytes32 farmerId;
        bytes32 credentialHash;
        bytes32 coopId;
        bool active;
    }

    SachAccess public immutable access;
    mapping(bytes32 farmerId => Farmer farmer) private _farmers;

    error Unauthorized(address caller);
    error InvalidId();
    error FarmerAlreadyExists(bytes32 farmerId);
    error FarmerNotFound(bytes32 farmerId);
    error FarmerAlreadyInactive(bytes32 farmerId);

    event FarmerRegistered(bytes32 indexed farmerId, bytes32 indexed coopId, bytes32 credentialHash);
    event FarmerCredentialUpdated(bytes32 indexed farmerId, bytes32 credentialHash);
    event FarmerRevoked(bytes32 indexed farmerId);

    constructor(SachAccess access_) {
        access = access_;
    }

    modifier onlyAdminOrCoopAgent() {
        if (!access.hasRole(access.ADMIN_ROLE(), msg.sender) && !access.hasRole(access.COOP_AGENT_ROLE(), msg.sender)) {
            revert Unauthorized(msg.sender);
        }
        _;
    }

    function registerFarmer(bytes32 farmerId, bytes32 credentialHash, bytes32 coopId) external onlyAdminOrCoopAgent {
        if (farmerId == bytes32(0) || coopId == bytes32(0)) revert InvalidId();
        if (_farmers[farmerId].farmerId != bytes32(0)) revert FarmerAlreadyExists(farmerId);
        _farmers[farmerId] = Farmer(farmerId, credentialHash, coopId, true);
        emit FarmerRegistered(farmerId, coopId, credentialHash);
    }

    function updateCredential(bytes32 farmerId, bytes32 credentialHash) external onlyAdminOrCoopAgent {
        Farmer storage farmer = _farmers[farmerId];
        if (farmer.farmerId == bytes32(0)) revert FarmerNotFound(farmerId);
        if (!farmer.active) revert FarmerAlreadyInactive(farmerId);
        farmer.credentialHash = credentialHash;
        emit FarmerCredentialUpdated(farmerId, credentialHash);
    }

    function revokeFarmer(bytes32 farmerId) external onlyAdminOrCoopAgent {
        Farmer storage farmer = _farmers[farmerId];
        if (farmer.farmerId == bytes32(0)) revert FarmerNotFound(farmerId);
        if (!farmer.active) revert FarmerAlreadyInactive(farmerId);
        farmer.active = false;
        emit FarmerRevoked(farmerId);
    }

    function getFarmer(bytes32 farmerId) external view returns (Farmer memory) {
        Farmer memory farmer = _farmers[farmerId];
        if (farmer.farmerId == bytes32(0)) revert FarmerNotFound(farmerId);
        return farmer;
    }

    function isActive(bytes32 farmerId) external view returns (bool) {
        return _farmers[farmerId].active;
    }
}
