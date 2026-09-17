import React, { useState, useRef } from 'react';
import { Camera, User, ArrowRight, X, CheckCircle2, Pencil } from 'lucide-react';

/**
 * PersonalDetailsPage
 * ─────────────────────────────────────────────────────────────────
 * Step 1 of the new-user onboarding flow (shown right after registration).
 * Lets the user upload a profile photo + fill their name/title.
 * The entire step can be skipped with "Skip for now →".
 *
 * Props
 *  onComplete(details)  – called when user hits Continue.
 *                         details = { fullName, jobTitle, photoFile, photoPreview }
 *  onSkip()             – called when user clicks Skip.
 */
export default function PersonalDetailsPage({ onComplete, onSkip, currentUser }) {
  const userKeySuffix = currentUser?.id ? `_${currentUser.id}` : '';
  const initialName = currentUser?.full_name || currentUser?.name || localStorage.getItem(`nexus_display_name${userKeySuffix}`) || localStorage.getItem('nexus_display_name') || '';
  const initialJobTitle = currentUser?.job_title || localStorage.getItem(`nexus_job_title${userKeySuffix}`) || localStorage.getItem('nexus_job_title') || '';
  const initialPic = localStorage.getItem(`nexus_profile_pic${userKeySuffix}`) || localStorage.getItem('nexus_profile_pic') || '';

  const [fullName, setFullName]       = useState(initialName);
  const [jobTitle, setJobTitle]       = useState(initialJobTitle);
  const [photoFile, setPhotoFile]     = useState(null);
  const [photoPreview, setPhotoPreview] = useState(initialPic);
  const [dragOver, setDragOver]       = useState(false);
  const [saved, setSaved]             = useState(false);

  const isExistingUser = Boolean(currentUser?.id || localStorage.getItem('nexus_onboarded') === 'true');

  const fileInputRef   = useRef(null);
  const videoRef       = useRef(null);
  const canvasRef      = useRef(null);
  const streamRef      = useRef(null);

  const [cameraOpen,   setCameraOpen]   = useState(false);
  const [cameraReady,  setCameraReady]  = useState(false);
  const [cameraError,  setCameraError]  = useState('');
  const [snapPreview,  setSnapPreview]  = useState(''); // data-url of captured frame

  // ── Photo helpers ──────────────────────────────────────────────
  const applyPhoto = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => applyPhoto(e.target.files?.[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    applyPhoto(e.dataTransfer?.files?.[0]);
  };

  const handleRemovePhoto = (e) => {
    e.stopPropagation();
    setPhotoFile(null);
    setPhotoPreview('');
    localStorage.removeItem('nexus_profile_pic');
    if (currentUser?.id) {
      localStorage.removeItem(`nexus_profile_pic_${currentUser.id}`);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Camera helpers ─────────────────────────────────────────────
  const openCamera = async () => {
    setCameraError('');
    setSnapPreview('');
    setCameraOpen(true);
    setCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      // Wait a tick for the modal to mount and the video el to be in the DOM
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            setCameraReady(true);
          };
        }
      }, 80);
    } catch (err) {
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera access denied. Allow camera in your browser settings and try again.'
          : `Could not open camera: ${err.message}`
      );
    }
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setCameraReady(false);
    setSnapPreview('');
  };

  const snapPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    setSnapPreview(canvas.toDataURL('image/jpeg', 0.92));
    // Pause stream but keep it alive so user can retake
    video.pause();
  };

  const retakePhoto = () => {
    setSnapPreview('');
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play();
    }
  };

  const usePhoto = () => {
    if (!snapPreview) return;
    setPhotoPreview(snapPreview);
    // Convert data-url → File object so parent gets a real File
    fetch(snapPreview)
      .then(r => r.blob())
      .then(blob => {
        const file = new File([blob], `selfie_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setPhotoFile(file);
      });
    closeCamera();
  };

  // ── Submit ─────────────────────────────────────────────────────
  const handleContinue = (e) => {
    e.preventDefault();
    setSaved(true);
    // Persist photo preview in localStorage so the rest of the app can use it
    if (photoPreview) {
      localStorage.setItem('nexus_profile_pic', photoPreview);
      if (currentUser?.id) {
        localStorage.setItem(`nexus_profile_pic_${currentUser.id}`, photoPreview);
      }
    } else {
      localStorage.removeItem('nexus_profile_pic');
      if (currentUser?.id) {
        localStorage.removeItem(`nexus_profile_pic_${currentUser.id}`);
      }
    }
    if (fullName.trim()) {
      localStorage.setItem('nexus_display_name', fullName.trim());
      if (currentUser?.id) {
        localStorage.setItem(`nexus_display_name_${currentUser.id}`, fullName.trim());
      }
    }
    if (jobTitle.trim()) {
      localStorage.setItem('nexus_job_title', jobTitle.trim());
      if (currentUser?.id) {
        localStorage.setItem(`nexus_job_title_${currentUser.id}`, jobTitle.trim());
      }
    }
    setTimeout(() => {
      onComplete({ fullName: fullName.trim(), jobTitle: jobTitle.trim(), photoFile, photoPreview });
    }, 600);
  };

  return (
    <div
      className="personal-details-root min-h-screen flex flex-col bg-gradient-to-b from-blue-50 via-sky-50 to-white text-gray-900 font-sans relative overflow-hidden"
    >
      {/* Background decorative blurs */}
      <div className="absolute top-[-120px] left-[-100px] w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-80px]  w-96 h-96 bg-sky-300/20  rounded-full blur-3xl pointer-events-none" />

      {/* ── Header ── */}
      <header className="p-6 flex items-center justify-between max-w-6xl w-full mx-auto relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0a66c2] via-[#0284c7] to-[#38bdf8] flex items-center justify-center text-white font-black text-lg shadow-md shadow-blue-500/20">
            S
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-black text-xl tracking-tight text-gray-900">
              SAHAAL<span className="text-[#0a66c2]">.</span>
            </span>
            <span className="text-[9px] font-bold text-gray-400 tracking-widest uppercase">
              Intelligence
            </span>
          </div>
        </div>

        {/* Step indicator (only in new onboarding) */}
        {!isExistingUser ? (
          <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
            <span className="flex items-center gap-1">
              <span className="w-5 h-5 rounded-full bg-[#0a66c2] text-white flex items-center justify-center text-[10px] font-bold">1</span>
              <span className="hidden sm:inline text-gray-600 font-semibold">Profile</span>
            </span>
            <span className="w-6 h-px bg-gray-300" />
            <span className="flex items-center gap-1">
              <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-[10px] font-bold">2</span>
              <span className="hidden sm:inline">Resume</span>
            </span>
          </div>
        ) : (
          <div className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
            Profile Settings
          </div>
        )}

        {/* Skip / Back button */}
        <button
          type="button"
          onClick={onSkip}
          className="text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1"
        >
          {isExistingUser ? 'Back to Dashboard' : 'Skip for now'} <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* ── Main Card ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 relative z-10">
        <div className="personal-details-card bg-white border border-gray-200/90 rounded-2xl shadow-xl p-6 sm:p-8 max-w-md w-full">

          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 mb-2">
              {isExistingUser ? 'Edit your profile' : "Let's set up your profile"}
            </h1>
            <p className="text-sm text-gray-500">
              {isExistingUser
                ? 'Update your photo (upload or take a selfie), full name, and job title.'
                : 'Add a photo and your details — you can always change these later.'}
            </p>
          </div>

          <form onSubmit={handleContinue} className="flex flex-col gap-6">

            {/* ── Circular Photo Upload ── */}
            <div className="flex flex-col items-center gap-3">
              <div
                className={`relative group cursor-pointer select-none transition-all duration-200 ${
                  dragOver ? 'scale-105' : ''
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                {/* Circle avatar */}
                <div
                  className={`w-28 h-28 rounded-full flex items-center justify-center overflow-hidden border-4 transition-all duration-200 shadow-lg ${
                    dragOver
                      ? 'border-[#0a66c2] shadow-blue-300/50'
                      : photoPreview
                      ? 'border-[#0a66c2]/30'
                      : 'border-dashed border-gray-300 bg-gray-50 hover:border-[#0a66c2] hover:bg-blue-50/50'
                  }`}
                >
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Profile preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-gray-400 group-hover:text-[#0a66c2] transition-colors">
                      <Camera className="w-8 h-8" />
                      <span className="text-[10px] font-semibold">Add Photo</span>
                    </div>
                  )}
                </div>

                {/* Edit overlay on hover */}
                {photoPreview && (
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil className="w-6 h-6 text-white" />
                  </div>
                )}

                {/* Remove button */}
                {photoPreview && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              <p className="text-[11px] text-gray-400 text-center">
                Click to upload · Drag &amp; drop · JPG, PNG, WEBP
              </p>

              {/* Take photo from camera */}
              <button
                type="button"
                onClick={openCamera}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0a66c2] hover:text-[#0952a0] transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                Take photo from camera
              </button>

              {/* Hidden canvas used for frame capture */}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* ── Full Name ── */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-600 tracking-wide uppercase">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alex Johnson"
                  className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/10 transition-all"
                />
              </div>
            </div>

            {/* ── Job Title ── */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-600 tracking-wide uppercase">
                Job Title <span className="text-gray-400 font-normal normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Software Engineer"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/10 transition-all"
              />
            </div>

            {/* ── Continue Button ── */}
            <button
              type="submit"
              className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 shadow-md ${
                saved
                  ? 'bg-emerald-500 text-white shadow-emerald-200'
                  : 'bg-[#0a66c2] hover:bg-[#0952a0] text-white shadow-blue-200 hover:shadow-blue-300 active:scale-[0.98]'
              }`}
            >
              {saved ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {isExistingUser ? 'Profile Updated!' : 'Saved! Moving on…'}
                </>
              ) : isExistingUser ? (
                <>
                  Save Profile Details
                  <CheckCircle2 className="w-4 h-4" />
                </>
              ) : (
                <>
                  Continue to Resume
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Skip inline link */}
            <button
              type="button"
              onClick={onSkip}
              className="text-center text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {isExistingUser ? 'Cancel and return to dashboard' : 'Skip this step and add details later'}
            </button>

          </form>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="pb-6 text-center text-[11px] text-gray-300 relative z-10">
        Your information is private and never shared.
      </footer>

      {/* ── Camera Modal ─────────────────────────────────────────── */}
      {cameraOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeCamera(); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#0a66c2]" />
                <span className="font-bold text-sm text-gray-800">Take a selfie</span>
              </div>
              <button
                type="button"
                onClick={closeCamera}
                className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Camera error */}
            {cameraError && (
              <div className="mx-5 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 text-center">
                {cameraError}
              </div>
            )}

            {/* Video / snapshot preview */}
            <div className="relative bg-gray-900 mx-5 mt-4 rounded-xl overflow-hidden aspect-video flex items-center justify-center">
              {/* Live stream — always mounted, hidden when snap taken */}
              <video
                ref={videoRef}
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{ display: snapPreview ? 'none' : 'block', transform: 'scaleX(-1)' }}
              />

              {/* Snap preview */}
              {snapPreview && (
                <img
                  src={snapPreview}
                  alt="Captured selfie"
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
              )}

              {/* Loading overlay */}
              {!cameraReady && !cameraError && !snapPreview && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
                  <div className="w-7 h-7 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium">Starting camera…</span>
                </div>
              )}

              {/* Round face guide */}
              {!snapPreview && cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-36 h-36 rounded-full border-2 border-white/50 border-dashed" />
                </div>
              )}
            </div>

            {/* Hint text */}
            <p className="text-center text-[11px] text-gray-400 mt-2 px-5">
              {snapPreview
                ? 'Happy with this photo? Use it, or retake.'
                : 'Position your face in the circle then press Snap.'}
            </p>

            {/* Action buttons */}
            <div className="flex gap-3 px-5 py-4">
              {!snapPreview ? (
                <button
                  type="button"
                  disabled={!cameraReady}
                  onClick={snapPhoto}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0a66c2] hover:bg-[#0952a0] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-all active:scale-[0.97] shadow-md shadow-blue-200"
                >
                  <Camera className="w-4 h-4" />
                  Snap
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={retakePhoto}
                    className="flex-1 py-3 rounded-xl border border-gray-200 hover:border-gray-300 text-gray-600 text-sm font-semibold transition-all hover:bg-gray-50 active:scale-[0.97]"
                  >
                    Retake
                  </button>
                  <button
                    type="button"
                    onClick={usePhoto}
                    className="flex-1 py-3 rounded-xl bg-[#0a66c2] hover:bg-[#0952a0] text-white text-sm font-bold transition-all shadow-md shadow-blue-200 active:scale-[0.97]"
                  >
                    Use this photo
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
