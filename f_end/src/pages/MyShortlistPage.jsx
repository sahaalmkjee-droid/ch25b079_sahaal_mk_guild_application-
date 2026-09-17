import React, { useState, useMemo } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  FileText,
  Sparkles,
  ExternalLink,
  Trash2,
  Volume2,
  Play,
  Pause,
  Clock,
  Building2,
  MapPin,
  DollarSign,
  CheckCircle2,
  ArrowRight,
  Search,
  Filter,
  Copy,
  Check,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Radio,
  Briefcase
} from 'lucide-react';

export default function MyShortlistPage({
  savedMatches = [],
  loadingSaved = false,
  onStatusChange,
  onToggleSave,
  resumeProfile,
  loadingResumeProfile = false,
  onUploadResume,
  resumeUploading = false,
  briefingHistory = [],
  onNavigateToMatches,
  onNavigateToBriefing,
  apiBase = import.meta.env.VITE_API_BASE_URL || '',
}) {
  const [activeSection, setActiveSection] = useState('saved'); // 'saved' | 'resume' | 'briefings'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'saved' | 'applied' | 'interviewing' | 'offer'
  const [showFullResume, setShowFullResume] = useState(false);
  const [copiedResume, setCopiedResume] = useState(false);
  const [activePlayingId, setActivePlayingId] = useState(null);
  const [copiedBriefingId, setCopiedBriefingId] = useState(null);

  const strLower = (str) => (str || '').toString().toLowerCase();

  // Filtered Saved Matches
  const filteredMatches = useMemo(() => {
    return savedMatches.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || (item.status || 'saved').toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [savedMatches, searchQuery, statusFilter]);

  // Counts for overview
  const counts = useMemo(() => {
    const total = savedMatches.length;
    const applied = savedMatches.filter((m) => m.status === 'applied').length;
    const interviewing = savedMatches.filter((m) => m.status === 'interviewing').length;
    const offer = savedMatches.filter((m) => m.status === 'offer').length;
    return { total, applied, interviewing, offer };
  }, [savedMatches]);

  const handleCopyText = (text, type = 'resume') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'resume') {
      setCopiedResume(true);
      setTimeout(() => setCopiedResume(false), 2000);
    } else {
      setCopiedBriefingId(type);
      setTimeout(() => setCopiedBriefingId(null), 2000);
    }
  };

  const handleTogglePastAudio = (briefingId, audioUrl) => {
    const audioElement = document.getElementById(`audio-player-${briefingId}`);
    if (!audioElement) return;

    if (activePlayingId === briefingId) {
      audioElement.pause();
      setActivePlayingId(null);
    } else {
      if (activePlayingId) {
        const prev = document.getElementById(`audio-player-${activePlayingId}`);
        if (prev) prev.pause();
      }
      audioElement.play().then(() => {
        setActivePlayingId(briefingId);
      }).catch((err) => {
        console.warn('Playback blocked or failed', err);
        setActivePlayingId(null);
      });
    }
  };

  const getStatusBadge = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'applied':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'interviewing':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'offer':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'saved':
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full py-6 space-y-6 overflow-x-hidden">
      {/* Dynamic Keyframe Style Definition */}
      <style>{`
        @keyframes slideInFromRight130 {
          0% {
            opacity: 0;
            transform: translateX(130px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slide-entry {
          animation: slideInFromRight130 1.5s cubic-bezier(0.16, 1, 0.3, 1) both;
          will-change: transform, opacity;
        }
        .shortlist-card-hover {
          transform: scale(1);
          transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 0.22s ease,
                      border-color 0.22s ease;
          will-change: transform, box-shadow;
        }
        .shortlist-card-hover:hover {
          transform: scale(1.02);
          box-shadow: 0 12px 24px -4px rgba(10, 102, 194, 0.15), 0 4px 8px -2px rgba(0, 0, 0, 0.05) !important;
          border-color: rgba(10, 102, 194, 0.4) !important;
          z-index: 10;
        }
      `}</style>

      {/* Header Banner */}
      <div 
        className="bg-white/90 backdrop-blur-md border border-gray-200/80 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 animate-slide-entry shortlist-card-hover"
        style={{ animationDelay: '0ms' }}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 text-[#0a66c2]">
              <BookmarkCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">My Shortlist & Career Hub</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Track your saved opportunities, active application states, candidate resume profile, and past executive voice dispatches.
          </p>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNavigateToMatches}
            className="px-4 py-2 bg-[#0a66c2] hover:bg-[#004182] text-white text-xs font-semibold rounded-full shadow-xs flex items-center gap-1.5 transition"
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Explore Ranked Matches</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div 
          className="bg-white border border-gray-200/80 rounded-xl p-4 shadow-2xs animate-slide-entry shortlist-card-hover cursor-pointer"
          style={{ animationDelay: '80ms' }}
        >
          <div className="text-xs text-gray-500 font-medium">Total Shortlisted</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{counts.total}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Saved opportunities</div>
        </div>

        <div 
          className="bg-white border border-gray-200/80 rounded-xl p-4 shadow-2xs animate-slide-entry shortlist-card-hover cursor-pointer"
          style={{ animationDelay: '140ms' }}
        >
          <div className="text-xs text-gray-500 font-medium">Applied / In Progress</div>
          <div className="text-2xl font-bold text-[#0a66c2] mt-1">{counts.applied + counts.interviewing}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">{counts.applied} applied, {counts.interviewing} interviews</div>
        </div>

        <div 
          className="bg-white border border-gray-200/80 rounded-xl p-4 shadow-2xs animate-slide-entry shortlist-card-hover cursor-pointer"
          style={{ animationDelay: '200ms' }}
        >
          <div className="text-xs text-gray-500 font-medium">Resume Status</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {resumeProfile?.has_resume ? 'Active' : 'No Resume'}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">
            {resumeProfile?.word_count ? `${resumeProfile.word_count} words indexed` : 'Upload to vectorize'}
          </div>
        </div>

        <div 
          className="bg-white border border-gray-200/80 rounded-xl p-4 shadow-2xs animate-slide-entry shortlist-card-hover cursor-pointer"
          style={{ animationDelay: '260ms' }}
        >
          <div className="text-xs text-gray-500 font-medium">Past Briefings</div>
          <div className="text-2xl font-bold text-gray-800 mt-1">{briefingHistory?.length || 0}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Recorded voice dispatches</div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div 
        className="flex border-b border-gray-200 text-xs font-semibold space-x-6 animate-slide-entry"
        style={{ animationDelay: '320ms' }}
      >
        <button
          type="button"
          onClick={() => setActiveSection('saved')}
          className={`pb-3 relative transition-colors flex items-center gap-2 ${
            activeSection === 'saved' ? 'text-[#0a66c2]' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Bookmark className="w-4 h-4" />
          <span>Saved Opportunities ({savedMatches.length})</span>
          {activeSection === 'saved' && (
            <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[#0a66c2]" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('resume')}
          className={`pb-3 relative transition-colors flex items-center gap-2 ${
            activeSection === 'resume' ? 'text-[#0a66c2]' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Resume Profile & Top 3 Matches</span>
          {activeSection === 'resume' && (
            <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[#0a66c2]" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('briefings')}
          className={`pb-3 relative transition-colors flex items-center gap-2 ${
            activeSection === 'briefings' ? 'text-[#0a66c2]' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Volume2 className="w-4 h-4" />
          <span>Past Briefings Archive ({briefingHistory?.length || 0})</span>
          {activeSection === 'briefings' && (
            <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[#0a66c2]" />
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: SAVED LISTINGS & APPLICATION STATES                            */}
      {/* ========================================================================= */}
      {activeSection === 'saved' && (
        <div className="space-y-4 animate-slide-entry" style={{ animationDelay: '380ms' }}>
          {/* Controls Bar */}
          <div className="bg-white border border-gray-200/80 rounded-xl p-3 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 shortlist-card-hover">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter saved jobs or companies..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#0a66c2] focus:bg-white transition"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1" />
              {['all', 'saved', 'applied', 'interviewing', 'offer'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize transition ${
                    statusFilter === st
                      ? 'bg-[#0a66c2] text-white shadow-2xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Listings Table / Cards */}
          {loadingSaved ? (
            <div className="bg-white border border-gray-200/80 rounded-2xl p-12 text-center text-gray-500 text-xs shadow-xs">
              Loading shortlist...
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center space-y-3 shadow-xs">
              <Bookmark className="w-8 h-8 text-gray-300 mx-auto" />
              <h3 className="text-sm font-bold text-gray-800">No Shortlisted Jobs Found</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                {searchQuery || statusFilter !== 'all'
                  ? 'No saved jobs match your current search or filter criteria.'
                  : 'Bookmark promising opportunities from the Ranked Matches tab to track them here.'}
              </p>
              <button
                type="button"
                onClick={onNavigateToMatches}
                className="px-4 py-2 bg-[#0a66c2] hover:bg-[#004182] text-white text-xs font-semibold rounded-full shadow-xs inline-flex items-center gap-1.5"
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Browse Ranked Matches</span>
              </button>
            </div>
          ) : (
            <div className="bg-white border border-gray-200/80 rounded-2xl overflow-hidden shadow-xs shortlist-card-hover">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-semibold">
                    <tr>
                      <th className="py-3 px-4">Role & Company</th>
                      <th className="py-3 px-3">Location & Stipend</th>
                      <th className="py-3 px-3">Match Score</th>
                      <th className="py-3 px-3">Application State</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredMatches.map((job) => (
                      <tr key={job.id} className="hover:bg-blue-50/20 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-gray-900 hover:text-[#0a66c2] transition flex items-center gap-2">
                            <span>{job.title}</span>
                            {job.has_changed && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300">
                                Details Updated
                              </span>
                            )}
                            {(job.is_active === false || strLower(job.deadline) === 'closed') && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold border border-rose-300">
                                Closed by Employer
                              </span>
                            )}
                          </div>
                          <div className="text-gray-500 text-[11px] flex items-center gap-1.5 mt-0.5">
                            <Building2 className="w-3 h-3 text-gray-400" />
                            <span>{job.company}</span>
                            {job.remote_ok && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200">
                                Remote OK
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="text-gray-700 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                            <span>{job.location || 'Remote'}</span>
                          </div>
                          <div className="text-gray-500 text-[11px] flex items-center gap-1 mt-0.5">
                            <DollarSign className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span className="font-medium text-emerald-700">{job.stipend || 'Competitive'}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-[#0a66c2] border border-blue-200 inline-flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-[#0a66c2]" />
                            <span>{Math.round((job.match_score || 0) * 100)}%</span>
                          </span>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <select
                              value={job.status || 'saved'}
                              onChange={(e) => onStatusChange(job.id, e.target.value)}
                              className={`border rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#0a66c2] cursor-pointer shadow-2xs ${getStatusBadge(
                                job.status
                              )}`}
                            >
                              <option value="saved">Saved</option>
                              <option value="applied">Applied</option>
                              <option value="interviewing">Interviewing</option>
                              <option value="offer">Offer Received</option>
                              <option value="none">Remove from Shortlist</option>
                            </select>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <a
                              href={job.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-[#0a66c2] text-xs font-semibold rounded-lg inline-flex items-center gap-1 transition"
                            >
                              <span>Apply</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>

                            <button
                              type="button"
                              onClick={() => onStatusChange(job.id, 'none')}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Remove Bookmark"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: RESUME PROFILE & TOP 3 SEMANTIC MATCHES                        */}
      {/* ========================================================================= */}
      {activeSection === 'resume' && (
        <div className="space-y-6 animate-slide-entry" style={{ animationDelay: '380ms' }}>
          <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <FileText className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Uploaded Candidate Resume</h2>
                  <p className="text-xs text-gray-500">
                    {resumeProfile?.has_resume
                      ? `Indexed and vectorized (${resumeProfile.word_count} words)`
                      : 'No resume uploaded yet.'}
                  </p>
                </div>
              </div>

              {resumeProfile?.has_resume && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFullResume(!showFullResume)}
                    className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition"
                  >
                    {showFullResume ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showFullResume ? 'Hide Text' : 'Read Uploaded Resume'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyText(resumeProfile.raw_text, 'resume')}
                    className="px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition"
                  >
                    {copiedResume ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedResume ? 'Copied' : 'Copy Text'}</span>
                  </button>
                </div>
              )}
            </div>

            {resumeProfile?.has_resume ? (
              <div className="space-y-3">
                <div className="bg-gray-50/80 rounded-xl p-4 border border-gray-200/60 text-xs text-gray-700 font-mono leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap">
                  {showFullResume
                    ? resumeProfile.raw_text
                    : `${resumeProfile.raw_text?.slice(0, 500)}...`}
                </div>
                {!showFullResume && (
                  <button
                    type="button"
                    onClick={() => setShowFullResume(true)}
                    className="text-xs text-[#0a66c2] hover:underline font-semibold flex items-center gap-1"
                  >
                    <span>Read complete candidate resume document</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 border border-dashed border-gray-200 p-8 rounded-xl text-center space-y-2">
                <FileText className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="text-xs text-gray-500">Please upload your resume to enable vector matching.</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-gray-900 text-sm">
                <Sparkles className="w-4 h-4 text-[#0a66c2]" />
                <span>Top 3 Semantic Matches With Your Resume</span>
              </div>
              <span className="text-xs text-gray-500 font-medium">Computed via text-embedding-004 cosine similarity</span>
            </div>

            {resumeProfile?.top_3_matches && resumeProfile.top_3_matches.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {resumeProfile.top_3_matches.map((job, idx) => (
                  <div
                    key={job.id}
                    className="bg-white border border-gray-200/80 hover:border-blue-300 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 transition"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="w-6 h-6 rounded-full bg-blue-50 text-[#0a66c2] text-xs font-bold flex items-center justify-center border border-blue-100 shrink-0">
                          #{idx + 1}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-[#0a66c2] border border-blue-200">
                          {Math.round((job.match_score || 0) * 100)}% Match
                        </span>
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-gray-900 leading-snug hover:text-[#0a66c2] transition">
                          {job.title}
                        </h3>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-gray-400" />
                          <span>{job.company}</span>
                        </p>
                      </div>

                      <div className="text-xs text-gray-600 space-y-1 pt-1">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <span>{job.location || 'Remote'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                          <DollarSign className="w-3 h-3 text-emerald-600" />
                          <span>{job.stipend || 'Competitive'}</span>
                        </div>
                      </div>

                      {job.required_skills && job.required_skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-2">
                          {job.required_skills.slice(0, 3).map((skill, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[10px] font-medium"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onToggleSave(job.id, job.is_saved ? 'saved' : 'none')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                          job.is_saved
                            ? 'bg-blue-50 text-[#0a66c2] border border-blue-200'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>{job.is_saved ? 'Shortlisted' : 'Save'}</span>
                      </button>

                      <a
                        href={job.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-[#0a66c2] hover:bg-[#004182] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1 transition"
                      >
                        <span>Apply</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border border-dashed border-gray-200 p-8 rounded-2xl text-center text-gray-500 text-xs">
                Upload your resume to see top semantic vector matches calculated here.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: PAST EXECUTIVE VOICE BRIEFINGS ARCHIVE                         */}
      {/* ========================================================================= */}
      {activeSection === 'briefings' && (
        <div className="space-y-4 animate-slide-entry" style={{ animationDelay: '380ms' }}>
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Listen to previously synthesized executive voice briefings generated for your profile.
            </div>
            <button
              type="button"
              onClick={onNavigateToBriefing}
              className="px-3 py-1.5 bg-[#0a66c2] hover:bg-[#004182] text-white text-xs font-semibold rounded-full shadow-2xs inline-flex items-center gap-1.5 transition"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Generate New Briefing</span>
            </button>
          </div>

          {briefingHistory.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center space-y-3 shadow-xs">
              <Volume2 className="w-8 h-8 text-gray-300 mx-auto" />
              <h3 className="text-sm font-bold text-gray-800">No Past Briefings Recorded</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Generate an Executive Briefing in Tab 3 to synthesize your daily spoken voice dispatch.
              </p>
              <button
                type="button"
                onClick={onNavigateToBriefing}
                className="px-4 py-2 bg-[#0a66c2] hover:bg-[#004182] text-white text-xs font-semibold rounded-full shadow-xs inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Go to Executive Briefing</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {briefingHistory.map((brief) => {
                const audioUrl = brief.audio_url || brief.media_url;
                const fullAudioSrc = audioUrl ? `${apiBase}${audioUrl}` : '';
                const isPlaying = activePlayingId === brief.id;
                const formattedDate = brief.created_at
                  ? new Date(brief.created_at).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })
                  : 'Recent Briefing';

                return (
                  <div
                    key={brief.id}
                    className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-xs space-y-3 hover:border-blue-200 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-blue-50 text-[#0a66c2]">
                          <Radio className="w-4 h-4" />
                        </span>
                        <div>
                          <div className="text-xs font-bold text-gray-900">Briefing #{brief.id}</div>
                          <div className="text-[11px] text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formattedDate}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-blue-50 text-[#0a66c2] font-semibold px-2 py-0.5 rounded-full border border-blue-100">
                          {brief.fallback_reason || 'Voice Model: Edge Neural Christopher'}
                        </span>

                        {fullAudioSrc && (
                          <button
                            type="button"
                            onClick={() => handleTogglePastAudio(brief.id, fullAudioSrc)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition ${
                              isPlaying
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-[#0a66c2] hover:bg-[#004182] text-white'
                            }`}
                          >
                            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                            <span>{isPlaying ? 'Pause Audio' : 'Listen Voice'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {brief.script && (
                      <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3 text-xs text-gray-700 leading-relaxed space-y-2">
                        <p className="italic">"{brief.script}"</p>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleCopyText(brief.script, brief.id)}
                            className="inline-flex items-center gap-1 text-[11px] text-[#0a66c2] hover:underline font-semibold"
                          >
                            {copiedBriefingId === brief.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>{copiedBriefingId === brief.id ? 'Copied' : 'Copy Script'}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {fullAudioSrc && (
                      <audio
                        id={`audio-player-${brief.id}`}
                        src={fullAudioSrc}
                        onEnded={() => setActivePlayingId(null)}
                        onPause={() => {
                          if (activePlayingId === brief.id) setActivePlayingId(null);
                        }}
                        preload="none"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}