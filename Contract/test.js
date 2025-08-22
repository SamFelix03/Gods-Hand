const { ethers } = require('ethers');

// Configuration
const CONTRACT_ADDRESS = 'xxxxxxxxxxxxxxxxxxxxx';
const PRIVATE_KEY = 'xxxxxxxxxxxxxxxxxxxxxx';

const RPC_URLS = {
    sepolia: 'https://eth-sepolia.g.alchemy.com/v2/NMsHzNgJ7XUYtzNyFpEJ8yT4muQ_lkRF',
};

// Use appropriate RPC URL for your network
const PROVIDER_URL = RPC_URLS.sepolia; // Change this to your target network

// Contract ABI (extracted from the Solidity code)
const CONTRACT_ABI = [
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

async function testContract() {
    try {
        console.log('🚀 Starting Smart Contract Test...\n');

        // Initialize provider and wallet
        const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

        console.log('📋 Test Configuration:');
        console.log(`Contract Address: ${CONTRACT_ADDRESS}`);
        console.log(`Test Wallet: ${wallet.address}`);
        console.log(`Network: ${await provider.getNetwork().then(n => n.name)}\n`);

        // Test 1: Get basic contract info
        console.log('📊 === BASIC CONTRACT INFO ===');
        const owner = await contract.owner();
        const totalDisasters = await contract.getTotalDisasters();
        const disasterCounter = await contract.disasterCounter();
        
        console.log(`Owner: ${owner}`);
        console.log(`Total Disasters: ${totalDisasters.toString()}`);
        console.log(`Disaster Counter: ${disasterCounter.toString()}\n`);

        // Test 2: Create a new disaster
        console.log('🆕 === CREATING NEW DISASTER ===');
        const disasterTitle = "Earthquake Relief Fund 2024";
        const disasterMetadata = JSON.stringify({
            location: "Turkey-Syria Border",
            description: "Emergency relief for earthquake victims",
            category: "Natural Disaster",
            urgency: "High"
        });
        const targetAmount = ethers.parseEther("10"); // 10 ETH target

        console.log(`Creating disaster: ${disasterTitle}`);
        console.log(`Target Amount: ${ethers.formatEther(targetAmount)} ETH`);
        
        const createTx = await contract.createDisaster(
            disasterTitle,
            disasterMetadata,
            targetAmount
        );
        const createReceipt = await createTx.wait();
        
        // Extract disaster hash from event
        let disasterHash;
        for (const log of createReceipt.logs) {
            try {
                const parsedLog = contract.interface.parseLog(log);
                if (parsedLog && parsedLog.name === 'DisasterCreated') {
                    disasterHash = parsedLog.args.disasterHash;
                    break;
                }
            } catch (e) {
                // Continue looking through logs
            }
        }

        console.log(`✅ Disaster Created!`);
        console.log(`Transaction Hash: ${createTx.hash}`);
        console.log(`Disaster Hash: ${disasterHash}\n`);

        // Test 3: Get disaster details
        console.log('📖 === DISASTER DETAILS ===');
        const disasterDetails = await contract.getDisasterDetails(disasterHash);
        console.log(`Title: ${disasterDetails[0]}`);
        console.log(`Metadata: ${disasterDetails[1]}`);
        console.log(`Target Amount: ${ethers.formatEther(disasterDetails[2])} ETH`);
        console.log(`Total Donated: ${ethers.formatEther(disasterDetails[3])} ETH`);
        console.log(`Creator: ${disasterDetails[4]}`);
        console.log(`Timestamp: ${new Date(Number(disasterDetails[5]) * 1000).toISOString()}`);
        console.log(`Is Active: ${disasterDetails[6]}\n`);

        // Test 4: Record donations
        console.log('💰 === RECORDING DONATIONS ===');
        const donationAmount1 = ethers.parseEther("2.5"); // 2.5 ETH
        const donationAmount2 = ethers.parseEther("1.0"); // 1.0 ETH
        const donationAmount3 = ethers.parseEther("0.5"); // 0.5 ETH

        console.log('Recording first donation...');
        const donation1Tx = await contract.recordDonation(
            disasterHash,
            donationAmount1,
            wallet.address
        );
        await donation1Tx.wait();
        console.log(`✅ Donation 1: ${ethers.formatEther(donationAmount1)} ETH recorded`);

        console.log('Recording second donation...');
        const donation2Tx = await contract.recordDonation(
            disasterHash,
            donationAmount2,
            wallet.address
        );
        await donation2Tx.wait();
        console.log(`✅ Donation 2: ${ethers.formatEther(donationAmount2)} ETH recorded`);

        console.log('Recording third donation...');
        const donation3Tx = await contract.recordDonation(
            disasterHash,
            donationAmount3,
            wallet.address
        );
        await donation3Tx.wait();
        console.log(`✅ Donation 3: ${ethers.formatEther(donationAmount3)} ETH recorded\n`);

        // Test 5: Get updated disaster details
        console.log('📈 === UPDATED DISASTER DETAILS ===');
        const updatedDetails = await contract.getDisasterDetails(disasterHash);
        console.log(`Title: ${updatedDetails[0]}`);
        console.log(`Total Donated: ${ethers.formatEther(updatedDetails[3])} ETH`);
        console.log(`Target Amount: ${ethers.formatEther(updatedDetails[2])} ETH`);
        
        const fundingProgress = await contract.getFundingProgress(disasterHash);
        console.log(`Funding Progress: ${fundingProgress.toString()}%\n`);

        // Test 6: Get all donations for the disaster
        console.log('📜 === ALL DONATIONS FOR DISASTER ===');
        const allDonations = await contract.getDisasterDonations(disasterHash);
        const donationCount = await contract.getDonationCount(disasterHash);
        
        console.log(`Total Donations Count: ${donationCount.toString()}`);
        console.log('Donation Details:');
        
        for (let i = 0; i < allDonations.length; i++) {
            const donation = allDonations[i];
            console.log(`  Donation ${i + 1}:`);
            console.log(`    Donor: ${donation.donor}`);
            console.log(`    Amount: ${ethers.formatEther(donation.amount)} ETH`);
            console.log(`    Timestamp: ${new Date(Number(donation.timestamp) * 1000).toISOString()}`);
        }
        console.log();

        // Test 7: Get specific donor contributions
        console.log('👤 === DONOR CONTRIBUTIONS ===');
        const donorContribution = await contract.getDonorContribution(disasterHash, wallet.address);
        console.log(`Total contribution from ${wallet.address}:`);
        console.log(`Amount: ${ethers.formatEther(donorContribution)} ETH\n`);

        // Test 8: Get all disaster hashes
        console.log('🗂️ === ALL DISASTERS ===');
        const allHashes = await contract.getAllDisasterHashes();
        console.log(`Total disasters in contract: ${allHashes.length}`);
        
        for (let i = 0; i < allHashes.length; i++) {
            console.log(`Disaster ${i + 1} Hash: ${allHashes[i]}`);
            try {
                const details = await contract.getDisasterDetails(allHashes[i]);
                console.log(`  Title: ${details[0]}`);
                console.log(`  Donated: ${ethers.formatEther(details[3])} ETH / ${ethers.formatEther(details[2])} ETH`);
                console.log(`  Active: ${details[6]}`);
            } catch (error) {
                console.log(`  Error fetching details: ${error.message}`);
            }
        }
        console.log();

        // Test 9: Test disaster status toggle (if you're the owner)
        console.log('🔄 === TESTING DISASTER STATUS TOGGLE ===');
        try {
            console.log('Attempting to toggle disaster status...');
            const toggleTx = await contract.toggleDisasterStatus(disasterHash);
            await toggleTx.wait();
            console.log('✅ Disaster status toggled successfully');
            
            // Check new status
            const newDetails = await contract.getDisasterDetails(disasterHash);
            console.log(`New status: ${newDetails[6] ? 'Active' : 'Inactive'}`);
        } catch (error) {
            console.log(`❌ Toggle failed (might not be owner): ${error.message}`);
        }
        console.log();

        console.log('🎉 === TEST COMPLETE ===');
        console.log('All contract functions tested successfully!');
        console.log('\n📝 Summary:');
        console.log(`- Created disaster with hash: ${disasterHash}`);
        console.log(`- Recorded ${donationCount} donations`);
        console.log(`- Total amount raised: ${ethers.formatEther(updatedDetails[3])} ETH`);
        console.log(`- Funding progress: ${fundingProgress}%`);

    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        if (error.data) {
            console.error('Error data:', error.data);
        }
        if (error.transaction) {
            console.error('Failed transaction:', error.transaction);
        }
    }
}

// Helper function to test with existing disaster hash
async function testSpecificDisaster(specificDisasterHash) {
    try {
        console.log(`\n🔍 === TESTING SPECIFIC DISASTER: ${specificDisasterHash} ===`);
        
        const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

        // Get disaster details
        const details = await contract.getDisasterDetails(specificDisasterHash);
        console.log('📋 Disaster Details:');
        console.log(`  Title: ${details[0]}`);
        console.log(`  Metadata: ${details[1]}`);
        console.log(`  Target: ${ethers.formatEther(details[2])} ETH`);
        console.log(`  Raised: ${ethers.formatEther(details[3])} ETH`);
        console.log(`  Creator: ${details[4]}`);
        console.log(`  Created: ${new Date(Number(details[5]) * 1000).toISOString()}`);
        console.log(`  Active: ${details[6]}`);

        // Get all donations
        const donations = await contract.getDisasterDonations(specificDisasterHash);
        console.log(`\n💰 Donations (${donations.length} total):`);
        
        for (let i = 0; i < donations.length; i++) {
            console.log(`  ${i + 1}. ${donations[i].donor} - ${ethers.formatEther(donations[i].amount)} ETH`);
        }

        // Get funding progress
        const progress = await contract.getFundingProgress(specificDisasterHash);
        console.log(`\n📊 Funding Progress: ${progress}%`);

    } catch (error) {
        console.error(`❌ Error testing specific disaster: ${error.message}`);
    }
}

// Run the test
testContract();

// Uncomment and add a specific disaster hash to test existing disasters
// testSpecificDisaster('0x1234567890abcdef...');