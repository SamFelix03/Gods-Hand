import { Event } from "../types/database";
import { eventsService } from "../dynamodb/events";
import { ethers } from "ethers";

// Contract ABI for the lottery function
const LOTTERY_ABI = [
  "function lottery(bytes32 _disasterHash) public returns (address)",
  "event LotteryWinner(bytes32 indexed disasterHash, address indexed winner, uint256 participantCount)"
];

const CONTRACT_ADDRESS = "0x700D3D55ec6FC21394A43b02496F320E02873114"; // Your deployed contract address
const DEFAULT_LOTTERY_DURATION = 72; // 72 hours = 3 days

interface TimerInstance {
  eventId: string;
  disasterHash: string;
  endTime: Date;
  timeout?: NodeJS.Timeout;
}

class LotteryTimerService {
  private timers: Map<string, TimerInstance> = new Map();
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    
    console.log('🎰 Initializing Lottery Timer Service...');
    
    // Load all active events and set up timers
    await this.loadActiveTimers();
    this.initialized = true;
    
    console.log('✅ Lottery Timer Service initialized');
  }

  private async loadActiveTimers() {
    try {
      const events = await eventsService.getAllEvents();
      
      for (const event of events) {
        await this.processEventForLottery(event);
      }
    } catch (error) {
      console.error('❌ Error loading active timers:', error);
    }
  }

  async processEventForLottery(event: Event) {
    // Skip if event doesn't have disaster_hash
    if (!event.disaster_hash) {
      console.log(`⏭️ Skipping event ${event.id} - no disaster hash`);
      return;
    }

    // Initialize lottery for new events
    if (!event.lottery_status) {
      console.log(`🆕 Setting up lottery for new event: ${event.title}`);
      await this.initializeLotteryForEvent(event);
      return;
    }

    // Handle active lotteries
    if (event.lottery_status === 'active' && event.lottery_end_time) {
      const endTime = new Date(event.lottery_end_time);
      const now = new Date();
      
      if (now >= endTime) {
        // Timer has expired, execute lottery
        console.log(`⏰ Lottery timer expired for event: ${event.title}`);
        await this.executeLottery(event);
      } else {
        // Set up timer for remaining time
        console.log(`⏱️ Setting up timer for event: ${event.title} (${Math.round((endTime.getTime() - now.getTime()) / 1000 / 60)} minutes remaining)`);
        this.setupTimer(event, endTime);
      }
    }
  }

  private async initializeLotteryForEvent(event: Event) {
    const duration = event.lottery_duration_hours || DEFAULT_LOTTERY_DURATION;
    const createdAt = new Date(event.created_at);
    const endTime = new Date(createdAt.getTime() + (duration * 60 * 60 * 1000));
    
    const updates = {
      lottery_end_time: endTime.toISOString(),
      lottery_duration_hours: duration,
      lottery_status: 'active' as const,
    };

    try {
      await eventsService.updateEvent(event.id, updates);
      console.log(`✅ Initialized lottery for event: ${event.title} - ends at ${endTime.toLocaleString()}`);
      
      // Set up timer
      this.setupTimer({ ...event, ...updates }, endTime);
    } catch (error) {
      console.error(`❌ Error initializing lottery for event ${event.id}:`, error);
    }
  }

  private setupTimer(event: Event, endTime: Date) {
    // Clear existing timer for this event
    this.clearTimer(event.id);
    
    const now = new Date();
    const msUntilEnd = endTime.getTime() - now.getTime();
    
    if (msUntilEnd <= 0) {
      // Timer already expired
      this.executeLottery(event);
      return;
    }

    // Create timer instance
    const timerInstance: TimerInstance = {
      eventId: event.id,
      disasterHash: event.disaster_hash!,
      endTime,
      timeout: setTimeout(() => {
        console.log(`⏰ Timer fired for event: ${event.title}`);
        this.executeLottery(event);
      }, msUntilEnd)
    };

    this.timers.set(event.id, timerInstance);
    console.log(`⏱️ Timer set for event ${event.id} - ${Math.round(msUntilEnd / 1000 / 60)} minutes remaining`);
  }

  private clearTimer(eventId: string) {
    const timer = this.timers.get(eventId);
    if (timer?.timeout) {
      clearTimeout(timer.timeout);
    }
    this.timers.delete(eventId);
  }

  private async executeLottery(event: Event) {
    if (!event.disaster_hash) {
      console.error(`❌ Cannot execute lottery for event ${event.id} - no disaster hash`);
      return;
    }

    console.log(`🎰 Executing lottery for event: ${event.title}`);

    try {
      // Update event status to indicate lottery is ending
      await eventsService.updateEvent(event.id, {
        lottery_status: 'ended'
      });

      // Execute contract call
      const result = await this.callLotteryContract(event.disaster_hash);
      
      if (result.success) {
        // Update event with lottery results
        await eventsService.updateEvent(event.id, {
          lottery_winner: result.winner,
          lottery_prize_amount: result.prizeAmount,
          lottery_transaction_hash: result.txHash,
          lottery_status: 'ended'
        });

        console.log(`🎉 Lottery executed successfully for event: ${event.title}`);
        console.log(`   Winner: ${result.winner}`);
        console.log(`   Prize: ${result.prizeAmount} FLOW`);
        console.log(`   TX Hash: ${result.txHash}`);
      } else {
        console.error(`❌ Lottery execution failed for event ${event.id}:`, result.error);
        
        // Mark lottery as failed but keep the event data
        await eventsService.updateEvent(event.id, {
          lottery_status: 'ended'
        });
      }
    } catch (error) {
      console.error(`❌ Error executing lottery for event ${event.id}:`, error);
    } finally {
      // Clean up timer
      this.clearTimer(event.id);
    }
  }

  private async callLotteryContract(disasterHash: string): Promise<{
    success: boolean;
    winner?: string;
    prizeAmount?: number;
    txHash?: string;
    error?: string;
  }> {
    try {
      // Check if we have MetaMask or web3 provider
      if (!window.ethereum) {
        throw new Error("No web3 provider found - MetaMask not installed");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Verify network
      const network = await provider.getNetwork();
      if (network.chainId !== 545n) {
        throw new Error(`Wrong network. Expected Flow Testnet (545), got ${network.chainId}`);
      }

      // Create contract instance
      const contract = new ethers.Contract(CONTRACT_ADDRESS, LOTTERY_ABI, signer);

      // Ensure disaster hash has 0x prefix
      let formattedDisasterHash = disasterHash;
      if (!disasterHash.startsWith('0x')) {
        formattedDisasterHash = '0x' + disasterHash;
      }

      console.log(`📞 Calling lottery contract for disaster hash: ${formattedDisasterHash}`);

      // Call the lottery function
      const tx = await contract.lottery(formattedDisasterHash);
      console.log(`📝 Transaction submitted: ${tx.hash}`);

      // Wait for transaction confirmation
      const receipt = await tx.wait();
      console.log(`✅ Transaction confirmed: ${receipt.hash}`);

      // Parse events to get lottery winner
      let winner = '';
      let participantCount = 0;
      
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed?.name === 'LotteryWinner') {
            winner = parsed.args.winner;
            participantCount = Number(parsed.args.participantCount);
            break;
          }
        } catch (e) {
          // Ignore parsing errors for other events
        }
      }

      if (!winner) {
        throw new Error("LotteryWinner event not found in transaction receipt");
      }

      // Calculate prize amount (5% of disaster funds)
      // For now, we'll estimate this - in a real implementation you'd query the contract
      const estimatedPrizeAmount = 0; // This would need to be calculated from the contract state

      return {
        success: true,
        winner,
        prizeAmount: estimatedPrizeAmount,
        txHash: receipt.hash
      };

    } catch (error: any) {
      console.error('❌ Contract call failed:', error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  // Method to add a new event to the timer system
  async addEvent(event: Event) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    await this.processEventForLottery(event);
  }

  // Method to get remaining time for an event's lottery
  getRemainingTime(eventId: string): number | null {
    const timer = this.timers.get(eventId);
    if (!timer) return null;
    
    const now = new Date();
    const remaining = timer.endTime.getTime() - now.getTime();
    return Math.max(0, remaining);
  }

  // Method to manually trigger lottery (for testing)
  async manuallyExecuteLottery(eventId: string) {
    const event = await eventsService.getEventById(eventId);
    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }
    
    console.log(`🔧 Manually executing lottery for event: ${event.title}`);
    await this.executeLottery(event);
  }

  // Cleanup method
  destroy() {
    console.log('🧹 Cleaning up Lottery Timer Service...');
    for (const [eventId, timer] of this.timers) {
      if (timer.timeout) {
        clearTimeout(timer.timeout);
      }
    }
    this.timers.clear();
    this.initialized = false;
  }
}

// Create singleton instance
export const lotteryTimerService = new LotteryTimerService();

// Auto-initialize when the module is loaded
if (typeof window !== 'undefined') {
  // Initialize after a short delay to ensure other services are ready
  setTimeout(() => {
    lotteryTimerService.initialize().catch(console.error);
  }, 1000);
}

export default lotteryTimerService; 