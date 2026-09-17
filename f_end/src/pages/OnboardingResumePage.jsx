import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, ArrowRight, X, Sparkles, Clipboard, FileCode } from 'lucide-react';

export default function OnboardingResumePage({ onUploadResume, onSkip, resumeUploading, resumeSuccess }) {
  const [tab, setTab] = useState('upload'); // 'upload' | 'paste'
  const [selectedFile, setSelectedFile] = useState(null);
  const [pastedText, setPastedText] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard) {
        const text = await navigator.clipboard.readText();
        if (text) setPastedText(text);
      }
    } catch (err) {
      console.warn('Clipboard read permission denied or unavailable', err);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (tab === 'upload' && selectedFile) {
      onUploadResume(selectedFile);
    } else if (tab === 'paste' && pastedText.trim()) {
      onUploadResume(pastedText.trim());
    }
  };

  const wordCount = pastedText.trim() ? pastedText.trim().split(/\s+/).length : 0;

  return (
    <div className="onboarding-page-root min-h-screen flex flex-col justify-between bg-gradient-to-b from-blue-50 via-sky-50 to-white text-gray-900 font-sans relative overflow-hidden">
      {/* Background Decorative Radial Circles */}
      <div className="absolute top-[-120px] left-[-100px] w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-80px] w-96 h-96 bg-sky-300/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header with Skip Button */}
      <header className="p-6 flex items-center justify-between max-w-6xl w-full mx-auto relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0a66c2] via-[#0284c7] to-[#38bdf8] flex items-center justify-center text-white font-black text-lg shadow-md shadow-blue-500/20">
            S
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-black text-xl tracking-tight text-gray-900 dark:text-white">
              SAHAAL<span className="text-[#0a66c2]">.</span>
            </span>
            <span className="text-[9px] font-bold text-gray-400 tracking-widest uppercase">
              Intelligence
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onSkip}
          className="group flex items-center gap-1.5 px-4 py-2 bg-white/80 hover:bg-white text-gray-700 hover:text-[#0a66c2] text-xs font-semibold rounded-full border border-gray-200 hover:border-blue-300 shadow-sm transition-all"
        >
          <span>Skip for now</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </header>

      {/* Center Box */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 relative z-10">
        <div className="onboarding-card bg-white border border-gray-200/90 rounded-2xl shadow-xl p-6 sm:p-8 max-w-lg w-full space-y-5">
          
          {/* Header text */}
          <div className="text-center space-y-1.5">
            <div className="w-11 h-11 bg-blue-50 text-[#0a66c2] rounded-2xl mx-auto flex items-center justify-center shadow-inner border border-blue-100">
              <Sparkles className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              Add Your Resume
            </h1>
            <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
              Upload your resume as a PDF or TXT file, or copy-paste the text directly to calculate career fit and AI match rankings.
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="onboarding-tabs-bar flex bg-gray-100/80 p-1 rounded-xl border border-gray-200/60">
            <button
              type="button"
              onClick={() => setTab('upload')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                tab === 'upload'
                  ? 'bg-white text-[#0a66c2] shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload PDF / TXT</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('paste')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                tab === 'paste'
                  ? 'bg-white text-[#0a66c2] shadow-xs'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span>Copy & Paste Text</span>
            </button>
          </div>

          {/* Tab 1: File Upload (PDF & TXT) */}
          {tab === 'upload' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.txt,.text,.md"
                className="hidden"
              />

              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`onboarding-dropzone border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-[#0a66c2] bg-blue-50/60 scale-[1.01]'
                    : selectedFile
                    ? 'border-emerald-400 bg-emerald-50/30'
                    : 'border-gray-300 hover:border-[#0a66c2] bg-gray-50/60 hover:bg-blue-50/30'
                }`}
              >
                {selectedFile ? (
                  <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-lg border border-emerald-200 shadow-xs text-left">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-gray-900 truncate">{selectedFile.name}</div>
                        <div className="text-[10px] text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-10 h-10 bg-blue-100/60 text-[#0a66c2] rounded-full mx-auto flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-semibold text-gray-800">
                      Click to browse or drag & drop resume file
                    </div>
                    <div className="text-[10px] text-gray-400">
                      Supports <strong>PDF</strong> and <strong>TXT</strong> files (Max 10 MB)
                    </div>
                  </div>
                )}
              </div>

              {/* Success state — shown after upload completes */}
              {resumeSuccess ? (
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  </div>
                  <p className="text-sm font-bold text-emerald-700 text-center">{resumeSuccess}</p>
                  <button
                    type="button"
                    onClick={onSkip}
                    className="py-2.5 px-6 bg-[#0a66c2] hover:bg-[#004182] text-white text-xs font-bold rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Go to Dashboard Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : selectedFile ? (
                <button
                  type="submit"
                  disabled={resumeUploading}
                  className="w-full py-2.5 px-4 bg-[#0a66c2] hover:bg-[#004182] text-white text-xs font-bold rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {resumeUploading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Vectorizing File with AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Upload &amp; Index Resume</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 bg-[#0a66c2] hover:bg-[#004182] text-white text-xs font-bold rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose Resume File to Upload</span>
                </button>
              )}
            </form>
          )}

          {/* Tab 2: Copy & Paste Text */}
          {tab === 'paste' && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">Resume Plain Text:</span>
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="text-[11px] text-[#0a66c2] hover:text-[#004182] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Clipboard className="w-3 h-3" />
                  <span>Paste from clipboard</span>
                </button>
              </div>

              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={8}
                placeholder="Paste your full resume text here (Summary, Work Experience, Technical Skills, Education)..."
                className="w-full p-3 bg-gray-50 hover:bg-white focus:bg-white border border-gray-300 focus:border-[#0a66c2] rounded-xl text-xs text-gray-900 leading-relaxed outline-none transition-all resize-y shadow-xs"
              />

              <div className="flex items-center justify-between text-[11px] text-gray-500 px-1">
                <span>{wordCount} words ({pastedText.length} chars)</span>
                {pastedText && (
                  <button
                    type="button"
                    onClick={() => setPastedText('')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    Clear text
                  </button>
                )}
              </div>

              {/* Success state or submit button */}
              {resumeSuccess ? (
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  </div>
                  <p className="text-sm font-bold text-emerald-700 text-center">{resumeSuccess}</p>
                  <button
                    type="button"
                    onClick={onSkip}
                    className="py-2.5 px-6 bg-[#0a66c2] hover:bg-[#004182] text-white text-xs font-bold rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Go to Dashboard Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={resumeUploading || !pastedText.trim()}
                  className="w-full py-2.5 px-4 bg-[#0a66c2] hover:bg-[#004182] text-white text-xs font-bold rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {resumeUploading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Vectorizing Resume Text...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Vectorize &amp; Save Pasted Resume</span>
                    </>
                  )}
                </button>
              )}
            </form>
          )}

          {/* Bottom Secondary Skip Link */}
          <div className="pt-2 border-t border-gray-100 text-center">
            <button
              type="button"
              onClick={onSkip}
              className="text-xs text-gray-500 hover:text-gray-800 hover:underline font-medium cursor-pointer"
            >
              I will add my resume later, take me to dashboard
            </button>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-gray-400">
        SAHAAL Autonomous Career Intelligence Engine &copy; 2026
      </footer>
    </div>
  );
}
