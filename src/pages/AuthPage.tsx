import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  AtSign,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthPageProps {
  initialMode: 'login' | 'register';
  onNavigate: (path: string) => void;
}

type UsernameAvailability = {
  checking: boolean;
  valid: boolean;
  available: boolean;
  normalized: string;
};

export function AuthPage({ initialMode, onNavigate }: AuthPageProps) {
  const {
    user,
    loading: authLoading,
    authError,
    clearAuthError,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    resetPassword,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [forgotMode, setForgotMode] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get('username') || '';
    return initial.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
  });
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const [usernameCheck, setUsernameCheck] = useState<UsernameAvailability | null>(
    null
  );

  // Sync mode if route changes between /login and /register
  useEffect(() => {
    setMode(initialMode);
    setForgotMode(false);
    setLocalError(null);
    setResetSuccessMsg(null);
    clearAuthError();
  }, [initialMode]);

  useEffect(() => {
    if (forgotMode) {
      document.title = 'Reset Kata Sandi — LokaBio';
    } else if (mode === 'register') {
      document.title = 'Daftar Akun — LokaBio';
    } else {
      document.title = 'Masuk ke Studio — LokaBio';
    }
  }, [mode, forgotMode]);

  // Auto-redirect when already signed in
  useEffect(() => {
    if (!authLoading && user) {
      onNavigate('/dashboard');
    }
  }, [authLoading, user, onNavigate]);

  // Debounced live username availability check in Register mode
  useEffect(() => {
    if (mode !== 'register') return;
    const cleaned = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleaned) {
      setUsernameCheck(null);
      return;
    }
    if (cleaned.length < 3) {
      setUsernameCheck({
        checking: false,
        valid: false,
        available: false,
        normalized: cleaned,
      });
      return;
    }

    let cancelled = false;
    setUsernameCheck({
      checking: true,
      valid: true,
      available: true,
      normalized: cleaned,
    });

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/public/username-check?username=${encodeURIComponent(cleaned)}`
        );
        const data = await res.json();
        if (!cancelled) {
          setUsernameCheck({
            checking: false,
            valid: Boolean(data.valid),
            available: Boolean(data.available),
            normalized: data.normalized || cleaned,
          });
        }
      } catch {
        if (!cancelled) setUsernameCheck(null);
      }
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, mode]);

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setForgotMode(false);
    setLocalError(null);
    setResetSuccessMsg(null);
    clearAuthError();
    const targetPath = nextMode === 'register' ? '/register' : '/login';
    if (window.location.pathname !== targetPath) {
      window.history.replaceState({}, '', targetPath);
    }
  };

  const handleUsernameInput = (raw: string) => {
    const cleaned = raw.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
    setUsername(cleaned);
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    if (!email.trim()) {
      setLocalError('Alamat email wajib diisi.');
      return;
    }
    if (!password) {
      setLocalError('Kata sandi wajib diisi.');
      return;
    }

    setSubmitting(true);
    const loggedIn = await signInWithEmail(email, password);
    setSubmitting(false);
    if (loggedIn) {
      onNavigate('/dashboard');
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    const cleanedUsername = username.trim().toLowerCase();
    if (cleanedUsername) {
      if (cleanedUsername.length < 3) {
        setLocalError('Username minimal 3 karakter (huruf, angka, _ atau -).');
        return;
      }
      if (usernameCheck && (!usernameCheck.valid || !usernameCheck.available)) {
        setLocalError('Username tersebut sudah dipakai atau tidak valid.');
        return;
      }
    }

    if (!displayName.trim()) {
      setLocalError('Nama tampilan wajib diisi.');
      return;
    }
    if (!email.trim()) {
      setLocalError('Alamat email wajib diisi.');
      return;
    }
    if (password.length < 6) {
      setLocalError('Kata sandi minimal 6 karakter.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setSubmitting(true);
    const created = await registerWithEmail(
      email,
      password,
      displayName,
      cleanedUsername || undefined
    );
    setSubmitting(false);
    if (created) {
      onNavigate('/dashboard');
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setResetSuccessMsg(null);
    clearAuthError();

    if (!email.trim()) {
      setLocalError('Masukkan alamat email akun Anda terlebih dahulu.');
      return;
    }

    setSubmitting(true);
    const ok = await resetPassword(email);
    setSubmitting(false);
    if (ok) {
      setResetSuccessMsg(
        `Tautan reset kata sandi telah dikirim ke ${email.trim()}. Periksa kotak masuk atau folder spam Anda.`
      );
    }
  };

  const handleGoogleAuth = async () => {
    setLocalError(null);
    clearAuthError();

    if (
      mode === 'register' &&
      username.trim() &&
      usernameCheck &&
      (!usernameCheck.valid || !usernameCheck.available)
    ) {
      setLocalError(
        'Username yang dipilih tidak tersedia. Hapus atau ganti username terlebih dahulu.'
      );
      return;
    }

    setGoogleSubmitting(true);
    const onboarding =
      mode === 'register'
        ? {
            username: username.trim() || undefined,
            displayName: displayName.trim() || undefined,
          }
        : undefined;
    const loggedIn = await signInWithGoogle(onboarding);
    setGoogleSubmitting(false);
    if (loggedIn) {
      onNavigate('/dashboard');
    }
  };

  const displayedError = localError || authError;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-[#141413] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F5F1] text-[#141413] flex flex-col justify-between px-4 py-6 sm:px-6">
      {/* Top Bar */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="font-display text-xl font-bold tracking-tight text-[#141413] whitespace-nowrap shrink-0"
        >
          LokaBio
        </button>
        <div className="flex items-center gap-4 text-sm">
          <button
            type="button"
            onClick={() => onNavigate('/rakapratama')}
            className="text-stone-600 hover:text-[#141413] font-medium transition-colors whitespace-nowrap shrink-0"
          >
            Lihat Contoh Profil
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="inline-flex items-center gap-1.5 text-stone-600 hover:text-[#141413] font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Beranda</span>
          </button>
        </div>
      </header>

      {/* Main Auth Card */}
      <main className="w-full max-w-[440px] mx-auto my-8">
        <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 shadow-xs">
          {/* Segmented Mode Switcher */}
          {!forgotMode && (
            <div className="grid grid-cols-2 p-1 bg-stone-100 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`relative min-h-[42px] rounded-lg text-sm font-semibold transition-colors ${
                  mode === 'login'
                    ? 'text-[#141413]'
                    : 'text-stone-500 hover:text-[#141413]'
                }`}
              >
                {mode === 'login' && (
                  <motion.span
                    layoutId="auth-mode-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 bg-white rounded-lg shadow-xs"
                  />
                )}
                <span className="relative z-10">Masuk</span>
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`relative min-h-[42px] rounded-lg text-sm font-semibold transition-colors ${
                  mode === 'register'
                    ? 'text-[#141413]'
                    : 'text-stone-500 hover:text-[#141413]'
                }`}
              >
                {mode === 'register' && (
                  <motion.span
                    layoutId="auth-mode-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 bg-white rounded-lg shadow-xs"
                  />
                )}
                <span className="relative z-10">Daftar</span>
              </button>
            </div>
          )}

          {/* Heading */}
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold tracking-tight text-[#141413]">
              {forgotMode
                ? 'Reset Kata Sandi'
                : mode === 'register'
                ? 'Buat Halaman BioLink Anda'
                : 'Selamat Datang Kembali'}
            </h1>
            <p className="text-sm text-stone-600 mt-1.5 leading-relaxed">
              {forgotMode
                ? 'Masukkan email akun LokaBio Anda untuk menerima tautan pemulihan kata sandi.'
                : mode === 'register'
                ? 'Klaim username unik Anda, kelola tautan, tema, analitik, dan SEO dalam satu studio.'
                : 'Masuk untuk mengelola tautan, tema real-time, analitik pengunjung, dan QR Code.'}
            </p>
          </div>

          {/* Alerts */}
          <AnimatePresence initial={false}>
            {displayedError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                role="alert"
                className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5 leading-relaxed"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{displayedError}</span>
              </motion.div>
            )}

            {resetSuccessMsg && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5 leading-relaxed"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{resetSuccessMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Forgot Password Form */}
          {forgotMode ? (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Alamat Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@domain.com"
                    autoComplete="email"
                    className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 text-sm focus:outline-none focus:bg-white focus:border-[#141413] transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#141413] text-white text-sm font-semibold hover:bg-stone-800 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <KeyRound className="w-4 h-4" />
                )}
                <span>
                  {submitting ? 'Mengirim Tautan...' : 'Kirim Tautan Reset'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setForgotMode(false);
                  setLocalError(null);
                  setResetSuccessMsg(null);
                  clearAuthError();
                }}
                className="w-full min-h-[40px] text-xs font-medium text-stone-600 hover:text-[#141413] transition-colors"
              >
                Kembali ke halaman Masuk
              </button>
            </form>
          ) : (
            <>
              <AnimatePresence mode="wait" initial={false}>
                {mode === 'login' ? (
                  <motion.form
                    key="login-form"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 6 }}
                    transition={{ duration: 0.16 }}
                    onSubmit={handleEmailLogin}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1.5">
                        Email
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="nama@domain.com"
                          autoComplete="email"
                          className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 text-sm focus:outline-none focus:bg-white focus:border-[#141413] transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-medium text-stone-700">
                          Kata Sandi
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setForgotMode(true);
                            setLocalError(null);
                            clearAuthError();
                          }}
                          className="text-xs font-medium text-[#D97757] hover:underline underline-offset-2"
                        >
                          Lupa kata sandi?
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Masukkan kata sandi"
                          autoComplete="current-password"
                          className="w-full min-h-[46px] pl-3.5 pr-11 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 text-sm focus:outline-none focus:bg-white focus:border-[#141413] transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={
                            showPassword
                              ? 'Sembunyikan kata sandi'
                              : 'Lihat kata sandi'
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg text-stone-500 hover:text-[#141413] hover:bg-stone-100 transition-colors"
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting || googleSubmitting}
                      className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#141413] text-white text-sm font-semibold hover:bg-stone-800 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )}
                      <span>
                        {submitting ? 'Memeriksa Akun...' : 'Masuk dengan Email'}
                      </span>
                    </button>
                  </motion.form>
                ) : (
                  <motion.form
                    key="register-form"
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ duration: 0.16 }}
                    onSubmit={handleEmailRegister}
                    className="space-y-4"
                  >
                    {/* Claim Username */}
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1.5">
                        Klaim Username (Opsional)
                      </label>
                      <div className="relative flex items-center rounded-xl border border-stone-200 bg-stone-50/50 focus-within:bg-white focus-within:border-[#141413] transition-colors">
                        <span className="pl-3.5 pr-1 text-xs font-mono text-stone-500 select-none flex items-center gap-1">
                          <AtSign className="w-3.5 h-3.5 text-stone-400" />
                          <span>lokabio/</span>
                        </span>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => handleUsernameInput(e.target.value)}
                          placeholder="namakreator"
                          autoComplete="username"
                          className="w-full min-h-[46px] pr-9 py-2.5 bg-transparent text-sm font-mono focus:outline-none"
                        />
                        {usernameCheck && (
                          <span className="pr-3 shrink-0">
                            {usernameCheck.checking ? (
                              <Loader2 className="w-4 h-4 text-stone-400 animate-spin" />
                            ) : usernameCheck.valid &&
                              usernameCheck.available ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-500" />
                            )}
                          </span>
                        )}
                      </div>
                      {usernameCheck && !usernameCheck.checking && (
                        <p
                          className={`mt-1.5 text-[11px] font-medium ${
                            usernameCheck.valid && usernameCheck.available
                              ? 'text-emerald-700'
                              : 'text-red-600'
                          }`}
                        >
                          {!usernameCheck.valid
                            ? 'Minimal 3 karakter (huruf kecil, angka, garis bawah, atau tanda hubung).'
                            : usernameCheck.available
                            ? `/${usernameCheck.normalized} tersedia untuk Anda!`
                            : `/${usernameCheck.normalized} sudah digunakan kreator lain.`}
                        </p>
                      )}
                    </div>

                    {/* Display Name */}
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1.5">
                        Nama Tampilan
                      </label>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="cth. Raka Pratama"
                          autoComplete="name"
                          className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 text-sm focus:outline-none focus:bg-white focus:border-[#141413] transition-colors"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1.5">
                        Email
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="nama@domain.com"
                          autoComplete="email"
                          className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 text-sm focus:outline-none focus:bg-white focus:border-[#141413] transition-colors"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1.5">
                        Kata Sandi
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Minimal 6 karakter"
                          autoComplete="new-password"
                          className="w-full min-h-[46px] pl-3.5 pr-11 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 text-sm focus:outline-none focus:bg-white focus:border-[#141413] transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={
                            showPassword
                              ? 'Sembunyikan kata sandi'
                              : 'Lihat kata sandi'
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg text-stone-500 hover:text-[#141413] hover:bg-stone-100 transition-colors"
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1.5">
                        Konfirmasi Kata Sandi
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Ulangi kata sandi"
                        autoComplete="new-password"
                        className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 text-sm focus:outline-none focus:bg-white focus:border-[#141413] transition-colors"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting || googleSubmitting}
                      className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#D97757] text-white text-sm font-semibold hover:bg-[#c56647] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )}
                      <span>
                        {submitting ? 'Membuat Akun...' : 'Buat Akun Sekarang'}
                      </span>
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Divider */}
              <div className="relative my-5 flex items-center justify-center">
                <span className="absolute inset-x-0 h-px bg-stone-200" />
                <span className="relative bg-white px-3 text-xs text-stone-400 font-medium">
                  atau
                </span>
              </div>

              {/* Google OAuth Button */}
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={submitting || googleSubmitting}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-white border border-stone-200 text-[#141413] text-sm font-semibold hover:bg-stone-50 hover:border-stone-300 active:scale-[0.99] transition-all flex items-center justify-center gap-3 disabled:opacity-60"
              >
                {googleSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                )}
                <span>
                  {mode === 'register'
                    ? 'Daftar Cepat dengan Google'
                    : 'Masuk dengan Google'}
                </span>
              </button>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-stone-500">
        LokaBio · Autentikasi aman via Firebase &amp; Google
      </footer>
    </div>
  );
}
