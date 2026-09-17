import React, { useEffect } from 'react';
import { X, Coins, Cpu, TrendingUp, Sparkles, RefreshCw } from 'lucide-react';

export default function CostAnalyticsModal({
  isOpen,
  onClose,
  analytics = { total_tokens_in: 0, total_tokens_out: 0, total_cost_inr: 0, features: [] },
  onRefresh
}) {
  // Close on ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalTokens = (analytics.total_tokens_in || 0) + (analytics.total_tokens_out || 0);
  const totalCostInr = (analytics.total_cost_inr || 0).toFixed(4);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      {/* Semi-transparent dark backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centered Modal Container (w-full max-w-2xl) */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden z-10 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50/80 via-white to-gray-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0a66c2] flex items-center justify-center border border-blue-100 shadow-2xs">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                Cost & Token Analytics Dashboard
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Real-time API token consumption & rupee billing telemetry
              </p>
            </div>
          </div>

          {/* Top-Right Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* KPI Metrics Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* 1. Total Tokens Consumed */}
            <div className="bg-gray-50/90 border border-gray-200/90 rounded-xl p-4 shadow-2xs">
              <div className="text-[11px] font-bold text-gray-500 tracking-wider uppercase flex items-center justify-between">
                <span>Tokens Consumed</span>
                <Cpu className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div className="text-2xl font-black text-gray-900 mt-2 font-mono">
                {totalTokens.toLocaleString()}
              </div>
              <div className="text-[11px] text-gray-500 mt-1 flex justify-between">
                <span>In: {(analytics.total_tokens_in || 0).toLocaleString()}</span>
                <span>Out: {(analytics.total_tokens_out || 0).toLocaleString()}</span>
              </div>
            </div>

            {/* 2. Total Spend (INR) */}
            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4 shadow-2xs">
              <div className="text-[11px] font-bold text-emerald-800 tracking-wider uppercase flex items-center justify-between">
                <span>Total Spend (INR)</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-700 mt-2 font-mono">
                ₹ {totalCostInr}
              </div>
              <div className="text-[11px] text-emerald-600 mt-1 font-medium">
                Standard ₹ 6.25 / 1M tokens
              </div>
            </div>

            {/* 3. Pricing Tier / Model Info */}
            <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-4 shadow-2xs">
              <div className="text-[11px] font-bold text-[#0a66c2] tracking-wider uppercase flex items-center justify-between">
                <span>Pricing Tier</span>
                <Sparkles className="w-3.5 h-3.5 text-[#0a66c2]" />
              </div>
              <div className="text-lg sm:text-xl font-black text-gray-900 mt-2">
                Gemini 2.5 Flash
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                + text-embedding-004
              </div>
            </div>

          </div>

          {/* Itemized Feature Cost Breakdown Table Container */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-gray-50/80 border-b border-gray-200/80 flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-gray-900">
                  Itemized Feature Cost Breakdown
                </h3>
                <p className="text-[11px] text-gray-500">
                  Detailed consumption per AI service module
                </p>
              </div>

              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                  title="Refresh telemetry"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                  <span>Refresh</span>
                </button>
              )}
            </div>

            {/* Structured Table */}
            {!analytics.features || analytics.features.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                No billing events logged yet for your user account.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                      <th className="py-2.5 px-4 font-bold text-gray-700">Feature Name</th>
                      <th className="py-2.5 px-4 text-right font-bold text-gray-700">Input Tokens</th>
                      <th className="py-2.5 px-4 text-right font-bold text-gray-700">Output Tokens</th>
                      <th className="py-2.5 px-4 text-right font-bold text-gray-700">Computed Cost (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-mono">
                    {analytics.features.map((f, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-3 px-4 font-sans font-semibold text-gray-900 capitalize">
                          {f.feature?.replace(/_/g, ' ') || 'AI Service'}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">
                          {(f.tokens_in || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">
                          {(f.tokens_out || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-700">
                          ₹ {(f.cost_inr || 0).toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>Telemetry updated automatically per AI call</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
