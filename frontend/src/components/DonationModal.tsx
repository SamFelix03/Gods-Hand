"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {  parseEther } from "viem";
import { EmbeddedWallet } from "./embedded-wallet"; // Adjust path


interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventTitle: string;
  disasterHash: string;
}

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

interface AztecTestAccount {
  id: number;
  name: string;
  description: string;
}

interface ChainConfig {
  id: string;
  name: string;
  displayName: string;
  chainId: string;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  icon: React.ReactNode;
  description: string;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export default function DonationModal({
  isOpen,
  onClose,
  eventTitle,
  disasterHash,
}: DonationModalProps) {
  const [step, setStep] = useState<"wallet" | "chain" | "aztec-accounts" | "amount">(
    "wallet"
  );
  const [donationAmount, setDonationAmount] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>("");
  const [connectedWallet, setConnectedWallet] = useState<string>("");
  const [connectedAccount, setConnectedAccount] = useState<string>("");
  const [selectedChain, setSelectedChain] = useState<ChainConfig | null>(null);

  // Aztec specific state
  const [embeddedWallet, setEmbeddedWallet] = useState<EmbeddedWallet | null>(
    null
  );
  const [selectedTestAccount, setSelectedTestAccount] =
    useState<AztecTestAccount | null>(null);
  const [isFauceting, setIsFauceting] = useState(false);

  // Chain configurations for testnets
  const supportedChains: ChainConfig[] = [
    {
      id: "ethereum",
      name: "Ethereum Sepolia",
      displayName: "Ethereum",
      chainId: "0xaa36a7",
      rpcUrl: "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      blockExplorer: "https://sepolia.etherscan.io",
      nativeCurrency: {
        name: "Sepolia Ether",
        symbol: "ETH",
        decimals: 18,
      },
      icon: <img src="/chain-logo/ethereum.png" alt="Ethereum" className="w-6 h-6" />,
      description: "Ethereum Sepolia Testnet"
    },
    {
      id: "arbitrum",
      name: "Arbitrum Sepolia",
      displayName: "Arbitrum",
      chainId: "0x66eee",
      rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
      blockExplorer: "https://sepolia.arbiscan.io",
      nativeCurrency: {
        name: "Arbitrum Sepolia Ether",
        symbol: "ETH",
        decimals: 18,
      },
      icon: <img src="/chain-logo/arbitrum.png" alt="Arbitrum" className="w-6 h-6" />,
      description: "Arbitrum Sepolia Testnet"
    },
    {
      id: "polygon",
      name: "Polygon Amoy",
      displayName: "Polygon",
      chainId: "0x13882",
      rpcUrl: "https://rpc-amoy.polygon.technology",
      blockExplorer: "https://amoy.polygonscan.com",
      nativeCurrency: {
        name: "MATIC",
        symbol: "MATIC",
        decimals: 18,
      },
      icon: <img src="/chain-logo/polygon.png" alt="Polygon" className="w-6 h-6" />,
      description: "Polygon Amoy Testnet"
    },
    {
      id: "avalanche",
      name: "Avalanche Fuji",
      displayName: "Avalanche",
      chainId: "0xa869",
      rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
      blockExplorer: "https://testnet.snowtrace.io",
      nativeCurrency: {
        name: "Avalanche",
        symbol: "AVAX",
        decimals: 18,
      },
      icon: <img src="/chain-logo/avalanche.png" alt="Avalanche" className="w-6 h-6" />,
      description: "Avalanche Fuji Testnet"
    },
    {
      id: "base",
      name: "Base Sepolia",
      displayName: "Base",
      chainId: "0x14a34",
      rpcUrl: "https://sepolia.base.org",
      blockExplorer: "https://sepolia.basescan.org",
      nativeCurrency: {
        name: "Sepolia Ether",
        symbol: "ETH",
        decimals: 18,
      },
      icon: <img src="/chain-logo/base.png" alt="Base" className="w-6 h-6" />,
      description: "Base Sepolia Testnet"
    },
    {
      id: "bnb",
      name: "BNB Smart Chain Testnet",
      displayName: "BNB Chain",
      chainId: "0x61",
      rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
      blockExplorer: "https://testnet.bscscan.com",
      nativeCurrency: {
        name: "Binance Coin",
        symbol: "tBNB",
        decimals: 18,
      },
      icon: <img src="/chain-logo/bnb.png" alt="BNB" className="w-6 h-6" />,
      description: "BNB Smart Chain Testnet"
    }
  ];

  // Your test accounts
  const testAccounts: AztecTestAccount[] = [
    {
      id: 1,
      name: "User Account",
      description: "Test account for user donations",
    },
    {
      id: 2,
      name: "NGO Account",
      description: "Test account for NGOs accepting donations",
    },
    {
      id: 3,
      name: "User Two Account",
      description: "Test account two for user donations",
    },
  ];

  // Contract configuration
  const DUMMY_CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890";
  const nodeUrl =
    process.env.REACT_APP_AZTEC_NODE_URL || "http://localhost:8080";

  const initializeEmbeddedWallet = async () => {
    try {
      const wallet = new EmbeddedWallet(nodeUrl);
      await wallet.initialize();
      setEmbeddedWallet(wallet);
      return wallet;
    } catch (error) {
      console.error("Failed to initialize embedded wallet:", error);
      throw error;
    }
  };

  const switchToChain = async (chain: ChainConfig) => {
    if (!window.ethereum) {
      setConnectionStatus("MetaMask not found");
      return false;
    }

    try {
      setConnectionStatus(`Switching to ${chain.displayName}...`);
      
      // Try to switch to the chain
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chain.chainId }],
      });

      setSelectedChain(chain);
      setConnectionStatus(`Connected to ${chain.displayName}!`);
      
      setTimeout(() => {
        setStep("amount");
        setConnectionStatus("");
        setIsConnecting(false);
      }, 1500);
      
      return true;
    } catch (switchError: any) {
      // Chain doesn't exist in MetaMask, add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: chain.chainId,
                chainName: chain.name,
                nativeCurrency: chain.nativeCurrency,
                rpcUrls: [chain.rpcUrl],
                blockExplorerUrls: [chain.blockExplorer],
              },
            ],
          });

          setSelectedChain(chain);
          setConnectionStatus(`Added and connected to ${chain.displayName}!`);
          
          setTimeout(() => {
            setStep("amount");
            setConnectionStatus("");
            setIsConnecting(false);
          }, 1500);
          
          return true;
        } catch (addError) {
          console.error("Failed to add chain:", addError);
          setConnectionStatus(`Failed to add ${chain.displayName} network`);
          setIsConnecting(false);
          return false;
        }
      } else {
        console.error("Failed to switch chain:", switchError);
        setConnectionStatus(`Failed to switch to ${chain.displayName}`);
        setIsConnecting(false);
        return false;
      }
    }
  };

  const selectChain = async (chain: ChainConfig) => {
    setIsConnecting(true);
    await switchToChain(chain);
  };

  const selectTestAccount = async (account: AztecTestAccount) => {
    setIsConnecting(true);
    setConnectionStatus(`Connecting to ${account.name}...`);

    try {
      let wallet = embeddedWallet;
      if (!wallet) {
        wallet = await initializeEmbeddedWallet();
      }

      setConnectionStatus("Connecting test account...");

      // Connect to test account (index is 0-based)
      const connectedAccount = await wallet.connectTestAccount(account.id - 1);

      setSelectedTestAccount(account);
      setConnectedWallet("aztec");
      setConnectedAccount(connectedAccount.getAddress().toString());
      setConnectionStatus(`Connected to ${account.name}!`);

      setTimeout(() => {
        setStep("amount");
        setConnectionStatus("");
        setIsConnecting(false);
      }, 1500);
    } catch (error: unknown) {
      console.error("Test account connection error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Connection failed";
      setConnectionStatus(`Error: ${errorMessage}`);
      setIsConnecting(false);
    }
  };

  const handleFaucetETH = async () => {
    if (!selectedTestAccount) return;

    setIsFauceting(true);
    setConnectionStatus("Requesting ETH from faucet...");

    try {
      // Simulate faucet request - replace with actual faucet logic if you have one
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setConnectionStatus("Successfully received 1000 ETH!");

      setTimeout(() => {
        setConnectionStatus("");
        setIsFauceting(false);
      }, 2000);
    } catch (error) {
      console.error("Faucet error:", error);
      setConnectionStatus("Faucet request failed");
      setIsFauceting(false);
    }
  };

  const handleDonate = async () => {
    if (!donationAmount || parseFloat(donationAmount) <= 0) return;

    setIsConnecting(true);
    setConnectionStatus("Preparing transaction...");

    console.log({
      connectedWallet,
      selectedChain,
      donationAmount,
    });
    
    try {
      if (connectedWallet === "metamask" && selectedChain) {
        const ethAmount = (parseFloat(donationAmount) * 0.001).toString();
        const donationAmountWei = parseEther(ethAmount);

        const transactionParameters = {
          to: DUMMY_CONTRACT_ADDRESS as `0x${string}`,
          from: connectedAccount as `0x${string}`,
          value: donationAmountWei,
          data: "0x",
        };

        setConnectionStatus(`Please confirm the transaction in MetaMask for ${selectedChain.displayName}...`);

        const txHash = (await window.ethereum!.request({
          method: "eth_sendTransaction",
          params: [transactionParameters],
        })) as string;

        setConnectionStatus(
          `Transaction sent on ${selectedChain.displayName}! Hash: ${txHash.substring(0, 10)}...`
        );

        setTimeout(() => {
          onClose();
          resetModal();
        }, 3000);
      } else {
        throw new Error("Please connect MetaMask wallet first");
      }
    } catch (error: unknown) {
      console.error("Donation error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Transaction failed";
      setConnectionStatus(`Error: ${errorMessage}`);
      setIsConnecting(false);
    }
  };

  const connectMetamask = async () => {
    setIsConnecting(true);
    setConnectionStatus("Connecting to MetaMask...");

    try {
      if (!window.ethereum) {
        setConnectionStatus(
          "MetaMask not found. Please install MetaMask extension."
        );
        setIsConnecting(false);
        return;
      }

      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (accounts.length === 0) {
        setConnectionStatus("No accounts found. Please unlock MetaMask.");
        setIsConnecting(false);
        return;
      }

      setConnectionStatus("Connected! Please select a blockchain network...");
      setConnectedWallet("metamask");
      setConnectedAccount(accounts[0]);

      setTimeout(() => {
        setStep("chain");
        setConnectionStatus("");
        setIsConnecting(false);
      }, 1500);
    } catch (error: unknown) {
      console.error("MetaMask connection error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Connection failed";
      setConnectionStatus(`Error: ${errorMessage}`);
      setIsConnecting(false);
    }
  };



  const handleBack = () => {
    if (step === "aztec-accounts") {
      setStep("wallet");
    } else if (step === "chain") {
      setStep("wallet");
    } else if (step === "amount") {
      if (connectedWallet === "metamask") {
        setStep("chain");
      } else {
        setStep("aztec-accounts");
      }
    } else {
      setStep("wallet");
    }
    setConnectionStatus("");
    setIsConnecting(false);
    if (step === "wallet") {
      setConnectedWallet("");
      setConnectedAccount("");
      setSelectedChain(null);
    }
  };

  const resetModal = () => {
    setStep("wallet");
    setDonationAmount("");
    setConnectionStatus("");
    setIsConnecting(false);
    setConnectedWallet("");
    setConnectedAccount("");
    setSelectedTestAccount(null);
    setSelectedChain(null);
    setIsFauceting(false);
  };

  useEffect(() => {
    if (!isOpen) {
      resetModal();
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Scroll Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotateX: -15 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, scale: 0.8, rotateX: 15 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="relative max-w-md w-full"
          >
            {/* Ancient Scroll Design */}
            <div
              className="relative rounded-2xl border-4 border-amber-800 shadow-2xl"
              style={{ backgroundColor: "#cbb287" }}
            >
              {/* Scroll Decorations */}
              <div className="absolute -top-2 left-4 right-4 h-4 bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 rounded-full"></div>
              <div className="absolute -bottom-2 left-4 right-4 h-4 bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 rounded-full"></div>

              {/* Scroll Ends */}
              <div className="absolute -left-3 top-2 bottom-2 w-6 bg-gradient-to-b from-amber-800 to-amber-900 rounded-full shadow-lg"></div>
              <div className="absolute -right-3 top-2 bottom-2 w-6 bg-gradient-to-b from-amber-800 to-amber-900 rounded-full shadow-lg"></div>

              {/* Content */}
              <div className="p-8 pt-12 pb-12">
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 text-amber-900 hover:text-black transition-colors"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>

                {/* Back Button */}
                {(step === "amount" || step === "aztec-accounts" || step === "chain") && (
                  <button
                    onClick={handleBack}
                    className="absolute top-4 left-4 text-amber-900 hover:text-black transition-colors"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                )}

                {/* Step 1: Wallet Selection */}
                {step === "wallet" && (
                  <>
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold text-gray-900 font-['Cinzel'] mb-2 drop-shadow-sm">
                        Connect Your Wallet
                      </h2>
                      <div className="mt-2 text-gray-800 font-['Cinzel'] text-xs italic">
                        For: {eventTitle}
                      </div>
                    </div>

                    {connectionStatus && (
                      <div className="mb-6 p-3 bg-amber-200/70 rounded-lg border border-amber-600/50">
                        <p className="text-gray-900 font-['Cinzel'] text-sm text-center font-medium">
                          {connectionStatus}
                        </p>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <button
                          onClick={connectMetamask}
                          disabled={isConnecting}
                          className="w-full bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 disabled:bg-gray-400/20 disabled:border-gray-400/30 text-gray-900 font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none font-['Cinzel'] flex items-center justify-center"
                        >
                          <img
                            src="/MetaMask.png"
                            alt="MetaMask"
                            className="w-6 h-6 mr-3"
                          />
                          {isConnecting && connectedWallet !== "aztec"
                            ? "Connecting..."
                            : "Connect MetaMask"}
                        </button>
                        <p className="text-gray-700 font-['Cinzel'] text-xs text-center italic px-2">
                          Choose from multiple blockchain networks
                        </p>
                      </div>

                    </div>
                  </>
                )}

                {/* Step 2: Chain Selection */}
                {step === "chain" && (
                  <>
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold text-gray-900 font-['Cinzel'] mb-2 drop-shadow-sm">
                        Select Blockchain Network
                      </h2>
                      <div className="mt-2 text-gray-800 font-['Cinzel'] text-xs italic">
                        Choose your preferred testnet for donation
                      </div>
                    </div>

                    {connectionStatus && (
                      <div className="mb-6 p-3 bg-amber-200/70 rounded-lg border border-amber-600/50">
                        <p className="text-gray-900 font-['Cinzel'] text-sm text-center font-medium">
                          {connectionStatus}
                        </p>
                      </div>
                    )}

                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {supportedChains.map((chain) => (
                        <button
                          key={chain.id}
                          onClick={() => selectChain(chain)}
                          disabled={isConnecting}
                          className="w-full bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 disabled:bg-gray-400/20 text-gray-900 py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none font-['Cinzel'] text-left"
                        >
                          <div className="flex items-center">
                            <span className="text-2xl mr-4">{chain.icon}</span>
                            <div className="flex-1">
                              <div className="font-bold text-lg">
                                {chain.displayName}
                              </div>
                              <div className="text-xs font-normal mt-1 opacity-80">
                                {chain.description}
                              </div>
                              <div className="text-xs font-mono mt-2 text-amber-800">
                                {chain.nativeCurrency.symbol} • {chain.name}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Step 3: Aztec Test Account Selection */}
                {step === "aztec-accounts" && (
                  <>
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold text-gray-900 font-['Cinzel'] mb-2 drop-shadow-sm">
                        Choose Test Account
                      </h2>
                      <div className="mt-2 text-gray-800 font-['Cinzel'] text-xs italic">
                        Select from your Aztec test accounts
                      </div>
                    </div>

                    {connectionStatus && (
                      <div className="mb-6 p-3 bg-amber-200/70 rounded-lg border border-amber-600/50">
                        <p className="text-gray-900 font-['Cinzel'] text-sm text-center font-medium">
                          {connectionStatus}
                        </p>
                      </div>
                    )}

                    <div className="space-y-4">
                      {testAccounts.map((account) => (
                        <button
                          key={account.id}
                          onClick={() => selectTestAccount(account)}
                          disabled={isConnecting}
                          className="w-full bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 disabled:bg-gray-400/20 text-gray-900 py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none font-['Cinzel'] text-left"
                        >
                          <div className="font-bold text-lg">
                            {account.name}
                          </div>
                          <div className="text-xs font-normal mt-1 opacity-80">
                            {account.description}
                          </div>
                          <div className="text-xs font-mono mt-2 text-amber-800">
                            Test Account {account.id}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Step 4: Amount Input */}
                {step === "amount" && (
                  <>
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold text-gray-900 font-['Cinzel'] mb-2 drop-shadow-sm">
                        Enter Donation Amount
                      </h2>
                      <div className="mt-2 text-gray-800 font-['Cinzel'] text-sm">
                        Connected:{" "}
                        <span className="font-bold capitalize">
                          {connectedWallet}
                        </span>
                        {selectedTestAccount &&
                          ` (${selectedTestAccount.name})`}
                        {selectedChain &&
                          ` • ${selectedChain.displayName}`}
                      </div>
                      <div className="mt-1 text-gray-800 font-['Cinzel'] text-xs italic">
                        For: {eventTitle}
                      </div>
                    </div>

                    {connectionStatus && (
                      <div className="mb-6 p-3 bg-amber-200/70 rounded-lg border border-amber-600/50">
                        <p className="text-gray-900 font-['Cinzel'] text-sm text-center font-medium">
                          {connectionStatus}
                        </p>
                      </div>
                    )}

                    {/* Faucet Button (only for Aztec) */}
                    {connectedWallet === "aztec" && (
                      <div className="mb-4 text-center">
                        <button
                          onClick={handleFaucetETH}
                          disabled={isFauceting}
                          className="text-amber-800 hover:text-amber-900 font-['Cinzel'] text-sm underline disabled:text-gray-500"
                        >
                          {isFauceting ? "Processing..." : "🚰 Faucet ETH"}
                        </button>
                      </div>
                    )}

                    <div className="mb-6">
                      <label className="block text-gray-900 font-['Cinzel'] font-bold mb-3 text-lg">
                        Amount ({selectedChain?.nativeCurrency.symbol || "ETH"})
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-700 font-['Cinzel'] text-xl font-bold">
                          $
                        </span>
                        <input
                          type="number"
                          value={donationAmount}
                          onChange={(e) => setDonationAmount(e.target.value)}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-full pl-8 pr-4 py-4 bg-white/20 backdrop-blur-sm border-2 border-amber-600/50 rounded-xl text-gray-900 font-['Cinzel'] text-xl font-bold placeholder-gray-600 focus:outline-none focus:border-amber-700 focus:bg-white/30 transition-all"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleDonate}
                      disabled={
                        !donationAmount ||
                        parseFloat(donationAmount) <= 0 ||
                        isConnecting
                      }
                      className="w-full bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 disabled:bg-gray-400/20 disabled:border-gray-400/30 disabled:text-gray-500 text-gray-900 font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none font-['Cinzel']"
                    >
                      {isConnecting ? "Processing..." : "Donate Now"}
                    </button>
                  </>
                )}

                <div className="mt-8 text-center">
                  <p className="text-gray-800 font-['Cinzel'] text-xs italic">
                    ✨ Your generosity brings divine blessings ✨
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
