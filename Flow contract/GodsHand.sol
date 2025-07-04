// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract GodsHand {
    address public owner;

    struct Disaster {
        string title;
        uint256 targetAmount;
        address creator;
    }

    struct Donation {
        address donor;
        uint256 amount;
        uint256 timestamp;
    }

    mapping(bytes32 => Disaster) public disasters;
    mapping(bytes32 => Donation[]) public disasterDonations;

    event DisasterCreated(bytes32 indexed disasterHash, string title, address indexed creator, uint256 targetAmount);
    event DonationMade(bytes32 indexed disasterHash, address indexed donor, uint256 amount);

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

    function donateToDisaster(bytes32 _disasterHash) public payable {
        require(msg.value > 0, "Donation must be > 0");
        require(disasters[_disasterHash].creator != address(0), "Disaster does not exist");
        disasterDonations[_disasterHash].push(Donation(msg.sender, msg.value, block.timestamp));
        emit DonationMade(_disasterHash, msg.sender, msg.value);
    }

    function getDisasterFunds(bytes32 _disasterHash) public view returns (uint256) {
        Donation[] memory donations = disasterDonations[_disasterHash];
        uint256 total = 0;
        for (uint256 i = 0; i < donations.length; i++) {
            total += donations[i].amount;
        }
        return total;
    }

    function getDisasterDetails(bytes32 _disasterHash) public view returns (string memory, uint256, address) {
        Disaster memory d = disasters[_disasterHash];
        return (d.title, d.targetAmount, d.creator);
    }
}