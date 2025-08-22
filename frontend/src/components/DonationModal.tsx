"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCrossChainTransfer } from "../hooks/use-cctp-v2";
import { SUPPORTED_CHAINS, CHAIN_TO_CHAIN_NAME, SupportedChainId, CHAIN_RPC_URLS } from "../lib/chains";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI, SEPOLIA_TESTNET_CONFIG } from "../lib/constants";

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventTitle: string;
  disasterHash: string;
  refreshDonations?: () => Promise<void>;
}

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
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
  refreshDonations,
}: DonationModalProps) {
  const [step, setStep] = useState<"chain" | "amount" | "transfer" | "success">("chain");
  const [selectedChain, setSelectedChain] = useState<SupportedChainId | null>(null);
  const [donationAmount, setDonationAmount] = useState<string>("");
  const [connectionStatus, setConnectionStatus] = useState<string>("");
  const [usdcBalance, setUsdcBalance] = useState<string>("0");
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isRecordingDonation, setIsRecordingDonation] = useState(false);
  const [donationRecordHash, setDonationRecordHash] = useState<string>("");
  
  // CCTP hook
  const {
    connectWallet,
    disconnectWallet,
    checkWalletConnection,
    getBalance,
    executeTransfer,
    currentStep,
    logs,
    error,
    reset,
    connectedAddress,
    isWalletConnected,
    setSenderPrivateKey,
    transactionHashes,
  } = useCrossChainTransfer();

  // Load USDC balance when chain or wallet changes
  useEffect(() => {
    const loadBalance = async () => {
      if (selectedChain && isWalletConnected) {
        setIsLoadingBalance(true);
        try {
          const balance = await getBalance(selectedChain);
          setUsdcBalance(balance);
        } catch (error) {
          console.error("Failed to load USDC balance:", error);
          setUsdcBalance("0");
        } finally {
          setIsLoadingBalance(false);
        }
      }
    };

    loadBalance();
  }, [selectedChain, isWalletConnected, getBalance]);

  // Monitor transfer progress and record donation when CCTP completes
  useEffect(() => {
    if (step === "transfer" && currentStep === "completed" && !isRecordingDonation && !donationRecordHash) {
      recordDonationOnContract();
    }
  }, [currentStep, step, isRecordingDonation, donationRecordHash]);

  const recordDonationOnContract = async () => {
    if (!donationAmount || !connectedAddress) return;

    setIsRecordingDonation(true);
    setConnectionStatus("Recording donation on smart contract...");

    try {
      // Connect to Ethereum Sepolia
      const provider = new ethers.JsonRpcProvider(SEPOLIA_TESTNET_CONFIG.rpcUrl);
      
      // Use the connected wallet to sign the transaction
      if (!window.ethereum) {
        throw new Error("MetaMask not found");
      }

      // Switch to Sepolia for the contract interaction
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: SEPOLIA_TESTNET_CONFIG.chainId }],
        });
      } catch (switchError: any) {
        // If Sepolia not added, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: SEPOLIA_TESTNET_CONFIG.chainId,
              chainName: SEPOLIA_TESTNET_CONFIG.chainName,
              rpcUrls: [SEPOLIA_TESTNET_CONFIG.rpcUrl],
              nativeCurrency: SEPOLIA_TESTNET_CONFIG.nativeCurrency,
            }],
          });
        } else {
          throw switchError;
        }
      }

      // Create ethers provider with MetaMask
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await web3Provider.getSigner();
      
      // Create contract instance
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      
      // Convert USDC amount to proper format (USDC has 6 decimals but we record in contract units)
      const donationAmountWei = ethers.parseUnits(donationAmount, 6);
      
      console.log('Recording donation on contract...');
      const recordTx = await contract.recordDonation(
        disasterHash,
        donationAmountWei,
        connectedAddress
      );
      
      setConnectionStatus("Waiting for contract confirmation...");
      await recordTx.wait();
      
      setDonationRecordHash(recordTx.hash);
      setConnectionStatus("Donation recorded on blockchain!");
      
      // Move to success step
      setStep("success");
      
      // Refresh donations if callback provided
      if (refreshDonations) {
        await refreshDonations();
      }
      
    } catch (error: any) {
      console.error("Failed to record donation:", error);
      setConnectionStatus(`Contract recording failed: ${error.message || "Unknown error"}`);
      // Still move to success since CCTP transfer completed
      setStep("success");
    } finally {
      setIsRecordingDonation(false);
    }
  };

  const switchToChain = async (chainId: SupportedChainId) => {
    if (!window.ethereum) {
      setConnectionStatus("MetaMask not found");
      return false;
    }

    try {
      setConnectionStatus(`Switching to ${CHAIN_TO_CHAIN_NAME[chainId]}...`);
      
      const hexChainId = `0x${chainId.toString(16)}`;
      
      // Try to switch to the selected chain
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }],
      });

      setConnectionStatus(`Connected to ${CHAIN_TO_CHAIN_NAME[chainId]}!`);
      setSelectedChain(chainId);
      
      setTimeout(() => {
        setStep("amount");
        setConnectionStatus("");
      }, 1500);
      
      return true;
    } catch (switchError: any) {
      // Chain doesn't exist in MetaMask, add it (if we have RPC info)
      if (switchError.code === 4902 && CHAIN_RPC_URLS[chainId]) {
        try {
          const hexChainId = `0x${chainId.toString(16)}`;
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: hexChainId,
                chainName: CHAIN_TO_CHAIN_NAME[chainId],
                rpcUrls: [CHAIN_RPC_URLS[chainId]],
                nativeCurrency: {
                  name: "ETH",
                  symbol: "ETH", 
                  decimals: 18,
                },
              },
            ],
          });

          setConnectionStatus(`Added and connected to ${CHAIN_TO_CHAIN_NAME[chainId]}!`);
          setSelectedChain(chainId);
          
          setTimeout(() => {
            setStep("amount");
            setConnectionStatus("");
          }, 1500);
          
          return true;
        } catch (addError) {
          console.error(`Failed to add ${CHAIN_TO_CHAIN_NAME[chainId]}:`, addError);
          setConnectionStatus(`Failed to add ${CHAIN_TO_CHAIN_NAME[chainId]} network`);
          return false;
        }
      } else {
        console.error(`Failed to switch to ${CHAIN_TO_CHAIN_NAME[chainId]}:`, switchError);
        setConnectionStatus(`Failed to switch to ${CHAIN_TO_CHAIN_NAME[chainId]}`);
        return false;
      }
    }
  };

  const handleDonate = async () => {
    if (!donationAmount || parseFloat(donationAmount) <= 0 || !selectedChain) return;

    // Get donation agent address from env
    const donationAgentAddress = import.meta.env.VITE_DONATION_AGENT_ADDRESS;
    if (!donationAgentAddress) {
      setConnectionStatus("Error: Donation agent address not configured");
      return;
    }

    // Private key is automatically loaded from environment variables in the hook

    // Move to transfer step and let the transfer progress
    setStep("transfer");
    setConnectionStatus("Initiating USDC transfer...");

    try {
      // Execute CCTP transfer - this will update currentStep and logs automatically
      await executeTransfer(
        selectedChain,
        donationAmount,
        "standard", // Use standard transfer for donations
        donationAgentAddress
      );

      // Only move to success when transfer is actually completed
      if (refreshDonations) {
        await refreshDonations();
      }

    } catch (error: any) {
      console.error("Donation error:", error);
      setConnectionStatus(`Error: ${error.message || "Transfer failed"}`);
      // Stay on transfer step to show error, don't go back to amount
    }
  };

  const handleChainSelect = async (chainId: SupportedChainId) => {
    setConnectionStatus("Connecting to MetaMask...");

    try {
      // Connect wallet first
      await connectWallet();
      
      // Then switch to selected chain
      await switchToChain(chainId);
    } catch (error: unknown) {
      console.error("Connection error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Connection failed";
      setConnectionStatus(`Error: ${errorMessage}`);
    }
  };

  const handleBack = () => {
    if (step === "amount") {
      setStep("chain");
    } else if (step === "transfer") {
      setStep("amount");
    } else if (step === "success") {
      setStep("amount");
    }
    setConnectionStatus("");
  };

  const handleNewDonation = () => {
    setStep("amount");
    setDonationAmount("");
    setConnectionStatus("");
    setIsRecordingDonation(false);
    setDonationRecordHash("");
    reset(); // Reset CCTP hook state
  };

  // Helper function to get chain logo path
  const getChainLogo = (chainId: SupportedChainId): string => {
    switch (chainId) {
      case SupportedChainId.ETH_SEPOLIA: return "/chain-logo/ethereum.png";
      case SupportedChainId.AVAX_FUJI: return "/chain-logo/avalanche.png";
      case SupportedChainId.BASE_SEPOLIA: return "/chain-logo/base.png";
      case SupportedChainId.SONIC_BLAZE: return "/chain-logo/sonic.png";
      case SupportedChainId.LINEA_SEPOLIA: return "/chain-logo/linea.png";
      case SupportedChainId.ARBITRUM_SEPOLIA: return "/chain-logo/arbitrum.png";
      case SupportedChainId.WORLDCHAIN_SEPOLIA: return "/chain-logo/worldchain.png";
      case SupportedChainId.OPTIMISM_SEPOLIA: return "/chain-logo/optimism.png";
      case SupportedChainId.CODEX_TESTNET: return "/chain-logo/codex.png";
      case SupportedChainId.UNICHAIN_SEPOLIA: return "/chain-logo/unichain.png";
      case SupportedChainId.POLYGON_AMOY: return "/chain-logo/polygon.png";
      case SupportedChainId.SEI_TESTNET: return "/chain-logo/sei.png";
      default: return "/chain-logo/ethereum.png"; // fallback
    }
  };

  // Helper function to get short chain name for display
  const getShortChainName = (chainId: SupportedChainId): string => {
    switch (chainId) {
      case SupportedChainId.ETH_SEPOLIA: return "Ethereum";
      case SupportedChainId.AVAX_FUJI: return "Avalanche";
      case SupportedChainId.BASE_SEPOLIA: return "Base";
      case SupportedChainId.SONIC_BLAZE: return "Sonic";
      case SupportedChainId.LINEA_SEPOLIA: return "Linea";
      case SupportedChainId.ARBITRUM_SEPOLIA: return "Arbitrum";
      case SupportedChainId.WORLDCHAIN_SEPOLIA: return "Worldchain";
      case SupportedChainId.OPTIMISM_SEPOLIA: return "Optimism";
      case SupportedChainId.CODEX_TESTNET: return "Codex";
      case SupportedChainId.UNICHAIN_SEPOLIA: return "Unichain";
      case SupportedChainId.POLYGON_AMOY: return "Polygon";
      case SupportedChainId.SEI_TESTNET: return "Sei";
      default: return CHAIN_TO_CHAIN_NAME[chainId] || "Unknown";
    }
  };

  const resetModal = () => {
    setStep("chain");
    setDonationAmount("");
    setConnectionStatus("");
    setSelectedChain(null);
    setUsdcBalance("0");
    setIsLoadingBalance(false);
    setIsRecordingDonation(false);
    setDonationRecordHash("");
    reset(); // Reset CCTP hook state
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
            className={`relative w-full ${
              step === "chain" ? "max-w-4xl" : "max-w-md"
            }`}
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
                {(step === "amount" || step === "transfer" || step === "success") && (
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

                {/* Step 1: Chain Selection */}
                {step === "chain" && (
                  <>
                    <div className="text-center mb-8">
                      <h2 className="text-3xl font-bold text-gray-900 font-['Cinzel'] mb-4 drop-shadow-sm">
                        Select Chain for USDC Donation
                      </h2>
                      
                      {/* Circle CCTP v2 Branding */}
                      <div className="flex items-center justify-center gap-2 mb-4 p-3 bg-white/20 rounded-lg border border-white/30">
                        <span className="text-gray-700 font-['Cinzel'] text-sm font-medium">Powered by</span>
                        <div className="flex items-center gap-1">
                          <img 
                            src="/chain-logo/circle.png" 
                            alt="Circle" 
                            className="w-15 h-10"
                          />
                        </div>
                        <span className="text-gray-700 font-['Cinzel'] text-sm font-medium">CCTP v2 & Paymaster</span>
                      </div>

                      <div className="mt-2 text-gray-800 font-['Cinzel'] text-sm italic">
                        For: {eventTitle}
                      </div>
                      <div className="mt-2 text-gray-700 font-['Cinzel'] text-sm">
                        Choose your preferred blockchain network
                      </div>
                    </div>

                    {connectionStatus && (
                      <div className="mb-6 p-3 bg-amber-200/70 rounded-lg border border-amber-600/50">
                        <p className="text-gray-900 font-['Cinzel'] text-sm text-center font-medium">
                          {connectionStatus}
                        </p>
                      </div>
                    )}

                    {/* 3-Column Grid Layout */}
                    <div className="grid grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                      {SUPPORTED_CHAINS.map((chainId) => (
                        <button
                          key={chainId}
                          onClick={() => handleChainSelect(chainId)}
                          className="bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 text-gray-900 font-bold p-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] font-['Cinzel'] text-center flex flex-col items-center gap-3 min-h-[100px]"
                        >
                          {/* Chain Icon */}
                          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white/20 p-2">
                            <img 
                              src={getChainLogo(chainId)} 
                              alt={getShortChainName(chainId)} 
                              className="w-8 h-8 object-contain"
                            />
                          </div>
                          
                          {/* Chain Name */}
                          <div>
                            <div className="text-sm font-bold leading-tight">{getShortChainName(chainId)}</div>
                            <div className="text-xs text-gray-600 mt-1">USDC Ready</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Step 2: Amount Input */}
                {step === "amount" && (
                  <>
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold text-gray-900 font-['Cinzel'] mb-2 drop-shadow-sm">
                        Enter USDC Amount
                      </h2>
                      <div className="mt-2 text-gray-800 font-['Cinzel'] text-sm">
                        Connected: <span className="font-bold">{selectedChain ? CHAIN_TO_CHAIN_NAME[selectedChain] : ""}</span>
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

                    {/* USDC Balance Display */}
                    <div className="mb-4 p-3 bg-amber-100/30 rounded-lg border border-amber-200/50">
                      <div className="text-center">
                        <p className="text-gray-800 font-['Cinzel'] text-sm">
                          Your USDC Balance:
                        </p>
                        <p className="text-gray-900 font-['Cinzel'] text-lg font-bold">
                          {isLoadingBalance ? (
                            <span className="animate-pulse">Loading...</span>
                          ) : (
                            `${parseFloat(usdcBalance).toFixed(6)} USDC`
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mb-6">
                      <label className="block text-gray-900 font-['Cinzel'] font-bold mb-3 text-lg">
                        Amount (USDC)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={donationAmount}
                          onChange={(e) => setDonationAmount(e.target.value)}
                          placeholder="0.000000"
                          min="0"
                          step="0.000001"
                          max={usdcBalance}
                          className="w-full pl-4 pr-16 py-4 bg-white/20 backdrop-blur-sm border-2 border-amber-600/50 rounded-xl text-gray-900 font-['Cinzel'] text-xl font-bold placeholder-gray-600 focus:outline-none focus:border-amber-700 focus:bg-white/30 transition-all"
                        />
                        <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-700 font-['Cinzel'] text-sm font-bold">
                          USDC
                        </span>
                      </div>
                      <div className="mt-2 flex justify-between text-xs text-gray-700">
                        <span>Min: 0.1 USDC</span>
                        <button
                          onClick={() => setDonationAmount(usdcBalance)}
                          className="text-amber-800 hover:text-amber-900 font-bold"
                        >
                          Use Max
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={handleDonate}
                      disabled={
                        !donationAmount ||
                        parseFloat(donationAmount) <= 0 ||
                        parseFloat(donationAmount) > parseFloat(usdcBalance) ||
                        parseFloat(donationAmount) < 0.1
                      }
                      className="w-full bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 disabled:bg-gray-400/20 disabled:border-gray-400/30 disabled:text-gray-500 text-gray-900 font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none font-['Cinzel']"
                    >
                      Donate USDC
                    </button>
                  </>
                )}

                {/* Step 3: Transfer Progress */}
                {step === "transfer" && (
                  <>
                    <div className="text-center mb-6">
                      <h2 className="text-2xl font-bold text-gray-900 font-['Cinzel'] mb-2 drop-shadow-sm">
                        Processing USDC Transfer
                      </h2>
                      <div className="mt-2 text-gray-800 font-['Cinzel'] text-xs italic">
                        Cross-chain transfer to Ethereum Sepolia in progress
                      </div>
                    </div>

                    {/* Progress Steps Indicator */}
                    <div className="mb-6 p-4 bg-amber-100/30 rounded-lg border border-amber-200/50">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-['Cinzel']">
                          <div className={`flex items-center space-x-2 ${currentStep === "idle" || currentStep === "approving" || currentStep === "burning" || currentStep === "waiting-attestation" || currentStep === "minting" || currentStep === "completed" ? "text-green-700" : "text-gray-500"}`}>
                            <div className={`w-3 h-3 rounded-full ${currentStep === "approving" ? "bg-yellow-500 animate-pulse" : (currentStep === "idle" || currentStep === "burning" || currentStep === "waiting-attestation" || currentStep === "minting" || currentStep === "completed") ? "bg-green-500" : "bg-gray-300"}`}></div>
                            <span>1. Approve USDC</span>
                          </div>
                          {(currentStep === "burning" || currentStep === "waiting-attestation" || currentStep === "minting" || currentStep === "completed") && <span className="text-green-600">✓</span>}
                        </div>
                        
                        <div className="flex items-center justify-between text-xs font-['Cinzel']">
                          <div className={`flex items-center space-x-2 ${currentStep === "burning" || currentStep === "waiting-attestation" || currentStep === "minting" || currentStep === "completed" ? "text-green-700" : "text-gray-500"}`}>
                            <div className={`w-3 h-3 rounded-full ${currentStep === "burning" ? "bg-yellow-500 animate-pulse" : (currentStep === "waiting-attestation" || currentStep === "minting" || currentStep === "completed") ? "bg-green-500" : "bg-gray-300"}`}></div>
                            <span>2. Burn USDC on {selectedChain ? CHAIN_TO_CHAIN_NAME[selectedChain] : "Source"}</span>
                          </div>
                          {(currentStep === "waiting-attestation" || currentStep === "minting" || currentStep === "completed") && <span className="text-green-600">✓</span>}
                        </div>
                        
                        <div className="flex items-center justify-between text-xs font-['Cinzel']">
                          <div className={`flex items-center space-x-2 ${currentStep === "waiting-attestation" || currentStep === "minting" || currentStep === "completed" ? "text-green-700" : "text-gray-500"}`}>
                            <div className={`w-3 h-3 rounded-full ${currentStep === "waiting-attestation" ? "bg-yellow-500 animate-pulse" : (currentStep === "minting" || currentStep === "completed") ? "bg-green-500" : "bg-gray-300"}`}></div>
                            <span>3. Wait for Attestation</span>
                          </div>
                          {(currentStep === "minting" || currentStep === "completed") && <span className="text-green-600">✓</span>}
                        </div>
                        
                        <div className="flex items-center justify-between text-xs font-['Cinzel']">
                          <div className={`flex items-center space-x-2 ${currentStep === "minting" || currentStep === "completed" ? "text-green-700" : "text-gray-500"}`}>
                            <div className={`w-3 h-3 rounded-full ${currentStep === "minting" ? "bg-yellow-500 animate-pulse" : currentStep === "completed" ? "bg-green-500" : "bg-gray-300"}`}></div>
                            <span>4. Mint USDC on Ethereum Sepolia</span>
                          </div>
                          {currentStep === "completed" && <span className="text-green-600">✓</span>}
                        </div>
                      </div>
                    </div>

                    {/* Current Status */}
                    <div className="mb-4 p-3 bg-blue-100/30 rounded-lg border border-blue-200/50">
                      <div className="text-center">
                        <p className="text-blue-800 font-['Cinzel'] text-sm font-bold">
                          Current Status:
                        </p>
                        <p className="text-blue-900 font-['Cinzel'] text-sm capitalize">
                          {isRecordingDonation ? "Recording donation on smart contract..." :
                           currentStep === "idle" ? "Initializing..." : 
                           currentStep === "approving" ? "Approving USDC for transfer..." :
                           currentStep === "burning" ? "Burning USDC on source chain..." :
                           currentStep === "waiting-attestation" ? "Waiting for Circle attestation..." :
                           currentStep === "minting" ? "Minting USDC on destination..." :
                           currentStep === "completed" ? "Transfer completed - Recording on contract..." :
                           currentStep === "error" ? "Transfer failed" :
                           "Unknown status"}
                        </p>
                      </div>
                    </div>
{/* 
                    Key Transaction Hashes
                    {(transactionHashes.approvalTx || transactionHashes.burnTx || transactionHashes.mintTx || transactionHashes.attestationHash) && (
                      <div className="mb-4 p-3 bg-green-100/30 rounded-lg border border-green-200/50">
                        <p className="text-green-800 font-['Cinzel'] text-sm font-bold mb-3">Key Transaction Events:</p>
                        <div className="space-y-2">
                          {transactionHashes.approvalTx && (
                            <div className="flex items-start space-x-2">
                              <span className="text-green-600 text-sm">✅</span>
                              <div className="flex-1">
                                <p className="text-green-800 font-['Cinzel'] text-sm font-semibold">Approval Transaction</p>
                                <p className="text-green-700 font-mono text-xs break-all">{transactionHashes.approvalTx}</p>
                              </div>
                            </div>
                          )}
                          {transactionHashes.burnTx && (
                            <div className="flex items-start space-x-2">
                              <span className="text-green-600 text-sm">🔥</span>
                              <div className="flex-1">
                                <p className="text-green-800 font-['Cinzel'] text-sm font-semibold">Burn Transaction</p>
                                <p className="text-green-700 font-mono text-xs break-all">{transactionHashes.burnTx}</p>
                              </div>
                            </div>
                          )}
                          {transactionHashes.attestationHash && (
                            <div className="flex items-start space-x-2">
                              <span className="text-green-600 text-sm">📋</span>
                              <div className="flex-1">
                                <p className="text-green-800 font-['Cinzel'] text-sm font-semibold">Circle Attestation</p>
                                <p className="text-green-700 font-mono text-xs break-all">{transactionHashes.attestationHash.substring(0, 40)}...</p>
                              </div>
                            </div>
                          )}
                          {transactionHashes.mintTx && (
                            <div className="flex items-start space-x-2">
                              <span className="text-green-600 text-sm">✨</span>
                              <div className="flex-1">
                                <p className="text-green-800 font-['Cinzel'] text-sm font-semibold">Mint Transaction</p>
                                <p className="text-green-700 font-mono text-xs break-all">{transactionHashes.mintTx}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )} */}

                    {/* Transfer Logs */}
                    <div className="mb-6 max-h-32 overflow-y-auto space-y-2 p-3 bg-gray-100/30 rounded-lg border border-gray-200/50">
                      <p className="text-gray-700 font-['Cinzel'] text-sm font-bold mb-2">Transaction Log:</p>
                      {logs.length === 0 ? (
                        <div className="text-sm text-gray-600 font-mono italic">
                          Initializing transfer...
                        </div>
                      ) : (
                        logs.slice(-6).map((log, index) => (
                          <div key={index} className="text-sm text-gray-700 font-mono leading-relaxed">
                            {log.replace(/^\[\d{1,2}:\d{2}:\d{2}\s*[AP]M\]\s*/, '')}
                          </div>
                        ))
                      )}
                    </div>

                    {/* Error Display */}
                    {error && (
                      <div className="mb-6 p-3 bg-red-200/70 rounded-lg border border-red-600/50">
                        <p className="text-red-900 font-['Cinzel'] text-sm text-center font-medium">
                          ❌ Error: {error}
                        </p>
                      </div>
                    )}

                    {/* Warning/Info */}
                    <div className="text-center">
                      <div className="text-gray-700 font-['Cinzel'] text-xs">
                        {currentStep === "waiting-attestation" ? (
                          <span className="animate-pulse">⏳ Waiting for Circle's attestation service... This usually takes 1-2 minutes</span>
                        ) : currentStep === "minting" ? (
                          <span className="animate-pulse">⚡ Minting USDC on destination chain...</span>
                        ) : currentStep === "completed" ? (
                          <span className="text-green-700">✅ Transfer completed successfully!</span>
                        ) : (
                          <span className="animate-pulse">Processing transaction... Please wait</span>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Step 4: Success Screen */}
                {step === "success" && (
                  <>
                    <div className="text-center mb-8">
                      <div className="mb-4">
                        <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                          <svg
                            className="w-8 h-8 text-green-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 font-['Cinzel'] mb-2 drop-shadow-sm">
                        USDC Donation Successful!
                      </h2>
                      <div className="mt-2 text-gray-800 font-['Cinzel'] text-xs italic">
                        Your USDC has been transferred to Ethereum Sepolia
                      </div>
                    </div>

                    <div className="space-y-4 mb-6">
                      {/* Transfer Details */}
                      <div className="p-3 bg-amber-100/30 rounded-lg border border-amber-200/50">
                        <p className="text-gray-800 font-['Cinzel'] text-sm font-bold mb-1">
                          Transfer Details:
                        </p>
                        <div className="space-y-1 text-xs text-gray-900 font-['Cinzel']">
                          <div>Amount: <span className="font-bold">{donationAmount} USDC</span></div>
                          <div>From: <span className="font-bold">{selectedChain ? CHAIN_TO_CHAIN_NAME[selectedChain] : ""}</span></div>
                          <div>To: <span className="font-bold">Ethereum Sepolia</span></div>
                          <div>Recipient: <span className="font-bold">Donation Agent</span></div>
                        </div>
                      </div>

                      {/* Status */}
                      {currentStep === "completed" && (
                        <div className="p-3 bg-green-100/30 rounded-lg border border-green-200/50">
                          <p className="text-green-800 font-['Cinzel'] text-sm font-bold mb-1">
                            Transfer Status:
                          </p>
                          <p className="text-green-900 font-['Cinzel'] text-sm">
                            ✅ Successfully transferred via Circle's CCTP
                          </p>
                        </div>
                      )}

                      {/* Transaction Hashes Summary */}
                      <div className="p-3 bg-amber-100/30 rounded-lg border border-amber-200/50">
                        <p className="text-gray-800 font-['Cinzel'] text-sm font-bold mb-3">
                          Transaction Summary:
                        </p>
                        <div className="space-y-2">
                          {transactionHashes.burnTx && (
                            <div>
                              <p className="text-gray-700 font-['Cinzel'] text-xs font-semibold">🔥 CCTP Burn Tx:</p>
                              <p className="text-gray-600 font-mono text-xs break-all">{transactionHashes.burnTx}</p>
                            </div>
                          )}
                          {transactionHashes.mintTx && (
                            <div>
                              <p className="text-gray-700 font-['Cinzel'] text-xs font-semibold">✨ CCTP Mint Tx:</p>
                              <p className="text-gray-600 font-mono text-xs break-all">{transactionHashes.mintTx}</p>
                            </div>
                          )}
                          {donationRecordHash && (
                            <div>
                              <p className="text-gray-700 font-['Cinzel'] text-xs font-semibold">📝 Contract Record Tx:</p>
                              <p className="text-gray-600 font-mono text-xs break-all">{donationRecordHash}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <button
                        onClick={handleNewDonation}
                        className="w-full bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 text-gray-900 font-bold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] font-['Cinzel']"
                      >
                        Donate Again
                      </button>
                      <button
                        onClick={onClose}
                        className="w-full bg-amber-700/20 backdrop-blur-xl border border-amber-600/50 hover:bg-amber-700/30 text-gray-900 font-bold py-3 px-6 rounded-xl transition-all duration-300 font-['Cinzel']"
                      >
                        Close
                      </button>
                    </div>
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
