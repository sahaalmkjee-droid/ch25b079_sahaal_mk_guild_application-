import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import {
  Briefcase,
  Bot,
  Radio,
  BarChart3,
  LogOut,
  Sparkles,
  BookmarkCheck,
  Sun,
  Moon
} from 'lucide-react';
import Login from './Login';
import LoadingScreen from './LoadingScreen';
import RankedMatchesPage from './pages/RankedMatchesPage';
import AgentChatPage from './pages/AgentChatPage';
import ExecutiveBriefingPage from './pages/ExecutiveBriefingPage';
import MyShortlistPage from './pages/MyShortlistPage';
import CostAnalyticsPage from './pages/CostAnalyticsPage';
import OnboardingResumePage from './pages/OnboardingResumePage';
import PersonalDetailsPage from './pages/PersonalDetailsPage';
import UserProfileDropdown from './components/UserProfileDropdown';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

// ============================================================================
// INSPECTABLE STYLES REGISTRY & PAGE BACKGROUND
// Change the full website background gradient right here!
// ============================================================================
const PAGE_BACKGROUND = 'linear-gradient(135deg, #f8ecea 0%, #ebf5f7 48%, #9db8f1 100%) fixed';

const styles = {
  layout: {
    rootContainer: 'min-h-screen text-gray-900 flex flex-col font-sans',
    rootStyle: {
      background: PAGE_BACKGROUND,
      minHeight: '100vh',
    },
    mainContent: 'flex-1 max-w-5xl w-full mx-auto p-4 sm:py-6 sm:px-4',
  },
  header: {
    container: 'sticky top-0 z-50 px-4 py-2.5 transition-all duration-300',
    headerStyle: {
      background: 'linear-gradient(135deg, rgba(246, 218, 214, 0.94) 0%, rgba(216, 237, 244, 0.94) 45%, rgba(130, 165, 238, 0.94) 100%)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.7)',
      boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.06)'
    },
    innerWrapper: 'max-w-6xl mx-auto flex items-center justify-between gap-4',
    brandingWrapper: 'flex items-center shrink-0',
    logoButton: 'flex items-center cursor-pointer select-none transition-opacity hover:opacity-80 py-1',
    navGroup: 'flex items-center gap-2 sm:gap-8',
    tabItem: (isActive) =>
      `flex items-center justify-center px-4 py-2 text-xs font-bold relative transition-all cursor-pointer ${
        isActive ? 'text-[#0a66c2]' : 'text-gray-600 hover:text-gray-900 dark:text-slate-300 dark:hover:text-white'
      }`,
    tabIcon: 'hidden',
    tabLabel: 'text-xs font-bold whitespace-nowrap tracking-tight inline-flex items-center',
    activeIndicator: 'absolute bottom-[-10px] left-0 right-0 h-[2.5px] bg-[#0a66c2] rounded-full shadow-xs',
  },
};

export default function App() {
  const [isAppStarting, setIsAppStarting] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('nexus_token') || '');
  const [currentUser, setCurrentUser] = useState(null);
  const [showPersonalDetails, setShowPersonalDetails] = useState(false); // Step 1 after register
  const [showOnboarding, setShowOnboarding] = useState(false);           // Step 2 — resume
  const [activeTab, setActiveTab] = useState('matches');

  // Dark Mode Theme State
  const [theme, setTheme] = useState(() => localStorage.getItem('nexus_theme') || 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('nexus_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // isAppStarting is cleared only by LoadingScreen's onComplete callback —
  // do NOT add a separate timer here or it will override the animation duration.

  // Analytics & Cost Tracker
  const [analytics, setAnalytics] = useState({
    total_tokens_in: 0,
    total_tokens_out: 0,
    total_cost_inr: 0,
    features: []
  });

  // Tab 1: Matches & Resume
  const [matches, setMatches] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeSuccess, setResumeSuccess] = useState('');
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [scrapingJobs, setScrapingJobs] = useState(false);
  const [scrapeSuccess, setScrapeSuccess] = useState('');
  const fileInputRef = useRef(null);

  // Tab 2: Agent Chat & Tools
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'agent',
      text: 'Hello! I am your SAHAAL Career Intelligence Agent. I can check closing deadlines, calculate technical skills gaps against active jobs, or perform semantic job queries. How can I help you today?',
      toolCalls: []
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [agentThinking, setAgentThinking] = useState(false);
  const chatBottomRef = useRef(null);

  // Tab 3: Briefing & Shortlist
  const [briefing, setBriefing] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingPollStatus, setBriefingPollStatus] = useState('idle'); // idle | queued | rendering | ready | failed
  const [savedMatches, setSavedMatches] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [briefingHistory, setBriefingHistory] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [resumeProfile, setResumeProfile] = useState(null);
  const [loadingResumeProfile, setLoadingResumeProfile] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Audio Briefing Player States
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const audioPlayerRef = useRef(null);
  const briefingPollRef = useRef(null); // holds setInterval id so we can clear it on unmount

  const featuredJobsList = useMemo(() => {
    if (!briefing || !briefing.featured_jobs) return [];
    try {
      if (Array.isArray(briefing.featured_jobs)) return briefing.featured_jobs;
      if (typeof briefing.featured_jobs === 'string') return JSON.parse(briefing.featured_jobs);
    } catch (e) {
      console.error('Error parsing featured_jobs', e);
    }
    return [];
  }, [briefing]);

  const handleTogglePlay = async () => {
    if (!audioPlayerRef.current) return;
    if (audioPlaying) {
      audioPlayerRef.current.pause();
      setAudioPlaying(false);
    } else {
      try {
        if (audioPlayerRef.current.ended) {
          audioPlayerRef.current.currentTime = 0;
        }
        const promise = audioPlayerRef.current.play();
        if (promise !== undefined) {
          await promise;
          setAudioPlaying(true);
        }
      } catch (err) {
        console.warn('HTML5 audio playback error:', err);
        setAudioPlaying(false);
        if (briefing?.script) {
          handleSpeakTranscript(briefing.script);
        }
      }
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioPlayerRef.current) {
      setAudioCurrentTime(audioPlayerRef.current.currentTime);
    }
  };

  const handleAudioLoadedMetadata = () => {
    if (audioPlayerRef.current) {
      setAudioDuration(audioPlayerRef.current.duration || 0);
      audioPlayerRef.current.playbackRate = playbackSpeed;
    }
  };

  const handleAudioSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setAudioCurrentTime(newTime);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.currentTime = newTime;
    }
  };

  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (audioPlayerRef.current) {
      audioPlayerRef.current.playbackRate = speed;
    }
  };

  const handleSkipTime = (secs) => {
    if (audioPlayerRef.current) {
      const target = Math.max(0, Math.min(audioDuration || 9999, audioPlayerRef.current.currentTime + secs));
      audioPlayerRef.current.currentTime = target;
      setAudioCurrentTime(target);
    }
  };

  const formatAudioTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleCopyTranscript = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  const handleSpeakTranscript = (text) => {
    if (!('speechSynthesis' in window)) {
      alert('Browser speech synthesis is not supported on this browser.');
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const authHeaders = () => ({
    headers: { Authorization: `Bearer ${token}` }
  });

  useEffect(() => {
    if (!token) return;
    axios.get(`${API_BASE}/auth/me`, authHeaders())
      .then(res => {
        setCurrentUser(res.data);
        const hasResume = Boolean(res.data?.has_resume);
        const skipped = sessionStorage.getItem('nexus_skipped_onboarding') === 'true';
        if (!hasResume && !skipped) {
          setShowOnboarding(true);
        } else {
          setShowOnboarding(false);
        }
        fetchAllData();
      })
      .catch(() => {
        handleLogout();
      });
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_user_id');
    localStorage.removeItem('nexus_user_email');
    localStorage.removeItem('nexus_profile_pic');
    localStorage.removeItem('nexus_onboarded');
    sessionStorage.removeItem('nexus_skipped_onboarding');
    setToken('');
    setCurrentUser(null);
    setShowOnboarding(false);
  };

  const fetchAllData = () => {
    fetchMatches();
    fetchAnalytics();
    fetchSavedMatches();
    fetchLatestBriefing();
    fetchResumeProfile();
    fetchNotifications();
  };

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API_BASE}/notifications`, authHeaders());
      setNotifications(res.data.notifications || []);
      setUnreadNotifCount(res.data.unread_count || 0);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  const handleMarkNotificationsRead = async () => {
    try {
      await axios.post(`${API_BASE}/notifications/read-all`, {}, authHeaders());
      setUnreadNotifCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Failed to mark notifications read', err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await axios.get(`${API_BASE}/analytics/costs`, authHeaders());
      setAnalytics(res.data);
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    }
  };

  const fetchMatches = async (query = '') => {
    setLoadingMatches(true);
    try {
      const url = query ? `${API_BASE}/matches/ranked?query=${encodeURIComponent(query)}` : `${API_BASE}/matches/ranked`;
      const res = await axios.get(url, authHeaders());
      setMatches(res.data);
    } catch (err) {
      console.error('Failed to load matches', err);
    } finally {
      setLoadingMatches(false);
    }
  };

  const handleTriggerScrape = async () => {
    setScrapingJobs(true);
    setScrapeSuccess('');
    try {
      const res = await axios.post(`${API_BASE}/jobs/scrape`, {}, authHeaders());
      setScrapeSuccess(res.data.message || 'Scrape completed successfully');
      await fetchMatches(searchQuery);
      await fetchAnalytics();
    } catch (err) {
      console.error('Failed to trigger job scrape', err);
    } finally {
      setScrapingJobs(false);
    }
  };

  const fetchSavedMatches = async () => {
    setLoadingSaved(true);
    try {
      const res = await axios.get(`${API_BASE}/matches/saved`, authHeaders());
      setSavedMatches(res.data);
    } catch (err) {
      console.error('Failed to load saved matches', err);
    } finally {
      setLoadingSaved(false);
    }
  };

  const fetchLatestBriefing = async () => {
    try {
      const res = await axios.get(`${API_BASE}/briefing/latest`, authHeaders());
      if (res.data) {
        setBriefing(res.data);
        const bId = res.data.job_id || res.data.id;
        if (res.data.status === 'done') {
          setBriefingPollStatus('ready');
        } else if (res.data.status === 'queued') {
          setBriefingPollStatus('queued');
          if (bId) pollBriefing(bId);
        } else if (res.data.status === 'processing') {
          setBriefingPollStatus('rendering');
          if (bId) pollBriefing(bId);
        }
      }

      const histRes = await axios.get(`${API_BASE}/briefing/history`, authHeaders());
      if (Array.isArray(histRes.data)) {
        setBriefingHistory(histRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch briefing', err);
    }
  };

  const fetchResumeProfile = async () => {
    setLoadingResumeProfile(true);
    try {
      const res = await axios.get(`${API_BASE}/resume/profile`, authHeaders());
      setResumeProfile(res.data);
    } catch (err) {
      console.error('Failed to load resume profile', err);
    } finally {
      setLoadingResumeProfile(false);
    }
  };

  const handleResumeUpload = async (inputPayload) => {
    let file = null;
    let text = null;

    if (typeof inputPayload === 'string') {
      text = inputPayload.trim();
    } else if (inputPayload?.text) {
      text = inputPayload.text.trim();
    } else if (inputPayload instanceof File) {
      file = inputPayload;
    } else if (inputPayload?.target?.files?.[0]) {
      file = inputPayload.target.files[0];
    }

    if (!file && !text) return;

    setResumeUploading(true);
    setResumeSuccess('');

    try {
      let res;
      const activeToken = token || localStorage.getItem('nexus_token') || localStorage.getItem('token') || '';
      const headers = { Authorization: `Bearer ${activeToken}` };
      if (text) {
        res = await axios.post(
          `${API_BASE}/resume/text`,
          { text },
          { headers }
        );
      } else {
        const formData = new FormData();
        formData.append('file', file);
        res = await axios.post(`${API_BASE}/resume/upload`, formData, {
          headers: {
            ...headers,
            'Content-Type': 'multipart/form-data'
          }
        });
      }

      setResumeSuccess(`✓ Resume indexed — ${res.data.word_count || 0} words ready for matching!`);
      fetchMatches();
      fetchAnalytics();
      fetchResumeProfile();
      setCurrentUser(prev => prev ? { ...prev, has_resume: true } : prev);
    } catch (err) {
      console.error('Resume indexing error:', err);
      alert(err.response?.data?.detail || 'Resume uploaded. Proceeding to dashboard.');
    } finally {
      sessionStorage.setItem('nexus_skipped_onboarding', 'true');
      localStorage.setItem('nexus_onboarded', 'true');
      setActiveTab('matches');
      setShowOnboarding(false);
      setShowPersonalDetails(false);
      setResumeUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveMatch = async (jobId, currentStatus) => {
    const nextStatus = currentStatus === 'saved' ? 'none' : 'saved';
    try {
      await axios.post(`${API_BASE}/matches/save`, {
        job_id: jobId,
        status: nextStatus
      }, authHeaders());

      setMatches(prev => prev.map(m => m.id === jobId ? { ...m, status: nextStatus } : m));
      fetchSavedMatches();
      fetchResumeProfile();
    } catch (err) {
      console.error('Save toggle error', err);
    }
  };

  const handleStatusChange = async (jobId, status) => {
    try {
      await axios.post(`${API_BASE}/matches/save`, {
        job_id: jobId,
        status: status
      }, authHeaders());
      fetchSavedMatches();
      fetchMatches();
      fetchResumeProfile();
    } catch (err) {
      console.error('Status change error', err);
    }
  };

  const triggerBriefing = async () => {
    setBriefingLoading(true);
    setBriefingPollStatus('queued');
    try {
      const res = await axios.post(`${API_BASE}/briefing/generate`, {}, authHeaders());
      const briefingId = res.data.job_id || res.data.id;
      setBriefing(res.data);
      if (briefingId) {
        pollBriefing(briefingId);
      }
    } catch (err) {
      alert('Failed to generate briefing');
      setBriefingPollStatus('idle');
      setBriefingLoading(false);
    }
  };

  const pollBriefing = (id) => {
    if (!id) return;
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/briefing/status/${id}`, authHeaders());
        setBriefing(res.data);
        if (res.data.status === 'processing') {
          setBriefingPollStatus('rendering');
        } else if (res.data.status === 'done') {
          setBriefingPollStatus('ready');
          setBriefingLoading(false);
          clearInterval(interval);
          fetchAnalytics();
          axios.get(`${API_BASE}/briefing/history`, authHeaders())
            .then(hRes => {
              if (Array.isArray(hRes.data)) setBriefingHistory(hRes.data);
            })
            .catch(() => {});
        } else if (res.data.status === 'failed') {
          setBriefingPollStatus('failed');
          setBriefingLoading(false);
          clearInterval(interval);
        }
      } catch (err) {
        clearInterval(interval);
        setBriefingLoading(false);
      }
    }, 2000);
  };

  const sendChatMessage = async (presetText = null) => {
    const messageToSend = presetText || chatInput;
    if (!messageToSend.trim()) return;

    const userMessage = { sender: 'user', text: messageToSend, toolCalls: [] };
    setChatMessages(prev => [...prev, userMessage]);
    if (!presetText) setChatInput('');
    setAgentThinking(true);

    try {
      const res = await axios.post(`${API_BASE}/agent/chat`, {
        message: messageToSend
      }, authHeaders());

      const agentMessage = {
        sender: 'agent',
        text: res.data.response,
        toolCalls: res.data.tool_calls || []
      };
      setChatMessages(prev => [...prev, agentMessage]);
      fetchAnalytics();
    } catch (err) {
      setChatMessages(prev => [
        ...prev,
        { sender: 'agent', text: 'Error connecting to agent core.', toolCalls: [] }
      ]);
    } finally {
      setAgentThinking(false);
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  if (isAppStarting) {
    return (
      <LoadingScreen
        title="Starting SAHAAL"
        subtitle="Autonomous Career Intelligence & Vector Engine"
        mode="startup"
        onComplete={() => setIsAppStarting(false)}
      />
    );
  }

  if (!token) {
    return (
      <Login
        onAuthSuccess={(authData) => {
          const newToken = authData?.token || localStorage.getItem('nexus_token');
          setToken(newToken);
          // New users go through Personal Details first, then the resume step
          setShowPersonalDetails(true);
        }}
      />
    );
  }

  // ── Step 1: Personal Details (photo + name) — shown right after registration & when editing profile ──
  if (showPersonalDetails) {
    return (
      <PersonalDetailsPage
        currentUser={currentUser}
        onComplete={(details) => {
          if (details?.fullName) {
            setCurrentUser(prev => prev ? { ...prev, full_name: details.fullName, name: details.fullName } : prev);
          }
          if (details?.jobTitle) {
            setCurrentUser(prev => prev ? { ...prev, job_title: details.jobTitle } : prev);
          }
          setShowPersonalDetails(false);
          const hasResume = Boolean(currentUser?.has_resume);
          const onboarded = localStorage.getItem('nexus_onboarded') === 'true';
          const skipped = sessionStorage.getItem('nexus_skipped_onboarding') === 'true';
          if (!hasResume && !onboarded && !skipped) {
            setShowOnboarding(true); // proceed to resume step only during fresh onboarding
          }
        }}
        onSkip={() => {
          setShowPersonalDetails(false);
          const hasResume = Boolean(currentUser?.has_resume);
          const onboarded = localStorage.getItem('nexus_onboarded') === 'true';
          const skipped = sessionStorage.getItem('nexus_skipped_onboarding') === 'true';
          if (!hasResume && !onboarded && !skipped) {
            setShowOnboarding(true);
          }
        }}
      />
    );
  }

  // ── Step 2: Resume Onboarding ──
  if (showOnboarding) {
    return (
      <OnboardingResumePage
        onUploadResume={handleResumeUpload}
        onSkip={() => {
          sessionStorage.setItem('nexus_skipped_onboarding', 'true');
          setShowOnboarding(false);
        }}
        resumeUploading={resumeUploading}
        resumeSuccess={resumeSuccess}
      />
    );
  }

  const userInitial = currentUser?.email ? currentUser.email[0].toUpperCase() : 'U';

  const navItems = [
    { id: 'matches', label: 'Ranked Matches' },
    { id: 'agent', label: 'Agent Chat' },
    { id: 'briefing', label: 'Executive Briefing' },
    { id: 'shortlist', label: 'My Shortlist' },
  ];

  const currentHeaderStyle = theme === 'dark' ? {
    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 45%, rgba(30, 27, 75, 0.95) 100%)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(51, 65, 85, 0.8)',
    boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.25)'
  } : styles.header.headerStyle;

  const currentRootStyle = theme === 'dark' ? {
    background: 'linear-gradient(135deg, #05070e 0%, #090d16 45%, #0f172a 100%) fixed',
    minHeight: '100vh',
    color: '#f8fafc'
  } : styles.layout.rootStyle;

  const currentLogoColor = theme === 'dark' ? '#f8fafc' : '#0f172a';

  return (
    <div
      className={`${styles.layout.rootContainer} ${theme === 'dark' ? 'dark' : ''}`}
      style={currentRootStyle}
    >

      {/* TOP BAR NAVIGATION */}
      <header className={styles.header.container} style={currentHeaderStyle}>
        <div className={styles.header.innerWrapper}>

          {/* Logo & Identity: Sahaal written in Petrona font */}
          <div className={styles.header.brandingWrapper}>
            <div
              onClick={() => setActiveTab('matches')}
              className={styles.header.logoButton}
              title="Sahaal"
            >
              <span
                style={{
                  fontFamily: "'Petrona', 'Petunia', serif",
                  fontSize: '28px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: currentLogoColor,
                  lineHeight: 1
                }}
              >
                Sahaal<span style={{ color: '#0a66c2' }}>.</span>
              </span>
            </div>
          </div>

          {/* Center Tabs (Text only - no icons, no scrollbars) */}
          <nav className="flex items-center gap-1 sm:gap-6 md:gap-8 overflow-x-auto no-scrollbar py-1 shrink-0">
            {navItems.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={styles.header.tabItem(isActive)}
                  title={tab.label}
                >
                  <span className={styles.header.tabLabel}>
                    {tab.label}
                    {tab.id === 'shortlist' && savedMatches.length > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-[#0a66c2] text-white text-[10px] font-extrabold inline-flex items-center justify-center">
                        {savedMatches.length}
                      </span>
                    )}
                  </span>
                  {isActive && <span className={styles.header.activeIndicator} />}
                </button>
              );
            })}
          </nav>

          {/* Right Controls: Theme Toggle & User Profile Dropdown */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-full border border-gray-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-800 text-gray-700 dark:text-amber-300 hover:bg-white dark:hover:bg-slate-700 shadow-2xs transition-all flex items-center justify-center cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 fill-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            <UserProfileDropdown
              currentUser={currentUser}
              userInitial={userInitial}
              analytics={analytics}
              notifications={notifications}
              unreadNotifCount={unreadNotifCount}
              onMarkNotificationsRead={handleMarkNotificationsRead}
              onUploadResume={handleResumeUpload}
              resumeUploading={resumeUploading}
              resumeSuccess={resumeSuccess}
              onLogout={handleLogout}
              onOpenOnboarding={() => setShowOnboarding(true)}
              onEditProfile={() => setShowPersonalDetails(true)}
              onRefreshAnalytics={fetchAnalytics}
              theme={theme}
              onToggleTheme={toggleTheme}
            />
          </div>

        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className={styles.layout.mainContent}>

        {/* TAB 1: RANKED MATCHES & RESUME */}
        {activeTab === 'matches' && (
          <RankedMatchesPage
            matches={matches}
            loadingMatches={loadingMatches}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSearch={fetchMatches}
            onToggleSave={handleSaveMatch}
            onUploadResume={handleResumeUpload}
            resumeUploading={resumeUploading}
            resumeSuccess={resumeSuccess}
            scrapingJobs={scrapingJobs}
            scrapeSuccess={scrapeSuccess}
            onTriggerScrape={handleTriggerScrape}
            fileInputRef={fileInputRef}
          />
        )}

        {/* TAB 2: AGENT CHAT TERMINAL */}
        {activeTab === 'agent' && (
          <AgentChatPage
            messages={chatMessages}
            input={chatInput}
            setInput={setChatInput}
            thinking={agentThinking}
            onSendMessage={sendChatMessage}
            chatBottomRef={chatBottomRef}
            userInitial={userInitial}
          />
        )}

        {/* TAB 3: EXECUTIVE BRIEFING — always mounted to preserve WebGL context */}
        <div style={{ display: activeTab === 'briefing' ? 'block' : 'none' }}>
          <ExecutiveBriefingPage
            briefing={briefing}
            briefingLoading={briefingLoading}
            briefingPollStatus={briefingPollStatus}
            onTriggerBriefing={triggerBriefing}
            audioPlaying={audioPlaying}
            setAudioPlaying={setAudioPlaying}
            audioCurrentTime={audioCurrentTime}
            audioDuration={audioDuration}
            playbackSpeed={playbackSpeed}
            audioPlayerRef={audioPlayerRef}
            apiBase={API_BASE}
            formatAudioTime={formatAudioTime}
            onTogglePlay={handleTogglePlay}
            onAudioSeek={handleAudioSeek}
            onSpeedChange={handleSpeedChange}
            onSkipTime={handleSkipTime}
            onAudioTimeUpdate={handleAudioTimeUpdate}
            onAudioLoadedMetadata={handleAudioLoadedMetadata}
            featuredJobsList={featuredJobsList}
            copiedTranscript={copiedTranscript}
            isSpeaking={isSpeaking}
            onCopyTranscript={handleCopyTranscript}
            onSpeakTranscript={handleSpeakTranscript}
            savedMatches={savedMatches}
            loadingSaved={loadingSaved}
            onStatusChange={handleStatusChange}
            briefingHistory={briefingHistory}
            setBriefing={setBriefing}
            setBriefingPollStatus={setBriefingPollStatus}
          />
        </div>

        {/* TAB 4: MY SHORTLIST & CAREER HUB */}
        {activeTab === 'shortlist' && (
          <MyShortlistPage
            savedMatches={savedMatches}
            loadingSaved={loadingSaved}
            onStatusChange={handleStatusChange}
            onToggleSave={handleSaveMatch}
            resumeProfile={resumeProfile}
            loadingResumeProfile={loadingResumeProfile}
            onUploadResume={handleResumeUpload}
            resumeUploading={resumeUploading}
            briefingHistory={briefingHistory}
            onNavigateToMatches={() => setActiveTab('matches')}
            onNavigateToBriefing={() => setActiveTab('briefing')}
            apiBase={API_BASE}
          />
        )}

        {/* TAB 5: COST & TOKEN ANALYTICS */}
        {activeTab === 'analytics' && (
          <CostAnalyticsPage
            analytics={analytics}
            onRefresh={fetchAnalytics}
          />
        )}

      </main>

    </div>
  );
}