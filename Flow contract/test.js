const { ethers } = require('ethers');

// Configuration
const CONFIG = {
    // Flow EVM Testnet
    RPC_URL: 'https://testnet.evm.nodes.onflow.org',
    CHAIN_ID: 545,
    
    // Account Details
    ACCOUNT_ADDRESS: 'xxxxxxxxxxxxxxxxxxxxxxxxxxx',
    PRIVATE_KEY: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    
    // Contract Address (UPDATE THIS AFTER DEPLOYMENT)
    CONTRACT_ADDRESS: '0x700D3D55ec6FC21394A43b02496F320E02873114', // Replace with actual deployed address
    
    // Test Parameters
    TEST_DISASTER_TITLE: 'Hurricane Relief Test',
    TEST_DISASTER_METADATA: 'Emergency relief for hurricane victims - automated test',
    TEST_TARGET_AMOUNT: ethers.parseEther('10'), // 10 FLOW
    TEST_DONATION_AMOUNT: ethers.parseEther('0.5'), // 0.5 FLOW
    TEST_UNLOCK_AMOUNT: ethers.parseEther('0.2'), // 0.2 FLOW
    RECIPIENT_ADDRESS: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxx' // Test recipient address
};

// Contract ABI
const CONTRACT_ABI = [
    // Constructor and basic info
    "function owner() view returns (address)",
    "function disasterCounter() view returns (uint256)",
    
    // Disaster creation
    "function createDisaster(string memory _title, string memory _metadata, uint256 _targetAmount) returns (bytes32)",
    
    // Donation functions
    "function donateToDisaster(bytes32 _disasterHash) payable",
    
    // Read functions
    "function getDisasterFunds(bytes32 _disasterHash) view returns (uint256)",
    "function getDisasterDetails(bytes32 _disasterHash) view returns (string, string, uint256, uint256, address, uint256, bool)",
    "function getDonorContribution(bytes32 _disasterHash, address _donor) view returns (uint256)",
    "function getDisasterDonations(bytes32 _disasterHash) view returns (tuple(address donor, uint256 amount, uint256 timestamp)[])",
    "function getDonationCount(bytes32 _disasterHash) view returns (uint256)",
    "function getAllDisasterHashes() view returns (bytes32[])",
    "function getTotalDisasters() view returns (uint256)",
    "function getContractBalance() view returns (uint256)",
    "function getFundingProgress(bytes32 _disasterHash) view returns (uint256)",
    
    // Admin functions
    "function unlockFunds(bytes32 _disasterHash, uint256 _amount, address payable _recipient)",
    "function unlockFundsByCreator(bytes32 _disasterHash, uint256 _amount, address payable _recipient)",
    "function toggleDisasterStatus(bytes32 _disasterHash)",
    "function transferOwnership(address _newOwner)",
    
    // Emergency functions
    "function emergencyWithdraw()",
    
    // Mappings access
    "function disasters(bytes32) view returns (string, string, uint256, uint256, address, uint256, bool)",
    "function disasterFunds(bytes32) view returns (uint256)",
    "function donorContributions(bytes32, address) view returns (uint256)",
    
    // Events
    "event DisasterCreated(bytes32 indexed disasterHash, string title, address indexed creator, uint256 targetAmount)",
    "event DonationMade(bytes32 indexed disasterHash, address indexed donor, uint256 amount, uint256 totalDonated)",
    "event FundsUnlocked(bytes32 indexed disasterHash, address indexed recipient, uint256 amount, address indexed unlockedBy)"
];

class DisasterReliefTester {
    constructor() {
        this.provider = null;
        this.wallet = null;
        this.contract = null;
        this.testDisasterHash = null;
        this.testResults = [];
    }

    // Initialize connection
    async initialize() {
        try {
            console.log('🚀 Initializing Disaster Relief Contract Tester...\n');
            
            // Setup provider
            this.provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
            
            // Setup wallet
            this.wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, this.provider);
            
            // Setup contract
            this.contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONTRACT_ABI, this.wallet);
            
            // Verify connection
            const balance = await this.provider.getBalance(this.wallet.address);
            const network = await this.provider.getNetwork();
            
            console.log('✅ Connection established:');
            console.log(`   Account: ${this.wallet.address}`);
            console.log(`   Balance: ${ethers.formatEther(balance)} FLOW`);
            console.log(`   Network: ${network.name} (Chain ID: ${network.chainId})`);
            console.log(`   Contract: ${CONFIG.CONTRACT_ADDRESS}\n`);
            
            return true;
        } catch (error) {
            console.error('❌ Initialization failed:', error.message);
            return false;
        }
    }

    // Utility function to add test result
    addTestResult(testName, success, details = '') {
        this.testResults.push({
            test: testName,
            status: success ? '✅ PASS' : '❌ FAIL',
            details: details
        });
        console.log(`${success ? '✅' : '❌'} ${testName}: ${details}\n`);
    }

    // Test 1: Read initial contract state
    async testInitialState() {
        try {
            console.log('📖 Test 1: Reading Initial Contract State');
            
            const owner = await this.contract.owner();
            const disasterCounter = await this.contract.disasterCounter();
            const totalDisasters = await this.contract.getTotalDisasters();
            const contractBalance = await this.contract.getContractBalance();
            
            console.log(`   Owner: ${owner}`);
            console.log(`   Disaster Counter: ${disasterCounter.toString()}`);
            console.log(`   Total Disasters: ${totalDisasters.toString()}`);
            console.log(`   Contract Balance: ${ethers.formatEther(contractBalance)} FLOW`);
            
            this.addTestResult(
                'Initial State Check',
                true,
                `Owner: ${owner}, Disasters: ${totalDisasters.toString()}`
            );
            
        } catch (error) {
            this.addTestResult('Initial State Check', false, error.message);
        }
    }

    // Test 2: Create a disaster
    async testCreateDisaster() {
        try {
            console.log('📝 Test 2: Creating New Disaster');
            
            const tx = await this.contract.createDisaster(
                CONFIG.TEST_DISASTER_TITLE,
                CONFIG.TEST_DISASTER_METADATA,
                CONFIG.TEST_TARGET_AMOUNT
            );
            
            console.log(`   Transaction Hash: ${tx.hash}`);
            const receipt = await tx.wait();
            
            // Extract disaster hash from events
            const event = receipt.logs.find(log => {
                try {
                    const parsed = this.contract.interface.parseLog(log);
                    return parsed.name === 'DisasterCreated';
                } catch {
                    return false;
                }
            });
            
            if (event) {
                const parsed = this.contract.interface.parseLog(event);
                this.testDisasterHash = parsed.args.disasterHash;
                console.log(`   Disaster Hash: ${this.testDisasterHash}`);
                
                this.addTestResult(
                    'Disaster Creation',
                    true,
                    `Hash: ${this.testDisasterHash.substring(0, 10)}...`
                );
            } else {
                throw new Error('DisasterCreated event not found');
            }
            
        } catch (error) {
            this.addTestResult('Disaster Creation', false, error.message);
        }
    }

    // Test 3: Get disaster details
    async testGetDisasterDetails() {
        try {
            console.log('📋 Test 3: Reading Disaster Details');
            
            if (!this.testDisasterHash) {
                throw new Error('No disaster hash available');
            }
            
            const details = await this.contract.getDisasterDetails(this.testDisasterHash);
            
            console.log(`   Title: ${details[0]}`);
            console.log(`   Metadata: ${details[1]}`);
            console.log(`   Target Amount: ${ethers.formatEther(details[2])} FLOW`);
            console.log(`   Total Donated: ${ethers.formatEther(details[3])} FLOW`);
            console.log(`   Creator: ${details[4]}`);
            console.log(`   Timestamp: ${new Date(Number(details[5]) * 1000).toLocaleString()}`);
            console.log(`   Is Active: ${details[6]}`);
            
            this.addTestResult(
                'Get Disaster Details',
                true,
                `Title: ${details[0]}, Active: ${details[6]}`
            );
            
        } catch (error) {
            this.addTestResult('Get Disaster Details', false, error.message);
        }
    }

    // Test 4: Check initial disaster funds
    async testInitialDisasterFunds() {
        try {
            console.log('💰 Test 4: Checking Initial Disaster Funds');
            
            if (!this.testDisasterHash) {
                throw new Error('No disaster hash available');
            }
            
            const funds = await this.contract.getDisasterFunds(this.testDisasterHash);
            const donationCount = await this.contract.getDonationCount(this.testDisasterHash);
            
            console.log(`   Initial Funds: ${ethers.formatEther(funds)} FLOW`);
            console.log(`   Initial Donation Count: ${donationCount.toString()}`);
            
            this.addTestResult(
                'Initial Disaster Funds Check',
                funds === 0n && donationCount === 0n,
                `Funds: ${ethers.formatEther(funds)} FLOW, Count: ${donationCount.toString()}`
            );
            
        } catch (error) {
            this.addTestResult('Initial Disaster Funds Check', false, error.message);
        }
    }

    // Test 5: Make a donation
    async testDonateToDisaster() {
        try {
            console.log('💝 Test 5: Making Donation to Disaster');
            
            if (!this.testDisasterHash) {
                throw new Error('No disaster hash available');
            }
            
            const balanceBefore = await this.provider.getBalance(this.wallet.address);
            console.log(`   Balance Before: ${ethers.formatEther(balanceBefore)} FLOW`);
            
            const tx = await this.contract.donateToDisaster(this.testDisasterHash, {
                value: CONFIG.TEST_DONATION_AMOUNT
            });
            
            console.log(`   Transaction Hash: ${tx.hash}`);
            const receipt = await tx.wait();
            
            const balanceAfter = await this.provider.getBalance(this.wallet.address);
            console.log(`   Balance After: ${ethers.formatEther(balanceAfter)} FLOW`);
            
            // Check if DonationMade event was emitted
            const event = receipt.logs.find(log => {
                try {
                    const parsed = this.contract.interface.parseLog(log);
                    return parsed.name === 'DonationMade';
                } catch {
                    return false;
                }
            });
            
            if (event) {
                const parsed = this.contract.interface.parseLog(event);
                console.log(`   Donated Amount: ${ethers.formatEther(parsed.args.amount)} FLOW`);
                console.log(`   New Total: ${ethers.formatEther(parsed.args.totalDonated)} FLOW`);
            }
            
            this.addTestResult(
                'Donation Made',
                true,
                `Amount: ${ethers.formatEther(CONFIG.TEST_DONATION_AMOUNT)} FLOW`
            );
            
        } catch (error) {
            this.addTestResult('Donation Made', false, error.message);
        }
    }

    // Test 6: Verify donation was recorded
    async testVerifyDonation() {
        try {
            console.log('🔍 Test 6: Verifying Donation Records');
            
            if (!this.testDisasterHash) {
                throw new Error('No disaster hash available');
            }
            
            const funds = await this.contract.getDisasterFunds(this.testDisasterHash);
            const donorContribution = await this.contract.getDonorContribution(
                this.testDisasterHash, 
                this.wallet.address
            );
            const donationCount = await this.contract.getDonationCount(this.testDisasterHash);
            const donations = await this.contract.getDisasterDonations(this.testDisasterHash);
            
            console.log(`   Total Disaster Funds: ${ethers.formatEther(funds)} FLOW`);
            console.log(`   Your Contribution: ${ethers.formatEther(donorContribution)} FLOW`);
            console.log(`   Total Donations Count: ${donationCount.toString()}`);
            
            if (donations.length > 0) {
                console.log(`   Latest Donation:`);
                console.log(`     Donor: ${donations[donations.length - 1].donor}`);
                console.log(`     Amount: ${ethers.formatEther(donations[donations.length - 1].amount)} FLOW`);
                console.log(`     Timestamp: ${new Date(Number(donations[donations.length - 1].timestamp) * 1000).toLocaleString()}`);
            }
            
            const isValid = funds > 0n && donorContribution > 0n && donationCount > 0n;
            
            this.addTestResult(
                'Donation Verification',
                isValid,
                `Funds: ${ethers.formatEther(funds)} FLOW, Count: ${donationCount.toString()}`
            );
            
        } catch (error) {
            this.addTestResult('Donation Verification', false, error.message);
        }
    }

    // Test 7: Check funding progress
    async testFundingProgress() {
        try {
            console.log('📊 Test 7: Checking Funding Progress');
            
            if (!this.testDisasterHash) {
                throw new Error('No disaster hash available');
            }
            
            const progress = await this.contract.getFundingProgress(this.testDisasterHash);
            const details = await this.contract.getDisasterDetails(this.testDisasterHash);
            
            console.log(`   Target Amount: ${ethers.formatEther(details[2])} FLOW`);
            console.log(`   Current Amount: ${ethers.formatEther(details[3])} FLOW`);
            console.log(`   Progress: ${progress.toString()}%`);
            
            this.addTestResult(
                'Funding Progress Check',
                true,
                `Progress: ${progress.toString()}%`
            );
            
        } catch (error) {
            this.addTestResult('Funding Progress Check', false, error.message);
        }
    }

    // Test 8: Unlock funds (as owner)
    async testUnlockFunds() {
        try {
            console.log('🔓 Test 8: Unlocking Funds');
            
            if (!this.testDisasterHash) {
                throw new Error('No disaster hash available');
            }
            
            const fundsBefore = await this.contract.getDisasterFunds(this.testDisasterHash);
            console.log(`   Funds Before Unlock: ${ethers.formatEther(fundsBefore)} FLOW`);
            
            if (fundsBefore < CONFIG.TEST_UNLOCK_AMOUNT) {
                throw new Error('Insufficient funds to unlock');
            }
            
            const tx = await this.contract.unlockFunds(
                this.testDisasterHash,
                CONFIG.TEST_UNLOCK_AMOUNT,
                CONFIG.RECIPIENT_ADDRESS
            );
            
            console.log(`   Transaction Hash: ${tx.hash}`);
            const receipt = await tx.wait();
            
            const fundsAfter = await this.contract.getDisasterFunds(this.testDisasterHash);
            console.log(`   Funds After Unlock: ${ethers.formatEther(fundsAfter)} FLOW`);
            console.log(`   Unlocked Amount: ${ethers.formatEther(CONFIG.TEST_UNLOCK_AMOUNT)} FLOW`);
            console.log(`   Recipient: ${CONFIG.RECIPIENT_ADDRESS}`);
            
            // Check for FundsUnlocked event
            const event = receipt.logs.find(log => {
                try {
                    const parsed = this.contract.interface.parseLog(log);
                    return parsed.name === 'FundsUnlocked';
                } catch {
                    return false;
                }
            });
            
            if (event) {
                const parsed = this.contract.interface.parseLog(event);
                console.log(`   Event Confirmed - Amount: ${ethers.formatEther(parsed.args.amount)} FLOW`);
            }
            
            this.addTestResult(
                'Funds Unlock',
                true,
                `Unlocked: ${ethers.formatEther(CONFIG.TEST_UNLOCK_AMOUNT)} FLOW`
            );
            
        } catch (error) {
            this.addTestResult('Funds Unlock', false, error.message);
        }
    }

    // Test 9: Test all disaster listing functions
    async testDisasterListing() {
        try {
            console.log('📝 Test 9: Testing Disaster Listing Functions');
            
            const allHashes = await this.contract.getAllDisasterHashes();
            const totalDisasters = await this.contract.getTotalDisasters();
            
            console.log(`   Total Disasters: ${totalDisasters.toString()}`);
            console.log(`   All Disaster Hashes Count: ${allHashes.length}`);
            
            if (allHashes.length > 0) {
                console.log(`   Latest Disaster Hash: ${allHashes[allHashes.length - 1]}`);
                
                // Test getting details for each disaster
                for (let i = 0; i < Math.min(allHashes.length, 3); i++) {
                    const details = await this.contract.getDisasterDetails(allHashes[i]);
                    console.log(`   Disaster ${i + 1}: ${details[0]} (${details[6] ? 'Active' : 'Inactive'})`);
                }
            }
            
            this.addTestResult(
                'Disaster Listing',
                totalDisasters === BigInt(allHashes.length),
                `Found ${totalDisasters.toString()} disasters`
            );
            
        } catch (error) {
            this.addTestResult('Disaster Listing', false, error.message);
        }
    }

    // Test 10: Test contract balance and final state
    async testFinalState() {
        try {
            console.log('🏁 Test 10: Final Contract State Check');
            
            const contractBalance = await this.contract.getContractBalance();
            const totalDisasters = await this.contract.getTotalDisasters();
            const owner = await this.contract.owner();
            
            console.log(`   Final Contract Balance: ${ethers.formatEther(contractBalance)} FLOW`);
            console.log(`   Total Disasters Created: ${totalDisasters.toString()}`);
            console.log(`   Contract Owner: ${owner}`);
            
            if (this.testDisasterHash) {
                const finalFunds = await this.contract.getDisasterFunds(this.testDisasterHash);
                const finalDonationCount = await this.contract.getDonationCount(this.testDisasterHash);
                
                console.log(`   Test Disaster Final Funds: ${ethers.formatEther(finalFunds)} FLOW`);
                console.log(`   Test Disaster Donation Count: ${finalDonationCount.toString()}`);
            }
            
            this.addTestResult(
                'Final State Check',
                true,
                `Balance: ${ethers.formatEther(contractBalance)} FLOW, Disasters: ${totalDisasters.toString()}`
            );
            
        } catch (error) {
            this.addTestResult('Final State Check', false, error.message);
        }
    }

    // Run all tests
    async runAllTests() {
        console.log('🧪 DISASTER RELIEF CONTRACT COMPREHENSIVE TESTING\n');
        console.log('='.repeat(60));
        
        // Initialize
        const initialized = await this.initialize();
        if (!initialized) {
            console.log('❌ Testing aborted due to initialization failure');
            return;
        }
        
        // Run all tests in sequence
        await this.testInitialState();
        await this.testCreateDisaster();
        await this.testGetDisasterDetails();
        await this.testInitialDisasterFunds();
        await this.testDonateToDisaster();
        await this.testVerifyDonation();
        await this.testFundingProgress();
        await this.testUnlockFunds();
        await this.testDisasterListing();
        await this.testFinalState();
        
        // Print summary
        this.printTestSummary();
    }

    // Print test summary
    printTestSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(60));
        
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(t => t.status.includes('PASS')).length;
        const failedTests = totalTests - passedTests;
        
        console.log(`Total Tests: ${totalTests}`);
        console.log(`✅ Passed: ${passedTests}`);
        console.log(`❌ Failed: ${failedTests}`);
        console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n`);
        
        // Detailed results
        this.testResults.forEach((result, index) => {
            console.log(`${index + 1}. ${result.status} ${result.test}`);
            if (result.details) {
                console.log(`   └─ ${result.details}`);
            }
        });
        
        console.log('\n' + '='.repeat(60));
        
        if (this.testDisasterHash) {
            console.log(`🎯 Test Disaster Hash: ${this.testDisasterHash}`);
            console.log('💡 Use this hash for manual testing in Remix!');
            console.log('='.repeat(60));
        }
    }
}

// Usage instructions
async function main() {
    // Check if contract address is set
    if (CONFIG.CONTRACT_ADDRESS === 'YOUR_CONTRACT_ADDRESS_HERE') {
        console.log('❌ Please update CONTRACT_ADDRESS in the configuration!');
        console.log('   1. Deploy the contract in Remix');
        console.log('   2. Copy the contract address');
        console.log('   3. Replace YOUR_CONTRACT_ADDRESS_HERE with the actual address');
        console.log('   4. Run this script again');
        return;
    }
    
    const tester = new DisasterReliefTester();
    await tester.runAllTests();
}

// Export for module usage
module.exports = { DisasterReliefTester, CONFIG };

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}