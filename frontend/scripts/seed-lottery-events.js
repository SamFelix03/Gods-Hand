import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.VITE_AWS_REGION || process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const docClient = DynamoDBDocumentClient.from(client);

async function seedLotteryEvents() {
  try {
    console.log("🎰 Seeding lottery-enabled events...");

    // Event 1: Active lottery with 2 hours remaining
    const event1Id = uuidv4();
    const event1CreatedTime = new Date(Date.now() - 70 * 60 * 60 * 1000); // 70 hours ago
    const event1EndTime = new Date(event1CreatedTime.getTime() + 72 * 60 * 60 * 1000); // 72 hours from creation
    
    const event1 = {
      id: event1Id,
      title: "Turkey-Syria Earthquake Relief Fund",
      description: "Emergency relief funding needed for the devastating 7.8 magnitude earthquake that struck Turkey and Syria. Immediate assistance required for rescue operations, medical supplies, food, and temporary shelter for displaced families.",
      disaster_location: "Turkey & Syria",
      estimated_amount_required: 5000000,
      source: "https://en.wikipedia.org/wiki/2023_Turkey%E2%80%93Syria_earthquake",
      disaster_hash: "0x" + Buffer.from(`turkey-syria-earthquake-${event1Id}`).toString('hex').slice(0, 40),
      created_at: event1CreatedTime.toISOString(),
      lottery_end_time: event1EndTime.toISOString(),
      lottery_duration_hours: 72,
      lottery_status: 'active'
    };

    // Event 2: New event (lottery will be initialized automatically)
    const event2Id = uuidv4();
    const event2CreatedTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    
    const event2 = {
      id: event2Id,
      title: "Morocco Earthquake Emergency Response",
      description: "Emergency response fund for the 6.8 magnitude earthquake that struck Morocco's Atlas Mountains region. Supporting search and rescue operations, emergency medical care, and immediate relief for affected communities.",
      disaster_location: "Morocco",
      estimated_amount_required: 2200000,
      source: "https://en.wikipedia.org/wiki/2023_Morocco_earthquake",
      disaster_hash: "0x" + Buffer.from(`morocco-earthquake-${event2Id}`).toString('hex').slice(0, 40),
      created_at: event2CreatedTime.toISOString(),
    };

    // Event 3: Recently completed lottery
    const event3Id = uuidv4();
    const event3CreatedTime = new Date(Date.now() - 75 * 60 * 60 * 1000); // 75 hours ago
    const event3EndTime = new Date(event3CreatedTime.getTime() + 72 * 60 * 60 * 1000); // Ended 3 hours ago
    
    const event3 = {
      id: event3Id,
      title: "Maui Wildfire Recovery Fund",
      description: "Recovery fund for the devastating wildfires in Maui, Hawaii. Supporting displaced families, community rebuilding efforts, and long-term recovery initiatives for affected areas.",
      disaster_location: "Maui, Hawaii, USA",
      estimated_amount_required: 4100000,
      source: "https://en.wikipedia.org/wiki/2023_Hawaii_wildfires",
      disaster_hash: "0x" + Buffer.from(`maui-wildfire-${event3Id}`).toString('hex').slice(0, 40),
      created_at: event3CreatedTime.toISOString(),
      lottery_end_time: event3EndTime.toISOString(),
      lottery_duration_hours: 72,
      lottery_status: 'ended',
      lottery_winner: '0x742d35cc6d6c0532925a3b8d9c115f8d9f6e0491', // Mock winner address
      lottery_prize_amount: 1250, // Mock prize amount in FLOW
      lottery_transaction_hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
    };

    // Event 4: Event without disaster hash (lottery won't activate)
    const event4Id = uuidv4();
    const event4CreatedTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    const event4 = {
      id: event4Id,
      title: "Local Community Food Drive",
      description: "Supporting local families in need through our monthly food drive initiative. Helping provide essential groceries and supplies to families facing food insecurity in our community.",
      disaster_location: "Local Community",
      estimated_amount_required: 25000,
      source: "https://example.com/food-drive",
      created_at: event4CreatedTime.toISOString(),
      // No disaster_hash - this event won't have lottery functionality
    };

    const events = [event1, event2, event3, event4];

    console.log("📝 Creating lottery events...");
    
    for (const event of events) {
      await docClient.send(
        new PutCommand({
          TableName: "gods-hand-events",
          Item: event,
        })
      );
      
      console.log(`✅ Created event: ${event.title}`);
      if (event.disaster_hash) {
        console.log(`   📦 Disaster Hash: ${event.disaster_hash}`);
        if (event.lottery_status) {
          console.log(`   🎰 Lottery Status: ${event.lottery_status}`);
          if (event.lottery_end_time) {
            const endTime = new Date(event.lottery_end_time);
            const now = new Date();
            if (endTime > now) {
              const hoursRemaining = Math.round((endTime.getTime() - now.getTime()) / (1000 * 60 * 60));
              console.log(`   ⏰ Time Remaining: ${hoursRemaining} hours`);
            } else {
              console.log(`   ⏰ Lottery Ended: ${Math.round((now.getTime() - endTime.getTime()) / (1000 * 60 * 60))} hours ago`);
            }
          }
        } else {
          console.log(`   🎰 Lottery Status: Will be initialized automatically`);
        }
      } else {
        console.log(`   ⚠️  No disaster hash - lottery disabled`);
      }
      console.log("");
    }

    console.log("🎉 Lottery events seeded successfully!");
    console.log("📊 Summary:");
    console.log(`   - Total Events Created: ${events.length}`);
    console.log(`   - Events with Lottery: ${events.filter(e => e.disaster_hash).length}`);
    console.log(`   - Active Lotteries: ${events.filter(e => e.lottery_status === 'active').length}`);
    console.log(`   - Completed Lotteries: ${events.filter(e => e.lottery_status === 'ended').length}`);
    console.log("");
    console.log("🔗 You can now test the lottery functionality on these events!");
    console.log("🎯 Try the event with active lottery to see the countdown timer.");
    console.log("🔧 Use the manual trigger button (dev only) to test lottery execution.");

  } catch (error) {
    console.error("❌ Error seeding lottery events:", error);
    process.exit(1);
  }
}

// Run the seeding
seedLotteryEvents().catch(console.error); 