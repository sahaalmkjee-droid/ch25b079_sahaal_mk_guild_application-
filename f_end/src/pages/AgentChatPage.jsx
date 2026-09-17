import React, { useState } from 'react';
import { ArrowUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function MarkdownMessage({ content, isUser }) {
  if (isUser) {
    return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{content}</div>;
  }

  return (
    <div
      className="chat-markdown-body"
      style={{
        fontSize: '14px',
        lineHeight: '1.6',
        color: '#111827',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ node, ...props }) => (
            <div className="chat-markdown-table-wrap" style={{ overflowX: 'auto', margin: '12px 0', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <table className="chat-markdown-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', backgroundColor: '#ffffff' }} {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="chat-markdown-thead" style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }} {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody className="chat-markdown-tbody" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="chat-markdown-tr" style={{ borderBottom: '1px solid #f1f5f9' }} {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="chat-markdown-th" style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', borderRight: '1px solid #e2e8f0' }} {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="chat-markdown-td" style={{ padding: '9px 14px', color: '#334155', verticalAlign: 'top', borderRight: '1px solid #f1f5f9' }} {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className="chat-markdown-strong" style={{ fontWeight: 700, color: '#111827' }} {...props} />
          ),
          b: ({ node, ...props }) => (
            <b className="chat-markdown-b" style={{ fontWeight: 700, color: '#111827' }} {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="chat-markdown-p" style={{ margin: '0 0 10px 0', lineHeight: '1.6' }} {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul
              className="chat-markdown-ul"
              style={{
                margin: '6px 0 12px 0',
                paddingLeft: '22px',
                listStyleType: 'disc',
                display: 'block'
              }}
              {...props}
            />
          ),
          ol: ({ node, ...props }) => (
            <ol
              className="chat-markdown-ol"
              style={{
                margin: '6px 0 12px 0',
                paddingLeft: '22px',
                listStyleType: 'decimal',
                display: 'block'
              }}
              {...props}
            />
          ),
          li: ({ node, ...props }) => (
            <li
              className="chat-markdown-li"
              style={{
                margin: '3px 0',
                lineHeight: '1.5',
                display: 'list-item'
              }}
              {...props}
            />
          ),
          h1: ({ node, ...props }) => (
            <h1 className="chat-markdown-h1" style={{ fontSize: '18px', fontWeight: 700, margin: '14px 0 8px 0', color: '#111827' }} {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="chat-markdown-h2" style={{ fontSize: '16px', fontWeight: 700, margin: '12px 0 6px 0', color: '#111827' }} {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="chat-markdown-h3" style={{ fontSize: '14px', fontWeight: 700, margin: '10px 0 4px 0', color: '#1f2937' }} {...props} />
          ),
          code: ({ node, inline, ...props }) =>
            inline ? (
              <code
                className="chat-markdown-inline-code"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.06)',
                  color: '#0f172a',
                  padding: '2px 5px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                }}
                {...props}
              />
            ) : (
              <pre
                className="chat-markdown-pre"
                style={{
                  backgroundColor: '#0f172a',
                  color: '#f8fafc',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  overflowX: 'auto',
                  fontSize: '12px',
                  margin: '10px 0'
                }}
              >
                <code {...props} />
              </pre>
            ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="chat-markdown-blockquote"
              style={{
                borderLeft: '3px solid #0a66c2',
                paddingLeft: '12px',
                margin: '8px 0',
                color: '#4b5563',
                fontStyle: 'italic'
              }}
              {...props}
            />
          ),
          a: ({ node, ...props }) => (
            <a
              className="chat-markdown-link"
              style={{ color: '#0a66c2', textDecoration: 'underline', fontWeight: 500 }}
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function AgentChatPage({
  messages = [],
  input,
  setInput,
  thinking,
  onSendMessage,
  chatBottomRef,
  currentUser = null
}) {
  const savedName = localStorage.getItem(currentUser?.id ? `nexus_display_name_${currentUser.id}` : 'nexus_display_name') || localStorage.getItem('nexus_display_name');
  const fullDisplayName = currentUser?.full_name || currentUser?.name || savedName || (currentUser?.email ? currentUser.email.split('@')[0] : 'Member');
  const rawFirstName = fullDisplayName.trim().split(/\s+/)[0] || 'Member';
  const userName = rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1);

  const activeUserMessages = messages.filter((m) => m.sender === 'user');
  const isChatStarted = activeUserMessages.length > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || thinking) return;
    onSendMessage();
  };

  const handleQuickPromptClick = (promptText) => {
    onSendMessage(promptText);
  };

  const quickPrompts = [
    {
      title: 'Closing Deadlines',
      prompt: 'Which job listings have closing deadlines within 7 days?'
    },
    {
      title: 'Analyze Skill Gaps',
      prompt: 'Analyze my resume and tell me my highest priority skill gaps for top jobs.'
    },
    {
      title: 'Remote AI Roles',
      prompt: 'Find the best remote Python and AI engineer roles with high compensation.'
    },
    {
      title: 'High Stipend Roles',
      prompt: 'Show me active developer positions offering top-tier salaries and stipends.'
    },
    {
      title: 'Interview Strategy',
      prompt: 'What core technical topics should I prepare for machine learning roles?'
    },
    {
      title: 'Top Matched Jobs',
      prompt: 'List the top 5 jobs with the highest cosine similarity match score to my resume.'
    }
  ];

  return (
    <>
      <style>{`
        @keyframes chatSlideInFromRight {
          0% {
            opacity: 0;
            transform: translateX(120px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .animated-chat-box {
          animation: chatSlideInFromRight 0.65s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
          will-change: transform, opacity;
        }

        .quick-prompt-btn {
          position: relative;
          padding: 14px;
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid rgba(229, 231, 235, 0.8);
          border-radius: 12px;
          text-align: left;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 112px;
          transform: scale(1);
          transform-origin: center center;
          transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
                      background 0.25s ease,
                      box-shadow 0.22s ease,
                      border-color 0.22s ease;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          z-index: 1;
        }

        /* Increase hover size to 1.4x and soften the glow */
        .quick-prompt-btn:hover {
          transform: scale(1.4);
          background: linear-gradient(135deg, #fff7ed 0%, #fed7aa 45%, #fdba74 100%) !important;
          border-color: transparent !important;
          box-shadow: 0 16px 28px -8px rgba(251, 146, 60, 0.28), 0 6px 10px -2px rgba(0, 0, 0, 0.06);
          z-index: 20;
        }

        .quick-prompt-btn:hover .arrow-icon-wrapper {
          background-color: #0284c7 !important;
          color: #ffffff !important;
        }

        .quick-prompt-btn:hover .prompt-card-title {
          color: #0369a1 !important;
        }

        .chat-input-form {
          transform: scale(1);
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 0.25s ease,
                      border-color 0.25s ease,
                      background-color 0.25s ease;
          will-change: transform, box-shadow;
        }

        .chat-input-form:hover,
        .chat-input-form:focus-within {
          transform: scale(1.015);
          box-shadow: 0 10px 25px -5px rgba(10, 102, 194, 0.2), 0 4px 10px -2px rgba(0, 0, 0, 0.06) !important;
          border-color: rgba(10, 102, 194, 0.5) !important;
          background-color: #ffffff !important;
        }
      `}</style>

      <div
        className="animated-chat-box"
        style={{
          border: '1px solid rgba(229, 231, 235, 0.8)',
          borderRadius: '16px',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '700px',
          fontFamily: 'sans-serif',
          background: 'linear-gradient(to bottom, #ffffff, rgba(239, 246, 255, 0.4), rgba(224, 231, 255, 0.6))'
        }}
      >
        {!isChatStarted ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '24px'
            }}
          >
            {/* Hero Gradient Heading */}
            <div style={{ maxWidth: '768px', margin: '0 auto', width: '100%', paddingTop: '16px', textAlign: 'left' }}>
              <h1
                style={{
                  fontSize: '48px',
                  fontWeight: 800,
                  letterSpacing: '-0.025em',
                  background: 'linear-gradient(to right, #0a66c2, #2563eb, #818cf8)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  margin: 0
                }}
              >
                Hello, {userName}
              </h1>
              <p
                className="chat-greeting-sub"
                style={{
                  fontSize: '36px',
                  fontWeight: 700,
                  color: '#d1d5db',
                  letterSpacing: '-0.025em',
                  marginTop: '8px',
                  marginBottom: 0
                }}
              >
                Where should we start?
              </p>
            </div>

            {/* Prompt Cards Grid */}
            <div
              style={{
                maxWidth: '768px',
                margin: '16px auto',
                width: '100%',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                padding: '8px 4px'
              }}
            >
              {quickPrompts.map((card, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="quick-prompt-btn"
                  onClick={() => handleQuickPromptClick(card.prompt)}
                >
                  <span className="prompt-card-title" style={{ fontSize: '12px', fontWeight: 700, color: '#1f2937', transition: 'color 0.2s ease' }}>
                    {card.title}
                  </span>
                  <p
                    className="prompt-card-sub"
                    style={{
                      fontSize: '11px',
                      color: '#6b7280',
                      lineHeight: '1.4',
                      margin: 0,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {card.prompt}
                  </p>
                  <div
                    className="arrow-icon-wrapper"
                    style={{
                      alignSelf: 'flex-end',
                      padding: '4px',
                      borderRadius: '50%',
                      backgroundColor: '#f3f4f6',
                      color: '#9ca3af',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <ArrowUp style={{ width: '12px', height: '12px', transform: 'rotate(45deg)' }} />
                  </div>
                </button>
              ))}
            </div>

            {/* Centered Large Prompt Bar */}
            <div style={{ maxWidth: '768px', margin: '0 auto', width: '100%', paddingBottom: '8px' }}>
              <form
                className="chat-input-form"
                onSubmit={handleSubmit}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '9999px',
                  padding: '10px 16px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              >
                <input
                  type="text"
                  className="chat-input-field"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask SAHAAL Agent anything..."
                  style={{
                    width: '100%',
                    backgroundColor: 'transparent',
                    fontSize: '14px',
                    color: '#111827',
                    border: 'none',
                    outline: 'none',
                    paddingRight: '40px',
                    paddingLeft: '8px'
                  }}
                />
                <button
                  type="submit"
                  disabled={thinking || !input.trim()}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    padding: '8px',
                    backgroundColor: '#0a66c2',
                    color: '#ffffff',
                    borderRadius: '50%',
                    border: 'none',
                    cursor: thinking || !input.trim() ? 'not-allowed' : 'pointer',
                    opacity: thinking || !input.trim() ? 0.3 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <ArrowUp style={{ width: '16px', height: '16px' }} />
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Message Stream */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justify: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '768px',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                    width: '100%'
                  }}
                >
                  <div
                    className={msg.sender === 'user' ? 'chat-bubble-user' : 'chat-bubble-agent'}
                    style={{
                      fontSize: '14px',
                      lineHeight: '1.6',
                      backgroundColor: msg.sender === 'user' ? '#0a66c2' : 'transparent',
                      color: msg.sender === 'user' ? '#ffffff' : '#111827',
                      padding: msg.sender === 'user' ? '10px 16px' : '0',
                      borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '0',
                      boxShadow: msg.sender === 'user' ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none',
                      border: 'none',
                      fontWeight: 400,
                      width: msg.sender === 'user' ? 'fit-content' : '100%',
                      maxWidth: msg.sender === 'user' ? '75%' : '100%',
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere'
                    }}
                  >
                    <MarkdownMessage content={msg.text} isUser={msg.sender === 'user'} />
                  </div>
                </div>
              ))}

              {thinking && (
                <div
                  className="chat-thinking-text"
                  style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    fontStyle: 'italic',
                    maxWidth: '768px',
                    marginRight: 'auto',
                    paddingTop: '4px'
                  }}
                >
                  Thinking...
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Bottom Controls */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                style={{
                  maxWidth: '768px',
                  margin: '0 auto',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  overflowX: 'auto',
                  paddingBottom: '4px'
                }}
              >
                {quickPrompts.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="chat-prompt-chip"
                    onClick={() => handleQuickPromptClick(chip.prompt)}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.5)',
                      border: '1px solid transparent',
                      color: '#374151',
                      fontSize: '11px',
                      fontWeight: 500,
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {chip.title}
                  </button>
                ))}
              </div>

              <form
                className="chat-input-form"
                onSubmit={handleSubmit}
                style={{
                  maxWidth: '768px',
                  margin: '0 auto',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid rgba(229, 231, 235, 0.9)',
                  borderRadius: '9999px',
                  padding: '6px 12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              >
                <input
                  type="text"
                  className="chat-input-field"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask follow-up questions..."
                  style={{
                    flex: 1,
                    backgroundColor: 'transparent',
                    fontSize: '14px',
                    color: '#111827',
                    border: 'none',
                    outline: 'none',
                    padding: '0 8px'
                  }}
                />

                <button
                  type="submit"
                  disabled={thinking || !input.trim()}
                  style={{
                    padding: '8px',
                    backgroundColor: '#0a66c2',
                    color: '#ffffff',
                    borderRadius: '50%',
                    border: 'none',
                    cursor: thinking || !input.trim() ? 'not-allowed' : 'pointer',
                    opacity: thinking || !input.trim() ? 0.3 : 1,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <ArrowUp style={{ width: '16px', height: '16px' }} />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}