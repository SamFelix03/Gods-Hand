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

async function seedApprovedClaim() {
  try {
    console.log("🌱 Seeding approved claim data...");

    // Create a disaster event
    const eventId = uuidv4();
    const event = {
      id: eventId,
      title: "Hurricane Relief Fund - Florida Keys",
      description: "Emergency relief funding needed for Hurricane Idalia damage in the Florida Keys. Immediate assistance required for food, shelter, and medical supplies for displaced families.",
      disaster_location: "Florida Keys, FL, USA",
      estimated_amount_required: 500000,
      source: "https://www.weather.gov/key/hurricaneidalia2023",
      disaster_hash: "0x" + Buffer.from(`hurricane-florida-keys-${Date.now()}`).toString('hex').slice(0, 40),
      created_at: new Date().toISOString(),
    };

    console.log("📝 Creating event:", event.title);
    await docClient.send(
      new PutCommand({
        TableName: "gods-hand-events",
        Item: event,
      })
    );

    // Create an approved claim for this event
    const claimId = uuidv4();
    const claim = {
      id: claimId,
      event_id: eventId,
      organization_name: "Florida Keys Relief Foundation",
      organization_aztec_address: "0x0994b358dC0a58Dd2bD3cc222ef8ab6F1eB7BFEb",
      claimed_amount: 75000,
      reason: "We are the Florida Keys Relief Foundation, a registered 501(c)(3) nonprofit organization that has been serving the Florida Keys community for over 15 years. We are requesting $75,000 to provide immediate emergency relief including: 1) Emergency food supplies for 200 displaced families, 2) Temporary shelter materials and equipment, 3) Medical supplies and first aid kits, 4) Clean water distribution systems. Our organization has experience in disaster relief and has successfully distributed over $2M in aid during previous hurricanes. We have established partnerships with local emergency services and can deploy resources within 24 hours.",
      claim_state: "approved",
      logo_url: null,
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      updated_at: new Date().toISOString(),
    };

    console.log("✅ Creating approved claim:", claim.organization_name);
    await docClient.send(
      new PutCommand({
        TableName: "gods-hand-claims",
        Item: claim,
      })
    );

    console.log("🎉 Seed data created successfully!");
    console.log("📊 Summary:");
    console.log(`   - Event: ${event.title}`);
    console.log(`   - Event ID: ${eventId}`);
    console.log(`   - Claim: ${claim.organization_name}`);
    console.log(`   - Claim Amount: $${claim.claimed_amount.toLocaleString()}`);
    console.log(`   - Organization Address: ${claim.organization_aztec_address}`);
    console.log(`   - Claim Status: ${claim.claim_state}`);
    console.log("");
    console.log("🔗 You can now view this event and test the claim functionality!");

  } catch (error) {
    console.error("❌ Error seeding data:", error);
    process.exit(1);
  }
}

seedApprovedClaim(); 