import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import dotenv from "dotenv";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./constants";


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


// CoinMarketCap API configuration
const CMC_API_KEY = process.env.VITE_CMC_API_KEY;
const CMC_BASE_URL = "https://pro-api.coinmarketcap.com/v2/tools/price-conversion";

// Alternative: CoinGecko API (no API key required, CORS-friendly)
const COINGECKO_API_URL = "https://api.coingecko.com/api/v3/simple/price";

/**
 * Convert USD amount to FLOW tokens using CoinGecko API (CORS-friendly)
 * @param usdAmount - Amount in USD to convert
 * @returns Promise<number> - Equivalent amount in FLOW tokens
 */
export async function convertUsdToFlow(usdAmount: number): Promise<number> {
  try {
    // Use CoinGecko API which is CORS-friendly and doesn't require API key
    const response = await fetch(
      `${COINGECKO_API_URL}?ids=flow&vs_currencies=usd`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // CoinGecko returns: { "flow": { "usd": price_in_usd } }
    if (data.flow && data.flow.usd) {
      const flowPriceInUsd = data.flow.usd;
      const flowAmount = usdAmount / flowPriceInUsd;
      return flowAmount;
    } else {
      throw new Error("Invalid API response structure - FLOW price not found");
    }
  } catch (error) {
    console.error("Error converting USD to FLOW:", error);
    // Fallback rate in case of API failure
    // You should update this based on current market rates
    return usdAmount * 2.97; // 1 USD = 2.97 FLOW (approximate fallback)
  }
}

/**
 * Alternative conversion function using CoinMarketCap via CORS proxy
 * (Only use if you set up a backend proxy)
 */
// export async function convertUsdToFlowViaCMC(usdAmount: number): Promise<number> {
//   if (!CMC_API_KEY) {
//     console.warn("CoinMarketCap API key not found, using fallback rate");
//     return usdAmount * 2.97;
//   }

//   try {
//     // This would require a backend proxy to avoid CORS
//     const response = await fetch('/api/convert-currency', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({
//         amount: usdAmount,
//         from: 'USD',
//         to: 'FLOW'
//       }),
//     });

//     if (!response.ok) {
//       throw new Error(`HTTP error! status: ${response.status}`);
//     }

//     const data = await response.json();
//     return data.convertedAmount;
//   } catch (error) {
//     console.error("Error converting USD to FLOW via CMC:", error);
//     return usdAmount * 2.97;
//   }
// }

/**
 * Format FLOW amount for display
 * @param flowAmount - Amount in FLOW tokens
 * @returns string - Formatted FLOW amount
 */
export function formatFlowAmount(flowAmount: number): string {
  return `${flowAmount.toFixed(6)} FLOW`;
}

// Flow donation fetching
export async function fetchRecentDonations(disasterHash: string): Promise<{
  donor: string;
  amount: string;
  timestamp: string;
  formattedTime: string;
}[]> {
  try {
    if (!window.ethereum) {
      console.warn("MetaMask not available for fetching donations");
      return [];
    }

    // Ensure disaster hash has 0x prefix
    let formattedDisasterHash = disasterHash;
    if (!disasterHash.startsWith('0x')) {
      formattedDisasterHash = '0x' + disasterHash;
    }

    // Create provider and contract instance
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    try {
      // Try to get donations using the getDisasterDonations function
      const donations = await contract.getDisasterDonations(formattedDisasterHash);
      
      return donations.map((donation: any, index: number) => {
        const donor = donation.donor || donation[0];
        const amount = donation.amount || donation[1];
        const timestamp = donation.timestamp || donation[2];
        
        // Format the donor address for privacy (show first 6 and last 4 characters)
        const formattedDonor = `${donor.substring(0, 6)}...${donor.substring(38)}`;
        
        // Format amount in FLOW
        const formattedAmount = parseFloat(ethers.formatEther(amount)).toFixed(4);
        
        // Format timestamp
        const date = new Date(Number(timestamp) * 1000);
        const formattedTime = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        
        return {
          donor: formattedDonor,
          amount: `${formattedAmount} FLOW`,
          timestamp: timestamp.toString(),
          formattedTime
        };
      });
    } catch (contractError) {
      console.warn("Contract call failed, trying event logs:", contractError);
      
      // Fallback: Try to get recent DonationMade events
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000); // Look back 10k blocks
      
      // Create event filter for DonationMade events for this disaster
      const filter = {
        address: CONTRACT_ADDRESS,
        topics: [
          ethers.id("DonationMade(bytes32,address,uint256,uint256)"),
          formattedDisasterHash // Filter by disaster hash
        ],
        fromBlock,
        toBlock: 'latest'
      };
      
      const logs = await provider.getLogs(filter);
      
      // Parse the logs to extract donation data
      return logs.map((log, index) => {
        try {
          const decoded = contract.interface.parseLog(log);
          if (decoded && decoded.args) {
            const donor = decoded.args.donor;
            const amount = decoded.args.amount;
            
            // Format the donor address for privacy
            const formattedDonor = `${donor.substring(0, 6)}...${donor.substring(38)}`;
            
            // Format amount in FLOW
            const formattedAmount = parseFloat(ethers.formatEther(amount)).toFixed(4);
            
            // Get block timestamp (this requires another call, so we'll use block number as fallback)
            const formattedTime = `Block #${log.blockNumber}`;
            
            return {
              donor: formattedDonor,
              amount: `${formattedAmount} FLOW`,
              timestamp: log.blockNumber.toString(),
              formattedTime
            };
          }
        } catch (parseError) {
          console.warn("Failed to parse log:", parseError);
        }
        
        return {
          donor: "Unknown",
          amount: "0 FLOW",
          timestamp: "0",
          formattedTime: "Unknown"
        };
      }).filter(donation => donation.donor !== "Unknown");
    }
  } catch (error) {
    console.error("Failed to fetch donations:", error);
    return [];
  }
}
