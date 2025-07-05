"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { claimsService } from "../lib/dynamodb/claims";
import { Claim } from "../lib/types/database";

interface RequestFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventTitle: string;
  eventId: string;
  disasterHash: string;
}

interface ApiResponse {
  amount: number;
  comment: string;
  sources: string[];
  flow_balance: number;
  usd_value: number;
  raw_agent_response: string;
}

export default function RequestFundsModal({
  isOpen,
  onClose,
  eventTitle,
  eventId,
  disasterHash,
}: RequestFundsModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [organizationName, setOrganizationName] = useState<string>("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string>("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

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
          setConnectionStatus(`Wallet already connected: ${accounts[0].substring(0, 6)}...${accounts[0].substring(38)}`);
          
          // Auto-progress after showing the message
          setTimeout(() => {
            setCurrentStep(2);
            setConnectionStatus("");
            setIsConnectingWallet(false);
          }, 1500);
          return;
        }
        
        // Not connected, request connection
        const newAccounts = await window.ethereum.request({
          method: 'eth_requestAccounts'
        }) as string[];
        
        if (newAccounts.length > 0) {
          setWalletAddress(newAccounts[0]);
          setConnectionStatus("Wallet connected successfully!");
          setCurrentStep(2);
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

  const handleNextStep = () => {
    if (currentStep === 2 && organizationName.trim()) {
      setCurrentStep(3);
    }
  };

  const handlePrevStep = () => {
    if (currentStep === 3) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(1);
      setWalletAddress("");
    }
  };

  const handleSubmit = async () => {
    if (!reason.trim() || !organizationName.trim()) {
      setSubmitStatus("Please provide all required information.");
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus("Processing your request...");

    try {
      // Insert claim into database with organization details
      
      const claimData = await claimsService.createClaim({
        event_id: eventId,
        organization_name: organizationName.trim(),
        claimed_amount: 0,
        organization_aztec_address: walletAddress,
        reason: reason.trim(),
        claim_state: "voting",
        claims_hash: "",
      });

      setSubmitStatus(
        `Success! Your funding request  has been submitted. AI is analyzing your works.`
      );
      setIsProcessing(true);

      const apiUrl = "/api";

      console.log(JSON.stringify({
        statement: reason,
        disaster_hash: disasterHash
      }));

      const apiResponse = await fetch(`${apiUrl}/fact-check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        mode: "cors",
        body: JSON.stringify({
          statement: reason,
          disaster_hash: disasterHash
        }),
      });
      const data = await apiResponse.json();
      console.log(data);

      // Update claim with AI analysis results
      const updatedClaimData: Partial<Omit<Claim, "id" | "created_at">> = {
        claimed_amount: data.amount,
        claim_state: data.amount > 0 ? "voting" : "rejected"
      };

      await claimsService.updateClaim(claimData.id, updatedClaimData);

      setApiResponse(data);
      setIsProcessing(false);
      setIsSuccess(true);
      
      if (data.amount > 0) {
        setSubmitStatus("Analysis complete! Your claim has been approved for community voting.");
      } else {
        setSubmitStatus("Analysis complete! Unfortunately, your claim was not verified and has been rejected.");
      }
      
      setIsSubmitting(false);
    } catch (error) {
      console.error("Error submitting funding request:", error);
      setSubmitStatus(
        `Error: ${
          error instanceof Error ? error.message : "Failed to submit request"
        }`
      );
      setIsSubmitting(false);
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setOrganizationName("");
    setLogoFile(null);
    setLogoPreview("");
    setReason("");
    setSubmitStatus("");
    setIsSubmitting(false);
    setIsSuccess(false);
    setIsProcessing(false);
    setApiResponse(null);
    setWalletAddress("");
    setIsConnectingWallet(false);
    setConnectionStatus("");
  };

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const renderStep1 = () => (
    <div className="h-full flex flex-col">
      <div className="text-center mb-3 flex-shrink-0">
        <h2 className="text-2xl font-bold text-gray-900 font-['Cinzel'] mb-2 drop-shadow-sm">
          Connect Your Wallet
        </h2>
        <div className="mt-2 text-gray-800 font-['Cinzel'] text-xs italic">
          For: {eventTitle}
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        {connectionStatus && (
          <div className="mb-6 p-3 bg-amber-200/70 rounded-lg border border-amber-600/50">
            <p className="text-gray-900 font-['Cinzel'] text-sm text-center font-medium">
              {connectionStatus}
            </p>
          </div>
        )}

        {walletAddress ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h4 className="text-lg font-bold text-gray-900 font-['Cinzel'] mb-2">
                Wallet Connected
              </h4>
              <p className="text-gray-700 font-['Cinzel'] text-sm break-all">
                {walletAddress}
              </p>
            </div>
            <button
              onClick={() => setCurrentStep(2)}
              className="w-full bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 text-gray-900 font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] font-['Cinzel']"
            >
              Continue to Organization Info
            </button>
          </div>
        ) : (
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
                Connect your wallet to submit funding requests
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="h-full flex flex-col">
      <div className="text-center mb-3 flex-shrink-0">
        <h3 className="text-2xl font-bold text-gray-900 font-['Cinzel'] mb-2">
          Organization Information
        </h3>
        <p className="text-gray-700 font-['Cinzel'] text-sm">
          Please provide your organization details
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-between min-h-0">
        <div className="space-y-5">
          {/* Logo Upload */}
          <div className="text-center">
            <label className="block text-gray-900 font-['Cinzel'] font-bold mb-3 text-base">
              Organization Logo
            </label>
            <div className="flex flex-col items-center space-y-3">
              {logoPreview && (
                <div className="w-20 h-20 rounded-xl overflow-hidden shadow-lg border-2 border-amber-600/50">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-white/20 backdrop-blur-sm border-2 border-amber-600/50 hover:bg-white/30 text-gray-900 px-5 py-2 rounded-lg text-sm font-semibold font-['Cinzel'] transition-all duration-300"
              >
                {logoPreview ? "Change Logo" : "Upload Logo"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Organization Name */}
          <div>
            <label className="block text-gray-900 font-['Cinzel'] font-bold mb-3 text-base">
              Organization Name *
            </label>
            <input
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="Enter your organization name..."
              maxLength={100}
              className="w-full p-4 bg-white/20 backdrop-blur-sm border-2 border-amber-600/50 rounded-xl text-gray-900 font-['Cinzel'] placeholder-gray-600 focus:outline-none focus:border-amber-700 focus:bg-white/30 transition-all text-base"
            />
            <div className="mt-2 text-gray-700 font-['Cinzel'] text-sm">
              {organizationName.length}/100 characters
            </div>
          </div>
        </div>

        {/* Next Button */}
        <div className="mt-1">
          <button
            onClick={handleNextStep}
            disabled={!organizationName.trim()}
            className="w-full bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 disabled:bg-gray-400/20 disabled:border-gray-400/30 disabled:text-gray-500 text-gray-900 font-bold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none font-['Cinzel']"
          >
            Continue to Funding Request
          </button>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="h-full flex flex-col">
      <div className="text-center mb-3 flex-shrink-0">
        <h3 className="text-2xl font-bold text-gray-900 font-['Cinzel'] mb-2">
          Funding Request Details
        </h3>
        <div className="text-gray-800 font-['Cinzel'] text-sm">
          Organization: <span className="font-bold">{organizationName}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-between min-h-0">
        <div className="flex-1 flex flex-col">
          {/* Reason Input */}
          <div className="flex-1 flex flex-col">
            <label className="block text-gray-900 font-['Cinzel'] font-bold mb-3 text-base flex-shrink-0">
              Funding Request Justification *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide a detailed explanation of why you need funding for this disaster relief effort. Include specific plans, activities, beneficiaries, timeline, and expected impact..."
              rows={6}
              maxLength={2000}
              className="flex-1 w-full p-4 bg-white/20 backdrop-blur-sm border-2 border-amber-600/50 rounded-xl text-gray-900 font-['Cinzel'] placeholder-gray-600 focus:outline-none focus:border-amber-700 focus:bg-white/30 transition-all resize-none text-sm leading-relaxed"
            />
            <div className="mt-2 flex justify-between items-center flex-shrink-0">
              <div className="text-gray-700 font-['Cinzel'] text-xs italic">
                💡 Include specific plans, timeline, beneficiaries, and expected outcomes
              </div>
              <div className="text-gray-700 font-['Cinzel'] text-xs font-medium">
                {reason.length}/2000 characters
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="mt-4 flex gap-3 flex-shrink-0">
          <button
            onClick={handlePrevStep}
            className="flex-1 bg-gray-500/20 backdrop-blur-xl border border-gray-500/30 hover:bg-gray-500/30 text-gray-900 font-bold py-3 px-4 rounded-xl transition-all duration-300 font-['Cinzel'] text-sm"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !reason.trim()}
            className="flex-1 bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 disabled:bg-gray-400/20 disabled:border-gray-400/30 disabled:text-gray-500 text-gray-900 font-bold py-3 px-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none font-['Cinzel'] text-sm"
          >
            {isSubmitting ? (
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
                {isProcessing ? "Analyzing..." : "Submitting..."}
              </div>
            ) : (
              "Submit Funding Request"
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const renderResults = () => (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900 font-['Cinzel'] mb-2">
          AI Analysis Results
        </h3>
        <div className="flex justify-center items-center gap-3">
          <span className="px-3 py-1 rounded-full text-sm font-bold font-['Cinzel'] bg-green-200 text-green-800">
            ✓ Analysis Complete
          </span>
          <span className="text-2xl font-bold text-amber-600 font-['Cinzel']">
            ${apiResponse?.amount?.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="bg-white/30 backdrop-blur-sm rounded-xl p-6 border border-amber-600/30">
        <h4 className="font-bold text-gray-900 font-['Cinzel'] mb-3 text-lg">
          Allocated Amount
        </h4>
        <p className="text-2xl font-bold text-gray-900 font-['Cinzel'] mb-4">
          ${apiResponse?.amount?.toLocaleString()} USD
        </p>
        <p className="text-lg text-gray-700 font-['Cinzel']">
          (≈ {apiResponse?.flow_balance?.toFixed(2)} FLOW)
        </p>
      </div>

      <div className="bg-white/30 backdrop-blur-sm rounded-xl p-6 border border-amber-600/30">
        <h4 className="font-bold text-gray-900 font-['Cinzel'] mb-3 text-lg">
          AI Assessment
        </h4>
        <p className="text-gray-800 font-['Cinzel'] text-base leading-relaxed">
          {apiResponse?.comment}
        </p>
      </div>

      <button
        onClick={onClose}
        className="w-full bg-white/10 backdrop-blur-xl border border-white/20 hover:bg-white/20 text-gray-900 font-bold py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] font-['Cinzel']"
      >
        Close
      </button>
    </div>
  );

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

          {/* Fixed Size Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotateX: -15 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, scale: 0.8, rotateX: 15 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="relative w-full max-w-4xl"
            style={{ height: "85vh", maxHeight: "700px", minHeight: "600px" }}
          >
            {/* Ancient Scroll Design */}
            <div
              className="relative rounded-2xl border-4 border-amber-800 shadow-2xl h-full flex flex-col"
              style={{ backgroundColor: "#cbb287" }}
            >
              {/* Scroll Decorations */}
              <div className="absolute -top-2 left-4 right-4 h-4 bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 rounded-full"></div>
              <div className="absolute -bottom-2 left-4 right-4 h-4 bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 rounded-full"></div>

              {/* Scroll Ends */}
              <div className="absolute -left-3 top-2 bottom-2 w-6 bg-gradient-to-b from-amber-800 to-amber-900 rounded-full shadow-lg"></div>
              <div className="absolute -right-3 top-2 bottom-2 w-6 bg-gradient-to-b from-amber-800 to-amber-900 rounded-full shadow-lg"></div>

              {/* Header Section - Fixed Height */}
              <div className="flex-shrink-0 p-6 pb-0">
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="absolute top-3 right-3 text-amber-900 hover:text-black transition-colors z-10"
                >
                  <svg
                    className="w-5 h-5"
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
                <div className="text-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-900 font-['Cinzel'] mb-1 drop-shadow-sm">
                    Request Funds
                  </h2>
                  <div className="text-gray-800 font-['Cinzel'] text-sm">
                    For: <span className="font-bold">{eventTitle}</span>
                  </div>

                  {/* Step Indicator - Only show during form steps */}
                  {!isSuccess && (
                    <div className="flex justify-center items-center mt-3 space-x-3">
                      <div
                        className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold font-['Cinzel'] ${
                          currentStep >= 1
                            ? "bg-amber-600 text-white"
                            : "bg-gray-300 text-gray-600"
                        }`}
                      >
                        1
                      </div>
                      <div
                        className={`w-8 h-1 rounded-full ${
                          currentStep >= 2 ? "bg-amber-600" : "bg-gray-300"
                        }`}
                      ></div>
                      <div
                        className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold font-['Cinzel'] ${
                          currentStep >= 2
                            ? "bg-amber-600 text-white"
                            : "bg-gray-300 text-gray-600"
                        }`}
                      >
                        2
                      </div>
                      <div
                        className={`w-8 h-1 rounded-full ${
                          currentStep >= 3 ? "bg-amber-600" : "bg-gray-300"
                        }`}
                      ></div>
                      <div
                        className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold font-['Cinzel'] ${
                          currentStep >= 3
                            ? "bg-amber-600 text-white"
                            : "bg-gray-300 text-gray-600"
                        }`}
                      >
                        3
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Message */}
                {submitStatus && !isSuccess && (
                  <div
                    className={`mb-3 p-2 rounded-lg border ${
                      submitStatus.startsWith("Error")
                        ? "bg-red-200/70 border-red-600/50"
                        : "bg-amber-200/70 border-amber-600/50"
                    }`}
                  >
                    <p className="text-gray-900 font-['Cinzel'] text-xs text-center font-medium">
                      {submitStatus}
                    </p>
                  </div>
                )}
              </div>

              {/* Content Section - Flexible Height */}
              <div className="flex-1 px-6 overflow-hidden">
                <div className="h-full flex flex-col">
                  {/* Form Steps */}
                  {!isSuccess && (
                    <>
                      {currentStep === 1 && renderStep1()}
                      {currentStep === 2 && renderStep2()}
                      {currentStep === 3 && renderStep3()}
                    </>
                  )}

                  {/* Results */}
                  {isSuccess && apiResponse && renderResults()}
                </div>
              </div>

              {/* Footer Section - Fixed Height */}
              {!isSuccess && (
                <div className="flex-shrink-0 p-6 pt-0">
                  <div className="text-center">
                    <p className="text-gray-800 font-['Cinzel'] text-xs italic">
                      ✨ May your efforts bring hope to those in need ✨
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
