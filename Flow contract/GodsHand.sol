// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract godslite {
    // Struct to store disaster information
    struct Disaster {
        string title;
        string metadata;
        uint256 targetAmount;
        uint256 totalDonated;
        address creator;
        uint256 timestamp;
        bool isActive;
    }
    
    // Struct to store donation information
    struct Donation {
        address donor;
        uint256 amount;
        uint256 timestamp;
    }
    
    // State variables
    address public owner;
    uint256 public disasterCounter;
    
    // Mappings
    mapping(bytes32 => Disaster) public disasters;
    mapping(bytes32 => Donation[]) public disasterDonations;
    mapping(bytes32 => mapping(address => uint256)) public donorContributions;
    
    // Arrays to keep track of all disasters
    bytes32[] public allDisasterHashes;
    
    // Events
    event DisasterCreated(
        bytes32 indexed disasterHash,
        string title,
        address indexed creator,
        uint256 targetAmount
    );
    
    event DonationRecorded(
        bytes32 indexed disasterHash,
        address indexed donor,
        uint256 amount,
        uint256 totalDonated,
        address indexed walletAddress
    );
    
    event DisasterStatusChanged(
        bytes32 indexed disasterHash,
        bool isActive
    );
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier disasterExists(bytes32 _disasterHash) {
        require(disasters[_disasterHash].creator != address(0), "Disaster does not exist");
        _;
    }
    
    modifier disasterActive(bytes32 _disasterHash) {
        require(disasters[_disasterHash].isActive, "Disaster is not active");
        _;
    }
    
    // Constructor
    constructor() {
        owner = msg.sender;
        disasterCounter = 0;
    }
    
    // Function to create a new disaster
    function createDisaster(
        string memory _title,
        string memory _metadata,
        uint256 _targetAmount
    ) public returns (bytes32) {
        require(bytes(_title).length > 0, "Title cannot be empty");
        require(_targetAmount > 0, "Target amount must be greater than 0");
        
        // Increment counter for unique disaster ID
        disasterCounter++;
        
        // Create unique hash for the disaster
        bytes32 disasterHash = keccak256(
            abi.encodePacked(
                _title,
                _metadata,
                msg.sender,
                block.timestamp,
                disasterCounter
            )
        );
        
        // Store disaster information
        disasters[disasterHash] = Disaster({
            title: _title,
            metadata: _metadata,
            targetAmount: _targetAmount,
            totalDonated: 0,
            creator: msg.sender,
            timestamp: block.timestamp,
            isActive: true
        });
        
        // Add to all disasters array
        allDisasterHashes.push(disasterHash);
        
        emit DisasterCreated(disasterHash, _title, msg.sender, _targetAmount);
        
        return disasterHash;
    }
    
    // Function to record a donation to a specific disaster (external funds)
    function recordDonation(
        bytes32 _disasterHash,
        uint256 _amount,
        address _walletAddress
    ) 
        public 
        disasterExists(_disasterHash) 
        disasterActive(_disasterHash) 
    {
        require(_amount > 0, "Donation amount must be greater than 0");
        require(_walletAddress != address(0), "Invalid wallet address");
        
        // Update disaster total donated
        disasters[_disasterHash].totalDonated += _amount;
        
        // Record individual donor contribution
        donorContributions[_disasterHash][msg.sender] += _amount;
        
        // Store donation details
        disasterDonations[_disasterHash].push(Donation({
            donor: msg.sender,
            amount: _amount,
            timestamp: block.timestamp
        }));
        
        emit DonationRecorded(
            _disasterHash, 
            msg.sender, 
            _amount, 
            disasters[_disasterHash].totalDonated,
            _walletAddress
        );
    }
    
    // Function to get disaster details
    function getDisasterDetails(bytes32 _disasterHash) 
        public 
        view 
        disasterExists(_disasterHash) 
        returns (
            string memory title,
            string memory metadata,
            uint256 targetAmount,
            uint256 totalDonated,
            address creator,
            uint256 timestamp,
            bool isActive
        ) 
    {
        Disaster memory disaster = disasters[_disasterHash];
        return (
            disaster.title,
            disaster.metadata,
            disaster.targetAmount,
            disaster.totalDonated,
            disaster.creator,
            disaster.timestamp,
            disaster.isActive
        );
    }
    
    // Function to get donor's contribution to a specific disaster
    function getDonorContribution(bytes32 _disasterHash, address _donor) 
        public 
        view 
        disasterExists(_disasterHash) 
        returns (uint256) 
    {
        return donorContributions[_disasterHash][_donor];
    }
    
    // Function to get all donations for a specific disaster
    function getDisasterDonations(bytes32 _disasterHash) 
        public 
        view 
        disasterExists(_disasterHash) 
        returns (Donation[] memory) 
    {
        return disasterDonations[_disasterHash];
    }
    
    // Function to get donation count for a specific disaster
    function getDonationCount(bytes32 _disasterHash) 
        public 
        view 
        disasterExists(_disasterHash) 
        returns (uint256) 
    {
        return disasterDonations[_disasterHash].length;
    }
    
    // Function to toggle disaster active status (only owner)
    function toggleDisasterStatus(bytes32 _disasterHash) 
        public 
        onlyOwner 
        disasterExists(_disasterHash) 
    {
        disasters[_disasterHash].isActive = !disasters[_disasterHash].isActive;
        emit DisasterStatusChanged(_disasterHash, disasters[_disasterHash].isActive);
    }
    
    // Function to get all disaster hashes
    function getAllDisasterHashes() public view returns (bytes32[] memory) {
        return allDisasterHashes;
    }
    
    // Function to get total number of disasters
    function getTotalDisasters() public view returns (uint256) {
        return allDisasterHashes.length;
    }
    
    // Function to get disaster funding progress (percentage)
    function getFundingProgress(bytes32 _disasterHash) 
        public 
        view 
        disasterExists(_disasterHash) 
        returns (uint256) 
    {
        uint256 targetAmount = disasters[_disasterHash].targetAmount;
        uint256 totalDonated = disasters[_disasterHash].totalDonated;
        
        if (targetAmount == 0) return 0;
        
        return (totalDonated * 100) / targetAmount;
    }
    
    // Function to transfer ownership
    function transferOwnership(address _newOwner) public onlyOwner {
        require(_newOwner != address(0), "Invalid address");
        owner = _newOwner;
    }
}
