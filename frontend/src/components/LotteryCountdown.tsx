import React, { useState, useEffect } from 'react';
import { Event } from '../lib/types/database';
import { lotteryTimerService } from '../lib/services/lotteryTimer';

interface LotteryCountdownProps {
  event: Event;
  onLotteryComplete?: (winner: string, prizeAmount: number) => void;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

export default function LotteryCountdown({ event, onLotteryComplete }: LotteryCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!event.lottery_end_time || event.lottery_status !== 'active') {
      return;
    }

    const updateTimer = () => {
      const endTime = new Date(event.lottery_end_time!);
      const now = new Date();
      const totalMs = endTime.getTime() - now.getTime();

      if (totalMs <= 0) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 });
        return;
      }

      const days = Math.floor(totalMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((totalMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((totalMs % (1000 * 60)) / 1000);

      setTimeRemaining({ days, hours, minutes, seconds, total: totalMs });
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [event.lottery_end_time, event.lottery_status]);

  const handleManualTrigger = async () => {
    if (!window.confirm('Are you sure you want to manually trigger the lottery? This action cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    try {
      await lotteryTimerService.manuallyExecuteLottery(event.id);
      // Refresh the page to show updated lottery status
      window.location.reload();
    } catch (error) {
      console.error('Error triggering lottery:', error);
      alert('Failed to trigger lottery. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show anything if lottery isn't configured properly
  if (!event.disaster_hash) {
    return null;
  }

  // Show lottery ended state
  if (event.lottery_status === 'ended') {
    return (
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 p-8 shadow-2xl mb-8">
        <div className="text-center">
          <h3 className="text-3xl font-bold text-gray-900 mb-4 font-['Cinzel'] drop-shadow-sm">
            Raffle Complete!
          </h3>
          {event.lottery_winner ? (
            <div className="text-gray-800 font-['Cinzel']">
              <p className="text-xl font-semibold mb-4">The Chosen One:</p>
              <div className="bg-amber-100/30 rounded-xl p-4 border border-amber-200/50 mb-4">
                <p className="text-sm font-mono text-gray-700 break-all font-bold">
                  {event.lottery_winner}
                </p>
              </div>
              <p className="text-gray-600 font-['Cinzel'] text-md italic font-bold">
                (5% of total donations has been bestowed upon the winner)
              </p>
              {event.lottery_transaction_hash && (
                <div className="mt-4">
                  <a 
                    href={`https://evm-testnet.flowscan.io/tx/${event.lottery_transaction_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center bg-white/20 hover:bg-white/30 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors font-['Cinzel'] text-sm backdrop-blur-sm border border-white/30"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View Transaction
                  </a>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-700 font-['Cinzel'] text-lg">
              No worthy souls found (no donations received)
            </p>
          )}
        </div>
      </div>
    );
  }

  // Show loading state while time is being calculated
  if (!timeRemaining) {
    return (
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 p-8 shadow-2xl mb-8">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-amber-200/50 h-16 w-16"></div>
          <div className="flex-1 space-y-3 py-2">
            <div className="h-6 bg-amber-200/50 rounded w-3/4"></div>
            <div className="h-4 bg-amber-200/50 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  // Show lottery completed state when timer reaches zero
  if (timeRemaining.total <= 0) {
    return (
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 p-8 shadow-2xl mb-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-400 to-pink-500 rounded-full mb-6 shadow-xl animate-pulse">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-4 font-['Cinzel'] drop-shadow-sm">
            ⏰ Divine Moment Arrived!
          </h3>
          <p className="text-gray-700 font-['Cinzel'] text-lg mb-6">
            The heavenly raffle is being drawn. The chosen soul will be revealed shortly.
          </p>
          <div className="inline-flex items-center text-amber-700 font-['Cinzel'] font-semibold">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-700 mr-3"></div>
            Consulting the divine oracle...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 p-8 shadow-2xl mb-8">
      <div className="text-center">
        {/* Header */}
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full mb-6 shadow-xl">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
          </svg>
        </div>

        <h3 className="text-3xl font-bold text-gray-900 mb-4 font-['Cinzel'] drop-shadow-sm">
          🎰 Divine Raffle Active
        </h3>
        <p className="text-gray-700 font-['Cinzel'] text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
          Donate to this sacred cause to enter the heavenly raffle for a chance to receive divine blessings worth 5% of all donations!
        </p>

        {/* Countdown Timer */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg">
            <div className="text-4xl font-bold text-gray-900 font-['Cinzel'] mb-2 drop-shadow-sm">
              {timeRemaining.days}
            </div>
            <div className="text-sm text-gray-700 font-['Cinzel'] font-semibold">
              Days
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg">
            <div className="text-4xl font-bold text-gray-900 font-['Cinzel'] mb-2 drop-shadow-sm">
              {timeRemaining.hours}
            </div>
            <div className="text-sm text-gray-700 font-['Cinzel'] font-semibold">
              Hours
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg">
            <div className="text-4xl font-bold text-gray-900 font-['Cinzel'] mb-2 drop-shadow-sm">
              {timeRemaining.minutes}
            </div>
            <div className="text-sm text-gray-700 font-['Cinzel'] font-semibold">
              Minutes
            </div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 border border-white/30 shadow-lg">
            <div className="text-4xl font-bold text-gray-900 font-['Cinzel'] mb-2 drop-shadow-sm">
              {timeRemaining.seconds}
            </div>
            <div className="text-sm text-gray-700 font-['Cinzel'] font-semibold">
              Seconds
            </div>
          </div>
        </div>

        {/* Raffle Info */}
        <div className="bg-amber-100/20 backdrop-blur-sm rounded-2xl p-6 border border-amber-200/30 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-amber-100/60 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="font-bold text-gray-900 font-['Cinzel'] mb-1">Divine Prize</div>
              <div className="text-gray-700 font-['Cinzel'] text-sm">5% of Total Donations</div>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-amber-100/60 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div className="font-bold text-gray-900 font-['Cinzel'] mb-1">Entry Method</div>
              <div className="text-gray-700 font-['Cinzel'] text-sm">Any Donation Amount</div>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-amber-100/60 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="font-bold text-gray-900 font-['Cinzel'] mb-1">Divine Selection</div>
              <div className="text-gray-700 font-['Cinzel'] text-sm">Random from All Donors</div>
            </div>
          </div>
        </div>

        {/* End time display */}
        <p className="text-gray-600 font-['Cinzel'] text-sm mb-6 italic">
          Sacred raffle concludes on: {new Date(event.lottery_end_time!).toLocaleString()}
        </p>

        {/* Manual trigger button for testing/admin */}
        {process.env.NODE_ENV === 'development' && (
          <button
            onClick={handleManualTrigger}
            disabled={isLoading}
            className="inline-flex items-center bg-white/20 hover:bg-white/30 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors font-['Cinzel'] text-sm backdrop-blur-sm border border-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700 mr-2"></div>
                Invoking...
              </>
            ) : (
              'Manual Trigger (Dev Only)'
            )}
          </button>
        )}
      </div>
    </div>
  );
} 