// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract GodsHand {
    address public owner;
    uint256 public disasterCounter;
    bytes32[] public allDisasterHashes;

    struct Disaster {
        string title;
        uint256 targetAmount;
        address creator;
        bool isActive;
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
    event DisasterStatusChanged(bytes32 indexed disasterHash, bool isActive);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        disasterCounter = 0;
    }

    function createDisaster(string memory _title, uint256 _targetAmount) public returns (bytes32) {
        require(bytes(_title).length > 0, "Title required");
        require(_targetAmount > 0, "Target must be > 0");
        disasterCounter++;
        bytes32 disasterHash = keccak256(abi.encodePacked(_title, msg.sender, block.timestamp, disasterCounter));
        disasters[disasterHash] = Disaster(_title, _targetAmount, msg.sender, true);
        allDisasterHashes.push(disasterHash);
        emit DisasterCreated(disasterHash, _title, msg.sender, _targetAmount);
        return disasterHash;
    }
    mapping(bytes32 => mapping(address => uint256)) public donorContributions;
    function donateToDisaster(bytes32 _disasterHash) public payable {
        require(msg.value > 0, "Donation must be > 0");
        require(disasters[_disasterHash].creator != address(0), "Disaster does not exist");
        require(disasters[_disasterHash].isActive, "Disaster is not active");
        disasterDonations[_disasterHash].push(Donation(msg.sender, msg.value, block.timestamp));
        donorContributions[_disasterHash][msg.sender] += msg.value;
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
    function getDonorContribution(bytes32 _disasterHash, address _donor) public view returns (uint256) {
        return donorContributions[_disasterHash][_donor];    

    function getDisasterDetails(bytes32 _disasterHash) public view returns (string memory, uint256, address, bool) {
        Disaster memory d = disasters[_disasterHash];
        return (d.title, d.targetAmount, d.creator, d.isActive);
    }

    function toggleDisasterStatus(bytes32 _disasterHash) public onlyOwner {
        require(disasters[_disasterHash].creator != address(0), "Disaster does not exist");
        disasters[_disasterHash].isActive = !disasters[_disasterHash].isActive;
        emit DisasterStatusChanged(_disasterHash, disasters[_disasterHash].isActive);
    }
        function getAllDisasterHashes() public view returns (bytes32[] memory) {
        return allDisasterHashes;
    }

    function getTotalDisasters() public view returns (uint256) {
        return allDisasterHashes.length;
    }


    function withdraw() public onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
    
    event FundsUnlocked(bytes32 indexed disasterHash, address indexed recipient, uint256 amount, address indexed unlockedBy);

    function unlockFunds(bytes32 _disasterHash, uint256 _amount, address payable _recipient) public onlyOwner {
        require(_recipient != address(0), "Invalid recipient");
        require(_amount > 0, "Amount must be > 0");
        require(address(this).balance >= _amount, "Insufficient contract balance");
        _recipient.transfer(_amount);
        emit FundsUnlocked(_disasterHash, _recipient, _amount, msg.sender);
    }
    function unlockFundsByCreator(bytes32 _disasterHash, uint256 _amount, address payable _recipient) public {
        require(disasters[_disasterHash].creator == msg.sender, "Only creator");
        require(_recipient != address(0), "Invalid recipient");
        require(_amount > 0, "Amount must be > 0");
        require(address(this).balance >= _amount, "Insufficient contract balance");
        _recipient.transfer(_amount);
        emit FundsUnlocked(_disasterHash, _recipient, _amount, msg.sender);
    }
    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }        
    function getFundingProgress(bytes32 _disasterHash) public view returns (uint256) {
        Disaster memory d = disasters[_disasterHash];
        uint256 donated = getDisasterFunds(_disasterHash);
        if (d.targetAmount == 0) return 0;
        return (donated * 100) / d.targetAmount;
    }
    function emergencyWithdraw() public onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    receive() external payable {}
}