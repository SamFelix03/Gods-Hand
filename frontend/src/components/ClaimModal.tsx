"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { parseEther } from "viem";
import { claimsService } from "../lib/dynamodb/claims";

interface ClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationName: string;
  claimedAmount: number;
  organizationAztecAddress: string;
  claimId: string;
}

export default function ClaimModal({
  isOpen,
  onClose,
  organizationName,
  claimedAmount,
  organizationAztecAddress,
  claimId,
}: ClaimModalProps) {
  const [currentStep, setCurrentStep] = useState<"wallet" | "claim">("wallet");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>("");
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimStatus, setClaimStatus] = useState<string>("");

  // Contract configuration
  const DUMMY_CONTRACT_ADDRESS = "0x1234567890123456789012345678901234567890";

  const connectWallet = async () => {
    setIsConnectingWallet(true);
    try {
      if (typeof window.ethereum !== 'undefined') {
        // First check if already connected
        const accounts = await window.ethereum.request({
          method: 'eth_accounts'
        }) as string[];
        
        if (accounts.length > 0) {
          // Already connected
          setWalletAddress(accounts[0]);
          checkWalletMatch(accounts[0]);
          return;
        }
        
        // Not connected, request connection
        const newAccounts = await window.ethereum.request({
          method: 'eth_requestAccounts'
        }) as string[];
        
        if (newAccounts.length > 0) {
          setWalletAddress(newAccounts[0]);
          checkWalletMatch(newAccounts[0]);
        }
      } else {
        setConnectionStatus("Please install MetaMask to connect your wallet.");
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      setConnectionStatus("Failed to connect wallet. Please try again.");
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const checkWalletMatch = (connectedAddress: string) => {
    if (connectedAddress.toLowerCase() === organizationAztecAddress.toLowerCase()) {
      setConnectionStatus("✅ Wallet verified! You are authorized to claim these funds.");
      setTimeout(() => {
        setCurrentStep("claim");
        setConnectionStatus("");
      }, 2000);
    } else {
      setConnectionStatus("❌ This wallet does not match the organization address. You are not authorized to claim these funds.");
    }
  };

  const handleClaim = async () => {
    setIsClaiming(true);
    setClaimStatus("Preparing claim transaction...");

    try {
      // Make dummy contract call similar to donation
      const claimAmountEth = (claimedAmount * 0.001).toString(); // Convert to ETH equivalent
      const claimAmountWei = parseEther(claimAmountEth);

      const transactionParameters = {
        to: DUMMY_CONTRACT_ADDRESS as `0x${string}`,
        from: walletAddress as `0x${string}`,
        value: "0x0", // No ETH being sent, just claiming
        data: "0x", // Could include claim function call data
      };

      setClaimStatus("Please confirm the transaction in MetaMask...");

      const txHash = (await window.ethereum!.request({
        method: "eth_sendTransaction",
        params: [transactionParameters],
      })) as string;

      setClaimStatus(`Transaction sent! Hash: ${txHash.substring(0, 10)}...`);

      // Update claim status to "claimed" in database
      setClaimStatus("Updating claim status...");
      await claimsService.updateClaimStatus(claimId, "claimed");

      setClaimStatus("🎉 Funds claimed successfully! The claim status has been updated.");
      
      setTimeout(() => {
        onClose();
        resetModal();
        // Refresh the page to show updated claim status
        window.location.reload();
      }, 3000);
    } catch (error) {
      console.error("Claim error:", error);
      const errorMessage = error instanceof Error ? error.message : "Transaction failed";
      setClaimStatus(`❌ Failed to claim funds: ${errorMessage}`);
      setIsClaiming(false);
    }
  };

  const resetModal = () => {
    setCurrentStep("wallet");
    setWalletAddress("");
    setIsConnectingWallet(false);
    setConnectionStatus("");
    setIsClaiming(false);
    setClaimStatus("");
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

          {/* Modal */}
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

                {/* Title */}
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 font-['Cinzel'] mb-2 drop-shadow-sm">
                    Claim Your Funds
                  </h2>
                  <div className="text-gray-800 font-['Cinzel'] text-sm">
                    <div className="font-bold">{organizationName}</div>
                    <div className="text-2xl font-black text-green-600 mt-1">
                      ${claimedAmount.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Step 1: Wallet Connection */}
                {currentStep === "wallet" && (
                  <>
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-bold text-gray-900 font-['Cinzel'] mb-2">
                        Verify Your Identity
                      </h3>
                      <p className="text-gray-700 font-['Cinzel'] text-sm">
                        Connect your wallet to verify you are authorized to claim these funds
                      </p>
                    </div>

                    {connectionStatus && (
                      <div className="mb-6 p-3 bg-amber-200/70 rounded-lg border border-amber-600/50">
                        <p className="text-gray-900 font-['Cinzel'] text-sm text-center font-medium">
                          {connectionStatus}
                        </p>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-3 flex flex-col items-center">
                        <button
                          onClick={connectWallet}
                          disabled={isConnectingWallet}
                          className="bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 disabled:bg-gray-400/20 disabled:border-gray-400/30 text-gray-900 font-bold py-4 px-8 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none font-['Cinzel'] flex items-center justify-center min-w-[240px]"
                        >
                          <img
                            src="/MetaMask.png"
                            alt="MetaMask"
                            className="w-6 h-6 mr-3"
                          />
                          {isConnectingWallet ? "Connecting..." : "Connect MetaMask"}
                        </button>
                        <p className="text-gray-700 font-['Cinzel'] text-xs text-center italic px-2 max-w-xs">
                          Verify your wallet matches the organization address
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Step 2: Claim Funds */}
                {currentStep === "claim" && (
                  <>
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-bold text-gray-900 font-['Cinzel'] mb-2">
                        Ready to Claim
                      </h3>
                      <p className="text-gray-700 font-['Cinzel'] text-sm mb-4">
                        Your wallet has been verified. You can now claim your approved funds.
                      </p>
                      
                      <div className="bg-green-100/50 border border-green-500/30 rounded-lg p-3 mb-4">
                        <p className="text-green-800 font-['Cinzel'] text-xs">
                          ✅ Wallet verified: {walletAddress.substring(0, 6)}...{walletAddress.substring(38)}
                        </p>
                      </div>
                    </div>

                    {claimStatus && (
                      <div className="mb-6 p-3 bg-amber-200/70 rounded-lg border border-amber-600/50">
                        <p className="text-gray-900 font-['Cinzel'] text-sm text-center font-medium">
                          {claimStatus}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={handleClaim}
                      disabled={isClaiming}
                      className="w-full bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 disabled:bg-gray-400/20 disabled:border-gray-400/30 disabled:text-gray-500 text-gray-900 font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none font-['Cinzel']"
                    >
                      {isClaiming ? (
                        <div className="flex items-center justify-center">
                          <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-900"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Claiming Funds...
                        </div>
                      ) : (
                        `Claim $${claimedAmount.toLocaleString()}`
                      )}
                    </button>
                  </>
                )}

                <div className="mt-8 text-center">
                  <p className="text-gray-800 font-['Cinzel'] text-xs italic">
                    ✨ May these funds bring relief to those in need ✨
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