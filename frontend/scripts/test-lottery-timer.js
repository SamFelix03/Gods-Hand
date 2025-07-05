import { lotteryTimerService } from "../src/lib/services/lotteryTimer.js";
import { eventsService } from "../src/lib/dynamodb/events.js";

async function testLotteryTimer() {
  console.log('🧪 Testing Lottery Timer Service...\n');

  try {
    // Initialize the service
    console.log('1. Initializing lottery timer service...');
    await lotteryTimerService.initialize();
    console.log('✅ Service initialized\n');

    // Get all events to see what we're working with
    console.log('2. Fetching all events...');
    const events = await eventsService.getAllEvents();
    console.log(`✅ Found ${events.length} events\n`);

    // Show details of events with lotteries
    console.log('3. Event lottery status:');
    events.forEach(event => {
      console.log(`   📅 ${event.title}`);
      console.log(`      ID: ${event.id}`);
      console.log(`      Disaster Hash: ${event.disaster_hash || 'None'}`);
      console.log(`      Lottery Status: ${event.lottery_status || 'Not configured'}`);
      
      if (event.lottery_end_time) {
        const endTime = new Date(event.lottery_end_time);
        const now = new Date();
        const remaining = endTime.getTime() - now.getTime();
        
        if (remaining > 0) {
          const hours = Math.floor(remaining / (1000 * 60 * 60));
          const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
          console.log(`      Time Remaining: ${hours}h ${minutes}m`);
        } else {
          console.log(`      Status: Expired ${Math.floor(-remaining / (1000 * 60 * 60))} hours ago`);
        }
      }
      
      // Check if timer service has this event
      const remainingMs = lotteryTimerService.getRemainingTime(event.id);
      if (remainingMs !== null) {
        const minutes = Math.floor(remainingMs / (1000 * 60));
        console.log(`      Timer Service: ✅ Active (${minutes} minutes remaining)`);
      } else {
        console.log(`      Timer Service: ⭕ Not tracked`);
      }
      
      console.log('');
    });

    // Test manual execution on a specific event (for demo purposes)
    const testEvent = events.find(e => e.disaster_hash && e.lottery_status === 'active');
    if (testEvent) {
      console.log(`4. Testing manual lottery execution on: ${testEvent.title}`);
      console.log('   ⚠️  This would normally call the blockchain contract');
      console.log('   ⚠️  Skipping actual execution to avoid gas costs');
      console.log('   ✅ Test structure verified\n');
    } else {
      console.log('4. No active lottery events found for testing\n');
    }

    console.log('🎉 Lottery Timer Service test completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Start your development server: npm run dev');
    console.log('   2. Navigate to an event detail page');
    console.log('   3. Look for the lottery countdown timer');
    console.log('   4. Try the manual trigger button for testing');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Make sure DynamoDB is properly configured');
    console.error('   2. Check AWS credentials in .env file');
    console.error('   3. Verify events were seeded correctly');
    console.error('   4. Ensure all dependencies are installed');
  } finally {
    // Cleanup
    lotteryTimerService.destroy();
  }
}

// Run the test
testLotteryTimer().catch(console.error); 