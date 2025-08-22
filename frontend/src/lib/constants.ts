export const CONTRACT_ADDRESS = "0x07f9BFEb19F1ac572f6D69271261dDA1fD378D9A";

export const CONTRACT_ABI = [
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "bytes32", "name": "disasterHash", "type": "bytes32"},
            {"indexed": false, "internalType": "string", "name": "title", "type": "string"},
            {"indexed": true, "internalType": "address", "name": "creator", "type": "address"},
            {"indexed": false, "internalType": "uint256", "name": "targetAmount", "type": "uint256"}
        ],
        "name": "DisasterCreated",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "bytes32", "name": "disasterHash", "type": "bytes32"},
            {"indexed": true, "internalType": "address", "name": "donor", "type": "address"},
            {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"},
            {"indexed": false, "internalType": "uint256", "name": "totalDonated", "type": "uint256"},
            {"indexed": true, "internalType": "address", "name": "walletAddress", "type": "address"}
        ],
        "name": "DonationRecorded",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "bytes32", "name": "disasterHash", "type": "bytes32"},
            {"indexed": false, "internalType": "bool", "name": "isActive", "type": "bool"}
        ],
        "name": "DisasterStatusChanged",
        "type": "event"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "name": "allDisasterHashes",
        "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "string", "name": "_title", "type": "string"},
            {"internalType": "string", "name": "_metadata", "type": "string"},
            {"internalType": "uint256", "name": "_targetAmount", "type": "uint256"}
        ],
        "name": "createDisaster",
        "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "disasterCounter",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "", "type": "bytes32"},
            {"internalType": "uint256", "name": "", "type": "uint256"}
        ],
        "name": "disasterDonations",
        "outputs": [
            {"internalType": "address", "name": "donor", "type": "address"},
            {"internalType": "uint256", "name": "amount", "type": "uint256"},
            {"internalType": "uint256", "name": "timestamp", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "name": "disasters",
        "outputs": [
            {"internalType": "string", "name": "title", "type": "string"},
            {"internalType": "string", "name": "metadata", "type": "string"},
            {"internalType": "uint256", "name": "targetAmount", "type": "uint256"},
            {"internalType": "uint256", "name": "totalDonated", "type": "uint256"},
            {"internalType": "address", "name": "creator", "type": "address"},
            {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
            {"internalType": "bool", "name": "isActive", "type": "bool"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "", "type": "bytes32"},
            {"internalType": "address", "name": "", "type": "address"}
        ],
        "name": "donorContributions",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getAllDisasterHashes",
        "outputs": [{"internalType": "bytes32[]", "name": "", "type": "bytes32[]"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "_disasterHash", "type": "bytes32"}],
        "name": "getDisasterDetails",
        "outputs": [
            {"internalType": "string", "name": "title", "type": "string"},
            {"internalType": "string", "name": "metadata", "type": "string"},
            {"internalType": "uint256", "name": "targetAmount", "type": "uint256"},
            {"internalType": "uint256", "name": "totalDonated", "type": "uint256"},
            {"internalType": "address", "name": "creator", "type": "address"},
            {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
            {"internalType": "bool", "name": "isActive", "type": "bool"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "_disasterHash", "type": "bytes32"}],
        "name": "getDisasterDonations",
        "outputs": [
            {
                "components": [
                    {"internalType": "address", "name": "donor", "type": "address"},
                    {"internalType": "uint256", "name": "amount", "type": "uint256"},
                    {"internalType": "uint256", "name": "timestamp", "type": "uint256"}
                ],
                "internalType": "struct godslite.Donation[]",
                "name": "",
                "type": "tuple[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "_disasterHash", "type": "bytes32"}],
        "name": "getDonationCount",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "_disasterHash", "type": "bytes32"},
            {"internalType": "address", "name": "_donor", "type": "address"}
        ],
        "name": "getDonorContribution",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "_disasterHash", "type": "bytes32"}],
        "name": "getFundingProgress",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getTotalDisasters",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "_disasterHash", "type": "bytes32"},
            {"internalType": "uint256", "name": "_amount", "type": "uint256"},
            {"internalType": "address", "name": "_walletAddress", "type": "address"}
        ],
        "name": "recordDonation",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "_disasterHash", "type": "bytes32"}],
        "name": "toggleDisasterStatus",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "_newOwner", "type": "address"}],
        "name": "transferOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

export const SEPOLIA_TESTNET_CONFIG = {
    chainId: "0xaa36a7", // 11155111 in hex (Ethereum Sepolia)
    chainName: "Ethereum Sepolia",
    rpcUrl: "https://eth-sepolia.g.alchemy.com/v2/NMsHzNgJ7XUYtzNyFpEJ8yT4muQ_lkRF",
    blockExplorer: "https://sepolia.etherscan.io",
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
    },
  };