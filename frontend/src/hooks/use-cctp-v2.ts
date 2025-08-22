"use client";

import { useState } from "react";
import {
    createWalletClient,
    http,
    encodeFunctionData,
    HttpTransport,
    type Chain,
    type Account,
    type WalletClient,
    type Hex,
    TransactionExecutionError,
    parseUnits,
    createPublicClient,
    formatUnits,
    parseEther,
    formatEther,
    custom,
  } from "viem";

import { privateKeyToAccount, nonceManager } from "viem/accounts";
import axios from "axios";
import {
  sepolia,
  avalancheFuji,
  baseSepolia,
  sonicBlazeTestnet,
  lineaSepolia,
  arbitrumSepolia,
  worldchainSepolia,
  optimismSepolia,
  unichainSepolia,
  polygonAmoy,
  seiTestnet,
} from "viem/chains";
import { defineChain } from "viem";
import {
    SupportedChainId,
    CHAIN_IDS_TO_USDC_ADDRESSES,
    CHAIN_IDS_TO_TOKEN_MESSENGER,
    CHAIN_IDS_TO_MESSAGE_TRANSMITTER,
    DESTINATION_DOMAINS,
    CHAIN_TO_CHAIN_NAME,
    IRIS_API_URL,
    CHAIN_RPC_URLS,
  } from "@/lib/chains";
import { getBytes } from "ethers";
// Import paymaster utilities
import {
    createPaymasterConfig,
    createBundlerClientWithPaymaster,
    create7702SmartAccount,
  } from "@/lib/paymaster";

// Custom Codex chain definition with Thirdweb RPC
const codexTestnet = defineChain({
  id: 812242,
  name: "Codex Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Codex",
    symbol: "CDX",
  },
  rpcUrls: {
    default: {
      http: ["https://812242.rpc.thirdweb.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Codex Explorer",
      url: "https://explorer.codex-stg.xyz/",
    },
  },
  testnet: true,
});

// Custom chain definitions with proper RPCs
const customSepolia = defineChain({
  id: 11155111,
  name: "Ethereum Sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "Sepolia Ether",
    symbol: "SEP",
  },
  rpcUrls: {
    default: {
      http: ["https://eth-sepolia.g.alchemy.com/v2/NMsHzNgJ7XUYtzNyFpEJ8yT4muQ_lkRF"],
    },
  },
  blockExplorers: {
    default: {
      name: "Sepolia Etherscan",
      url: "https://sepolia.etherscan.io",
    },
  },
  testnet: true,
});

const customAvalancheFuji = defineChain({
  id: 43113,
  name: "Avalanche Fuji",
  nativeCurrency: {
    decimals: 18,
    name: "Avalanche",
    symbol: "AVAX",
  },
  rpcUrls: {
    default: {
      http: ["https://avax-fuji.g.alchemy.com/v2/NMsHzNgJ7XUYtzNyFpEJ8yT4muQ_lkRF"],
    },
  },
  blockExplorers: {
    default: {
      name: "Snowtrace",
      url: "https://testnet.snowtrace.io",
    },
  },
  testnet: true,
});

// Custom Base Sepolia chain with Alchemy RPC
const customBaseSepolia = defineChain({
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "Sepolia Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://base-sepolia.g.alchemy.com/v2/NMsHzNgJ7XUYtzNyFpEJ8yT4muQ_lkRF"],
    },
  },
  blockExplorers: {
    default: {
      name: "Base Sepolia Explorer",
      url: "https://sepolia.basescan.org",
    },
  },
  testnet: true,
});

// Custom Arbitrum Sepolia chain with proper RPC
const customArbitrumSepolia = defineChain({
  id: 421614,
  name: "Arbitrum Sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "Sepolia Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://arb-sepolia.g.alchemy.com/v2/NMsHzNgJ7XUYtzNyFpEJ8yT4muQ_lkRF"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arbitrum Sepolia Explorer",
      url: "https://sepolia.arbiscan.io",
    },
  },
  testnet: true,
});

export type TransferStep =
  | "idle"
  | "approving"
  | "burning"
  | "waiting-attestation"
  | "minting"
  | "completed"
  | "error";

const chains = {
  [SupportedChainId.ETH_SEPOLIA]: customSepolia,
  [SupportedChainId.AVAX_FUJI]: customAvalancheFuji,
  [SupportedChainId.BASE_SEPOLIA]: customBaseSepolia,
  [SupportedChainId.SONIC_BLAZE]: sonicBlazeTestnet,
  [SupportedChainId.LINEA_SEPOLIA]: lineaSepolia,
  [SupportedChainId.ARBITRUM_SEPOLIA]: customArbitrumSepolia,
  [SupportedChainId.WORLDCHAIN_SEPOLIA]: worldchainSepolia,
  [SupportedChainId.OPTIMISM_SEPOLIA]: optimismSepolia,
  [SupportedChainId.CODEX_TESTNET]: codexTestnet,
  [SupportedChainId.UNICHAIN_SEPOLIA]: unichainSepolia,
  [SupportedChainId.POLYGON_AMOY]: polygonAmoy,
  [SupportedChainId.SEI_TESTNET]: seiTestnet,
};


export interface TransactionHashes {
  approvalTx?: string;
  burnTx?: string;
  mintTx?: string;
  attestationHash?: string;
}

export function useCrossChainTransfer() {
  const [currentStep, setCurrentStep] = useState<TransferStep>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [senderPrivateKey, setSenderPrivateKey] = useState<string>(
    import.meta.env.VITE_EVM_PRIVATE_KEY || import.meta.env.VITE_PRIVATE_KEY || ""
  );
  const [transactionHashes, setTransactionHashes] = useState<TransactionHashes>({});

  const DEFAULT_DECIMALS = 6;

  const addLog = (message: string) =>
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);

  // Wallet connection functions
  const connectWallet = async () => {
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        }) as string[];
        
        if (accounts.length > 0) {
          setConnectedAddress(accounts[0]);
          setIsWalletConnected(true);
          addLog(`Wallet connected: ${accounts[0]}`);
          return accounts[0];
        }
      } else {
        throw new Error('MetaMask not detected');
      }
    } catch (error) {
      addLog(`Wallet connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  const disconnectWallet = () => {
    setConnectedAddress(null);
    setIsWalletConnected(false);
    addLog('Wallet disconnected');
  };

  // Check if wallet is already connected
  const checkWalletConnection = async () => {
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const accounts = await window.ethereum.request({
          method: 'eth_accounts',
        }) as string[];
        
        if (accounts.length > 0) {
          setConnectedAddress(accounts[0]);
          setIsWalletConnected(true);
          return accounts[0];
        }
      }
    } catch (error) {
      // Silent fail for check
    }
    return null;
  };


  // Utility function to get the appropriate private key for a chain
  const getPrivateKeyForChain = (chainId: number): string => {
    const evmKey =
      import.meta.env.VITE_EVM_PRIVATE_KEY ||
      import.meta.env.VITE_PRIVATE_KEY;
    if (!evmKey) {
      throw new Error(
        "EVM private key not found. Please set VITE_EVM_PRIVATE_KEY in your environment.",
      );
    }
    return evmKey;
  };

  // Utility function to get the gas payer private key for destination chain (Ethereum Sepolia)
  const getDestinationGasPayerPrivateKey = (): string => {
    const gasPayerKey = import.meta.env.VITE_DESTINATION_GAS_PAYER_PRIVATE_KEY;
    if (!gasPayerKey) {
      throw new Error(
        "Destination gas payer private key not found. Please set VITE_DESTINATION_GAS_PAYER_PRIVATE_KEY in your environment.",
      );
    }
    return gasPayerKey;
  };

  // Fetch proper fee from Circle's API
  const getProperBurnFee = async (
    sourceChainId: number,
    destinationChainId: number,
    amount: bigint,
  ): Promise<bigint> => {
    try {
      const sourceDomain = DESTINATION_DOMAINS[sourceChainId];
      const destinationDomain = DESTINATION_DOMAINS[destinationChainId];
      
      const url = `${IRIS_API_URL}/v2/burn/USDC/fees/${sourceDomain}/${destinationDomain}`;
      addLog(`Fetching burn fee from: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const feeData = response.data;
      
      addLog(`Fee API response: ${JSON.stringify(feeData, null, 2)}`);
      
      // The API returns minimumFee in basis points (bps)
      // 1 bps = 0.01%, so minimumFee = 1 means 0.01% of transfer amount
      const minimumFeeBps = feeData.data?.minimumFee || 1; // Default to 1 bps (0.01%)
      const finalityThreshold = feeData.data?.finalityThreshold || 1000;
      
      // Calculate fee as percentage of transfer amount
      // minimumFeeBps / 10000 = percentage (e.g., 1 bps = 0.0001 = 0.01%)
      const feePercentage = minimumFeeBps / 10000;
      const calculatedFee = (amount * BigInt(Math.floor(feePercentage * 10000))) / 10000n;
      
      // Ensure minimum fee of at least 0.1 USDC (100000 microUSDC)
      const minimumAbsoluteFee = 100000n;
      const recommendedFee = calculatedFee > minimumAbsoluteFee ? calculatedFee : minimumAbsoluteFee;
      
      addLog(`Minimum fee: ${minimumFeeBps} bps (${feePercentage * 100}%)`);
      addLog(`Calculated fee: ${calculatedFee} (${formatUnits(calculatedFee, DEFAULT_DECIMALS)} USDC)`);
      addLog(`Final maxFee: ${recommendedFee} (${formatUnits(recommendedFee, DEFAULT_DECIMALS)} USDC)`);
      addLog(`Finality threshold: ${finalityThreshold} blocks`);
      
      return recommendedFee;
    } catch (error) {
      addLog(`Fee API error: ${error instanceof Error ? error.message : "Unknown error"}`);
      // Fallback to a higher default fee if API fails
      const fallbackFee = 5000000n; // 5 USDC as fallback
      addLog(`Using fallback maxFee: ${fallbackFee} (${formatUnits(fallbackFee, DEFAULT_DECIMALS)} USDC)`);
      return fallbackFee;
    }
  };


  const getPublicClient = (chainId: SupportedChainId) => {
    return createPublicClient({
      chain: chains[chainId as keyof typeof chains],
      transport: http(),
    });
  };

  const getClients = (chainId: SupportedChainId) => {
    // For EVM chains, require connected MetaMask wallet
    if (!isWalletConnected || !connectedAddress) {
      throw new Error('Please connect your MetaMask wallet first');
    }

    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('MetaMask not detected');
    }

    return createWalletClient({
      chain: chains[chainId as keyof typeof chains],
      transport: custom(window.ethereum),
    });
  };

  const getBalance = async (chainId: SupportedChainId) => {
    return getEVMBalance(chainId);
  };


  const getEVMBalance = async (chainId: SupportedChainId) => {
    if (!isWalletConnected || !connectedAddress) {
      return "0"; // Return 0 if wallet not connected
    }

    const publicClient = createPublicClient({
      chain: chains[chainId as keyof typeof chains],
      transport: http(),
    });

    const balance = await publicClient.readContract({
      address: CHAIN_IDS_TO_USDC_ADDRESSES[chainId] as `0x${string}`,
      abi: [
        {
          constant: true,
          inputs: [{ name: "_owner", type: "address" }],
          name: "balanceOf",
          outputs: [{ name: "balance", type: "uint256" }],
          payable: false,
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "balanceOf",
      args: [connectedAddress as `0x${string}`],
    });

    const formattedBalance = formatUnits(balance, DEFAULT_DECIMALS);
    return formattedBalance;
  };

  // Utility function to check USDC allowance
  const checkUSDCAllowance = async (
    chainId: SupportedChainId,
    spenderAddress: string,
  ) => {
    if (!isWalletConnected || !connectedAddress) {
      throw new Error('Please connect your MetaMask wallet first');
    }
    
    const publicClient = createPublicClient({
      chain: chains[chainId as keyof typeof chains],
      transport: http(),
    });
    
    const allowance = await publicClient.readContract({
      address: CHAIN_IDS_TO_USDC_ADDRESSES[chainId] as `0x${string}`,
      abi: [
        {
          constant: true,
          inputs: [
            { name: "_owner", type: "address" },
            { name: "_spender", type: "address" }
          ],
          name: "allowance",
          outputs: [{ name: "allowance", type: "uint256" }],
          payable: false,
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "allowance",
      args: [connectedAddress as `0x${string}`, spenderAddress as `0x${string}`],
    });
    
    return allowance > 0n;
  };

  // EVM functions with USDC gas payment
  const approveUSDC = async (
    client: WalletClient<HttpTransport, Chain, Account>,
    sourceChainId: number,
  ) => {
    setCurrentStep("approving");
    addLog("Approving USDC transfer...");

    try {
      if (!senderPrivateKey) {
        throw new Error("Please enter your private key");
      }

      // Create 7702 smart account using entered private key
      const publicClient = createPublicClient({
        chain: chains[sourceChainId as keyof typeof chains],
        transport: http(),
      });
      
      const { account: smartAccount, owner } = await create7702SmartAccount({
        privateKey: senderPrivateKey,
        client: publicClient,
      });

      addLog(`Smart Account Address: ${smartAccount.address}`);
      addLog(`Sender Address: ${owner.address}`);

      // Create paymaster configuration for USDC gas payment
      const paymaster = createPaymasterConfig({
        usdcAddress: CHAIN_IDS_TO_USDC_ADDRESSES[sourceChainId] as `0x${string}`,
        account: smartAccount,
        client: publicClient,
      });

      // Create bundler client with paymaster
      const bundlerClient = createBundlerClientWithPaymaster({
        account: smartAccount,
        client: publicClient,
        paymaster,
      });

      // EIP-7702 authorization for this nonce window
      const authorization = await owner.signAuthorization({
        chainId: publicClient.chain.id,
        nonce: await publicClient.getTransactionCount({ address: owner.address }),
        contractAddress: smartAccount.authorization.address,
      });

      addLog("Sending USDC approval with USDC gas payment...");

      // Send the user operation for approval
      // @ts-ignore
      const uoHash = await bundlerClient.sendUserOperation({
        account: smartAccount,
        calls: [
          {
            to: CHAIN_IDS_TO_USDC_ADDRESSES[sourceChainId] as `0x${string}`,
            abi: [
              {
                type: "function",
                name: "approve",
                stateMutability: "nonpayable",
                inputs: [
                  { name: "spender", type: "address" },
                  { name: "amount", type: "uint256" },
                ],
                outputs: [{ name: "", type: "bool" }],
              },
            ],
            functionName: "approve",
            args: [
              CHAIN_IDS_TO_TOKEN_MESSENGER[sourceChainId] as `0x${string}`,
              10000000000n,
            ],
          },
        ],
        authorization,
      });

      addLog(`USDC Approval UserOperation hash: ${uoHash}`);
      
      // Wait for inclusion
      const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: uoHash });
      const approvalTxHash = receipt.receipt.transactionHash;
      
      // Store the approval transaction hash
      setTransactionHashes(prev => ({ ...prev, approvalTx: approvalTxHash }));
      
      addLog(`✅ USDC approval confirmed: ${approvalTxHash}`);
      
      if (receipt.success) {
        addLog("USDC approval completed successfully!");
      } else {
        throw new Error("USDC approval failed");
      }
      
      return approvalTxHash;
    } catch (err) {
      setError("Approval failed");
      throw err;
    }
  };


  const burnUSDC = async (
    client: WalletClient<HttpTransport, Chain, Account>,
    sourceChainId: number,
    amount: bigint,
    destinationChainId: number,
    destinationAddress: string,
    transferType: "fast" | "standard",
  ) => {
    setCurrentStep("burning");
    addLog("Burning USDC...");

    try {
      // Validate amount
      if (amount <= 0n) {
        throw new Error("Invalid amount: must be greater than 0");
      }
      
      const finalityThreshold = transferType === "fast" ? 1000 : 2000;
      
      // Get proper fee from Circle's API
      const maxFee = await getProperBurnFee(sourceChainId, destinationChainId, amount);
      
      // Validate that we have enough USDC for transfer + fee
      if (amount <= maxFee) {
        throw new Error(`Insufficient amount. Need at least ${formatUnits(maxFee, DEFAULT_DECIMALS)} USDC for fees`);
      }
      
      addLog(`Amount: ${amount}, MaxFee: ${maxFee}, FinalityThreshold: ${finalityThreshold}`);

      // For EVM destinations, pad the hex address
      const mintRecipient = `0x${destinationAddress
        .replace(/^0x/, "")
        .padStart(64, "0")}`;

      if (!senderPrivateKey) {
        throw new Error("Please enter your private key");
      }

      // Create 7702 smart account using entered private key
      const publicClient = createPublicClient({
        chain: chains[sourceChainId as keyof typeof chains],
        transport: http(),
      });
      
      const { account: smartAccount, owner } = await create7702SmartAccount({
        privateKey: senderPrivateKey,
        client: publicClient,
      });

      addLog(`Smart Account Address: ${smartAccount.address}`);

      // Create paymaster configuration for USDC gas payment
      const paymaster = createPaymasterConfig({
        usdcAddress: CHAIN_IDS_TO_USDC_ADDRESSES[sourceChainId] as `0x${string}`,
        account: smartAccount,
        client: publicClient,
      });

      // Create bundler client with paymaster
      const bundlerClient = createBundlerClientWithPaymaster({
        account: smartAccount,
        client: publicClient,
        paymaster,
      });

      addLog("Sending USDC burn with USDC gas payment...");

      // EIP-7702 authorization for this nonce window
      const authorization = await owner.signAuthorization({
        chainId: publicClient.chain.id,
        nonce: await publicClient.getTransactionCount({ address: owner.address }),
        contractAddress: smartAccount.authorization.address,
      });

      // Send the user operation for burning
      const uoHash = await bundlerClient.sendUserOperation({
        account: smartAccount,
        calls: [
          {
            to: CHAIN_IDS_TO_TOKEN_MESSENGER[sourceChainId] as `0x${string}`,
            abi: [
              {
                type: "function",
                name: "depositForBurn",
                stateMutability: "nonpayable",
                inputs: [
                  { name: "amount", type: "uint256" },
                  { name: "destinationDomain", type: "uint32" },
                  { name: "mintRecipient", type: "bytes32" },
                  { name: "burnToken", type: "address" },
                  { name: "hookData", type: "bytes32" },
                  { name: "maxFee", type: "uint256" },
                  { name: "finalityThreshold", type: "uint32" },
                ],
                outputs: [],
              },
            ],
            functionName: "depositForBurn",
            args: [
              amount,
              DESTINATION_DOMAINS[destinationChainId],
              mintRecipient as Hex,
              CHAIN_IDS_TO_USDC_ADDRESSES[sourceChainId] as `0x${string}`,
              "0x0000000000000000000000000000000000000000000000000000000000000000",
              maxFee,
              finalityThreshold,
            ],
          },
        ],
        authorization,
      });

      addLog(`Burn UserOperation hash: ${uoHash}`);
      
      // Wait for inclusion
      const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: uoHash });
      const burnTxHash = receipt.receipt.transactionHash;
      
      // Store the burn transaction hash
      setTransactionHashes(prev => ({ ...prev, burnTx: burnTxHash }));
      
      addLog(`🔥 USDC burn confirmed: ${burnTxHash}`);
      addLog("USDC successfully burned on source chain!");
      
      return burnTxHash;
    } catch (err) {
      setError("Burn failed");
      throw err;
    }
  };


  const retrieveAttestation = async (
    transactionHash: string,
    sourceChainId: number,
  ) => {
    setCurrentStep("waiting-attestation");
    addLog("Retrieving attestation...");
    addLog(`Source domain: ${DESTINATION_DOMAINS[sourceChainId]}`);
    addLog(`Transaction hash: ${transactionHash}`);

    const url = `${IRIS_API_URL}/v2/messages/${DESTINATION_DOMAINS[sourceChainId]}?transactionHash=${transactionHash}`;
    addLog(`IRIS API URL: ${url}`);

    let attemptCount = 0;
    while (true) {
      attemptCount++;
      try {
        addLog(`Attempt ${attemptCount}: Checking attestation...`);
        const response = await axios.get(url);
        
        addLog(`Response status: ${response.status}`);
        addLog(`Response data: ${JSON.stringify(response.data, null, 2)}`);
        
        if (response.data?.messages?.[0]?.status === "complete") {
          const message = response.data.messages[0];
          // Store the attestation hash
          setTransactionHashes(prev => ({ ...prev, attestationHash: message.attestation }));
          
          addLog("📋 Attestation retrieved successfully!");
          addLog(`Attestation hash: ${message.attestation.substring(0, 20)}...`);
          return message;
        } else if (response.data?.messages?.[0]?.status) {
          addLog(`Current status: ${response.data.messages[0].status}`);
        } else {
          addLog("No messages found yet, waiting...");
        }
        
        addLog("Waiting 10 seconds before next attempt...");
        await new Promise((resolve) => setTimeout(resolve, 10000));
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          addLog(`Attempt ${attemptCount}: No attestation found yet (404), waiting...`);
          await new Promise((resolve) => setTimeout(resolve, 10000));
          continue;
        }
        setError("Attestation retrieval failed");
        addLog(
          `Attestation error on attempt ${attemptCount}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        throw error;
      }
    }
  };

  // Direct USDC transfer for same-chain operations (ETH Sepolia to ETH Sepolia)
  const directUSDCTransfer = async (
    sourceChainId: number,
    amount: bigint,
    destinationAddress: string,
  ) => {
    setCurrentStep("approving");
    addLog("Executing direct USDC transfer (same chain)...");

    try {
      if (!senderPrivateKey) {
        throw new Error("Please enter your private key");
      }

      // Create 7702 smart account using entered private key
      const publicClient = createPublicClient({
        chain: chains[sourceChainId as keyof typeof chains],
        transport: http(),
      });
      
      const { account: smartAccount, owner } = await create7702SmartAccount({
        privateKey: senderPrivateKey,
        client: publicClient,
      });

      addLog(`Smart Account Address: ${smartAccount.address}`);
      addLog(`Transferring ${formatUnits(amount, DEFAULT_DECIMALS)} USDC to: ${destinationAddress}`);

      // Create paymaster configuration for USDC gas payment
      const paymaster = createPaymasterConfig({
        usdcAddress: CHAIN_IDS_TO_USDC_ADDRESSES[sourceChainId] as `0x${string}`,
        account: smartAccount,
        client: publicClient,
      });

      // Create bundler client with paymaster
      const bundlerClient = createBundlerClientWithPaymaster({
        account: smartAccount,
        client: publicClient,
        paymaster,
      });

      // EIP-7702 authorization for this nonce window
      const authorization = await owner.signAuthorization({
        chainId: publicClient.chain.id,
        nonce: await publicClient.getTransactionCount({ address: owner.address }),
        contractAddress: smartAccount.authorization.address,
      });

      addLog("Sending direct USDC transfer with USDC gas payment...");

      // Send the user operation for direct transfer
      // @ts-ignore
      const uoHash = await bundlerClient.sendUserOperation({
        account: smartAccount,
        calls: [
          {
            to: CHAIN_IDS_TO_USDC_ADDRESSES[sourceChainId] as `0x${string}`,
            abi: [
              {
                type: "function",
                name: "transfer",
                stateMutability: "nonpayable",
                inputs: [
                  { name: "to", type: "address" },
                  { name: "amount", type: "uint256" },
                ],
                outputs: [{ name: "", type: "bool" }],
              },
            ],
            functionName: "transfer",
            args: [
              destinationAddress as `0x${string}`,
              amount,
            ],
          },
        ],
        authorization,
      });

      addLog(`Direct transfer UserOperation hash: ${uoHash}`);
      
      // Wait for inclusion
      const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: uoHash });
      const transferHash = receipt.receipt.transactionHash;
      
      // Store the transaction hash
      setTransactionHashes(prev => ({ ...prev, burnTx: transferHash }));
      
      addLog(`Direct transfer transaction hash: ${transferHash}`);
      
      if (receipt.success) {
        setCurrentStep("completed");
        addLog("Direct USDC transfer completed successfully!");
      } else {
        throw new Error("Direct USDC transfer failed");
      }
      
      return transferHash;
    } catch (err) {
      setError("Direct transfer failed");
      addLog(`Direct transfer error: ${err instanceof Error ? err.message : "Unknown error"}`);
      throw err;
    }
  };

  const mintUSDC = async (
    client: WalletClient<HttpTransport, Chain, Account>,
    destinationChainId: number,
    attestation: any,
  ) => {
    const MAX_RETRIES = 3;
    let retries = 0;
    setCurrentStep("minting");
    addLog("Minting USDC...");

    while (retries < MAX_RETRIES) {
      try {
        // Create 7702 smart account for gas payer (separate from receiver)
        const gasPayerPrivateKey = getDestinationGasPayerPrivateKey();
        const publicClient = createPublicClient({
          chain: chains[destinationChainId as keyof typeof chains],
          transport: http(),
        });
        
        const { account: gasPayerSmartAccount, owner: gasPayerOwner } = await create7702SmartAccount({
          privateKey: gasPayerPrivateKey,
          client: publicClient,
        });

        addLog(`Gas Payer Smart Account Address: ${gasPayerSmartAccount.address}`);
        addLog(`Minting USDC to destination address (receiver will get the tokens)`);

        // Create paymaster configuration for USDC gas payment (from gas payer's USDC)
        const paymaster = createPaymasterConfig({
          usdcAddress: CHAIN_IDS_TO_USDC_ADDRESSES[destinationChainId] as `0x${string}`,
          account: gasPayerSmartAccount,
          client: publicClient,
        });

        // Create bundler client with paymaster
        const bundlerClient = createBundlerClientWithPaymaster({
          account: gasPayerSmartAccount,
          client: publicClient,
          paymaster,
        });

        // EIP-7702 authorization for gas payer
        const authorization = await gasPayerOwner.signAuthorization({
          chainId: publicClient.chain.id,
          nonce: await publicClient.getTransactionCount({ address: gasPayerOwner.address }),
          contractAddress: gasPayerSmartAccount.authorization.address,
        });

        addLog("Sending USDC mint with gas payer's USDC...");

        // Send the user operation for minting
        const uoHash = await bundlerClient.sendUserOperation({
          account: gasPayerSmartAccount,
          calls: [
            {
              to: CHAIN_IDS_TO_MESSAGE_TRANSMITTER[destinationChainId] as `0x${string}`,
              abi: [
                {
                  type: "function",
                  name: "receiveMessage",
                  stateMutability: "nonpayable",
                  inputs: [
                    { name: "message", type: "bytes" },
                    { name: "attestation", type: "bytes" },
                  ],
                  outputs: [],
                },
              ],
              functionName: "receiveMessage",
              args: [attestation.message, attestation.attestation],
            },
          ],
          authorization,
        });

        addLog(`Mint UserOperation hash: ${uoHash}`);
        
        // Wait for inclusion
        const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: uoHash });
        const mintTxHash = receipt.receipt.transactionHash;
        
        // Store the mint transaction hash
        setTransactionHashes(prev => ({ ...prev, mintTx: mintTxHash }));
        
        addLog(`✨ USDC mint confirmed: ${mintTxHash}`);
        
        if (receipt.success) {
          setCurrentStep("completed");
          addLog("🎉 Cross-chain transfer completed successfully!");
        } else {
          throw new Error("USDC mint failed");
        }
        
        break;
      } catch (err) {
        if (err instanceof TransactionExecutionError && retries < MAX_RETRIES) {
          retries++;
          addLog(`Retry ${retries}/${MAX_RETRIES}...`);
          await new Promise((resolve) => setTimeout(resolve, 2000 * retries));
          continue;
        }
        
        // Log detailed error information
        addLog(`Mint failed with error: ${err instanceof Error ? err.message : "Unknown error"}`);
        if (err instanceof TransactionExecutionError) {
          addLog(`Transaction execution error details: ${err.details}`);
        }
        throw err;
      }
    }
  };


  const executeTransfer = async (
    sourceChainId: number,
    amount: string,
    transferType: "fast" | "standard",
    destinationAddress?: string,
  ) => {
    try {
      // Validate private key is available
      if (!senderPrivateKey) {
        throw new Error("Private key not configured. Please set VITE_EVM_PRIVATE_KEY in your environment.");
      }

      const numericAmount = parseUnits(amount, DEFAULT_DECIMALS);
      const destinationChainId = SupportedChainId.ETH_SEPOLIA;
      
      addLog(`Processing transfer: ${amount} USDC (${numericAmount} wei)`);
      addLog(`Source: ${CHAIN_TO_CHAIN_NAME[sourceChainId]}, Destination: ${CHAIN_TO_CHAIN_NAME[destinationChainId]}`);

      // Special case: If source is Ethereum Sepolia, do direct token transfer
      if (sourceChainId === SupportedChainId.ETH_SEPOLIA) {
        addLog("Source is Ethereum Sepolia - performing direct USDC transfer");
        if (!destinationAddress) {
          throw new Error("Destination address is required for direct transfer");
        }
        await directUSDCTransfer(sourceChainId, numericAmount, destinationAddress);
        return;
      }

      let sourceClient: any, destinationClient: any, finalDestination: string;

      // Get source client
      sourceClient = getClients(sourceChainId);

      // Get destination client (always Ethereum Sepolia)
      destinationClient = getClients(destinationChainId);

      // Use provided destination address or derive from private key as fallback
      if (destinationAddress) {
        finalDestination = destinationAddress;
        addLog(`Using custom destination address: ${finalDestination}`);
      } else {
        // Destination is always Ethereum Sepolia (EVM), so get EVM address
        const destinationPrivateKey = getPrivateKeyForChain(destinationChainId);
        const account = privateKeyToAccount(
          `0x${destinationPrivateKey.replace(/^0x/, "")}`,
        );
        finalDestination = account.address;
        addLog(`Using derived destination address: ${finalDestination}`);
      }

      // Check native balance for destination chain
      const checkNativeBalance = async (chainId: SupportedChainId) => {
        const publicClient = createPublicClient({
          chain: chains[chainId as keyof typeof chains],
          transport: http(),
        });
        const privateKey = getPrivateKeyForChain(chainId);
        const account = privateKeyToAccount(
          `0x${privateKey.replace(/^0x/, "")}`,
        );
        const balance = await publicClient.getBalance({
          address: account.address,
        });
        return balance;
      };

      // Execute approve step
      await approveUSDC(sourceClient, sourceChainId);
      // Add a small delay to ensure nonce is properly updated
      addLog("Waiting for nonce update...");
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify the approval was successful
      const spenderAddress = CHAIN_IDS_TO_TOKEN_MESSENGER[sourceChainId] as string;
      const allowanceConfirmed = await checkUSDCAllowance(sourceChainId, spenderAddress);
      
      if (!allowanceConfirmed) {
        throw new Error("USDC approval verification failed - allowance not set");
      }
      addLog("USDC allowance verified successfully!");

      // Execute burn step
      const burnTx = await burnUSDC(
        sourceClient,
        sourceChainId,
        numericAmount,
        destinationChainId,
        finalDestination,
        transferType,
      );

      // Retrieve attestation
      const attestation = await retrieveAttestation(burnTx, sourceChainId);

      // Execute mint step (always Ethereum Sepolia - EVM)
      await mintUSDC(destinationClient, destinationChainId, attestation);
    } catch (error) {
      setCurrentStep("error");
      addLog(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const reset = () => {
    setCurrentStep("idle");
    setLogs([]);
    setError(null);
    setTransactionHashes({});
  };

  return {
    currentStep,
    logs,
    error,
    executeTransfer,
    getBalance,
    reset,
    connectWallet,
    disconnectWallet,
    checkWalletConnection,
    connectedAddress,
    isWalletConnected,
    senderPrivateKey,
    setSenderPrivateKey,
    transactionHashes,
  };
}
