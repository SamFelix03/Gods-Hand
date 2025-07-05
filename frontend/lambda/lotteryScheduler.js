const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { ethers } = require("ethers");

// Configuration
const config = {
  region: process.env.AWS_REGION || 'us-east-1',
  contractAddress: process.env.CONTRACT_ADDRESS || '0x700D3D55ec6FC21394A43b02496F320E02873114',
  rpcUrl: process.env.RPC_URL || 'https://testnet.evm.nodes.onflow.org',
  privateKey: process.env.SCHEDULER_PRIVATE_KEY, // Private key for the scheduler wallet
  tableName: process.env.EVENTS_TABLE_NAME || 'gods-hand-events'
};

// Contract ABI for lottery function
const LOTTERY_ABI = [
  "function lottery(bytes32 _disasterHash) public returns (address)",
  "event LotteryWinner(bytes32 indexed disasterHash, address indexed winner, uint256 participantCount)"
];

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({ region: config.region });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Main Lambda handler function
 * This function will be called by EventBridge on a schedule (e.g., every 5 minutes)
 */
exports.handler = async (event, context) => {
  console.log('🎰 Lottery Scheduler Lambda starting...');
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Get all events with active lotteries
    const activeEvents = await getActiveLotteryEvents();
    console.log(`📊 Found ${activeEvents.length} events with active lotteries`);
    
    if (activeEvents.length === 0) {
      console.log('✅ No active lotteries to process');
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No active lotteries found',
          processedEvents: 0
        })
      };
    }
    
    // Check each event for expired lotteries
    const results = [];
    for (const eventItem of activeEvents) {
      try {
        const result = await processEvent(eventItem);
        results.push(result);
      } catch (error) {
        console.error(`❌ Error processing event ${eventItem.id}:`, error);
        results.push({
          eventId: eventItem.id,
          status: 'error',
          error: error.message
        });
      }
    }
    
    const processed = results.filter(r => r.status === 'executed').length;
    const errors = results.filter(r => r.status === 'error').length;
    
    console.log(`✅ Lottery Scheduler completed: ${processed} executed, ${errors} errors`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Lottery check completed',
        processedEvents: activeEvents.length,
        executedLotteries: processed,
        errors: errors,
        results: results
      })
    };
    
  } catch (error) {
    console.error('❌ Lambda execution failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Lambda execution failed',
        message: error.message
      })
    };
  }
};

/**
 * Get all events with active lotteries from DynamoDB
 */
async function getActiveLotteryEvents() {
  try {
    const command = new ScanCommand({
      TableName: config.tableName,
      FilterExpression: 'lottery_status = :status',
      ExpressionAttributeValues: {
        ':status': 'active'
      }
    });
    
    const response = await docClient.send(command);
    return response.Items || [];
  } catch (error) {
    console.error('❌ Error fetching active lottery events:', error);
    throw error;
  }
}

/**
 * Process a single event to check if lottery should be executed
 */
async function processEvent(event) {
  console.log(`🔍 Processing event: ${event.title} (${event.id})`);
  
  if (!event.lottery_end_time || !event.disaster_hash) {
    console.log(`⏭️ Skipping event ${event.id} - missing lottery data`);
    return {
      eventId: event.id,
      status: 'skipped',
      reason: 'Missing lottery data'
    };
  }
  
  const endTime = new Date(event.lottery_end_time);
  const now = new Date();
  
  if (now < endTime) {
    const minutesRemaining = Math.round((endTime.getTime() - now.getTime()) / (1000 * 60));
    console.log(`⏰ Event ${event.id} lottery has ${minutesRemaining} minutes remaining`);
    return {
      eventId: event.id,
      status: 'pending',
      minutesRemaining: minutesRemaining
    };
  }
  
  console.log(`🎰 Event ${event.id} lottery has expired, executing...`);
  
  // Execute the lottery
  const lotteryResult = await executeLottery(event);
  
  if (lotteryResult.success) {
    // Update the event in DynamoDB
    await updateEventWithLotteryResult(event.id, lotteryResult);
    
    console.log(`🎉 Lottery executed successfully for event ${event.id}`);
    console.log(`   Winner: ${lotteryResult.winner}`);
    console.log(`   TX Hash: ${lotteryResult.txHash}`);
    
    return {
      eventId: event.id,
      status: 'executed',
      winner: lotteryResult.winner,
      txHash: lotteryResult.txHash
    };
  } else {
    // Mark lottery as failed
    await updateEventWithLotteryResult(event.id, { 
      success: false, 
      error: lotteryResult.error 
    });
    
    console.error(`❌ Lottery execution failed for event ${event.id}: ${lotteryResult.error}`);
    
    return {
      eventId: event.id,
      status: 'failed',
      error: lotteryResult.error
    };
  }
}

/**
 * Execute the lottery contract call
 */
async function executeLottery(event) {
  try {
    if (!config.privateKey) {
      throw new Error('SCHEDULER_PRIVATE_KEY not configured');
    }
    
    // Create provider and wallet
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const wallet = new ethers.Wallet(config.privateKey, provider);
    
    // Verify network
    const network = await provider.getNetwork();
    console.log(`🌐 Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
    
    // Create contract instance
    const contract = new ethers.Contract(config.contractAddress, LOTTERY_ABI, wallet);
    
    // Format disaster hash
    let formattedDisasterHash = event.disaster_hash;
    if (!event.disaster_hash.startsWith('0x')) {
      formattedDisasterHash = '0x' + event.disaster_hash;
    }
    
    console.log(`📞 Calling lottery contract for disaster hash: ${formattedDisasterHash}`);
    
    // Estimate gas first
    const gasEstimate = await contract.lottery.estimateGas(formattedDisasterHash);
    console.log(`⛽ Estimated gas: ${gasEstimate.toString()}`);
    
    // Call the lottery function with gas limit
    const tx = await contract.lottery(formattedDisasterHash, {
      gasLimit: gasEstimate * 120n / 100n // Add 20% buffer
    });
    
    console.log(`📝 Transaction submitted: ${tx.hash}`);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed: ${receipt.hash}`);
    
    // Parse lottery winner event
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
        // Ignore parsing errors
      }
    }
    
    if (!winner) {
      throw new Error("LotteryWinner event not found in transaction receipt");
    }
    
    return {
      success: true,
      winner,
      participantCount,
      txHash: receipt.hash,
      gasUsed: receipt.gasUsed.toString()
    };
    
  } catch (error) {
    console.error('❌ Contract execution failed:', error);
    return {
      success: false,
      error: error.message || 'Unknown contract error'
    };
  }
}

/**
 * Update event in DynamoDB with lottery results
 */
async function updateEventWithLotteryResult(eventId, result) {
  try {
    const updateData = {
      lottery_status: 'ended',
      updated_at: new Date().toISOString()
    };
    
    if (result.success) {
      updateData.lottery_winner = result.winner;
      updateData.lottery_transaction_hash = result.txHash;
      if (result.participantCount !== undefined) {
        updateData.lottery_participant_count = result.participantCount;
      }
      if (result.gasUsed) {
        updateData.lottery_gas_used = result.gasUsed;
      }
    } else {
      updateData.lottery_error = result.error;
    }
    
    // Build update expression
    const updateExpressions = [];
    const expressionAttributeValues = {};
    
    Object.keys(updateData).forEach((key, index) => {
      updateExpressions.push(`${key} = :val${index}`);
      expressionAttributeValues[`:val${index}`] = updateData[key];
    });
    
    const command = new UpdateCommand({
      TableName: config.tableName,
      Key: { id: eventId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'UPDATED_NEW'
    });
    
    const response = await docClient.send(command);
    console.log(`📝 Updated event ${eventId} in database`);
    return response.Attributes;
    
  } catch (error) {
    console.error(`❌ Error updating event ${eventId}:`, error);
    throw error;
  }
}

/**
 * Utility function to manually test the lottery execution
 * Can be invoked with a test event containing eventId
 */
exports.testLottery = async (eventId) => {
  console.log(`🧪 Testing lottery execution for event: ${eventId}`);
  
  try {
    // Get the specific event
    const command = new ScanCommand({
      TableName: config.tableName,
      FilterExpression: 'id = :eventId',
      ExpressionAttributeValues: {
        ':eventId': eventId
      }
    });
    
    const response = await docClient.send(command);
    const events = response.Items || [];
    
    if (events.length === 0) {
      throw new Error(`Event ${eventId} not found`);
    }
    
    const event = events[0];
    const result = await processEvent(event);
    
    console.log('🎯 Test result:', result);
    return result;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}; 