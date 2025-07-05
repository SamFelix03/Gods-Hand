"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ethers } from "ethers";
import { convertUsdToFlow, formatFlowAmount} from "../lib/utils";
import { CONTRACT_ADDRESS, CONTRACT_ABI, FLOW_TESTNET_CONFIG } from "../lib/constants";

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
  const [step, setStep] = useState<"wallet" | "amount" | "success">("wallet");
  const [donationAmount, setDonationAmount] = useState<string>("");
  const [flowAmount, setFlowAmount] = useState<number>(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>("");
  const [connectedAccount, setConnectedAccount] = useState<string>("");
  const [isConvertingCurrency, setIsConvertingCurrency] = useState(false);
  const [txHash, setTxHash] = useState<string>("");
  const [donatedAmount, setDonatedAmount] = useState<string>("");
  const [totalDonated, setTotalDonated] = useState<string>("");

  // Convert USD to FLOW when donation amount changes
  useEffect(() => {
    const convertCurrency = async () => {
      if (donationAmount && parseFloat(donationAmount) > 0) {
        setIsConvertingCurrency(true);
        try {
          const usdAmount = parseFloat(donationAmount);
          const flowTokens = await convertUsdToFlow(usdAmount);
          setFlowAmount(flowTokens);
        } catch (error) {
          console.error("Currency conversion failed:", error);
          // Use fallback rate
          setFlowAmount(parseFloat(donationAmount) * 1);
        } finally {
          setIsConvertingCurrency(false);
        }
      } else {
        setFlowAmount(0);
      }
    };

    const debounceTimer = setTimeout(convertCurrency, 500);
    return () => clearTimeout(debounceTimer);
  }, [donationAmount]);

  const switchToFlowTestnet = async () => {
    if (!window.ethereum) {
      setConnectionStatus("MetaMask not found");
      return false;
    }

    try {
      setConnectionStatus("Switching to Flow Testnet...");
      
      // Try to switch to Flow testnet
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: FLOW_TESTNET_CONFIG.chainId }],
      });

      setConnectionStatus("Connected to Flow Testnet!");
      
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
                chainId: FLOW_TESTNET_CONFIG.chainId,
                chainName: FLOW_TESTNET_CONFIG.chainName,
                nativeCurrency: FLOW_TESTNET_CONFIG.nativeCurrency,
                rpcUrls: [FLOW_TESTNET_CONFIG.rpcUrl],
                blockExplorerUrls: [FLOW_TESTNET_CONFIG.blockExplorer],
              },
            ],
          });

          setConnectionStatus("Added and connected to Flow Testnet!");
          
          setTimeout(() => {
            setStep("amount");
            setConnectionStatus("");
            setIsConnecting(false);
          }, 1500);
          
          return true;
        } catch (addError) {
          console.error("Failed to add Flow testnet:", addError);
          setConnectionStatus("Failed to add Flow Testnet network");
          setIsConnecting(false);
          return false;
        }
      } else {
        console.error("Failed to switch to Flow testnet:", switchError);
        setConnectionStatus("Failed to switch to Flow Testnet");
        setIsConnecting(false);
        return false;
      }
    }
  };

  const handleDonate = async () => {
    if (!donationAmount || parseFloat(donationAmount) <= 0 || flowAmount <= 0) return;

    setIsConnecting(true);
    setConnectionStatus("Preparing transaction...");

    try {
      if (!window.ethereum) {
        throw new Error("MetaMask not found");
      }

      // Ensure disaster hash has 0x prefix
      let formattedDisasterHash = disasterHash;
      if (!disasterHash.startsWith('0x')) {
        formattedDisasterHash = '0x' + disasterHash;
      }

      // Create ethers provider and signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Verify we're on the correct network
      const network = await provider.getNetwork();

      if (network.chainId !== 545n) {
        throw new Error(`Wrong network. Expected Flow Testnet (545), got ${network.chainId}`);
      }

      // Create contract instance
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      setConnectionStatus("Please confirm the transaction in MetaMask...");

      // Convert FLOW amount to wei using parseEther
      const donationAmountWei = ethers.parseEther(flowAmount.toString());

      // Verify disaster exists before donating
      try {
        const disasterDetails = await contract.getDisasterDetails(formattedDisasterHash);

        if (!disasterDetails[6]) {
          throw new Error('Disaster is not active');
        }
      } catch (verifyError) {
        throw new Error('Invalid disaster hash or disaster not found');
      }

      // Call the contract function
      const tx = await contract.donateToDisaster(formattedDisasterHash, {
        value: donationAmountWei
      });

      setConnectionStatus("Transaction submitted! Waiting for confirmation...");
      setTxHash(tx.hash);

      // Wait for transaction receipt
      const receipt = await tx.wait();

      setConnectionStatus("Transaction confirmed! Processing events...");

      // Check if DonationMade event was emitted
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = contract.interface.parseLog(log);
          return parsed?.name === 'DonationMade';
        } catch {
          return false;
        }
      });

      if (event) {
        try {
          const parsed = contract.interface.parseLog(event);
          if (parsed && parsed.args) {
            const donatedAmountFormatted = ethers.formatEther(parsed.args.amount);
            const totalDonatedFormatted = ethers.formatEther(parsed.args.totalDonated);
            
            setDonatedAmount(donatedAmountFormatted);
            setTotalDonated(totalDonatedFormatted);
          }
        } catch (error) {
          console.error("Error parsing event:", error);
        }
      }

      setConnectionStatus("Donation successful!");
      setStep("success");
      setIsConnecting(false);

      if (refreshDonations) {
        await refreshDonations();
      }

    } catch (error: any) {
      console.error("Donation error:", error);
      
      // More detailed error handling
      let errorMessage = "Transaction failed";
      
      if (error.code === 'CALL_EXCEPTION') {
        errorMessage = "Transaction failed - please check disaster hash and try again";
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        errorMessage = "Insufficient FLOW balance";
      } else if (error.code === 'USER_REJECTED') {
        errorMessage = "Transaction cancelled by user";
      } else if (error.code === 'NETWORK_ERROR') {
        errorMessage = "Network error - please check your connection to Flow testnet";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
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

      setConnectedAccount(accounts[0]);
      setConnectionStatus("Connected! Switching to Flow Testnet...");

      // Automatically switch to Flow testnet after connecting
      await switchToFlowTestnet();
    } catch (error: unknown) {
      console.error("MetaMask connection error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Connection failed";
      setConnectionStatus(`Error: ${errorMessage}`);
      setIsConnecting(false);
    }
  };

  const handleBack = () => {
    if (step === "amount") {
      setStep("wallet");
    } else if (step === "success") {
      setStep("amount");
    }
    setConnectionStatus("");
    setIsConnecting(false);
    if (step === "wallet") {
      setConnectedAccount("");
    }
  };

  const handleNewDonation = () => {
    setStep("amount");
    setDonationAmount("");
    setFlowAmount(0);
    setTxHash("");
    setDonatedAmount("");
    setTotalDonated("");
    setConnectionStatus("");
  };

  const resetModal = () => {
    setStep("wallet");
    setDonationAmount("");
    setFlowAmount(0);
    setConnectionStatus("");
    setIsConnecting(false);
    setConnectedAccount("");
    setIsConvertingCurrency(false);
    setTxHash("");
    setDonatedAmount("");
    setTotalDonated("");
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
                {(step === "amount" || step === "success") && (
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
                      <div className="mt-2 text-gray-800 font-['Cinzel'] text-xs">
                        Flow Testnet Network
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
                          {isConnecting ? "Connecting..." : "Connect MetaMask"}
                        </button>
                        <p className="text-gray-700 font-['Cinzel'] text-xs text-center italic px-2">
                          Connect to Flow Testnet for donations
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Step 2: Amount Input */}
                {step === "amount" && (
                  <>
                    <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold text-gray-900 font-['Cinzel'] mb-2 drop-shadow-sm">
                        Enter Donation Amount
                      </h2>
                      <div className="mt-2 text-gray-800 font-['Cinzel'] text-sm">
                        Connected: <span className="font-bold">Flow Testnet</span>
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

                    <div className="mb-6">
                      <label className="block text-gray-900 font-['Cinzel'] font-bold mb-3 text-lg">
                        Amount (USD)
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
                      
                      {/* Flow Amount Display */}
                      {donationAmount && parseFloat(donationAmount) > 0 && (
                        <div className="mt-3 p-3 bg-amber-100/30 rounded-lg border border-amber-200/50">
                          <div className="text-center">
                            <p className="text-gray-800 font-['Cinzel'] text-sm">
                              Equivalent in FLOW:
                            </p>
                            <p className="text-gray-900 font-['Cinzel'] text-lg font-bold">
                              {isConvertingCurrency ? (
                                <span className="animate-pulse">Converting...</span>
                              ) : (
                                formatFlowAmount(flowAmount)
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleDonate}
                      disabled={
                        !donationAmount ||
                        parseFloat(donationAmount) <= 0 ||
                        flowAmount <= 0 ||
                        isConnecting ||
                        isConvertingCurrency
                      }
                      className="w-full bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 disabled:bg-gray-400/20 disabled:border-gray-400/30 disabled:text-gray-500 text-gray-900 font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none font-['Cinzel']"
                    >
                      {isConnecting ? "Processing..." : 
                       isConvertingCurrency ? "Converting..." : 
                       "Donate Now"}
                    </button>
                  </>
                )}

                {/* Step 3: Success Screen */}
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
                        Donation Successful!
                      </h2>
                      <div className="mt-2 text-gray-800 font-['Cinzel'] text-xs italic">
                        Thank you for your generosity
                      </div>
                    </div>

                    <div className="space-y-4 mb-6">
                      {/* Transaction Hash */}
                      <div className="p-3 bg-amber-100/30 rounded-lg border border-amber-200/50">
                        <p className="text-gray-800 font-['Cinzel'] text-sm font-bold mb-1">
                          Transaction Hash:
                        </p>
                        <p className="text-gray-900 font-['Cinzel'] text-xs font-mono break-all">
                          {txHash}
                        </p>
                        <a
                          href={`https://evm-testnet.flowscan.io/tx/${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-800 hover:text-amber-900 font-['Cinzel'] text-xs underline mt-1 inline-block"
                        >
                          View on Explorer →
                        </a>
                      </div>

                      {/* Donation Details */}
                      {donatedAmount && (
                        <div className="p-3 bg-amber-100/30 rounded-lg border border-amber-200/50">
                          <p className="text-gray-800 font-['Cinzel'] text-sm font-bold mb-1">
                            Your Donation:
                          </p>
                          <p className="text-gray-900 font-['Cinzel'] text-lg font-bold">
                            {parseFloat(donatedAmount).toFixed(6)} FLOW
                          </p>
                        </div>
                      )}

                      {/* Total Donated */}
                      {totalDonated && (
                        <div className="p-3 bg-amber-100/30 rounded-lg border border-amber-200/50">
                          <p className="text-gray-800 font-['Cinzel'] text-sm font-bold mb-1">
                            Total Raised:
                          </p>
                          <p className="text-gray-900 font-['Cinzel'] text-lg font-bold">
                            {parseFloat(totalDonated).toFixed(6)} FLOW
                          </p>
                        </div>
                      )}
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
