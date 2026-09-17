import React, { useEffect, useRef, useState } from 'react';
import {
  Volume2,
  RefreshCw,
  Sparkles,
  RotateCcw,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react';

const defaultFormatAudioTime = (sec) => {
  if (isNaN(sec) || sec === null) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

// ==========================================
// 2. MAIN EXECUTIVE BRIEFING PAGE COMPONENT
// ==========================================
export default function ExecutiveBriefingPage({
  briefing,
  briefingLoading,
  briefingPollStatus,
  onTriggerBriefing,
  audioPlaying,
  setAudioPlaying,
  audioCurrentTime = 0,
  audioDuration = 0,
  playbackSpeed = 1.0,
  audioPlayerRef,
  apiBase = import.meta.env.VITE_API_BASE_URL || '',
  formatAudioTime = defaultFormatAudioTime,
  onTogglePlay,
  onAudioSeek,
  onSpeedChange,
  onSkipTime,
  onAudioTimeUpdate,
  onAudioLoadedMetadata,
  copiedTranscript,
  isSpeaking,
  onCopyTranscript,
  onSpeakTranscript,
}) {
  const [showScript, setShowScript] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const isPlayingVoice = Boolean(audioPlaying || isSpeaking);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsLoaded(true);
      });
    });
    return () => cancelAnimationFrame(frameId);
  }, []);

  const audioSrc = briefing?.audio_url
    ? `${apiBase}${briefing.audio_url}`
    : (briefing?.media_url ? `${apiBase}${briefing.media_url}` : '');

  const jobStatus = briefing?.status || briefingPollStatus || 'idle';
  const isQueued = jobStatus === 'queued';
  const isProcessing = jobStatus === 'processing' || briefingPollStatus === 'rendering';
  const isFailed = jobStatus === 'failed';
  const isDone = jobStatus === 'done' || jobStatus === 'ready';

  const isSynthesizing = briefingLoading || isQueued || isProcessing;

  useEffect(() => {
    if (audioPlayerRef?.current && audioSrc) {
      audioPlayerRef.current.load();
    }
  }, [audioSrc, audioPlayerRef]);

  return (
    <>
      <style>{`
        @keyframes voiceEqualizerBounce {
          0%, 100% { height: 4px; }
          50% { height: 18px; }
        }
        @keyframes pulseGlowRing {
          0%, 100% { transform: scale(1); opacity: 0.35; }
          50% { transform: scale(1.08); opacity: 0.65; }
        }
      `}</style>

      {/* 100% Full Width and Height Outer Frame */}
      <div
        className="exec-briefing-outer"
        style={{
          position: 'relative',
          width: '100%',
          minHeight: 'calc(100vh - 140px)',
          borderRadius: '20px',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.75) 0%, rgba(239, 246, 255, 0.75) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.9)',
          boxShadow: '0 8px 32px rgba(10, 102, 194, 0.06)',
          padding: '24px',
          boxSizing: 'border-box'
        }}
      >
        {/* Ambient Glowing Rings (Pure CSS, 0 WebGL overhead) */}
        <div
          style={{
            position: 'absolute',
            width: '450px',
            height: '450px',
            borderRadius: '50%',
            background: isPlayingVoice
              ? 'radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, rgba(37, 99, 235, 0.08) 50%, transparent 70%)'
              : 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, rgba(30, 58, 138, 0.06) 50%, transparent 70%)',
            filter: 'blur(50px)',
            animation: 'pulseGlowRing 6s ease-in-out infinite',
            pointerEvents: 'none'
          }}
        />

        {/* Foreground Briefing Box */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: '640px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}
        >
          <div
            className="exec-briefing-card"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(16px)',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              opacity: isLoaded ? 1 : 0,
              transform: isLoaded ? 'translateY(0px)' : 'translateY(40px)',
              transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
              willChange: 'transform, opacity'
            }}
          >
            {/* Header Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '12px',
                borderBottom: '1px solid #e2e8f0'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#0f172a'
                }}
              >
                <div
                  className="exec-header-icon"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    backgroundColor: '#eff6ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Volume2 style={{ width: '16px', height: '16px', color: '#0a66c2' }} />
                </div>
                <span className="exec-text-label">Executive Briefing</span>

                {/* Job Lifecycle Status Badge */}
                {isQueued && (
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Clock style={{ width: '11px', height: '11px' }} /> QUEUED
                  </span>
                )}
                {isProcessing && (
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <RefreshCw style={{ width: '11px', height: '11px', animation: 'spin 1s linear infinite' }} /> PROCESSING
                  </span>
                )}
                {isFailed && (
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <XCircle style={{ width: '11px', height: '11px' }} /> FAILED
                  </span>
                )}
                {isDone && briefing && (
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 style={{ width: '11px', height: '11px' }} /> READY
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={onTriggerBriefing}
                disabled={isSynthesizing}
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#0a66c2',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: isSynthesizing ? 'not-allowed' : 'pointer',
                  opacity: isSynthesizing ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isSynthesizing ? (
                  <>
                    <RefreshCw style={{ width: '13px', height: '13px', animation: 'spin 1s linear infinite' }} />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles style={{ width: '13px', height: '13px' }} />
                    <span>{briefing ? 'Regenerate' : 'Generate'}</span>
                  </>
                )}
              </button>
            </div>

            {/* State 1: Async Job Queued */}
            {isQueued ? (
              <div
                className="exec-audio-deck"
                style={{
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '12px',
                  padding: '28px 16px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <Clock style={{ width: '22px', height: '22px', color: '#d97706' }} />
                <div className="exec-text-label" style={{ fontSize: '13px', color: '#92400e', fontWeight: 600 }}>
                  Job Queued — Waiting for Background Worker...
                </div>
                <p style={{ fontSize: '11px', color: '#b45309', margin: 0 }}>
                  Your audio briefing job is queued in the non-blocking worker pipeline.
                </p>
              </div>
            ) : isProcessing ? (
              /* State 2: Async Job Processing */
              <div
                className="exec-audio-deck"
                style={{
                  backgroundColor: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '12px',
                  padding: '28px 16px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <RefreshCw style={{ width: '22px', height: '22px', color: '#0284c7', animation: 'spin 1s linear infinite' }} />
                <div className="exec-text-label" style={{ fontSize: '13px', color: '#0369a1', fontWeight: 600 }}>
                  Processing Executive Voice Briefing...
                </div>
                <p style={{ fontSize: '11px', color: '#0284c7', margin: 0 }}>
                  Vectorizing top match alignments & synthesizing multi-tier neural voice audio.
                </p>
              </div>
            ) : isFailed ? (
              /* State 3: Async Job Failed */
              <div
                className="exec-audio-deck"
                style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fca5a5',
                  borderRadius: '12px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <AlertCircle style={{ width: '24px', height: '24px', color: '#ef4444' }} />
                <div>
                  <div style={{ fontSize: '13px', color: '#b91c1c', fontWeight: 700 }}>
                    Async Briefing Generation Failed
                  </div>
                  <p style={{ fontSize: '11px', color: '#991b1b', marginTop: '4px', marginBottom: 0 }}>
                    {briefing?.fallback_reason || 'The background task encountered an issue or timed out.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onTriggerBriefing}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <RefreshCw style={{ width: '13px', height: '13px' }} />
                  <span>Retry Job</span>
                </button>
              </div>
            ) : briefing && (briefing.media_url || briefing.audio_url || briefing.script) ? (
              /* State 2: Active Audio Player Deck with Voice Waveform Animation */
              <div
                className="exec-audio-deck"
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: isPlayingVoice ? '#10b981' : '#0a66c2'
                      }}
                    />
                    <span className="exec-text-label" style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                      {isPlayingVoice ? 'Speaking' : 'Ready'}
                    </span>

                    {/* Live Waveform Equalizer */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '18px', marginLeft: '6px' }}>
                      {[0.1, 0.35, 0.2, 0.5, 0.25].map((delay, idx) => (
                        <span
                          key={idx}
                          style={{
                            width: '3px',
                            backgroundColor: '#0a66c2',
                            borderRadius: '9999px',
                            height: isPlayingVoice ? '18px' : '4px',
                            animation: isPlayingVoice ? `voiceEqualizerBounce 0.8s ease-in-out infinite ${delay}s` : 'none',
                            transition: 'height 0.2s ease'
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="exec-text-label" style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
                    {formatAudioTime(audioCurrentTime)} / {formatAudioTime(audioDuration || 60)}
                  </div>
                </div>

                <div style={{ width: '100%' }}>
                  <input
                    type="range"
                    min="0"
                    max={audioDuration || 60}
                    step="0.1"
                    value={audioCurrentTime}
                    onChange={onAudioSeek}
                    style={{
                      width: '100%',
                      accentColor: '#0a66c2',
                      cursor: 'pointer',
                      height: '5px',
                      backgroundColor: '#cbd5e1',
                      borderRadius: '9999px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => onSkipTime(-10)}
                    className="exec-action-btn"
                    style={{
                      padding: '8px',
                      borderRadius: '8px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#475569',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Rewind 10s"
                  >
                    <RotateCcw style={{ width: '14px', height: '14px' }} />
                  </button>

                  <button
                    type="button"
                    onClick={onTogglePlay}
                    disabled={!audioSrc}
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      backgroundColor: '#0a66c2',
                      color: '#ffffff',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: !audioSrc ? 'not-allowed' : 'pointer',
                      opacity: !audioSrc ? 0.5 : 1
                    }}
                    title={audioPlaying ? 'Pause' : 'Play'}
                  >
                    {audioPlaying ? (
                      <Pause style={{ width: '16px', height: '16px', fill: 'currentColor' }} />
                    ) : (
                      <Play style={{ width: '16px', height: '16px', fill: 'currentColor', marginLeft: '2px' }} />
                    )}
                  </button>

                  {briefing.script && onSpeakTranscript && (
                    <button
                      type="button"
                      onClick={() => onSpeakTranscript(briefing.script)}
                      className="exec-action-btn"
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        border: isSpeaking ? '1px solid #0a66c2' : '1px solid #cbd5e1',
                        backgroundColor: isSpeaking ? '#0a66c2' : '#ffffff',
                        color: isSpeaking ? '#ffffff' : '#334155'
                      }}
                    >
                      <Volume2 style={{ width: '13px', height: '13px' }} />
                      <span>{isSpeaking ? 'Stop' : 'Browser Voice'}</span>
                    </button>
                  )}
                </div>

                {briefing.script && (
                  <div style={{ paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
                    <button
                      type="button"
                      onClick={() => setShowScript(!showScript)}
                      className="exec-script-toggle"
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        color: '#64748b',
                        background: 'none',
                        border: 'none',
                        padding: '2px 0',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>Script Transcript</span>
                      {showScript ? <ChevronUp style={{ width: '14px', height: '14px' }} /> : <ChevronDown style={{ width: '14px', height: '14px' }} />}
                    </button>

                    {showScript && (
                      <div
                        className="exec-script-box"
                        style={{
                          marginTop: '8px',
                          padding: '12px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#334155',
                          lineHeight: '1.6',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <p style={{ margin: 0 }}>{briefing.script}</p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => onCopyTranscript(briefing.script)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              color: '#0a66c2',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            {copiedTranscript ? <Check style={{ width: '12px', height: '12px', color: '#059669' }} /> : <Copy style={{ width: '12px', height: '12px' }} />}
                            <span>{copiedTranscript ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <audio
                  key={audioSrc || 'empty-audio'}
                  ref={audioPlayerRef}
                  src={audioSrc}
                  onTimeUpdate={onAudioTimeUpdate}
                  onLoadedMetadata={onAudioLoadedMetadata}
                  onPlay={() => setAudioPlaying(true)}
                  onPause={() => setAudioPlaying(false)}
                  onEnded={() => setAudioPlaying(false)}
                  onError={(e) => {
                    console.warn('Audio error:', e);
                    setAudioPlaying(false);
                  }}
                  preload="auto"
                />
              </div>
            ) : (
              /* State 3: Empty State */
              <div
                className="exec-audio-deck"
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  padding: '28px 16px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <Volume2 style={{ width: '22px', height: '22px', color: '#94a3b8' }} />
                <p className="exec-text-label" style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                  No active voice briefing generated yet.
                </p>
                <button
                  type="button"
                  onClick={onTriggerBriefing}
                  disabled={isSynthesizing}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#0a66c2',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Sparkles style={{ width: '13px', height: '13px' }} />
                  <span>Generate Briefing</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
