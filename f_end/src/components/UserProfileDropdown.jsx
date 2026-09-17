import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Camera,
  Upload,
  FileText,
  CheckCircle2,
  LogOut,
  Sparkles,
  ChevronDown,
  Coins,
  Trash2,
  ExternalLink,
  Pencil,
  AlertTriangle
} from 'lucide-react';

import CostAnalyticsModal from './CostAnalyticsModal';

export default function UserProfileDropdown({
  currentUser,
  userInitial,
  analytics,
  notifications = [],
  unreadNotifCount = 0,
  onMarkNotificationsRead,
  onUploadResume,
  resumeUploading,
  resumeSuccess,
  onLogout,
  onOpenOnboarding,
  onEditProfile,
  onRefreshAnalytics,
  theme,
  onToggleTheme
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);
  const userPicKey = currentUser?.id ? `nexus_profile_pic_${currentUser.id}` : 'nexus_profile_pic';
  const [profilePic, setProfilePic] = useState(() => localStorage.getItem(currentUser?.id ? `nexus_profile_pic_${currentUser.id}` : 'nexus_profile_pic') || null);
  const dropdownRef = useRef(null);
  const picInputRef = useRef(null);
  const resumeInputRef = useRef(null);

  // Sync profile pic when current user switches
  useEffect(() => {
    if (currentUser?.id) {
      setProfilePic(localStorage.getItem(`nexus_profile_pic_${currentUser.id}`) || null);
    } else {
      setProfilePic(null);
    }
  }, [currentUser?.id]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Downscale and handle profile image upload
  const handleProfilePicChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Downscale to max 256x256 square to prevent huge images
          const canvas = document.createElement('canvas');
          const size = Math.min(img.width, img.height);
          const startX = (img.width - size) / 2;
          const startY = (img.height - size) / 2;
          const targetSize = 256;
          canvas.width = targetSize;
          canvas.height = targetSize;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, startX, startY, size, size, 0, 0, targetSize, targetSize);

          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
          setProfilePic(compressedBase64);
          localStorage.setItem(userPicKey, compressedBase64);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePic = (e) => {
    e.stopPropagation();
    setProfilePic(null);
    localStorage.removeItem(userPicKey);
    if (picInputRef.current) picInputRef.current.value = '';
  };

  const savedName = localStorage.getItem(currentUser?.id ? `nexus_display_name_${currentUser.id}` : 'nexus_display_name');
  const savedJobTitle = localStorage.getItem(currentUser?.id ? `nexus_job_title_${currentUser.id}` : 'nexus_job_title');
  const displayName = currentUser?.full_name || currentUser?.name || savedName || (currentUser?.email ? currentUser.email.split('@')[0] : 'Member');
  const jobTitle = currentUser?.job_title || savedJobTitle || '';
  const displayEmail = currentUser?.email || 'user@example.com';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} ref={dropdownRef}>
      {/* ── Change Detection Notification Bell ── */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => {
            setShowNotifMenu(!showNotifMenu);
            if (unreadNotifCount > 0 && onMarkNotificationsRead) {
              onMarkNotificationsRead();
            }
          }}
          className="p-2 rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center cursor-pointer relative"
          title="Listing Change & Edit Notifications"
        >
          <Bell className="w-4 h-4 text-gray-700 dark:text-slate-200" />
          {unreadNotifCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-xs animate-pulse">
              {unreadNotifCount}
            </span>
          )}
        </button>

        {/* Notifications Popover */}
        {showNotifMenu && (
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-slate-800">
              <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-[#0a66c2]" />
                <span>Listing Change Alerts</span>
              </span>
              <span className="text-[10px] font-semibold text-gray-400">
                Auto-Cron 6h
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {notifications.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400">
                  No listing edits or closures detected.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-2.5 rounded-xl border text-xs leading-relaxed ${
                      n.change_type === 'CLOSED'
                        ? 'bg-rose-50/80 border-rose-200 text-rose-900 dark:bg-rose-950/30 dark:border-rose-800/40 dark:text-rose-200'
                        : 'bg-amber-50/80 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800/40 dark:text-amber-200'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5 mb-0.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{n.title}</span>
                    </div>
                    <div className="text-[11px] opacity-90">{n.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navbar Avatar Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="profile-dropdown-trigger"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 10px 4px 6px',
          borderRadius: '9999px',
          border: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
        }}
        title={displayEmail}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#60a5fa';
          e.currentTarget.style.backgroundColor = '#f9fafb';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#e5e7eb';
          e.currentTarget.style.backgroundColor = '#ffffff';
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            minWidth: '32px',
            minHeight: '32px',
            maxWidth: '32px',
            maxHeight: '32px',
            borderRadius: '9999px',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(to top right, #0a66c2, #38bdf8)',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '12px',
            boxShadow: '0 0 0 2px #ffffff, 0 1px 2px 0 rgba(0,0,0,0.05)',
            flexShrink: 0
          }}
        >
          {profilePic ? (
            <img
              src={profilePic}
              alt="Profile"
              style={{
                width: '32px',
                height: '32px',
                objectFit: 'cover',
                borderRadius: '9999px',
                aspectRatio: '1 / 1',
                display: 'block'
              }}
            />
          ) : (
            <span>{userInitial}</span>
          )}
        </div>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#374151',
            maxWidth: '110px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textAlign: 'left'
          }}
        >
          {displayName}
        </span>
        <ChevronDown
          style={{
            width: '14px',
            height: '14px',
            color: isOpen ? '#0a66c2' : '#9ca3af',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease, color 0.2s ease'
          }}
        />
      </button>

      {/* Dropdown Menu Modal / Popup */}
      {isOpen && (
        <div
          className="profile-dropdown-popup"
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: '8px',
            width: '320px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(229, 231, 235, 0.9)',
            padding: '16px',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          {/* User Profile Card Header */}
          <div
            className="profile-dropdown-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              paddingBottom: '12px',
              borderBottom: '1px solid #f3f4f6'
            }}
          >
            {/* Avatar with Camera Overlay */}
            <div
              className="group"
              style={{
                position: 'relative',
                width: '52px',
                height: '52px',
                flexShrink: 0
              }}
            >
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  minWidth: '52px',
                  minHeight: '52px',
                  maxWidth: '52px',
                  maxHeight: '52px',
                  borderRadius: '9999px',
                  overflow: 'hidden',
                  background: 'linear-gradient(to top right, #0a66c2, #38bdf8)',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 0 2px #dbeafe, 0 1px 2px 0 rgba(0,0,0,0.05)'
                }}
              >
                {profilePic ? (
                  <img
                    src={profilePic}
                    alt="Avatar"
                    style={{
                      width: '52px',
                      height: '52px',
                      objectFit: 'cover',
                      borderRadius: '9999px',
                      aspectRatio: '1 / 1',
                      display: 'block'
                    }}
                  />
                ) : (
                  <span>{userInitial}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  if (onEditProfile) onEditProfile();
                  else picInputRef.current?.click();
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.45)',
                  borderRadius: '9999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  opacity: 0,
                  transition: 'opacity 0.2s',
                  cursor: 'pointer',
                  border: 'none'
                }}
                title="Change profile photo and details"
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0';
                }}
              >
                <Camera style={{ width: '16px', height: '16px' }} />
              </button>
              <input
                type="file"
                ref={picInputRef}
                onChange={handleProfilePicChange}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <h4
                  className="profile-dropdown-name"
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#111827',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    margin: 0
                  }}
                >
                  {displayName}
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      if (onEditProfile) onEditProfile();
                      else picInputRef.current?.click();
                    }}
                    style={{
                      fontSize: '10px',
                      color: '#0a66c2',
                      fontWeight: 600,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.textDecoration = 'underline';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.textDecoration = 'none';
                    }}
                  >
                    Change
                  </button>
                  {profilePic && (
                    <button
                      type="button"
                      onClick={handleRemovePic}
                      style={{
                        fontSize: '10px',
                        color: '#f43f5e',
                        fontWeight: 500,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0
                      }}
                      title="Reset photo"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#be123c';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#f43f5e';
                      }}
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
              {jobTitle ? (
                <p
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#0a66c2',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    margin: '2px 0 0 0'
                  }}
                >
                  {jobTitle}
                </p>
              ) : null}
              <p
                className="profile-dropdown-email"
                style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  margin: '2px 0 0 0'
                }}
              >
                {displayEmail}
              </p>
              <div
                style={{
                  marginTop: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 600,
                  backgroundColor: '#ecfdf5',
                  color: '#047857',
                  border: '1px solid #a7f3d0'
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '9999px',
                    backgroundColor: '#10b981'
                  }}
                />
                <span>Active Session</span>
              </div>
            </div>
          </div>

          {/* Dedicated Change Details Button */}
          {onEditProfile && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onEditProfile();
              }}
              className="profile-dropdown-btn"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 12px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '10px',
                color: '#0a66c2',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#dbeafe';
                e.currentTarget.style.borderColor = '#93c5fd';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#eff6ff';
                e.currentTarget.style.borderColor = '#bfdbfe';
              }}
            >
              <Pencil style={{ width: '12px', height: '12px' }} />
              <span>Change Photo, Name & Role</span>
            </button>
          )}

          {/* Resume Upload Box */}
          <div
            className="profile-dropdown-card"
            style={{
              backgroundColor: 'rgba(239, 246, 255, 0.5)',
              border: '1px solid #dbeafe',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span
                className="profile-dropdown-card-title"
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#1f2937',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                Resume Document
              </span>
            </div>

            <input
              type="file"
              ref={resumeInputRef}
              onChange={onUploadResume}
              accept=".pdf,.txt"
              style={{ display: 'none' }}
              id="dropdown-resume-upload-input"
            />

            <label
              htmlFor="dropdown-resume-upload-input"
              className="profile-dropdown-subcard"
              style={{
                width: '100%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 12px',
                backgroundColor: '#ffffff',
                border: '1px solid #bfdbfe',
                color: '#0a66c2',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '8px',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                transition: 'all 0.2s',
                textAlign: 'center',
                boxSizing: 'border-box'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#eff6ff';
                e.currentTarget.style.borderColor = '#60a5fa';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = '#bfdbfe';
              }}
            >
              {resumeUploading ? (
                <>
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      border: '2px solid #0a66c2',
                      borderTopColor: 'transparent',
                      borderRadius: '9999px',
                      animation: 'spin 1s linear infinite'
                    }}
                  />
                  <span>Vectorizing Resume...</span>
                </>
              ) : (
                <>
                  <Upload style={{ width: '14px', height: '14px' }} />
                  <span>Upload or Replace Resume</span>
                </>
              )}
            </label>

            {resumeSuccess && (
              <div
                style={{
                  fontSize: '11px',
                  color: '#047857',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <CheckCircle2
                  style={{ width: '14px', height: '14px', flexShrink: 0, color: '#059669' }}
                />
                <span
                  style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {resumeSuccess}
                </span>
              </div>
            )}

            {/* Link to Dedicated Onboarding / Setup Page */}
            {onOpenOnboarding && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenOnboarding();
                }}
                className="profile-dropdown-link"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '11px',
                  color: '#6b7280',
                  paddingTop: '4px',
                  transition: 'color 0.2s',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#0a66c2';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                <span>Open Dedicated Resume Setup Page</span>
              </button>
            )}
          </div>

          {/* Cost & Token Analytics Section */}
          <div
            onClick={() => {
              setIsOpen(false);
              setShowCostModal(true);
            }}
            className="profile-dropdown-card"
            style={{
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              transition: 'all 0.2s',
              cursor: 'pointer',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
            }}
            title="Click to open full Cost & Token Analytics Dashboard"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 246, 255, 0.5)';
              e.currentTarget.style.borderColor = '#bfdbfe';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f9fafb';
              e.currentTarget.style.borderColor = '#e5e7eb';
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#1f2937',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                Cost & Token
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: '#0a66c2',
                  backgroundColor: 'rgba(219, 234, 254, 0.6)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                <span>Expand</span>
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div
                className="profile-dropdown-subcard"
                style={{
                  backgroundColor: '#ffffff',
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid #f3f4f6',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}
              >
                <span className="profile-dropdown-subcard-label" style={{ fontSize: '10px', color: '#6b7280', display: 'block' }}>
                  Total Spend
                </span>
                <span
                  className="profile-dropdown-subcard-value"
                  style={{
                    fontSize: '12px',
                    fontWeight: 900,
                    color: '#111827',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                  }}
                >
                  ₹ {analytics?.total_cost_inr ? analytics.total_cost_inr.toFixed(4) : '0.0000'}
                </span>
              </div>
              <div
                className="profile-dropdown-subcard"
                style={{
                  backgroundColor: '#ffffff',
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid #f3f4f6',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}
              >
                <span className="profile-dropdown-subcard-label" style={{ fontSize: '10px', color: '#6b7280', display: 'block' }}>
                  Total Tokens
                </span>
                <span
                  className="profile-dropdown-subcard-value"
                  style={{
                    fontSize: '12px',
                    fontWeight: 900,
                    color: '#0a66c2',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                  }}
                >
                  {(
                    (analytics?.total_tokens_in || 0) + (analytics?.total_tokens_out || 0)
                  ).toLocaleString()}
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '10px',
                color: '#6b7280',
                paddingTop: '4px',
                borderTop: '1px solid rgba(229, 231, 235, 0.6)',
                paddingLeft: '2px',
                paddingRight: '2px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
              }}
            >
           
    
            </div>
          </div>

          {/* Sign Out Action Button */}
          <div style={{ paddingTop: '4px' }}>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="profile-dropdown-logout"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#e11d48',
                backgroundColor: '#fff1f2',
                borderRadius: '12px',
                border: 'none',
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e11d48';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#fff1f2';
                e.currentTarget.style.color = '#e11d48';
              }}
            >
              
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Large Centered Cost & Token Analytics Dashboard Modal Dialog */}
      <CostAnalyticsModal
        isOpen={showCostModal}
        onClose={() => setShowCostModal(false)}
        analytics={analytics}
        onRefresh={onRefreshAnalytics}
      />
    </div>
  );
}
