import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  RefreshCw,
  Briefcase,
  MapPin,
  Bookmark,
  BookmarkCheck,
  DollarSign,
  Clock,
  ExternalLink,
  FileText,
  Upload,
  Clipboard,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

// Wrapper component to animate card sliding from the right on scroll
function AnimatedJobCard({ children, index = 0 }) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target); // Trigger once per card
        }
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -40px 0px'
      }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateX(0)' : 'translateX(90px)',
        transition: `all 0.55s cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(index * 0.06, 0.3)}s`,
        willChange: 'transform, opacity'
      }}
    >
      {children}
    </div>
  );
}

// Wrapper that adds pointer-hover: scale + colour lift
function HoverJobCard({ children }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        transform: hovered ? 'scale(1.01)' : 'scale(1)',
        transition: 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.22s ease, filter 0.22s ease',
        borderRadius: '12px',
        boxShadow: hovered
          ? '0 8px 24px rgba(10, 102, 194, 0.18), 0 2px 8px rgba(0,0,0,0.08)'
          : '0 2px 6px rgba(0, 0, 0, 0.04)',
        filter: hovered ? 'brightness(1.04)' : 'brightness(1)',
        willChange: 'transform, box-shadow, filter',
        cursor: 'pointer'
      }}
    >
      {children}
    </div>
  );
}


export default function RankedMatchesPage({
  matches = [],
  loadingMatches,
  searchQuery,
  setSearchQuery,
  onSearch,
  onToggleSave,
  onUploadResume,
  resumeUploading,
  resumeSuccess,
  scrapingJobs,
  scrapeSuccess,
  onTriggerScrape
}) {
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pastedResume, setPastedResume] = useState('');
  const fileInputRef = useRef(null);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        fontFamily: 'sans-serif',
        overflowX: 'hidden', // Prevents horizontal scrollbars while cards slide in
        paddingBottom: '24px'
      }}
    >
      {/* Resume Adding Box: PDF, TXT, or Copy & Paste */}
      <div
        className="ranked-resume-card"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '14px 18px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              className="ranked-icon-box"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                color: '#0a66c2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileText style={{ width: '18px', height: '18px' }} />
            </div>
            <div>
              <div className="ranked-card-title" style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                Resume Profile & Alignment Vector
              </div>
              <div className="ranked-card-subtitle" style={{ fontSize: '11px', color: '#64748b' }}>
                Add or update your resume via PDF, TXT, or direct text paste
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files?.[0] && onUploadResume) {
                  onUploadResume(e.target.files[0]);
                }
              }}
              accept=".pdf,.txt,.text,.md"
              style={{ display: 'none' }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={resumeUploading}
              className="ranked-btn-secondary"
              style={{
                padding: '6px 12px',
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#334155',
                cursor: resumeUploading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <Upload style={{ width: '13px', height: '13px', color: '#0a66c2' }} />
              <span>{resumeUploading ? 'Vectorizing...' : 'Upload PDF / TXT'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPasteBox((prev) => !prev)}
              className="ranked-btn-secondary"
              style={{
                padding: '6px 12px',
                backgroundColor: showPasteBox ? '#eff6ff' : '#f8fafc',
                border: `1px solid ${showPasteBox ? '#93c5fd' : '#cbd5e1'}`,
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                color: showPasteBox ? '#0a66c2' : '#334155',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <Clipboard style={{ width: '13px', height: '13px', color: '#0a66c2' }} />
              <span>{showPasteBox ? 'Hide Paste Box' : 'Copy & Paste Resume'}</span>
            </button>
          </div>
        </div>

        {resumeSuccess && (
          <div
            style={{
              padding: '6px 10px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#15803d',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <CheckCircle2 style={{ width: '14px', height: '14px', color: '#16a34a' }} />
            <span>{resumeSuccess}</span>
          </div>
        )}

        {showPasteBox && (
          <div
            className="ranked-paste-box"
            style={{
              marginTop: '4px',
              padding: '12px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                Paste Resume Text (Work experience, skills, summary, education):
              </span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (navigator.clipboard) {
                      const txt = await navigator.clipboard.readText();
                      if (txt) setPastedResume(txt);
                    }
                  } catch (e) {}
                }}
                style={{
                  fontSize: '11px',
                  color: '#0a66c2',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Paste from clipboard
              </button>
            </div>

            <textarea
              rows={5}
              value={pastedResume}
              onChange={(e) => setPastedResume(e.target.value)}
              placeholder="Paste your resume content here..."
              className="ranked-textarea"
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                {pastedResume.trim() ? pastedResume.trim().split(/\s+/).length : 0} words
              </span>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setPastedResume('');
                    setShowPasteBox(false);
                  }}
                  className="ranked-btn-secondary"
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={resumeUploading || !pastedResume.trim()}
                  onClick={() => {
                    if (pastedResume.trim() && onUploadResume) {
                      onUploadResume(pastedResume.trim());
                    }
                  }}
                  style={{
                    padding: '6px 14px',
                    backgroundColor: '#0a66c2',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: resumeUploading || !pastedResume.trim() ? 'not-allowed' : 'pointer',
                    opacity: resumeUploading || !pastedResume.trim() ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Sparkles style={{ width: '12px', height: '12px' }} />
                  <span>{resumeUploading ? 'Indexing...' : 'Save & Vectorize'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Semantic Job Query Box */}
      <div
        className="semantic-search-container"
        style={{
          background: 'linear-gradient(to right, #bdd2ee, #eef4fc)',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '16px 20px',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            className="semantic-search-title"
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: '#1f2937',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              letterSpacing: '0.05em'
            }}
          >
            <Search style={{ width: '16px', height: '16px', color: '#0a66c2' }} />
            SEMANTIC JOB SEARCH
          </span>
          <span className="semantic-search-sub" style={{ fontSize: '11px', color: '#323335' }}>
            Powered by gemini
          </span>
        </div>

        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '16px',
                height: '16px',
                color: '#9ca3af'
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search roles semantically (e.g. 'Senior Python AI Engineer with FastAPI experience')..."
              className="semantic-search-input"
              style={{
                width: '100%',
                paddingLeft: '40px',
                paddingRight: '16px',
                paddingTop: '10px',
                paddingBottom: '10px',
                backgroundColor: '#f9fafb',
                border: '1px solid #d1d5db',
                borderRadius: '9999px',
                fontSize: '12px',
                color: '#111827',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: '10px 20px',
              backgroundColor: '#0a66c2',
              color: '#ffffff',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
            }}
          >
            <Search style={{ width: '14px', height: '14px' }} />
            <span>Search</span>
          </button>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                onSearch('');
              }}
              style={{
                padding: '10px 16px',
                backgroundColor: '#f3f4f6',
                color: '#4b5563',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Scrape Success Notification */}
      {scrapeSuccess && (
        <div
          style={{
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            fontSize: '12px',
            padding: '10px 14px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span>{scrapeSuccess}</span>
        </div>
      )}

      {/* Match Grid Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingTop: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onTriggerScrape}
            disabled={scrapingJobs}
            style={{
              fontSize: '12px',
              color: '#0a66c2',
              background: 'none',
              border: 'none',
              cursor: scrapingJobs ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 500,
              opacity: scrapingJobs ? 0.5 : 1
            }}
            title="Scrape live web URLs with BeautifulSoup & Gemini"
          >
            <RefreshCw
              style={{
                width: '12px',
                height: '12px',
                animation: scrapingJobs ? 'spin 1s linear infinite' : 'none'
              }}
            />
            <span>{scrapingJobs ? 'Scraping Live Web...' : 'Scrape Live Jobs'}</span>
          </button>
          <button
            onClick={() => onSearch(searchQuery)}
            style={{
              fontSize: '12px',
              color: '#4b5563',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 500
            }}
          >
            <RefreshCw
              style={{
                width: '12px',
                height: '12px',
                animation: loadingMatches ? 'spin 1s linear infinite' : 'none'
              }}
            />
            <span>Re-rank</span>
          </button>
        </div>
      </div>

      {/* Job Match Cards List */}
      {loadingMatches ? (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '48px',
            textAlign: 'center',
            color: '#6b7280',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              border: '2px solid #0a66c2',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              margin: '0 auto 8px auto',
              animation: 'spin 1s linear infinite'
            }}
          />
          <p style={{ fontSize: '12px', margin: 0 }}>Computing cosine similarity scores...</p>
        </div>
      ) : matches.length === 0 ? (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '48px',
            textAlign: 'center',
            color: '#6b7280',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
          }}
        >
          <Briefcase style={{ width: '32px', height: '32px', margin: '0 auto 8px auto', color: '#9ca3af' }} />
          <p style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: 0 }}>
            No job listings found.
          </p>
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', marginBottom: '12px' }}>
            Scrape live job postings directly into the database using BeautifulSoup & Gemini.
          </p>
          <button
            onClick={onTriggerScrape}
            disabled={scrapingJobs}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: '#0a66c2',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '4px',
              border: 'none',
              cursor: scrapingJobs ? 'not-allowed' : 'pointer',
              opacity: scrapingJobs ? 0.5 : 1
            }}
          >
            <RefreshCw
              style={{
                width: '12px',
                height: '12px',
                animation: scrapingJobs ? 'spin 1s linear infinite' : 'none'
              }}
            />
            <span>{scrapingJobs ? 'Scraping Live Web...' : 'Scrape Live Opportunities'}</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {matches.map((job, index) => {
            const scorePercent = Math.round((job.match_score || 0) * 100);
            const isSaved = job.status === 'saved' || job.status === 'applied';

            return (
              <AnimatedJobCard key={job.id} index={index}>
                <HoverJobCard>
                <div
                  className="job-card-box"
                  style={{
                    background: 'linear-gradient(to right, #9db2ce, #dfcfcf)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '20px',
                  }}
                >
                  {/* Main Card Content */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px' }}>
                    {/* Left Column */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 className="job-card-title" style={{ fontWeight: 800, color: '#0f172a', fontSize: '18px', lineHeight: 1.25, margin: 0, letterSpacing: '-0.01em' }}>
                        {job.title}
                      </h3>
                      <div className="job-card-company" style={{ fontSize: '14px', color: '#334155', fontWeight: 600, marginTop: '3px' }}>
                        {job.company}
                      </div>
                      <div
                        className="job-card-meta"
                        style={{
                          fontSize: '13px',
                          color: '#475569',
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: '10px',
                          marginTop: '6px'
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin style={{ width: '15px', height: '15px', color: '#64748b' }} />
                          {job.location}
                        </span>
                        {job.remote_ok && (
                          <span
                            style={{
                              backgroundColor: '#ecfdf5',
                              color: '#047857',
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              border: '1px solid #a7f3d0'
                            }}
                          >
                            Remote
                          </span>
                        )}
                      </div>

                      {/* LLM Match Explanation */}
                      {(job.match_justification || job.justification) ? (
                        <div
                          className="job-card-justification"
                          style={{
                            marginTop: '12px',
                            padding: '10px 14px',
                            backgroundColor: 'rgba(255, 255, 255, 0.65)',
                            border: '1px solid rgba(255, 255, 255, 0.9)',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
                          }}
                        >
                          <Sparkles style={{ width: '15px', height: '15px', color: '#0a66c2', marginTop: '2px', flexShrink: 0 }} />
                          <p
                            className="job-card-justification-text"
                            style={{
                              color: '#1e293b',
                              fontSize: '13px',
                              fontWeight: 500,
                              lineHeight: '1.55',
                              margin: 0
                            }}
                          >
                            {(job.match_justification || job.justification).replace(/^["'\s]+|["'\s]+$/g, '')}
                          </p>
                        </div>
                      ) : (
                        <p style={{ color: '#334155', fontSize: '13px', lineHeight: '1.5', marginTop: '10px', marginBottom: 0 }}>
                          High semantic relevance ({scorePercent}%) with required technical skills and experience level.
                        </p>
                      )}

                      {/* Skills Badges (No # symbols, minimal clean typography) */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                        {(job.required_skills || []).map((skill, idx) => {
                          const cleanSkill = typeof skill === 'string' ? skill.replace(/^#/, '').trim() : skill;
                          if (!cleanSkill) return null;
                          return (
                            <span
                              key={idx}
                              className="job-card-skill-badge"
                              style={{
                                fontSize: '12px',
                                fontWeight: 600,
                                backgroundColor: '#ffffff',
                                color: '#1e293b',
                                border: '1px solid #cbd5e1',
                                borderRadius: '20px',
                                padding: '3px 10px',
                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                                letterSpacing: '0.01em'
                              }}
                            >
                              {cleanSkill}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right Column */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        justifyContent: 'flex-start',
                        flexShrink: 0,
                        background: 'transparent',
                        border: 'none',
                        boxShadow: 'none',
                        padding: 0
                      }}
                    >
                      <button
                        onClick={() => onToggleSave(job.id, job.status)}
                        style={{
                          padding: '6px',
                          borderRadius: '50%',
                          border: isSaved ? '1px solid #0a66c2' : '1px solid rgba(255, 255, 255, 0.8)',
                          backgroundColor: isSaved ? '#eff6ff' : 'rgba(255, 255, 255, 0.65)',
                          backdropFilter: 'blur(4px)',
                          color: isSaved ? '#0a66c2' : '#64748b',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                          marginBottom: '4px',
                          transition: 'all 0.15s ease'
                        }}
                        title={isSaved ? 'Remove from saved' : 'Save job'}
                      >
                        {isSaved ? (
                          <BookmarkCheck style={{ width: '14px', height: '14px' }} />
                        ) : (
                          <Bookmark style={{ width: '14px', height: '14px' }} />
                        )}
                      </button>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'flex-end',
                          fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
                          lineHeight: 0.8,
                          opacity: 0.6,
                          userSelect: 'none'
                        }}
                      >
                        <span
                          style={{
                            fontSize: scorePercent >= 100 ? '102px' : '130px',
                            fontWeight: 900,
                            lineHeight: 0.8,
                            letterSpacing: '-0.05em',
                            fontVariantNumeric: 'tabular-nums',
                            color:
                              scorePercent >= 80 ? '#047857' : scorePercent >= 60 ? '#0a66c2' : '#334155'
                          }}
                        >
                          {scorePercent}
                        </span>
                        <span
                          style={{
                            fontSize: scorePercent >= 100 ? '18px' : '22px',
                            fontWeight: 900,
                            lineHeight: 1,
                            color:
                              scorePercent >= 80 ? '#047857' : scorePercent >= 60 ? '#0a66c2' : '#334155',
                            marginLeft: '4px',
                            marginTop: scorePercent >= 100 ? '8px' : '12px',
                            display: 'inline-block'
                          }}
                        >
                          %
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '16px',
                      paddingTop: '12px',
                      borderTop: '1px solid rgba(229, 231, 235, 0.7)',
                      fontSize: '13px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ fontWeight: 700, color: '#047857', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <DollarSign style={{ width: '15px', height: '15px' }} />
                        <span>{job.stipend}</span>
                      </div>
                      <span style={{ color: '#cbd5e1' }}>·</span>
                      <div style={{ color: '#475569', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Clock style={{ width: '15px', height: '15px', color: '#64748b' }} />
                        <span>Deadline: {job.deadline}</span>
                      </div>
                      {job.has_changed && (
                        <span
                          style={{
                            fontSize: '11px',
                            backgroundColor: '#fffbeb',
                            color: '#92400e',
                            border: '1px solid #fde68a',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 600
                          }}
                        >
                          Updated listing
                        </span>
                      )}
                    </div>

                    <a
                      href={job.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '7px 18px',
                        backgroundColor: '#0a66c2',
                        color: '#ffffff',
                        borderRadius: '9999px',
                        fontSize: '13px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        textDecoration: 'none',
                        boxShadow: '0 2px 4px rgba(10, 102, 194, 0.2)',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#004182';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#0a66c2';
                      }}
                    >
                      <span>Apply</span>
                      <ExternalLink style={{ width: '13px', height: '13px' }} />
                    </a>
                  </div>
                </div>
                </HoverJobCard>
              </AnimatedJobCard>
            );
          })}
        </div>
      )}
    </div>
  );
}