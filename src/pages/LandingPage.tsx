import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Globe,
  Layers,
  Loader2,
  Lock,
  Mail,
  Palette,
  Play,
  QrCode,
  Search,
  Smartphone,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BioLinkRenderer } from '../components/BioLinkRenderer';
import { PhoneMockupFrame } from '../components/PhoneMockupFrame';
import {
  PublicPlatformStatusDTO,
  PublicProfileDTO,
  THEME_PRESETS,
} from '../shared/themes';

interface LandingPageProps {
  onNavigate: (path: string) => void;
}

type ClaimCheck = {
  checking: boolean;
  valid: boolean;
  available: boolean;
  normalized: string;
};

const PRESET_SWATCHES: Record<string, string> = {
  'minimalist-light': '#F6F5F1',
  'dark-mode': '#141413',
  'gradient-sunset': 'linear-gradient(135deg, #2A1624 0%, #D97757 100%)',
  glassmorphism: 'linear-gradient(135deg, #0F172A 0%, #334155 100%)',
};

const MINI_CHART_BARS = [
  { label: 'Sen', views: 44, clicks: 28 },
  { label: 'Sel', views: 58, clicks: 38 },
  { label: 'Rab', views: 51, clicks: 34 },
  { label: 'Kam', views: 76, clicks: 54 },
  { label: 'Jum', views: 68, clicks: 46 },
  { label: 'Sab', views: 94, clicks: 68 },
  { label: 'Min', views: 86, clicks: 62 },
];

export function LandingPage({ onNavigate }: LandingPageProps) {
  const { user } = useAuth();
  const [featured, setFeatured] = useState<PublicProfileDTO[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [previewPresetId, setPreviewPresetId] = useState<string | null>(null);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [platformStatus, setPlatformStatus] =
    useState<PublicPlatformStatusDTO | null>(null);

  // Interactive Hero Username Claim
  const [claimHandle, setClaimHandle] = useState('');
  const [claimCheck, setClaimCheck] = useState<ClaimCheck | null>(null);
  const [ogImgFailed, setOgImgFailed] = useState(false);

  useEffect(() => {
    setOgImgFailed(false);
  }, [selectedIndex]);

  useEffect(() => {
    document.title = 'LokaBio – Platform BioLink Modern & Studio Tema Real-Time';
    fetch('/api/public/platform-status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setPlatformStatus(data);
      })
      .catch(() => {});
    fetch('/api/public/featured')
      .then((res) => (res.ok ? res.json() : { profiles: [] }))
      .then((data) => {
        if (Array.isArray(data?.profiles)) {
          setFeatured(data.profiles);
          setSelectedIndex(0);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingFeatured(false));
  }, []);

  // Debounced live username availability check on Hero claim input
  useEffect(() => {
    const cleaned = claimHandle
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');
    if (!cleaned) {
      setClaimCheck(null);
      return;
    }
    if (cleaned.length < 3) {
      setClaimCheck({
        checking: false,
        valid: false,
        available: false,
        normalized: cleaned,
      });
      return;
    }

    let cancelled = false;
    setClaimCheck({
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
          setClaimCheck({
            checking: false,
            valid: Boolean(data.valid),
            available: Boolean(data.available),
            normalized: data.normalized || cleaned,
          });
        }
      } catch {
        if (!cancelled) setClaimCheck(null);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [claimHandle]);

  const handlePrimaryAuth = () => {
    if (user) {
      onNavigate('/dashboard');
      return;
    }
    onNavigate('/login');
  };

  const handleClaimSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (user) {
      onNavigate('/dashboard');
      return;
    }
    const cleaned = claimHandle
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');
    if (cleaned.length >= 3) {
      onNavigate(`/register?username=${encodeURIComponent(cleaned)}`);
    } else {
      onNavigate('/register');
    }
  };

  const activeShowcase = featured[selectedIndex];
  const overriddenShowcase: PublicProfileDTO | null = activeShowcase
    ? (() => {
        if (!previewPresetId) return activeShowcase;
        const preset = THEME_PRESETS.find((p) => p.id === previewPresetId);
        if (!preset) return activeShowcase;
        return {
          ...activeShowcase,
          themePreset: preset.id,
          ...preset.config,
        };
      })()
    : null;

  const showcaseTotals = useMemo(() => {
    const views = featured.reduce((sum, p) => sum + (p.profileViews || 0), 0);
    const linkCount = featured.reduce((sum, p) => sum + p.links.length, 0);
    return { views, linkCount };
  }, [featured]);

  const activePresetId = previewPresetId ?? activeShowcase?.themePreset;

  if (platformStatus?.maintenanceMode) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] text-[#141413] flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-md w-full bg-white border border-stone-200 rounded-2xl p-8 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <Wrench className="w-6 h-6" />
          </div>
          <p className="font-display text-lg font-bold tracking-tight text-[#141413]">
            LokaBio
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight mt-2 mb-2">
            Sedang Dalam Pemeliharaan
          </h1>
          <p className="text-sm text-stone-600 leading-relaxed mb-6">
            {platformStatus.maintenanceMessage}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[42px] px-5 py-2 rounded-xl bg-[#141413] text-white text-sm font-medium hover:bg-stone-800 transition-colors"
            >
              Coba Muat Ulang
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/admin')}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-stone-200 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
            >
              Akses Super Admin
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F5F1] text-[#141413] overflow-x-hidden">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-[#F6F5F1]/85 backdrop-blur-xl border-b border-stone-200/75 transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[68px] flex items-center justify-between gap-8">
          {/* Zone 1: Single text wordmark */}
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="font-display text-xl font-bold tracking-tight text-[#141413] hover:text-[#D97757] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            LokaBio
          </button>

          {/* Zone 2: Concise single-line text nav links */}
          <nav
            aria-label="Navigasi utama"
            className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-600"
          >
            <a
              href="#eksplorasi"
              className="relative py-1 hover:text-[#141413] transition-colors whitespace-nowrap shrink-0 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[1.5px] after:w-0 after:bg-[#D97757] after:transition-all after:duration-200 hover:after:w-full"
            >
              Eksplorasi
            </a>
            <a
              href="#fitur"
              className="relative py-1 hover:text-[#141413] transition-colors whitespace-nowrap shrink-0 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[1.5px] after:w-0 after:bg-[#D97757] after:transition-all after:duration-200 hover:after:w-full"
            >
              Fitur
            </a>
            <a
              href="#tema"
              className="relative py-1 hover:text-[#141413] transition-colors whitespace-nowrap shrink-0 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[1.5px] after:w-0 after:bg-[#D97757] after:transition-all after:duration-200 hover:after:w-full"
            >
              Tema
            </a>
            <a
              href="#seo"
              className="relative py-1 hover:text-[#141413] transition-colors whitespace-nowrap shrink-0 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[1.5px] after:w-0 after:bg-[#D97757] after:transition-all after:duration-200 hover:after:w-full"
            >
              SEO
            </a>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handlePrimaryAuth}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#141413] text-[#FAF9F6] text-xs sm:text-sm font-semibold shadow-xs hover:bg-[#D97757] hover:shadow-sm active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              {user ? 'Buka Studio' : 'Masuk | Daftar'}
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Split with Architectural Studio Grid Backdrop */}
        <section id="eksplorasi" className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-studio-grid opacity-65 [mask-image:radial-gradient(ellipse_at_50%_30%,black_30%,transparent_80%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_45%,rgba(217,119,87,0.12),transparent_56%)]"
          />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-14 lg:pt-16 lg:pb-22">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Left Copy & Interactive Username Claim */}
              <div className="lg:col-span-6 space-y-6">
                <p className="text-xs sm:text-sm font-medium text-stone-500">
                  Platform BioLink untuk Kreator &amp; Profesional Indonesia
                </p>

                <h1
                  className="font-display font-bold tracking-tight leading-[1.06] text-[#141413]"
                  style={{
                    fontSize: 'clamp(2.25rem, 4.1vw, 3.55rem)',
                    textWrap: 'balance',
                  }}
                >
                  Satu halaman tautan yang terasa seperti{' '}
                  <span className="text-[#D97757]">karya Anda sendiri.</span>
                </h1>

                <p className="text-base sm:text-lg text-stone-600 leading-relaxed max-w-xl">
                  Satukan portofolio, toko digital, video, dan seluruh kanal sosial Anda dengan studio tema real-time, analitik klik harian, QR Code siap cetak, serta SEO otomatis untuk WhatsApp dan media sosial.
                </p>

                {/* Primary Action: Interactive Username Claim or Studio Button */}
                {user ? (
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => onNavigate('/dashboard')}
                      className="min-h-[48px] px-6 py-3 rounded-xl bg-[#D97757] text-white text-sm font-semibold hover:bg-[#c56647] active:scale-[0.98] transition-all inline-flex items-center gap-2 whitespace-nowrap shrink-0 shadow-sm"
                    >
                      <span>Buka Studio Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    {activeShowcase && (
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate(`/${activeShowcase.username}`)
                        }
                        className="min-h-[48px] px-5 py-3 rounded-xl bg-white border border-stone-200 text-[#141413] text-sm font-medium hover:bg-stone-50 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                      >
                        <span>Lihat /{activeShowcase.username}</span>
                        <ExternalLink className="w-4 h-4 text-stone-500" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 pt-1 max-w-lg">
                    <form
                      onSubmit={handleClaimSubmit}
                      className="flex flex-col sm:flex-row items-stretch gap-2 p-1.5 bg-white border border-stone-200 rounded-2xl shadow-sm focus-within:border-[#141413] transition-colors"
                    >
                      <div className="flex items-center flex-1 min-w-0 pl-3 pr-2">
                        <span className="text-sm font-mono text-stone-400 select-none shrink-0">
                          lokabio.id/
                        </span>
                        <input
                          type="text"
                          value={claimHandle}
                          onChange={(e) =>
                            setClaimHandle(
                              e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9_-]/g, '')
                                .slice(0, 30)
                            )
                          }
                          placeholder="namakamu"
                          aria-label="Username yang ingin diklaim"
                          className="w-full min-h-[44px] py-2 px-1 text-sm font-mono text-[#141413] placeholder:text-stone-400 bg-transparent focus:outline-none"
                        />
                        {claimCheck && (
                          <span className="shrink-0 pl-1">
                            {claimCheck.checking ? (
                              <Loader2 className="w-4 h-4 text-stone-400 animate-spin" />
                            ) : claimCheck.valid && claimCheck.available ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-500" />
                            )}
                          </span>
                        )}
                      </div>
                      <button
                        type="submit"
                        className="min-h-[46px] px-5 py-2.5 rounded-xl bg-[#D97757] text-white text-sm font-semibold hover:bg-[#c56647] active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                      >
                        <span>Klaim Tautan</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </form>

                    {/* Live feedback & Sign-In shortcut */}
                    <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
                      {claimCheck && !claimCheck.checking ? (
                        <span
                          className={`font-medium ${
                            claimCheck.valid && claimCheck.available
                              ? 'text-emerald-700'
                              : 'text-red-600'
                          }`}
                        >
                          {!claimCheck.valid
                            ? 'Minimal 3 karakter (huruf kecil, angka, _ atau -).'
                            : claimCheck.available
                            ? `/${claimCheck.normalized} tersedia — klik Klaim Tautan untuk daftar.`
                            : `/${claimCheck.normalized} sudah dipakai kreator lain.`}
                        </span>
                      ) : (
                        <span className="text-stone-500">
                          Gratis selamanya · Daftar via Google atau Email
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onNavigate('/login')}
                        className="font-semibold text-[#141413] hover:underline underline-offset-4 whitespace-nowrap shrink-0"
                      >
                        Sudah punya akun? Masuk
                      </button>
                    </div>
                  </div>
                )}

                {/* Grounded Platform Summary Strip */}
                <div className="pt-6 border-t border-stone-200/90 grid grid-cols-3 gap-4 sm:gap-6">
                  <div>
                    <p className="font-display text-xl sm:text-2xl font-bold text-[#141413] tabular-nums">
                      4 Preset
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Tema &amp; kustom penuh
                    </p>
                  </div>
                  <div>
                    <p className="font-display text-xl sm:text-2xl font-bold text-[#141413] tabular-nums">
                      {showcaseTotals.linkCount > 0
                        ? `${showcaseTotals.linkCount} Blok`
                        : '7+ Blok'}
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Embed, PIN &amp; jadwal
                    </p>
                  </div>
                  <div>
                    <p className="font-display text-xl sm:text-2xl font-bold text-[#141413] tabular-nums">
                      {showcaseTotals.views > 0
                        ? showcaseTotals.views.toLocaleString('id-ID')
                        : 'Real-Time'}
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {showcaseTotals.views > 0
                        ? 'Kunjungan sampel aktif'
                        : 'Analitik &amp; ekspor CSV'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Interactive Showcase Stage */}
              <div className="lg:col-span-6">
                <div className="relative rounded-[32px] bg-gradient-to-br from-[#EDE9DF] via-[#F9F8F4] to-[#E6E1D5] border border-stone-200/90 p-4 sm:p-6 shadow-sm">
                  {/* Stage Top Controls: Admin-Curated Creator Switcher */}
                  <div className="bg-white/90 backdrop-blur-sm border border-stone-200/80 rounded-2xl p-2.5 sm:p-3 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                    <div className="px-1 shrink-0">
                      <span className="text-xs font-semibold text-[#141413] block">
                        Pratinjau Profil Aktif
                      </span>
                      <span className="text-[11px] text-stone-500">
                        Kurasi resmi oleh Admin
                      </span>
                    </div>
                    {featured.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1 bg-stone-100 p-1 rounded-xl">
                        {featured.map((profile, idx) => (
                          <button
                            key={profile.id}
                            type="button"
                            onClick={() => {
                              setSelectedIndex(idx);
                              setPreviewPresetId(null);
                            }}
                            className={`relative min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap max-w-[140px] truncate ${
                              selectedIndex === idx
                                ? 'text-[#141413]'
                                : 'text-stone-600 hover:text-[#141413]'
                            }`}
                          >
                            {selectedIndex === idx && (
                              <motion.span
                                layoutId="landing-creator-pill"
                                transition={{
                                  type: 'spring',
                                  stiffness: 420,
                                  damping: 32,
                                }}
                                className="absolute inset-0 bg-white rounded-lg shadow-xs"
                              />
                            )}
                            <span className="relative z-10 truncate">
                              @{profile.username}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : !loadingFeatured ? (
                      <span className="text-[11px] text-stone-500 px-1">
                        Belum ada profil dipilih
                      </span>
                    ) : null}
                  </div>

                  {/* Flagship Mobile Hardware Mockup (No Scrollbar!) */}
                  <PhoneMockupFrame screenHeightClass="h-[510px] sm:h-[545px]">
                    {loadingFeatured ? (
                      <div className="h-full w-full bg-stone-100 animate-pulse px-6 pt-12 pb-8 flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-stone-200 mb-4" />
                        <div className="h-5 w-36 bg-stone-200 rounded mb-2" />
                        <div className="h-3 w-48 bg-stone-200 rounded mb-8" />
                        <div className="w-full space-y-3">
                          <div className="h-12 bg-stone-200 rounded-xl" />
                          <div className="h-12 bg-stone-200 rounded-xl" />
                          <div className="h-12 bg-stone-200 rounded-xl" />
                        </div>
                      </div>
                    ) : overriddenShowcase ? (
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={`${overriddenShowcase.username}-${overriddenShowcase.themePreset}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{
                            duration: 0.2,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          className="min-h-full"
                        >
                          <BioLinkRenderer
                            profile={overriddenShowcase}
                            isPreview
                          />
                        </motion.div>
                      </AnimatePresence>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center p-6 text-center text-sm text-stone-500 space-y-1.5">
                        <p className="font-medium text-stone-700">
                          Pratinjau belum diaktifkan Admin
                        </p>
                        <p className="text-xs text-stone-500">
                          Super Admin dapat memilih akun kreator melalui Panel Admin untuk ditampilkan di sini.
                        </p>
                      </div>
                    )}
                  </PhoneMockupFrame>

                  {/* Bottom Interactive Theme Tester & Profile Link */}
                  {activeShowcase && (
                    <div className="mt-5 bg-white/90 backdrop-blur-sm border border-stone-200/80 rounded-2xl p-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      {THEME_PRESETS.map((preset) => {
                        const isActive = activePresetId === preset.id;
                        const swatch =
                          PRESET_SWATCHES[preset.id] || '#F6F5F1';
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setPreviewPresetId(preset.id)}
                            className={`min-h-[34px] px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                              isActive
                                ? 'bg-[#141413] text-white border-[#141413]'
                                : 'bg-[#F6F5F1] text-stone-700 border-stone-200 hover:border-stone-300'
                            }`}
                          >
                            <span
                              className="w-3 h-3 rounded-full border border-black/15 shrink-0"
                              style={{ background: swatch }}
                              aria-hidden="true"
                            />
                            <span>{preset.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs text-stone-500 pt-2 border-t border-stone-100 px-1">
                        <span className="tabular-nums">
                          {activeShowcase.profileViews.toLocaleString('id-ID')}{' '}
                          kunjungan ·{' '}
                          {activeShowcase.links
                            .reduce((acc, l) => acc + l.clicks, 0)
                            .toLocaleString('id-ID')}{' '}
                          klik
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate(`/${activeShowcase.username}`)
                          }
                          className="font-semibold text-[#141413] hover:underline underline-offset-4 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <span>Buka /{activeShowcase.username}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Asymmetric Capabilities Bento Section */}
        <section
          id="fitur"
          className="border-t border-stone-200/80 bg-white py-16 lg:py-24"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
              <div className="max-w-2xl">
                <p className="text-xs font-medium text-stone-500 mb-2">
                  Arsitektur &amp; Kemampuan Studio
                </p>
                <h2
                  className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#141413]"
                  style={{ textWrap: 'balance' }}
                >
                  Semua alat untuk mengelola tautan, tampilan, dan konversi audiens.
                </h2>
              </div>
              <p className="text-sm text-stone-600 max-w-sm leading-relaxed">
                Tersimpan di PostgreSQL dengan pratinjau langsung di studio admin.
              </p>
            </div>

            {/* Asymmetric Bento Grid with Dynamic Surface Rhythm */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Marquee Card 1: Theme Studio & Rich Block Specimens */}
              <div
                id="tema"
                className="md:col-span-7 rounded-2xl bg-[#F6F5F1] border border-stone-200/90 p-6 sm:p-8 flex flex-col justify-between gap-6"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-stone-500">
                      01. Studio Tema &amp; Blok Konten
                    </span>
                    <Palette className="w-4 h-4 text-stone-500" />
                  </div>
                  <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#141413]">
                    Racik warna, tipografi, hingga konten tersemat secara real-time.
                  </h3>
                  <p className="text-sm text-stone-600 leading-relaxed max-w-xl">
                    Mulai dari preset Minimalist Light, Dark Mode, Gradient Sunset, atau Glassmorphism. Sesuaikan radius tombol (kotak, rounded, pill), jenis huruf Sans/Serif/Mono, jadwal tayang otomatis, kunci PIN, hingga embed YouTube &amp; Spotify.
                  </p>
                </div>

                {/* Rich Specimen Stack */}
                <div className="space-y-2.5 pt-1">
                  <div className="rounded-xl bg-[#141413] text-[#FAF9F6] px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-lg bg-[#D97757] text-white flex items-center justify-center shrink-0">
                        <ArrowUpRight className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">
                          Portofolio &amp; Katalog Produk Digital
                        </p>
                        <p className="text-[11px] text-stone-400 truncate">
                          Blok Sorotan · Efek kilau otomatis
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-stone-400 shrink-0">
                      Sorotan
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="rounded-xl bg-white px-3.5 py-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-[#F6F5F1] flex items-center justify-center text-[#141413] shrink-0">
                          <Play className="w-3.5 h-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">
                            Video / Musik Embed
                          </p>
                          <p className="text-[11px] text-stone-500 truncate">
                            YouTube &amp; Spotify
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-white px-3.5 py-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-[#F6F5F1] flex items-center justify-center text-[#141413] shrink-0">
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">
                            Tautan Kunci PIN
                          </p>
                          <p className="text-[11px] text-stone-500 truncate">
                            Akses eksklusif klien
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: High-Contrast Obsidian Analytics Card */}
              <div
                id="analitik"
                className="md:col-span-5 rounded-2xl bg-[#141413] text-[#FAF9F6] p-6 sm:p-8 flex flex-col justify-between gap-6"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-stone-400">
                      02. Analitik &amp; Drag-and-Drop
                    </span>
                    <BarChart3 className="w-4 h-4 text-[#D97757]" />
                  </div>
                  <h3 className="font-display text-xl font-bold tracking-tight">
                    Pantau klik harian, sumber trafik, dan ekspor ke CSV.
                  </h3>
                  <p className="text-sm text-stone-300 leading-relaxed">
                    Ubah urutan tautan dengan drag-and-drop, nonaktifkan tautan sementara, dan evaluasi tren 7–30 hari berdasarkan perangkat serta perujuk.
                  </p>
                </div>

                {/* High-Contrast Mini Bar Chart */}
                <div className="rounded-xl bg-stone-900/90 border border-stone-800 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-400">
                      Kunjungan vs Klik (7 Hari)
                    </span>
                    <span className="font-mono font-semibold text-[#D97757] tabular-nums">
                      CTR 68,4%
                    </span>
                  </div>
                  <div className="grid grid-cols-7 gap-2 items-end h-20 pt-2">
                    {MINI_CHART_BARS.map((bar) => (
                      <div
                        key={bar.label}
                        className="flex flex-col items-center gap-1 h-full justify-end"
                      >
                        <div className="w-full flex items-end justify-center gap-0.5 h-14">
                          <div
                            className="w-2 rounded-t bg-stone-700"
                            style={{ height: `${bar.views}%` }}
                          />
                          <div
                            className="w-2 rounded-t bg-[#D97757]"
                            style={{ height: `${bar.clicks}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-stone-500">
                          {bar.label}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-[11px] text-stone-400 tabular-nums">
                    <span>74% Mobile · 26% Desktop</span>
                    <span>Ekspor CSV</span>
                  </div>
                </div>
              </div>

              {/* Card 3: QR Code & Newsletter Capture */}
              <div className="md:col-span-5 rounded-2xl bg-[#F6F5F1] border border-stone-200/90 p-6 sm:p-8 flex flex-col justify-between gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-stone-500">
                      03. QR Code &amp; Daftar Email
                    </span>
                    <QrCode className="w-4 h-4 text-stone-500" />
                  </div>
                  <h3 className="font-display text-xl font-bold tracking-tight text-[#141413]">
                    Jembatani materi cetak &amp; bangun basis email sendiri.
                  </h3>
                  <p className="text-sm text-stone-600 leading-relaxed">
                    Hasilkan QR Code kustom (unduh PNG atau SVG resolusi tinggi) untuk kartu nama dan kemasan, serta kumpulkan email subscriber langsung di profil Anda.
                  </p>
                </div>

                {/* Crisp Miniature QR + Email Specimen */}
                <div className="space-y-2.5">
                  <div className="rounded-xl bg-white p-3.5 flex items-center gap-3.5">
                    <svg
                      viewBox="0 0 36 36"
                      className="w-11 h-11 shrink-0 text-[#141413]"
                      aria-hidden="true"
                    >
                      <rect
                        x="2"
                        y="2"
                        width="11"
                        height="11"
                        rx="2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      />
                      <rect x="5.5" y="5.5" width="4" height="4" fill="currentColor" />
                      <rect
                        x="23"
                        y="2"
                        width="11"
                        height="11"
                        rx="2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      />
                      <rect x="26.5" y="5.5" width="4" height="4" fill="currentColor" />
                      <rect
                        x="2"
                        y="23"
                        width="11"
                        height="11"
                        rx="2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      />
                      <rect x="5.5" y="26.5" width="4" height="4" fill="currentColor" />
                      <rect x="16" y="4" width="3" height="3" fill="currentColor" />
                      <rect x="16" y="10" width="3" height="3" fill="currentColor" />
                      <rect x="16" y="16" width="5" height="5" fill="#D97757" />
                      <rect x="4" y="16" width="4" height="3" fill="currentColor" />
                      <rect x="10" y="16" width="3" height="4" fill="currentColor" />
                      <rect x="24" y="16" width="4" height="4" fill="currentColor" />
                      <rect x="30" y="16" width="4" height="3" fill="currentColor" />
                      <rect x="17" y="25" width="4" height="4" fill="currentColor" />
                      <rect x="24" y="24" width="4" height="4" fill="currentColor" />
                      <rect x="29" y="29" width="5" height="5" fill="currentColor" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#141413]">
                        QR Code PNG &amp; SVG Siap Cetak
                      </p>
                      <p className="text-[11px] text-stone-500">
                        Kustomisasi warna latar &amp; modul
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white p-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 pl-1.5 min-w-0 text-xs text-stone-400">
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">nama@domain.com</span>
                    </div>
                    <span className="px-3 py-1.5 rounded-lg bg-[#D97757] text-white text-[11px] font-semibold shrink-0">
                      Gabung
                    </span>
                  </div>
                </div>
              </div>

              {/* Marquee Card 4: Dynamic SEO & Social Share Preview */}
              <div
                id="seo"
                className="md:col-span-7 rounded-2xl bg-[#F6F5F1] border border-stone-200/90 p-6 sm:p-8 flex flex-col justify-between gap-6"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-stone-500">
                      04. SEO Dinamis, Open Graph &amp; Sitemap
                    </span>
                    <Search className="w-4 h-4 text-stone-500" />
                  </div>
                  <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#141413]">
                    Tampil rapi saat dibagikan ke WhatsApp, X, dan mesin pencari.
                  </h3>
                  <p className="text-sm text-stone-600 leading-relaxed max-w-xl">
                    Setiap rute profil menyisipkan tag{' '}
                    <code className="text-xs font-mono bg-stone-200/70 px-1.5 py-0.5 rounded">
                      og:title
                    </code>
                    ,{' '}
                    <code className="text-xs font-mono bg-stone-200/70 px-1.5 py-0.5 rounded">
                      og:image
                    </code>
                    , Schema.org{' '}
                    <code className="text-xs font-mono bg-stone-200/70 px-1.5 py-0.5 rounded">
                      ProfilePage
                    </code>
                    , serta indeks otomatis di{' '}
                    <code className="text-xs font-mono bg-stone-200/70 px-1.5 py-0.5 rounded">
                      /sitemap.xml
                    </code>
                    .
                  </p>
                </div>

                {/* Rich Social Share Preview Card */}
                <div className="rounded-xl bg-white p-4 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-stone-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {!ogImgFailed ? (
                      <img
                        src={
                          activeShowcase?.avatarUrl ||
                          '/src/assets/images/avatar_creator_one_1795280504938.jpg'
                        }
                        alt={
                          activeShowcase?.displayName ||
                          'Pratinjau kartu Open Graph profil'
                        }
                        referrerPolicy="no-referrer"
                        onError={() => setOgImgFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Globe className="w-5 h-5 text-stone-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-stone-400 truncate">
                      <Globe className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        lokabio.id/{activeShowcase?.username || 'rakapratama'}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[#141413] truncate">
                      {activeShowcase?.seoTitle ||
                        'Raka Pratama — Desainer Produk & Kreator Digital'}
                    </p>
                    <p className="text-xs text-stone-500 line-clamp-1">
                      {activeShowcase?.seoDescription ||
                        'Portofolio desain, template sistem UI, catatan mingguan, dan konsultasi produk.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 3-Step Workflow Strip */}
            <div className="mt-14 pt-12 border-t border-stone-200/80 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-2">
                <p className="text-xs font-mono font-semibold text-[#D97757]">
                  01. Klaim &amp; Masuk
                </p>
                <h4 className="font-display text-base font-bold text-[#141413]">
                  Dapatkan alamat profil Anda
                </h4>
                <p className="text-sm text-stone-600 leading-relaxed">
                  Daftar cepat lewat Google atau email, cek ketersediaan username secara langsung, dan langsung masuk ke studio.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-mono font-semibold text-[#D97757]">
                  02. Susun &amp; Kustomisasi
                </p>
                <h4 className="font-display text-base font-bold text-[#141413]">
                  Atur tautan serta identitas visual
                </h4>
                <p className="text-sm text-stone-600 leading-relaxed">
                  Tambahkan tautan, media sosial, embed video/audio, lalu lihat hasilnya seketika di pratinjau ponsel sebelah kanan.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-mono font-semibold text-[#D97757]">
                  03. Bagikan &amp; Ukur
                </p>
                <h4 className="font-display text-base font-bold text-[#141413]">
                  Optimalkan performa tiap tautan
                </h4>
                <p className="text-sm text-stone-600 leading-relaxed">
                  Pasang tautan di Instagram, TikTok, atau unduh QR Code, lalu pantau kunjungan harian dan ekspor laporan kapan saja.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA Band */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 lg:py-20">
          <div className="relative overflow-hidden rounded-3xl bg-[#141413] text-[#FAF9F6] p-8 sm:p-12 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 w-80 h-80 rounded-full bg-[#D97757]/15 blur-3xl"
            />
            <div className="relative space-y-3 max-w-xl">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-stone-300">
                <Smartphone className="w-4 h-4 text-[#D97757]" />
                <span>Mobile-first dan siap dibagikan dalam hitungan detik</span>
              </div>
              <h2
                className="font-display text-2xl sm:text-3xl font-bold tracking-tight"
                style={{ textWrap: 'balance' }}
              >
                Klaim tautan profil pribadi Anda hari ini.
              </h2>
              <p className="text-sm text-stone-300 leading-relaxed">
                Buat akun gratis dengan Google atau email untuk mengatur tautan, tema kustom, QR Code, serta pratinjau SEO dari satu studio terpadu.
              </p>
            </div>
            <div className="relative flex flex-wrap items-center gap-3 shrink-0 w-full lg:w-auto">
              <button
                type="button"
                onClick={() => onNavigate(user ? '/dashboard' : '/register')}
                className="min-h-[48px] px-6 py-3 rounded-xl bg-[#D97757] text-white text-sm font-semibold hover:bg-[#c56647] active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 flex-1 sm:flex-initial"
              >
                <Layers className="w-4 h-4" />
                <span>{user ? 'Buka Studio Saya' : 'Daftar Gratis'}</span>
              </button>
              {activeShowcase && (
                <button
                  type="button"
                  onClick={() => onNavigate(`/${activeShowcase.username}`)}
                  className="min-h-[48px] px-5 py-3 rounded-xl bg-stone-800 text-[#FAF9F6] text-sm font-medium hover:bg-stone-700 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 flex-1 sm:flex-initial"
                >
                  <span>Lihat Contoh</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-stone-200/80 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <span>LokaBio · Platform BioLink &amp; Analitik Kreator</span>
          <div className="flex flex-wrap items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => onNavigate('/rakapratama')}
              className="hover:text-[#141413] transition-colors whitespace-nowrap"
            >
              /rakapratama
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/nadiaarchive')}
              className="hover:text-[#141413] transition-colors whitespace-nowrap"
            >
              /nadiaarchive
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="hover:text-[#141413] transition-colors whitespace-nowrap"
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/register')}
              className="hover:text-[#141413] transition-colors whitespace-nowrap"
            >
              Daftar
            </button>
            <a
              href="/sitemap.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#141413] transition-colors whitespace-nowrap"
            >
              sitemap.xml
            </a>
            <a
              href="/robots.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#141413] transition-colors whitespace-nowrap"
            >
              robots.txt
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
