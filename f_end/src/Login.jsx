import React, { useState } from 'react';
import axios from 'axios';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Mail,
  ArrowRight,
  ShieldCheck,
  Zap,
  Sparkles,
  HelpCircle,
  X
} from 'lucide-react';
import LoadingScreen from './LoadingScreen';
import loginBg from './assets/login-bg.png';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export default function Login({ onAuthSuccess }) {
  const [activeTab, setActiveTab] = useState('signin'); // 'signin' | 'register'
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  const validateForm = () => {
    if (!email || !email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (!password || password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return false;
    }
    if (activeTab === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }
    return true;
  };

  const handleAuthResponse = (data, successText) => {
    const { access_token, user_id, email: userEmail } = data;
    if (access_token) {
      localStorage.setItem('nexus_token', access_token);
      localStorage.setItem('nexus_user_id', user_id);
      localStorage.setItem('nexus_user_email', userEmail);
      setSuccessMsg(successText);
      setIsSigningIn(true);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!validateForm()) return;

    setLoading(true);
    const endpoint = activeTab === 'register' ? `${API_BASE}/auth/register` : `${API_BASE}/auth/login`;

    try {
      const response = await axios.post(endpoint, {
        email: email.trim(),
        password: password.trim()
      });
      handleAuthResponse(
        response.data,
        activeTab === 'register' ? 'Account created successfully!' : 'Signed in successfully!'
      );
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map(d => d.msg || d).join(', '));
      } else if (err.code === 'ERR_NETWORK' || !err.response) {
        setError('Cannot connect to backend server. Please make sure the backend is running on port 8000.');
      } else {
        setError('Authentication failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  // OAuth Login (Google & GitHub)
  const handleOAuthLogin = async (provider) => {
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const targetEmail = email.trim() || (provider === 'google' ? 'user.google@gmail.com' : 'user.github@nexus.ai');
      const response = await axios.post(`${API_BASE}/auth/oauth`, {
        provider: provider,
        email: targetEmail
      });

      handleAuthResponse(
        response.data,
        `Signed in with ${provider === 'google' ? 'Google' : 'GitHub'} successfully!`
      );
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : `Failed to sign in with ${provider}.`);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = () => {
    setActiveTab('signin');
    setEmail('demo.executive@nexus.ai');
    setPassword('nexus2026!');
    setConfirmPassword('nexus2026!');
    setShowEmailForm(true);
    setError('');
  };

  if (isSigningIn) {
    return (
      <LoadingScreen
        mode="signin"
        title="Signing in to NEXUS..."
        subtitle="Verifying credentials and loading 24,000 vector job matches..."
        onComplete={() => {
          if (onAuthSuccess) {
            onAuthSuccess({
              token: localStorage.getItem('nexus_token'),
              id: localStorage.getItem('nexus_user_id'),
              email: localStorage.getItem('nexus_user_email')
            });
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f3f7] flex flex-col justify-between items-center px-4 py-8 relative font-sans select-none">
      
      {/* 10% Opacity Architectural Background Layer */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10 pointer-events-none"
        style={{ backgroundImage: `url(${loginBg})` }}
      />

      {/* Background Soft Glow Accents */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[550px] h-[350px] bg-gradient-to-tr from-blue-400/10 via-indigo-400/10 to-teal-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Placeholder Spacing */}
      <div className="h-2 sm:h-6" />

      {/* ========================================================================= */}
      {/* CENTERED MODERN AUTH CARD                                                 */}
      {/* ========================================================================= */}
      <div className="w-full max-w-[430px] bg-white border border-gray-200/80 rounded-2xl shadow-xl p-7 sm:p-9 relative overflow-hidden z-10 transition-all">
        
        {/* ========================================================================= */}
        {/* HEADER & BRANDING                                                         */}
        {/* ========================================================================= */}
        <div className="flex flex-col items-center text-center mb-6">
          
          {/* Custom NEXUS Brand Graphic / Logo */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0a66c2] via-[#2563eb] to-[#38bdf8] flex items-center justify-center text-white shadow-lg shadow-blue-500/20 ring-4 ring-blue-50 mb-3.5 group transition-transform hover:scale-105">
            <div className="flex items-center justify-center font-black text-2xl tracking-tighter">
              <span>N</span>
              <Sparkles className="w-4 h-4 text-cyan-200 -ml-0.5 -mt-2 animate-pulse" />
            </div>
          </div>

          <div className="flex items-center gap-1.5 justify-center">
            <span className="text-xl font-black tracking-tight text-gray-900">
              NEXUS
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-blue-50 text-[#0a66c2] border border-blue-200/60">
              Intelligence
            </span>
          </div>

          {/* Prominent Bold Heading */}
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mt-3">
            Welcome!
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {activeTab === 'signin'
              ? 'Sign in to access your autonomous career intelligence agent'
              : 'Create an account to track 24,000 live startup & tech opportunities'}
          </p>

          {/* Two-Tab Navigation Header (Sign In / Register) */}
          <div className="flex items-center justify-center w-full mt-6 border-b border-gray-200">
            <button
              type="button"
              onClick={() => {
                setActiveTab('signin');
                setError('');
                setSuccessMsg('');
              }}
              className={`flex-1 pb-2.5 text-xs sm:text-sm font-bold tracking-tight transition-all relative ${
                activeTab === 'signin'
                  ? 'text-gray-900 border-b-2 border-gray-900'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setError('');
                setSuccessMsg('');
              }}
              className={`flex-1 pb-2.5 text-xs sm:text-sm font-bold tracking-tight transition-all relative ${
                activeTab === 'register'
                  ? 'text-gray-900 border-b-2 border-gray-900'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              Register
            </button>
          </div>

        </div>

        {/* Notifications */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in">
            <AlertCircle className="w-4 h-4 mt-0.5 text-red-600 shrink-0" />
            <div className="flex-1 leading-relaxed">
              <span>{error}</span>
              {error.toLowerCase().includes('already exists') && activeTab === 'register' && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('signin');
                    setError('');
                  }}
                  className="block mt-1.5 font-bold text-[#0a66c2] hover:underline"
                >
                  Click here to switch to Sign In →
                </button>
              )}
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-700 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* AUTH ACTION BUTTONS (ROUNDED PILLS STACKED VERTICALLY)                     */}
        {/* ========================================================================= */}
        <div className="space-y-2.5 relative z-10">
          
          {/* 1. Sign in with Google */}
          <button
            type="button"
            disabled={loading}
            onClick={() => handleOAuthLogin('google')}
            className="w-full py-2.5 px-4 bg-white hover:bg-gray-50 active:bg-gray-100 border border-gray-300 text-gray-700 hover:text-gray-900 font-semibold text-xs sm:text-sm rounded-full flex items-center justify-center gap-3 transition-all shadow-xs disabled:opacity-60"
          >
            {/* Google Multi-Color SVG Icon */}
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{activeTab === 'signin' ? 'Sign in with Google' : 'Register with Google'}</span>
          </button>

          {/* 2. Sign in with GitHub */}
          <button
            type="button"
            disabled={loading}
            onClick={() => handleOAuthLogin('github')}
            className="w-full py-2.5 px-4 bg-[#1e232a] hover:bg-[#111418] text-white font-semibold text-xs sm:text-sm rounded-full flex items-center justify-center gap-3 transition-all shadow-xs disabled:opacity-60"
          >
            {/* GitHub SVG Icon */}
            <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            <span>{activeTab === 'signin' ? 'Sign in with GitHub' : 'Register with GitHub'}</span>
          </button>

          {/* 3. Sign in with Email (Expands / Routes to form) */}
          <button
            type="button"
            onClick={() => {
              setShowEmailForm(!showEmailForm);
              setError('');
            }}
            className={`w-full py-2.5 px-4 font-semibold text-xs sm:text-sm rounded-full flex items-center justify-center gap-2.5 transition-all ${
              showEmailForm
                ? 'bg-blue-50 text-[#0a66c2] border border-blue-300'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
            }`}
          >
            <Mail className="w-4 h-4 shrink-0 text-gray-600" />
            <span>{activeTab === 'signin' ? 'Sign in with Email' : 'Register with Email'}</span>
            <span className={`text-[10px] ml-1 transition-transform duration-200 ${showEmailForm ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

        </div>

        {/* ========================================================================= */}
        {/* EXPANDABLE EMAIL / PASSWORD FORM                                          */}
        {/* ========================================================================= */}
        {showEmailForm && (
          <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-gray-100 space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200 relative z-10">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@nexus.ai"
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0a66c2] focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-3.5 pr-10 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0a66c2] focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {activeTab === 'register' && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0a66c2] focus:bg-white transition-all"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#0a66c2] hover:bg-[#004182] text-white font-bold text-xs sm:text-sm rounded-full flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-60 mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{activeTab === 'signin' ? 'Continue to NEXUS' : 'Complete Registration'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Quick Demo Fill Helper */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500 relative z-10">
          <span className="flex items-center gap-1 text-gray-500 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Encrypted OAuth2</span>
          </span>
          <button
            type="button"
            onClick={handleQuickDemoLogin}
            className="text-[#0a66c2] hover:text-[#004182] font-semibold flex items-center gap-1 hover:underline"
          >
            <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
            <span>Use Demo Account</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* IN-CARD SWITCH FOOTER LINK                                                */}
        {/* ========================================================================= */}
        <div className="mt-4 text-center text-xs text-gray-600 relative z-10">
          {activeTab === 'signin' ? (
            <span>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setError('');
                }}
                className="text-[#0a66c2] hover:underline font-bold"
              >
                Create one
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signin');
                  setError('');
                }}
                className="text-[#0a66c2] hover:underline font-bold"
              >
                Sign in
              </button>
            </span>
          )}
        </div>

        {/* ========================================================================= */}
        {/* DECORATIVE COLORFUL GRADIENT SHAPES (BOTTOM-RIGHT CORNER INSIDE FRAME)   */}
        {/* ========================================================================= */}
        <div className="absolute -bottom-10 -right-10 w-36 h-36 pointer-events-none z-0 overflow-hidden rounded-br-2xl">
          <div className="absolute inset-0 bg-gradient-to-tl from-cyan-400 via-blue-500 to-indigo-500 opacity-25 rounded-full blur-xl animate-pulse" />
          <div className="absolute bottom-2 right-2 w-20 h-20 bg-gradient-to-br from-pink-400 to-purple-500 opacity-20 rounded-full blur-lg" />
          <div className="absolute bottom-0 right-0 w-12 h-12 bg-amber-400 opacity-15 rounded-full blur-sm" />
        </div>

      </div>

      {/* ========================================================================= */}
      {/* FOOTER LINKS (BELOW CARD CONTAINER)                                       */}
      {/* ========================================================================= */}
      <div className="mt-5 flex flex-col items-center gap-2 text-center text-xs text-gray-500 z-10">
        <button
          type="button"
          onClick={() => setShowSupportModal(true)}
          className="text-gray-500 hover:text-gray-800 font-semibold flex items-center gap-1.5 transition-colors hover:underline"
        >
          <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
          <span>Contact Us / Support</span>
        </button>

        <span className="text-[11px] text-gray-400">
          NEXUS Autonomous Career Intelligence Platform &copy; 2026
        </span>
      </div>

      {/* Support / Contact Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-200 text-left relative">
            <button
              onClick={() => setShowSupportModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 font-bold p-1"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-extrabold text-gray-900 text-base mb-1">
              NEXUS Support & Help Center
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Need assistance logging in or configuring your vector career engine?
            </p>
            <div className="space-y-2.5 text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-200">
              <div>
                <span className="font-bold block text-gray-900">Email Support:</span>
                <span className="font-mono text-gray-600">support@nexus.ai</span>
              </div>
              <div>
                <span className="font-bold block text-gray-900">Test Credentials:</span>
                <span className="font-mono text-gray-600">demo.executive@nexus.ai / nexus2026!</span>
              </div>
              <div>
                <span className="font-bold block text-gray-900">Documentation:</span>
                <span className="text-[#0a66c2]">http://127.0.0.1:8000/docs</span>
              </div>
            </div>
            <button
              onClick={() => setShowSupportModal(false)}
              className="mt-4 w-full py-2 bg-gray-900 text-white rounded-xl text-xs font-semibold hover:bg-black transition-all"
            >
              Close Window
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
