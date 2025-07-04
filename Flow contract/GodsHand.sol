// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract GodsHand {
    address public owner;

    struct Disaster {
        string title;
        uint256 targetAmount;
        address creator;
    }

    mapping(bytes32 => Disaster) public disasters;

    event DisasterCreated(bytes32 indexed disasterHash, string title, address indexed creator, uint256 targetAmount);

    constructor() {
        owner = msg.sender;
    }

    function createDisaster(string memory _title, uint256 _targetAmount) public returns (bytes32) {
        require(bytes(_title).length > 0, "Title required");
        require(_targetAmount > 0, "Target must be > 0");
        bytes32 disasterHash = keccak256(abi.encodePacked(_title, msg.sender, block.timestamp));
        disasters[disasterHash] = Disaster(_title, _targetAmount, msg.sender);
        emit DisasterCreated(disasterHash, _title, msg.sender, _targetAmount);
        return disasterHash;
    }
}