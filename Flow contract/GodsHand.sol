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

    constructor() {
        owner = msg.sender;
    }
}