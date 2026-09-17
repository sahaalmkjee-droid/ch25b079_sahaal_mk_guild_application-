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
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      {/* Semi-transparent dark backdrop overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(2px)',
          transition: 'opacity 0.2s ease'
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centered Modal Container */}
      <div
        style={{
          position: 'relative',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e5e7eb',
          width: '100%',
          maxWidth: '672px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 10
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, rgba(249,250,251,0.8), #ffffff, rgba(249,250,251,0.8))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                backgroundColor: '#eff6ff',
                color: '#0a66c2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #dbeafe',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
              }}
            >
              <Coins style={{ width: '20px', height: '20px' }} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#111827',
                  lineHeight: 1.25,
                  margin: 0
                }}
              >
                Cost & Token Analytics Dashboard
              </h2>
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px', margin: 0 }}>
                Real-time API token consumption & rupee billing telemetry
              </p>
            </div>
          </div>

          {/* Top-Right Close Button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px',
              color: '#9ca3af',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '9999px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s, color 0.2s'
            }}
            title="Close (Esc)"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
              e.currentTarget.style.color = '#374151';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#9ca3af';
            }}
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}
        >
          {/* KPI Metrics Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '16px'
            }}
          >
            {/* 1. Total Tokens Consumed */}
            <div
              style={{
                backgroundColor: 'rgba(249, 250, 251, 0.9)',
                border: '1px solid rgba(229, 231, 235, 0.9)',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#6b7280',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>Tokens Consumed</span>
                <Cpu style={{ width: '14px', height: '14px', color: '#3b82f6' }} />
              </div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 900,
                  color: '#111827',
                  marginTop: '8px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                }}
              >
                {totalTokens.toLocaleString()}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#6b7280',
                  marginTop: '4px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}
              >
                <span>In: {(analytics.total_tokens_in || 0).toLocaleString()}</span>
                <span>Out: {(analytics.total_tokens_out || 0).toLocaleString()}</span>
              </div>
            </div>

            {/* 2. Total Spend (INR) */}
            <div
              style={{
                backgroundColor: 'rgba(236, 253, 245, 0.6)',
                border: '1px solid rgba(167, 243, 208, 0.8)',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#065f46',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>Total Spend (INR)</span>
                <TrendingUp style={{ width: '14px', height: '14px', color: '#059669' }} />
              </div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 900,
                  color: '#047857',
                  marginTop: '8px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                }}
              >
                ₹ {totalCostInr}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#059669',
                  marginTop: '4px',
                  fontWeight: 500
                }}
              >
                Standard ₹ 6.25 / 1M tokens
              </div>
            </div>

            {/* 3. Pricing Tier / Model Info */}
            <div
              style={{
                backgroundColor: 'rgba(239, 246, 255, 0.6)',
                border: '1px solid rgba(191, 219, 254, 0.8)',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#0a66c2',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span>Pricing Tier</span>
                <Sparkles style={{ width: '14px', height: '14px', color: '#0a66c2' }} />
              </div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 900,
                  color: '#111827',
                  marginTop: '8px'
                }}
              >
                Gemini 2.5 Flash
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                + text-embedding-004
              </div>
            </div>
          </div>

          {/* Itemized Feature Cost Breakdown Table Container */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: '14px 20px',
                backgroundColor: 'rgba(249, 250, 251, 0.8)',
                borderBottom: '1px solid rgba(229, 231, 235, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#111827',
                    margin: 0
                  }}
                >
                  Itemized Feature Cost Breakdown
                </h3>
                <p style={{ fontSize: '11px', color: '#6b7280', margin: 0, marginTop: '2px' }}>
                  Detailed consumption per AI service module
                </p>
              </div>

              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  title="Refresh telemetry"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                  }}
                >
                  <RefreshCw style={{ width: '14px', height: '14px', color: '#6b7280' }} />
                  <span>Refresh</span>
                </button>
              )}
            </div>

            {/* Structured Table */}
            {!analytics.features || analytics.features.length === 0 ? (
              <div
                style={{
                  padding: '32px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: '#9ca3af'
                }}
              >
                No billing events logged yet for your user account.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    fontSize: '12px',
                    borderCollapse: 'collapse'
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        backgroundColor: '#f9fafb',
                        color: '#6b7280',
                        fontWeight: 600,
                        borderBottom: '1px solid #e5e7eb'
                      }}
                    >
                      <th style={{ padding: '10px 16px', fontWeight: 700, color: '#374151' }}>
                        Feature Name
                      </th>
                      <th
                        style={{
                          padding: '10px 16px',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: '#374151'
                        }}
                      >
                        Input Tokens
                      </th>
                      <th
                        style={{
                          padding: '10px 16px',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: '#374151'
                        }}
                      >
                        Output Tokens
                      </th>
                      <th
                        style={{
                          padding: '10px 16px',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: '#374151'
                        }}
                      >
                        Computed Cost (INR)
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                    }}
                  >
                    {analytics.features.map((f, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: '1px solid #f3f4f6',
                          transition: 'background-color 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(239, 246, 255, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <td
                          style={{
                            padding: '12px 16px',
                            fontFamily: 'sans-serif',
                            fontWeight: 600,
                            color: '#111827',
                            textTransform: 'capitalize'
                          }}
                        >
                          {f.feature?.replace(/_/g, ' ') || 'AI Service'}
                        </td>
                        <td
                          style={{
                            padding: '12px 16px',
                            textAlign: 'right',
                            color: '#4b5563'
                          }}
                        >
                          {(f.tokens_in || 0).toLocaleString()}
                        </td>
                        <td
                          style={{
                            padding: '12px 16px',
                            textAlign: 'right',
                            color: '#4b5563'
                          }}
                        >
                          {(f.tokens_out || 0).toLocaleString()}
                        </td>
                        <td
                          style={{
                            padding: '12px 16px',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: '#047857'
                          }}
                        >
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
        <div
          style={{
            padding: '14px 24px',
            backgroundColor: '#f9fafb',
            borderTop: '1px solid #f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: '#6b7280'
          }}
        >
          <span>Telemetry updated automatically per AI call</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#e5e7eb',
              color: '#1f2937',
              fontWeight: 600,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#d1d5db';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#e5e7eb';
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}