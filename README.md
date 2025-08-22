# God's Hand
*"Where Heaven Hears, and Humanity Helps — One Gift at a Time."*

## 🚀 **Implementation Highlights**

We have implemented the following features offered by Circle:

1. **🌐 Multichain USDC Payment System (using CCTP v2)** - The Donations are multichain USDC payments and payouts using Fast Transfers from Circle's Cross-Chain Transfer Protocol V2.

2. **⚡ USDC Gas Payments (using Circle Paymaster)** - Enabled donors to pay for gas using USDC instead of native tokens, creating a unified payment experience across all supported networks.

📖 **For detailed technical implementation, visit: [Circle CCTP v2 & Paymaster Integration Notes](./CIRCLE_INTEGRATION.md)**

## 📋 **Table of Contents**

### **📖 Overview**
- [ Introduction](#-introduction)
- [ The Problems in Current Systems](#-the-problems-in-current-systems)
- [ Why God's Hand (AI agents + Blockchain) is the Solution?](#-why-gods-hand-ai-agents--blockchain-is-the-solution)

### **🏗️ Architecture & Pipeline**
- [ How It's Made: The Disaster Creation Pipeline](#️-how-its-made-the-disaster-creation-pipeline)
- [ The Democratic Verification & Distribution Pipeline](#️-the-democratic-verification--distribution-pipeline)

### **🔧 Core Integrations**
- [🤖 Mosaia Integration](#-mosaia-integration)
- [📄 Smart Contract Integration](#-smart-contract-integration)
- [🌤️ WeatherXM Integration](#️-weatherxm-integration)
- [⭕ Circle CCTP v2 & Paymaster Integration](#-circle-cctp-v2--paymaster-integration)


## 🌟 Introduction

**God's Hand** is a decentralized disaster relief platform that bridges the gap between urgent humanitarian needs and global generosity through AI Agents and blockchain infra. 

In a world where natural disasters strike without warning, traditional relief systems often fail due to..
- bureaucratic delays
- lack of transparency
- inefficient fund allocation.

God's Hand transforms this paradigm by deploying **autonomous AI agents** that continuously monitor global events, instantly assess disaster situations, and facilitate **rapid, transparent, and democratically-governed relief funding**.

Powered by **MOSAIA AI agents** relying on **WeatherXM's Weather Data** running on **Phala's Trusted Execution Environments (TEE)** and secured by **Ethereum blockchain**, our platform ensures complete transparency, trustless operations, and community-driven decision making. Every donation, every claim, and every allocation is immutably recorded on the **Ethereum Sepolia blockchain** via our smart contract, governed by the collective wisdom of verified global citizens, creating a truly decentralized ecosystem that eliminates the systemic failures plaguing traditional relief systems.


## 🚨 The Problems in Current Systems

Traditional disaster relief platforms fail due to:

**1. Lack of Transparency**
- **Opaque fund allocation** with no visibility into how donations are spent
- **Hidden administrative costs** and unclear overhead expenses

**2. Critical Delays**
- **Bureaucratic bottlenecks** slow fund distribution
- **Funds take weeks/months** to reach disaster-affected areas

**3. Limited Donor Engagement**
- **No transparency** in fund allocation and impact tracking
- **No engagement mechanisms** for ongoing participation in relief efforts


## 🔬 Why God's Hand (AI agents + Blockchain) is the Solution?

### 🤖 **Autonomous Disaster Detection & Analysis**
- **Real-time News Monitoring**: MOSAIA AI agents continuously scan global news sources for tragic events and natural disasters
- **Intelligent Location Identification**: The bbox Agent pinpoints affected geographical areas with precision
- **Weather Data Integration**: Leverages WeatherXM API to fetch critical weather conditions for comprehensive situation analysis
- **Smart Fund Allocation**: AI-driven assessment determines appropriate relief fund amounts based on severity, population impact, and weather conditions

### 🐦 **Automated Social Media Outreach**
- **Instant Tweet Generation**: AI crafts compelling, informative tweets about verified disaster events
- **Automatic Twitter Posting**: Seamless integration with Twitter API for immediate public awareness

### 🌐 **Transparent Relief Platform**
- **Verified Disaster Display**: All AI-verified disaster events are showcased in an intuitive frontend interface
- **Seamless Donation Experience**: User-friendly donation system supporting cross-chain **USDC** payments via Circle CCTP v2
- **Real-time Fund Tracking**: Complete transparency in fund collection and allocation progress

### 🏛️ **Democratic Claim Verification**
- **NGO & Organization Claims**: Registered relief organizations can file claims for disaster funds
- **AI-Powered Verification**: Dedicated MOSAIA Voting-Verification Pipeline agent validates claim authenticity
- **Community Governance**: Final fund allocation decisions made through democratic voting consensus

### 🔐 **Secure Identity Verification**
- **zkPassport Integration**: Zero-knowledge proof technology ensures voter identity verification
- **Fool-proof Voting System**: Anonymous yet verified voting prevents fraud and manipulation
- **Privacy-First Approach**: Identity verification without compromising personal data privacy

### 🛠️ **Comprehensive Tool Ecosystem**
- **Modular Architecture**: Built with specialized Mosaia tools for maximum efficiency and reliability
- **TEE-Hosted Security**: All AI agents run on Trusted Execution Environments for enhanced security and fool-proof execution.
- **Scalable Infrastructure**: Designed to handle global-scale disaster response operations

## 🏗️ How It's Made: The Disaster Creation Pipeline

### 🔄 **Complete Workflow: From Detection to Deployment**

<img width="1401" alt="Workflow Diagram" src="https://github.com/user-attachments/assets/a13c0ab3-7f7b-4a31-948f-e8952900300a" />



### 🎯 **Step-by-Step Pipeline Execution**

**Phase 1: Detection & Location Intelligence**
1. **Disaster Search Agent** scans global news sources and identifies disaster events
2. **BBOX Identifier Agent** processes location data and generates precise geographical boundaries
3. **WeatherXM Agent** fetches real-time weather conditions from stations within the affected area

**Phase 2: Analysis & Funding Determination**
4. **Disaster Analysis Agent** combines news intelligence with weather data to assess disaster severity
5. **Smart Contract Integration** converts USD funding requirements to appropriate funding targets in USDC
6. **Ethereum Blockchain Deployment** writes disaster data (title, metadata, target_amount) to the GodsHand smart contract on Ethereum Sepolia.

**Phase 3: Public Outreach & Data Storage**
7. **Tweet Agent** generates and publishes disaster awareness content with funding details and source links to our twitter account @godshandsupport.
8. **DynamoDB Storage** maintains comprehensive disaster records with unique hashes and timestamps
9. **Pipeline Completion** triggers next monitoring cycle and maintains continuous operation

### 🔒 **Security & Reliability Features**

- **TEE-Hosted Execution**: All agents run in Trusted Execution Environments for maximum security
- **Blockchain Immutability**: Disaster data is permanently recorded on Ethereum Sepolia blockchain
- **Multi-Source Verification**: News sources and weather stations provide cross-validation
- **Automated Failsafes**: Pipeline includes comprehensive error handling and recovery mechanisms

## 🗳️ The Democratic Verification & Distribution Pipeline

### 🔄 **Complete User Journey: From Donation to Distribution**

<img width="1436" alt="Screenshot 2025-07-06 at 4 02 10 AM" src="https://github.com/user-attachments/assets/1b1d4fc0-8ead-493c-a924-7b9b15c164be" />


### 🎯 **Step-by-Step Democratic Process**

#### **Step 1: User Donation & Blockchain Recording**
1. **USDC Donation**: Users donate any amount of USDC tokens from any supported blockchain through the intuitive DonationModal interface
2. **Cross-Chain Transfer**: Circle CCTP v2 facilitates seamless transfer to Ethereum Sepolia destination
3. **Smart Contract Recording**: All donations are automatically recorded on the GodsHand smart contract
4. **Transparent Tracking**: All donations are recorded immutably on Ethereum blockchain with real-time progress updates

#### **Step 2: NGO Funding Claims & AI Verification**
5. **Claim Submission**: Registered NGOs and relief organizations submit detailed funding requests through RequestFundsModal
6. **Fact-Check Agent Analysis**: AI agent `(ID: 686656aaf14ab5c885e431ce)` analyzes claims using:
   - **Cross-referencing** with original disaster data and news sources
   - **Feasibility assessment** of proposed relief activities
   - **Amount calculation** based on disaster severity, amount present in the disaster pool of that specific disaster and organizational capacity
   - **Evidence validation** for legitimacy verification
7. **Automatic Approval/Rejection**: Claims are instantly approved for voting or rejected based on AI analysis

#### **Step 3: Democratic Community Voting**
8. **zkPassport Verification**: Voters must prove they are 18+ using zero-knowledge passport verification
9. **Anonymous Voting**: Verified voters cast anonymous votes with four options:
   - **Accept**: Approve funding as requested
   - **Reject**: Deny funding entirely  
   - **Raise Amount**: Approve but suggest higher funding
   - **Lower Amount**: Approve but suggest reduced funding
10. **Consensus Mechanism**: Minimum 3 votes required for decision; majority vote determines outcome

#### **Step 4: Automated Fund Distribution**
11. **Voting Agent Processing**: Disaster Voting Agent `(ID: 6866646ff14ab5c885e4386d)` automatically:
    - **Aggregates votes** and determines consensus
    - **Executes blockchain transactions** for fund unlocking
    - **Updates claim status** in real-time
    - **Handles amount modifications** by resetting voting process
12. **Instant Execution**: Approved claims trigger immediate fund transfer to NGO wallets

#### **Step 5: Transparent Fund Tracking**
13. **Real-Time Updates**: All fund movements and allocations are tracked transparently on-chain
14. **Donation Impact**: Donors can see exactly how their contributions are being used for relief efforts
15. **Public Accountability**: Complete audit trail ensures funds reach intended recipients
16. **Community Oversight**: Ongoing monitoring and reporting of relief fund effectiveness


## 🤖 **Mosaia Integration**

God's Hand operates through an **Autonomous AI agent Ecosystem** that transforms disaster detection from reactive to proactive. Here's how our **disaster creation pipeline** works:

### 🔍 **Disaster Creation Pipeline Agents**

#### **1. Disaster Search Agent** `(mosaia ID: 68660a4aeef377abf1f7443f)`
- **Purpose**: Continuously monitors global news sources for natural disasters and tragic events using **EXA search**
- **Function**: Identifies breaking disaster events, extracts key details (title, description, location, source links), and triggers the pipeline workflow
- **📁 Line of Code**: [Disaster Search Agent](https://github.com/SamFelix03/Gods-Hand/blob/d5f5e57eed3797537fce0dba1f021af211e68293/Mosaia%20Agents/Disaster%20Creation%20Pipeline/main.py#L57-L76)

#### **2. BBOX Identifier Agent** `(mosaia ID: 6864d6cbca5744854d34c998)`
- **Purpose**: Converts textual disaster locations into precise geographical bounding boxes using the **Bounding Box Tool** `(mosaia ID: 6864d67fca5744854d34c8c6)`
- **Function**: Takes disaster location data and generates accurate latitude/longitude coordinates to define the affected geographical area
- **📁 Line of Code**: [BBOX Identifier Agent](https://github.com/SamFelix03/Gods-Hand/blob/d5f5e57eed3797537fce0dba1f021af211e68293/Mosaia%20Agents/Disaster%20Creation%20Pipeline/main.py#L78-L90)

#### **3. WeatherXM Agent** `(mosaia ID: 6864dd95ade4d61675d45e4d)`
- **Purpose**: Fetches real-time weather data from active weather stations within the disaster zone using **WeatherXM BBox Weather Tool** `(mosaia ID: 6864dcc425ddf4f7d390d91b)`
- **Function**: Provides crucial meteorological context including temperature, humidity, precipitation, wind patterns, and atmospheric conditions. This data provided by WeatherXM is **CRUCIAL** for our agent to make an informed decision on disaster severity
- **📁 Line of Code**: [WeatherXM Agent](https://github.com/SamFelix03/Gods-Hand/blob/d5f5e57eed3797537fce0dba1f021af211e68293/Mosaia%20Agents/Disaster%20Creation%20Pipeline/main.py#L92-L104)

#### **4. Disaster Analysis Agent** `(mosaia ID: 6866162ee2d11c774d448a27)`
- **Purpose**: Performs comprehensive disaster severity analysis by combining news data with weather intelligence to determine appropriate relief funding
- **Function**: Calculates required fund amounts in USD, assesses disaster impact severity, and provides detailed analysis for smart contract deployment
- **📁 Line of Code**: [Disaster Analysis Agent](https://github.com/SamFelix03/Gods-Hand/blob/d5f5e57eed3797537fce0dba1f021af211e68293/Mosaia%20Agents/Disaster%20Creation%20Pipeline/main.py#L106-L119)

#### **5. Tweet Agent** `(mosaia ID: 6864e70f77520411d032518a)`
- **Purpose**: Automatically generates and publishes disaster awareness content to Twitter using **Post to X Tool** `(mosaia ID: 6864e68268d0c18b74da20e7)`
- **Function**: Creates compelling tweets with disaster details, funding requirements, and source links to maximize public engagement and donations
- **📁 Line of Code**: [Tweet Agent](https://github.com/SamFelix03/Gods-Hand/blob/d5f5e57eed3797537fce0dba1f021af211e68293/Mosaia%20Agents/Disaster%20Creation%20Pipeline/main.py#L204-L215)

### 🗳️ **Verification Flow Architecture**

#### **6. Fact-Check Agent** `(mosaia ID: 686656aaf14ab5c885e431ce)`
- **Purpose**: Analyzes NGO funding requests using AI-powered fact-checking to verify legitimacy and determine appropriate funding amounts
- **Function**: Cross-references organization claims with disaster data, evaluates project feasibility, and calculates justified funding amounts based on evidence
- **📁 Line of Code**: [Fact Checking Agent](https://github.com/SamFelix03/Gods-Hand/blob/1dd11509d938f5811c93d6ada3397f10882080a9/Mosaia%20Agents/Voting-Verification%20Pipeline/main.py#L263-L291)

#### **7. Disaster Consensus Handling Agent** `(mosaia ID: 6866646ff14ab5c885e4386d)`
- **Purpose**: Processes community voting results and executes final funding decisions on the Flow blockchain
- **Function**: Aggregates verified votes, determines consensus, and automatically unlocks funds or rejects claims based on democratic decision-making
- **📁 Line of Code**: [Votes Handling Agent](https://github.com/SamFelix03/Gods-Hand/blob/1dd11509d938f5811c93d6ada3397f10882080a9/Mosaia%20Agents/Voting-Verification%20Pipeline/main.py#L565-L586)

### 🛠️ **Mosaia Tools Integration**

#### **1. BBOX Identifier Tool** `(mosaia ID: 6864d67fca5744854d34c8c6)`
**Purpose**: Translates a human-readable location (e.g., "Mumbai, India") into geographic coordinates and a bounding box, which defines the region's spatial extent.

**How it works**:
1. You send a location in human-readable format
2. The tool makes a request to the Geoapify API
3. The Boundary Box values of that specific location is returned, like this:
   
   ```
   min_latitude: minLat,
   max_latitude: maxLat,
   min_longitude: minLon,
   max_longitude: maxLon
   ```

**Required Environment Variables**:
- `Geoapify API Key`

**📁 Line of Code**: [BBOX Tool](https://github.com/SamFelix03/Gods-Hand/tree/main/Mosaia%20tools/bboxtool)

#### **2. WeatherXM Tool** `(mosaia ID: 6864dcc425ddf4f7d390d91b)`
**Purpose**: Integrates WeatherXM to provide real-time, hyperlocal weather data for disaster assessment and relief planning. The data collected from WeatherXM's decentralized network of weather stations is sent to the agent.

**How it works**:
1. Enter the bbox values of a specific location
2. Using the bounding box, the system queries the WeatherXM endpoint which returns a list of all weather stations located within the defined geographical bounds
3. The response is filtered to include only active stations, i.e., those that have reported recent weather data
4. Up to 5 randomly selected active stations are queried for their latest observations
5. Each response includes:
   - **Observation data**: temperature, precipitation, wind speed/gust, humidity, UV index, solar irradiance, etc.
   - **Location metadata**: latitude, longitude, elevation
   - **Health scores**: data quality, location accuracy
6. These details provide granular, real-time insights into the current weather conditions around a specific location

**Required Environment Variables**:
- `WeatherXM API key`

**📁 Line of Code**: [WeatherXM Tool](https://github.com/SamFelix03/Gods-Hand/tree/main/Mosaia%20tools/Mosaia-Weather-XM-Tool)

#### **3. Mosaia Twitter Poster Tool** `(mosaia ID: 6864e68268d0c18b74da20e7)`
**Purpose**: A Mosaia Tool that helps your agent post tweets using the Twitter API.

**What It Does**: This tool allows your Mosaia agent to post tweets by sending a message to the Twitter API using your account credentials.

**Required Environment Variables**:
- `TWITTER_API_KEY`
- `TWITTER_API_SECRET`
- `TWITTER_ACCESS_TOKEN`
- `TWITTER_ACCESS_SECRET`

**📁 Line of Code**: [Twitter Poster Tool](https://github.com/SamFelix03/Gods-Hand/tree/main/Mosaia%20tools/Mosaia-TweetPosting-Tool)


## 📄 **Smart Contract Integration**

### 📋 **Deployed Contract**
**🔗 Contract Address**: [Ethereum Sepolia Etherscan](https://sepolia.etherscan.io/address/0x07f9BFEb19F1ac572f6D69271261dDA1fD378D9A)
- **Network**: Ethereum Sepolia Testnet
- **Contract Name**: GodsHand
- **Deployment**: Verified and fully functional

### 🏗️ **Smart Contract Architecture**

#### **Core Functionalities**

##### **1. Disaster Management**
- **Disaster Creation**: AI agents create disaster relief campaigns with title, metadata, and target funding amount
- **Unique Identification**: Each disaster gets a unique bytes32 hash for immutable identification
- **Status Control**: Disasters can be activated/deactivated by authorized accounts
- **Metadata Storage**: Complete disaster information stored on-chain for transparency

##### **2. Donation System**
- **USDC Donations**: Users can donate USDC directly to specific disasters from any supported blockchain
- **Cross-Chain Support**: Circle CCTP v2 enables donations from 12+ blockchain networks
- **Contribution Tracking**: Individual donor contributions are tracked per disaster with timestamps
- **Funding Progress**: Real-time calculation of funding progress as percentage of target amount

##### **3. Fund Management & Distribution**
- **Secure Storage**: All donations are held securely in the smart contract
- **Democratic Distribution**: Community voting determines fund allocation to verified NGOs
- **Controlled Release**: Funds released only after community consensus approval
- **Audit Trail**: Complete transparency with immutable on-chain records

##### **4. Democratic Governance**
- **NGO Claims**: Relief organizations can submit funding requests with detailed proposals
- **Community Voting**: Verified users vote on fund allocation decisions
- **Consensus Mechanism**: Majority vote determines fund distribution
- **Transparent Process**: All voting and decisions recorded on-chain

**📁 Line of Code**: [GodsHand Smart Contract](https://github.com/SamFelix03/Gods-Hand/tree/main/Contract)


## 🌤️ WeatherXM Integration

WeatherXM powers the agent with real-time, hyperlocal weather data from WeatherXM's decentralized network of weather stations — serving as the primary and trusted data source for disaster detection, severity analysis, and fund allocation

#### Workflow Overview:
- The agent begins by receiving a bounding box (bbox) defining the geographical area of concern.
- It queries WeatherXM's API to locate all weather stations within this region.
- Only active stations—those providing recent and verifiable data—are considered.
- Up to five active stations are randomly sampled in the specified location.

Each station provides:
**Detailed weather observations**
- Temperature
- Feels Like
- Dew Point
- Humidity
- Wind Speed
- Wind Gust
- Wind Direction
- Pressure
- UV Index

The agent heavily relies on this granular, real-time data to:

- Evaluate the intensity and scope of the disaster, such as identifying flooding risks, wind damage potential, or heatwaves.
- Determine the urgency and severity of the situation in specific micro-locations.
- Autonomously calculate and allocate appropriate relief funding, ensuring aid reaches those most impacted.

## Line of Code
**📁 Line of Code**: [WeatherXM](https://github.com/SamFelix03/Gods-Hand/tree/main/Mosaia%20tools/Mosaia-Weather-XM-Tool)

## ⭕ **Circle CCTP v2 & Paymaster Integration**

God's Hand leverages Circle's Cross-Chain Transfer Protocol (CCTP) v2 with advanced Paymaster integration to enable seamless, gasless USDC donations across multiple blockchain networks — revolutionizing the cross-chain donation experience.

### 🌐 **Multi-Chain USDC Donation Support**

#### **Supported Networks**
- **Ethereum Sepolia** - Primary destination chain
- **Avalanche Fuji** - C-Chain testnet  
- **Base Sepolia** - Coinbase L2 testnet
- **Arbitrum Sepolia** - Arbitrum L2 testnet
- **Optimism Sepolia** - Optimism L2 testnet
- **Polygon Amoy** - Polygon testnet
- **Worldchain Sepolia** - Worldcoin L2 testnet
- **Unichain Sepolia** - Uniswap L2 testnet
- **Linea Sepolia** - ConsenSys L2 testnet
- **Sonic Blaze** - Sonic testnet
- **Codex Testnet** - Codex testnet
- **Sei Testnet** - Sei testnet

### ⚡ **USDC Gas Payments via EIP-7702 & Paymaster**
- **Unified Gas Token**: Donors pay all transaction fees using USDC instead of native tokens (ETH, AVAX, etc.)
- **EIP-7702 Smart Accounts**: Advanced account abstraction for seamless user experience
- **Automatic Gas Estimation**: Circle API integration for dynamic fee calculation
- **Bundle Transactions**: Single UserOperation handles approval, burn, attestation, and mint

### 🔄 **Seamless Cross-Chain Flow**
1. **Source Chain**: USDC approval and burning with USDC-paid gas
2. **Circle Attestation**: Automatic attestation retrieval from Circle's Iris API
3. **Destination Chain**: USDC minting on Ethereum Sepolia with paymaster gas coverage
4. **Smart Contract Recording**: Automatic donation recording on GodsHand contract

**📁 Line of Code**: [Circle CCTP v2 Integration](./src/hooks/use-cctp-v2.ts)