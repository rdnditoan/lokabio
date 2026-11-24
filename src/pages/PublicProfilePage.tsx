import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ShieldAlert, Wrench } from 'lucide-react';
import { BioLinkRenderer } from '../components/BioLinkRenderer';
import { PublicProfileDTO } from '../shared/themes';

interface PublicProfilePageProps {
  username: string;
  onNavigate: (path: string) => void;
}

export function PublicProfilePage({
  username,
  onNavigate,
}: PublicProfilePageProps) {
  const [profile, setProfile] = useState<PublicProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [suspendedMsg, setSuspendedMsg] = useState<string | null>(null);
  const [maintenanceMsg, setMaintenanceMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trackedViewRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    setSuspendedMsg(null);
    setMaintenanceMsg(null);
    setError(null);

    fetch(`/api/public/profiles/${encodeURIComponent(username)}`)
      .then(async (res) => {
        if (res.status === 503) {
          const errData = await res.json().catch(() => null);
          if (active) {
            setMaintenanceMsg(
              errData?.error ||
                'Platform sedang dalam pemeliharaan terjadwal. Silakan kembali beberapa saat lagi.'
            );
          }
          return null;
        }
        if (res.status === 404) {
          if (active) setNotFound(true);
          return null;
        }
        if (res.status === 403) {
          const errData = await res.json().catch(() => null);
          if (active) {
            setSuspendedMsg(
              errData?.error ||
                'Halaman profil ini sedang dinonaktifkan sementara oleh administrator.'
            );
          }
          return null;
        }
        if (!res.ok) {
          throw new Error('Gagal memuat halaman profil.');
        }
        return res.json();
      })
      .then((data) => {
        if (!active || !data?.profile) return;
        const fetched: PublicProfileDTO = data.profile;
        setProfile(fetched);

        // Update browser SEO tags dynamically for SPA navigation
        const title =
          fetched.seoTitle?.trim() ||
          `${fetched.displayName} (@${fetched.username}) — LokaBio`;
        const desc =
          fetched.seoDescription?.trim() ||
          fetched.bio?.trim() ||
          `Tautan resmi dan media sosial dari ${fetched.displayName}.`;
        document.title = title;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', desc);

        // Record profile visit once per username view
        if (trackedViewRef.current !== fetched.username) {
          trackedViewRef.current = fetched.username;
          const utmSource = new URLSearchParams(window.location.search).get(
            'utm_source'
          );
          fetch(
            `/api/public/profiles/${encodeURIComponent(fetched.username)}/view`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                referrer: utmSource || document.referrer || '',
              }),
            }
          ).catch(() => {});
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : 'Gagal memuat profil.'
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] flex flex-col items-center px-4 py-14">
        <div className="w-full max-w-[540px] flex flex-col items-center animate-pulse">
          <div className="w-24 h-24 rounded-full bg-stone-200 mb-4" />
          <div className="h-6 w-44 rounded-lg bg-stone-200 mb-2" />
          <div className="h-4 w-28 rounded bg-stone-200 mb-6" />
          <div className="h-4 w-72 rounded bg-stone-200 mb-8" />
          <div className="w-full space-y-3">
            <div className="h-14 w-full rounded-2xl bg-stone-200" />
            <div className="h-14 w-full rounded-2xl bg-stone-200" />
            <div className="h-14 w-full rounded-2xl bg-stone-200" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] text-[#141413] flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-md w-full bg-white border border-stone-200 rounded-2xl p-8">
          <p className="text-sm font-medium text-stone-500 mb-2">404</p>
          <h1 className="font-display text-2xl font-bold tracking-tight mb-3">
            Halaman @{username} belum terdaftar
          </h1>
          <p className="text-sm text-stone-600 leading-relaxed mb-6">
            Username ini masih tersedia atau tautan yang Anda buka sudah berubah. Anda bisa mengklaim nama ini melalui studio LokaBio.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-stone-200 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Beranda</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/dashboard')}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#141413] text-white text-sm font-medium hover:bg-stone-800 transition-colors"
            >
              Klaim @{username}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (maintenanceMsg) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] text-[#141413] flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-md w-full bg-white border border-stone-200 rounded-2xl p-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <Wrench className="w-6 h-6" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight mb-2">
            Sedang Dalam Pemeliharaan
          </h1>
          <p className="text-sm text-stone-600 leading-relaxed mb-6">
            {maintenanceMsg}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-[#141413] text-white text-sm font-medium hover:bg-stone-800 transition-colors"
          >
            Coba Muat Ulang
          </button>
        </div>
      </div>
    );
  }

  if (suspendedMsg) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] text-[#141413] flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-md w-full bg-white border border-stone-200 rounded-2xl p-8">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight mb-2">
            Halaman Dinonaktifkan
          </h1>
          <p className="text-sm text-stone-600 leading-relaxed mb-6">
            {suspendedMsg}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-[#141413] text-white text-sm font-medium hover:bg-stone-800 transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Beranda</span>
          </button>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] text-[#141413] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-stone-200 rounded-2xl p-8 text-center">
          <h1 className="font-display text-xl font-semibold mb-2">
            Gagal Memuat Profil
          </h1>
          <p className="text-sm text-stone-600 mb-6">
            {error || 'Terjadi kendala saat mengambil data dari server.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-[#141413] text-white text-sm font-medium"
          >
            Muat Ulang
          </button>
        </div>
      </div>
    );
  }

  return (
    <BioLinkRenderer
      profile={profile}
      onNavigateHome={() => onNavigate('/')}
    />
  );
}
