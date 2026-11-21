import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  Contact,
  Flag,
  Image as ImageIcon,
  Lock,
  Mail,
  Megaphone,
  MessageCircle,
  QrCode,
  Search,
  Send,
  Share2,
  ShoppingBag,
  User as UserIcon,
  Wallet,
  X,
} from 'lucide-react';
import {
  appendUtmParams,
  buildWhatsAppHref,
  getButtonRadiusClass,
  getFontFamilyStyle,
  isLinkScheduledActive,
  parseMediaEmbed,
  PublicLinkDTO,
  PublicProfileDTO,
} from '../shared/themes';
import { LinkIcon, SocialIcon } from './IconMapper';
import { QrCodeCard } from './QrCodeCard';

interface BioLinkRendererProps {
  profile: PublicProfileDTO;
  isPreview?: boolean;
  onLinkClick?: (linkId: number) => void;
  onNavigateHome?: () => void;
}

export function BioLinkRenderer({
  profile,
  isPreview = false,
  onLinkClick,
  onNavigateHome,
}: BioLinkRendererProps) {
  const [avatarError, setAvatarError] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const [brokenThumbs, setBrokenThumbs] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrisOpen, setQrisOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Search & category filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');

  // PIN Lock modal state
  const [lockedTarget, setLockedTarget] = useState<PublicLinkDTO | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [unlockedUrl, setUnlockedUrl] = useState<string | null>(null);

  // Newsletter state
  const [subEmail, setSubEmail] = useState('');
  const [subState, setSubState] = useState<
    'idle' | 'submitting' | 'success' | 'already' | 'error'
  >('idle');
  const [subMessage, setSubMessage] = useState('');

  // Inquiry form state
  const [inqName, setInqName] = useState('');
  const [inqContact, setInqContact] = useState('');
  const [inqMessage, setInqMessage] = useState('');
  const [inqState, setInqState] = useState<
    'idle' | 'submitting' | 'success' | 'error'
  >('idle');
  const [inqFeedback, setInqFeedback] = useState('');

  // Report profile modal state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Penipuan / Phishing');
  const [reportDetails, setReportDetails] = useState('');
  const [reportEmail, setReportEmail] = useState('');
  const [reportState, setReportState] = useState<
    'idle' | 'submitting' | 'success' | 'error'
  >('idle');
  const [reportFeedback, setReportFeedback] = useState('');

  const isImageBg = profile.bgType === 'image' && Boolean(profile.bgImageUrl);
  const backgroundStyle =
    profile.bgType === 'gradient'
      ? { backgroundImage: profile.bgGradient }
      : isImageBg
      ? { backgroundColor: '#141413' }
      : { backgroundColor: profile.bgColor || '#F6F5F1' };

  const fontStyle = {
    fontFamily: getFontFamilyStyle(profile.fontFamily),
    color: profile.textColor || '#141413',
  };

  const buttonRadiusClass = getButtonRadiusClass(profile.buttonShape);
  const isGlass =
    profile.themePreset === 'glassmorphism' ||
    profile.buttonColor.startsWith('rgba(') ||
    isImageBg;

  const now = new Date();
  const visibleLinks = useMemo(
    () => profile.links.filter((l) => isLinkScheduledActive(l, now)),
    [profile.links]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const l of visibleLinks) {
      if (l.category?.trim()) set.add(l.category.trim());
    }
    return Array.from(set);
  }, [visibleLinks]);

  const showFilterBar =
    !isPreview && (visibleLinks.length > 5 || categories.length > 0);

  const filteredLinks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return visibleLinks.filter((l) => {
      if (
        selectedCategory !== 'Semua' &&
        (l.category || '').trim() !== selectedCategory
      ) {
        return false;
      }
      if (!q) return true;
      return (
        l.title.toLowerCase().includes(q) ||
        (l.subtitle || '').toLowerCase().includes(q) ||
        (l.category || '').toLowerCase().includes(q) ||
        (l.priceText || '').toLowerCase().includes(q)
      );
    });
  }, [visibleLinks, searchQuery, selectedCategory]);

  const activeSocials = (profile.socialLinks || []).filter(
    (s) => s.platform && s.url?.trim()
  );

  const firstClickableId = filteredLinks.find(
    (l) =>
      l.linkType !== 'header' &&
      l.linkType !== 'embed' &&
      l.linkType !== 'gallery'
  )?.id;

  const whatsappHref = profile.whatsappNumber
    ? buildWhatsAppHref(profile.whatsappNumber, profile.whatsappMessage)
    : '';

  const hasQuickActions =
    Boolean(whatsappHref) ||
    Boolean(profile.vcardEnabled) ||
    Boolean(profile.qrisEnabled && profile.qrisImageUrl);

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/${profile.username}`;
    try {
      if (navigator.share && !isPreview) {
        await navigator.share({
          title: profile.displayName,
          text: profile.bio || `Tautan resmi ${profile.displayName}`,
          url: shareUrl,
        });
        return;
      }
    } catch {
      // Fallback to clipboard copy if user cancels share sheet
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure in restricted iframes
    }
  };

  const handleDownloadVCard = () => {
    if (isPreview) return;
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${profile.displayName || profile.username}`,
      `NICKNAME:@${profile.username}`,
      profile.whatsappNumber ? `TEL;TYPE=CELL:${profile.whatsappNumber}` : '',
      profile.contactEmail ? `EMAIL;TYPE=INTERNET:${profile.contactEmail}` : '',
      `URL:${window.location.origin}/${profile.username}`,
      profile.bio ? `NOTE:${profile.bio.replace(/\r?\n/g, ' ')}` : '',
      'END:VCARD',
    ].filter(Boolean);
    const blob = new Blob([lines.join('\r\n')], {
      type: 'text/vcard;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${profile.username}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClickLink = (linkId: number) => {
    if (isPreview) return;
    if (onLinkClick) {
      onLinkClick(linkId);
    } else {
      fetch(`/api/public/links/${linkId}/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referrer:
            new URLSearchParams(window.location.search).get('utm_source') ||
            document.referrer ||
            '',
        }),
        keepalive: true,
      }).catch(() => {});
    }
  };

  const handleOpenPinModal = (link: PublicLinkDTO) => {
    setLockedTarget(link);
    setPinInput('');
    setPinError(null);
    setUnlockedUrl(null);
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockedTarget || !pinInput.trim()) return;

    if (isPreview) {
      if (
        lockedTarget.pinCode &&
        lockedTarget.pinCode.trim() !== pinInput.trim()
      ) {
        setPinError('Kode PIN salah.');
        return;
      }
      setUnlockedUrl(
        appendUtmParams(
          lockedTarget.url || 'https://example.com',
          profile.username,
          profile.utmEnabled
        )
      );
      return;
    }

    setPinSubmitting(true);
    setPinError(null);
    try {
      const res = await fetch(`/api/public/links/${lockedTarget.id}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: pinInput.trim(),
          referrer:
            new URLSearchParams(window.location.search).get('utm_source') ||
            document.referrer ||
            '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPinError(data.error || 'Kode PIN tidak sesuai.');
        return;
      }
      setUnlockedUrl(
        appendUtmParams(data.url, profile.username, profile.utmEnabled)
      );
    } catch {
      setPinError('Gagal memeriksa PIN. Coba lagi.');
    } finally {
      setPinSubmitting(false);
    }
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subEmail.trim()) return;
    if (isPreview) {
      setSubState('success');
      setSubMessage('Pratinjau: email Anda akan tersimpan ke daftar kreator.');
      setSubEmail('');
      return;
    }

    setSubState('submitting');
    setSubMessage('');
    try {
      const res = await fetch(`/api/public/profiles/${profile.username}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: subEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubState('error');
        setSubMessage(data.error || 'Gagal mendaftarkan email.');
        return;
      }
      if (data.alreadySubscribed) {
        setSubState('already');
        setSubMessage('Email ini sudah terdaftar sebelumnya.');
      } else {
        setSubState('success');
        setSubMessage('Terima kasih! Email Anda berhasil terdaftar.');
      }
      setSubEmail('');
    } catch {
      setSubState('error');
      setSubMessage('Terjadi kesalahan jaringan.');
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPreview) return;
    setReportState('submitting');
    setReportFeedback('');
    try {
      const res = await fetch(`/api/public/profiles/${profile.username}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reportReason,
          details: reportDetails.trim(),
          reporterEmail: reportEmail.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReportState('error');
        setReportFeedback(data.error || 'Gagal mengirim laporan.');
        return;
      }
      setReportState('success');
      setReportFeedback(
        'Laporan Anda telah dikirim ke Super Admin LokaBio untuk ditinjau.'
      );
      setReportDetails('');
      setReportEmail('');
    } catch {
      setReportState('error');
      setReportFeedback('Terjadi kesalahan jaringan.');
    }
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inqName.trim() || !inqContact.trim() || !inqMessage.trim()) return;
    if (isPreview) {
      setInqState('success');
      setInqFeedback('Pratinjau: pesan kerja sama akan masuk ke Studio Admin.');
      setInqName('');
      setInqContact('');
      setInqMessage('');
      return;
    }

    setInqState('submitting');
    setInqFeedback('');
    try {
      const res = await fetch(`/api/public/profiles/${profile.username}/inquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: inqName.trim(),
          senderContact: inqContact.trim(),
          message: inqMessage.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInqState('error');
        setInqFeedback(data.error || 'Gagal mengirim pesan.');
        return;
      }
      setInqState('success');
      setInqFeedback('Pesan berhasil terkirim! Pemilik profil akan segera merespons.');
      setInqName('');
      setInqContact('');
      setInqMessage('');
    } catch {
      setInqState('error');
      setInqFeedback('Terjadi kesalahan jaringan saat mengirim pesan.');
    }
  };

  const renderSocialRow = (staggerDelay: number) => {
    if (activeSocials.length === 0) return null;
    return (
      <motion.div
        initial={isPreview ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.24,
          delay: isPreview ? 0 : staggerDelay,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="flex flex-wrap items-center justify-center gap-2.5"
        aria-label="Tautan media sosial"
      >
        {activeSocials.map((social, idx) => (
          <motion.a
            key={`${social.platform}-${idx}`}
            href={
              isPreview
                ? undefined
                : appendUtmParams(
                    social.url,
                    profile.username,
                    profile.utmEnabled
                  )
            }
            target={isPreview ? undefined : '_blank'}
            rel={isPreview ? undefined : 'noopener noreferrer'}
            onClick={(e) => {
              if (isPreview) e.preventDefault();
            }}
            whileHover={{ y: -2, scale: 1.07 }}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            title={social.platform}
            aria-label={social.platform}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/50"
            style={{
              backgroundColor: isGlass
                ? 'rgba(255,255,255,0.16)'
                : 'rgba(128,128,128,0.12)',
              color: profile.textColor,
              backdropFilter: isGlass ? 'blur(12px)' : undefined,
            }}
          >
            <SocialIcon platform={social.platform} className="w-5 h-5" />
          </motion.a>
        ))}
      </motion.div>
    );
  };

  const cardSurfaceRadius =
    profile.buttonShape === 'square' ? 'rounded-none' : 'rounded-2xl';

  return (
    <div
      className={
        isPreview
          ? 'relative w-full min-h-full px-4 pt-11 pb-8 flex flex-col justify-between overflow-hidden transition-[background-color,color] duration-300'
          : 'relative min-h-screen w-full px-4 py-8 sm:py-12 flex flex-col items-center justify-between overflow-x-hidden transition-[background-color,color] duration-300'
      }
      style={{ ...backgroundStyle, ...fontStyle }}
    >
      {/* Optional Background Image Layer with Blur & Scrim */}
      {isImageBg && profile.bgImageUrl && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        >
          <img
            src={profile.bgImageUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover scale-105"
            style={{
              filter:
                (profile.bgBlur || 0) > 0
                  ? `blur(${profile.bgBlur}px)`
                  : undefined,
            }}
          />
          <div
            className="absolute inset-0 bg-black"
            style={{
              opacity: Math.max(0, Math.min(85, profile.bgOverlayOpacity ?? 40)) / 100,
            }}
          />
        </div>
      )}

      <div
        className={
          isPreview
            ? 'relative z-10 w-full flex flex-col items-center'
            : 'relative z-10 w-full max-w-[540px] mx-auto flex flex-col items-center'
        }
      >
        {/* Top Utility Share & QR Row */}
        {!isPreview && (
          <div className="w-full flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={onNavigateHome}
              className="text-xs font-medium opacity-75 hover:opacity-100 transition-opacity py-2 px-1 whitespace-nowrap"
            >
              LokaBio
            </button>
            <div className="flex items-center gap-2">
              <motion.button
                type="button"
                onClick={() => setQrOpen(true)}
                whileTap={{ scale: 0.95 }}
                className="min-h-[40px] min-w-[40px] px-3 py-2 rounded-full flex items-center justify-center gap-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: isGlass
                    ? 'rgba(255,255,255,0.16)'
                    : 'rgba(128,128,128,0.12)',
                  color: profile.textColor,
                  backdropFilter: isGlass ? 'blur(12px)' : undefined,
                }}
                aria-label="Tampilkan QR Code"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>QR</span>
              </motion.button>
              <motion.button
                type="button"
                onClick={handleShare}
                whileTap={{ scale: 0.95 }}
                className="min-h-[40px] px-3.5 py-2 rounded-full flex items-center gap-2 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: isGlass
                    ? 'rgba(255,255,255,0.16)'
                    : 'rgba(128,128,128,0.12)',
                  color: profile.textColor,
                  backdropFilter: isGlass ? 'blur(12px)' : undefined,
                }}
                aria-label="Bagikan profil"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {copied ? (
                    <motion.span
                      key="copied"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ duration: 0.14 }}
                      className="inline-flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Tautan Disalin</span>
                    </motion.span>
                  ) : (
                    <motion.span
                      key="share"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ duration: 0.14 }}
                      className="inline-flex items-center gap-1.5"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Bagikan</span>
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </div>
        )}

        {/* Announcement Bar */}
        {profile.announcementEnabled && profile.announcementText?.trim() && (
          <div className="w-full mb-4">
            {profile.announcementUrl?.trim() && !isPreview ? (
              <a
                href={appendUtmParams(
                  profile.announcementUrl,
                  profile.username,
                  profile.utmEnabled
                )}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full px-3.5 py-2.5 ${cardSurfaceRadius} border border-current/15 flex items-center justify-center gap-2 text-xs font-medium hover:opacity-90 transition-opacity`}
                style={{
                  backgroundColor: isGlass
                    ? 'rgba(255,255,255,0.14)'
                    : 'rgba(128,128,128,0.1)',
                  backdropFilter: isGlass ? 'blur(12px)' : undefined,
                }}
              >
                <Megaphone className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{profile.announcementText}</span>
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0 opacity-75" />
              </a>
            ) : (
              <div
                className={`w-full px-3.5 py-2.5 ${cardSurfaceRadius} border border-current/15 flex items-center justify-center gap-2 text-xs font-medium`}
                style={{
                  backgroundColor: isGlass
                    ? 'rgba(255,255,255,0.14)'
                    : 'rgba(128,128,128,0.1)',
                  backdropFilter: isGlass ? 'blur(12px)' : undefined,
                }}
              >
                <Megaphone className="w-3.5 h-3.5 shrink-0" />
                <span className="text-center">{profile.announcementText}</span>
              </div>
            )}
          </div>
        )}

        {/* Optional Cover Banner */}
        {profile.coverUrl && !coverError && (
          <div
            className={`w-full ${
              isPreview ? 'h-24' : 'h-32 sm:h-40'
            } ${cardSurfaceRadius} overflow-hidden border border-current/10 mb-[-42px] sm:mb-[-48px] bg-black/10`}
          >
            <img
              src={profile.coverUrl}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setCoverError(true)}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Avatar */}
        <motion.div
          initial={isPreview ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-4 z-10"
        >
          <div
            className={`${
              isPreview ? 'w-20 h-20' : 'w-24 h-24 sm:w-28 sm:h-28'
            } rounded-full overflow-hidden ring-4 ring-white/25 shadow-sm flex items-center justify-center bg-black/10`}
          >
            {profile.avatarUrl && !avatarError ? (
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-black/10">
                <UserIcon className="w-9 h-9 opacity-60" />
              </div>
            )}
          </div>
        </motion.div>

        {/* Display Name, Verified Badge & Bio */}
        <motion.div
          initial={isPreview ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.24,
            delay: isPreview ? 0 : 0.04,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="flex flex-col items-center"
        >
          <div className="flex items-center justify-center gap-1.5 text-center px-2">
            <h1
              className={`${
                isPreview ? 'text-lg' : 'text-xl sm:text-2xl'
              } font-bold tracking-tight`}
            >
              {profile.displayName || `@${profile.username}`}
            </h1>
            {profile.isVerified && (
              <BadgeCheck
                className="w-5 h-5 shrink-0 text-sky-500 fill-sky-500/15"
                aria-label="Profil terverifikasi"
              />
            )}
          </div>

          <p className="text-xs opacity-65 mt-0.5 font-medium">
            @{profile.username}
          </p>

          {profile.bio && (
            <p
              className={`${
                isPreview ? 'text-xs' : 'text-sm sm:text-[15px]'
              } text-center opacity-85 leading-relaxed max-w-md mt-3 px-2`}
            >
              {profile.bio}
            </p>
          )}
        </motion.div>

        {/* Quick Contact Action Row (WhatsApp / vCard / QRIS) */}
        {hasQuickActions && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {whatsappHref && (
              <a
                href={isPreview ? undefined : whatsappHref}
                target={isPreview ? undefined : '_blank'}
                rel={isPreview ? undefined : 'noopener noreferrer'}
                onClick={(e) => {
                  if (isPreview) e.preventDefault();
                }}
                className={`min-h-[38px] px-3.5 py-1.5 ${
                  profile.buttonShape === 'square'
                    ? 'rounded-none'
                    : 'rounded-full'
                } text-xs font-semibold inline-flex items-center gap-1.5 border border-current/15 transition-opacity hover:opacity-85`}
                style={{
                  backgroundColor: isGlass
                    ? 'rgba(255,255,255,0.16)'
                    : 'rgba(128,128,128,0.12)',
                }}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
            )}
            {profile.vcardEnabled && (
              <button
                type="button"
                onClick={handleDownloadVCard}
                className={`min-h-[38px] px-3.5 py-1.5 ${
                  profile.buttonShape === 'square'
                    ? 'rounded-none'
                    : 'rounded-full'
                } text-xs font-semibold inline-flex items-center gap-1.5 border border-current/15 transition-opacity hover:opacity-85`}
                style={{
                  backgroundColor: isGlass
                    ? 'rgba(255,255,255,0.16)'
                    : 'rgba(128,128,128,0.12)',
                }}
              >
                <Contact className="w-3.5 h-3.5" />
                <span>Simpan Kontak</span>
              </button>
            )}
            {profile.qrisEnabled && profile.qrisImageUrl && (
              <button
                type="button"
                onClick={() => setQrisOpen(true)}
                className={`min-h-[38px] px-3.5 py-1.5 ${
                  profile.buttonShape === 'square'
                    ? 'rounded-none'
                    : 'rounded-full'
                } text-xs font-semibold inline-flex items-center gap-1.5 border border-current/15 transition-opacity hover:opacity-85`}
                style={{
                  backgroundColor: isGlass
                    ? 'rgba(255,255,255,0.16)'
                    : 'rgba(128,128,128,0.12)',
                }}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>QRIS</span>
              </button>
            )}
          </div>
        )}

        {/* Social Links (Top position) */}
        {profile.socialPosition !== 'bottom' && activeSocials.length > 0 && (
          <div className="mt-5">{renderSocialRow(0.08)}</div>
        )}

        {/* Search & Category Filter Bar */}
        {showFilterBar && (
          <div className="w-full mt-5 space-y-2.5">
            {visibleLinks.length > 5 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 opacity-55 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari tautan atau produk..."
                  className={`w-full min-h-[40px] pl-9 pr-3.5 text-xs border border-current/15 focus:outline-none ${
                    profile.buttonShape === 'square'
                      ? 'rounded-none'
                      : 'rounded-xl'
                  }`}
                  style={{
                    backgroundColor: isGlass
                      ? 'rgba(255,255,255,0.14)'
                      : 'rgba(128,128,128,0.08)',
                    color: profile.textColor,
                  }}
                />
              </div>
            )}

            {categories.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {['Semua', ...categories].map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 text-xs font-medium transition-all ${
                        profile.buttonShape === 'square'
                          ? 'rounded-none'
                          : 'rounded-lg'
                      }`}
                      style={
                        active
                          ? {
                              backgroundColor: profile.buttonColor || '#141413',
                              color: profile.buttonTextColor || '#FFFFFF',
                            }
                          : {
                              backgroundColor: isGlass
                                ? 'rgba(255,255,255,0.12)'
                                : 'rgba(128,128,128,0.1)',
                              color: profile.textColor,
                            }
                      }
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Links Stack */}
        <div className="w-full mt-6 flex flex-col gap-3">
          {filteredLinks.length === 0 ? (
            <div
              className={`w-full px-5 py-6 text-center text-xs opacity-70 border border-current/15 ${buttonRadiusClass}`}
            >
              {visibleLinks.length === 0
                ? 'Belum ada tautan aktif untuk ditampilkan.'
                : 'Tidak ada tautan yang sesuai dengan pencarian Anda.'}
            </div>
          ) : (
            filteredLinks.map((link, index) => {
              const isLocked = Boolean(
                link.isLocked || (link.pinCode && link.pinCode.trim().length > 0)
              );
              const hasThumb = Boolean(
                link.thumbnailUrl && !brokenThumbs[link.id]
              );
              const thumbRadius =
                profile.buttonShape === 'square'
                  ? 'rounded-none'
                  : profile.buttonShape === 'pill'
                  ? 'rounded-full'
                  : 'rounded-xl';
              const isSpotlight = link.id === firstClickableId;
              const targetHref =
                isPreview || isLocked
                  ? undefined
                  : appendUtmParams(
                      link.url,
                      profile.username,
                      profile.utmEnabled
                    );

              // 1. Section Header Divider
              if (link.linkType === 'header') {
                return (
                  <motion.div
                    key={link.id}
                    initial={isPreview ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.2,
                      delay: isPreview ? 0 : Math.min(0.1 + index * 0.04, 0.32),
                    }}
                    className="pt-3 pb-1 flex items-center gap-3"
                  >
                    <span className="h-px flex-1 bg-current opacity-15" />
                    <span className="text-xs font-semibold tracking-wide opacity-75 text-center">
                      {link.title}
                    </span>
                    <span className="h-px flex-1 bg-current opacity-15" />
                  </motion.div>
                );
              }

              // 2. Photo Gallery Grid
              if (link.linkType === 'gallery') {
                const imgs = Array.isArray(link.galleryUrls)
                  ? link.galleryUrls.filter(Boolean)
                  : [];
                if (imgs.length === 0) return null;
                return (
                  <motion.div
                    key={link.id}
                    initial={isPreview ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.24,
                      delay: isPreview ? 0 : Math.min(0.12 + index * 0.04, 0.36),
                    }}
                    className={`w-full p-3.5 ${cardSurfaceRadius} border border-current/15`}
                    style={{
                      backgroundColor: isGlass
                        ? 'rgba(255,255,255,0.12)'
                        : 'rgba(128,128,128,0.08)',
                      backdropFilter: isGlass ? 'blur(12px)' : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="text-xs font-semibold flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 opacity-75" />
                        <span>{link.title}</span>
                      </span>
                      {link.subtitle && (
                        <span className="text-[11px] opacity-65 truncate">
                          {link.subtitle}
                        </span>
                      )}
                    </div>
                    <div
                      className={`grid gap-2 ${
                        imgs.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
                      }`}
                    >
                      {imgs.map((imgUrl, idx) => (
                        <button
                          key={`${link.id}-img-${idx}`}
                          type="button"
                          onClick={() => setLightboxImage(imgUrl)}
                          className="aspect-square rounded-xl overflow-hidden bg-black/10 group focus:outline-none"
                        >
                          <img
                            src={imgUrl}
                            alt={`${link.title} ${idx + 1}`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </button>
                      ))}
                    </div>
                  </motion.div>
                );
              }

              // 3. Embed Media (YouTube / Spotify)
              if (link.linkType === 'embed') {
                const parsed = parseMediaEmbed(link.url);
                if (parsed) {
                  return (
                    <motion.div
                      key={link.id}
                      initial={isPreview ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.24,
                        delay: isPreview
                          ? 0
                          : Math.min(0.12 + index * 0.04, 0.36),
                      }}
                      className={`w-full overflow-hidden ${cardSurfaceRadius} border border-current/15 shadow-sm`}
                      style={{
                        backgroundColor: profile.buttonColor || '#141413',
                        color: profile.buttonTextColor || '#FFFFFF',
                      }}
                    >
                      <div className="px-4 py-2.5 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold truncate">
                          {link.title}
                        </span>
                        <span className="text-[11px] opacity-70 capitalize">
                          {parsed.provider}
                        </span>
                      </div>
                      <div
                        className={
                          parsed.provider === 'youtube'
                            ? 'aspect-video w-full bg-black'
                            : 'w-full h-[152px] bg-black/10'
                        }
                      >
                        <iframe
                          src={parsed.embedUrl}
                          title={link.title}
                          loading="lazy"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="w-full h-full border-0"
                        />
                      </div>
                    </motion.div>
                  );
                }
              }

              // 4. Product Showcase Card
              if (link.linkType === 'product') {
                return (
                  <motion.a
                    key={link.id}
                    href={targetHref}
                    target={isPreview || isLocked ? undefined : '_blank'}
                    rel={isPreview || isLocked ? undefined : 'noopener noreferrer'}
                    onClick={(e) => {
                      if (isLocked) {
                        e.preventDefault();
                        handleOpenPinModal(link);
                        return;
                      }
                      if (isPreview) {
                        e.preventDefault();
                        return;
                      }
                      handleClickLink(link.id);
                    }}
                    initial={isPreview ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.24,
                      delay: isPreview ? 0 : Math.min(0.12 + index * 0.04, 0.36),
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    className={`group relative overflow-hidden w-full p-3 flex items-center gap-3.5 cursor-pointer transition-shadow duration-200 ${cardSurfaceRadius} ${
                      isGlass
                        ? 'backdrop-blur-md border border-white/25 shadow-sm'
                        : 'shadow-sm hover:shadow-md'
                    }`}
                    style={{
                      backgroundColor: profile.buttonColor || '#141413',
                      color: profile.buttonTextColor || '#FFFFFF',
                    }}
                  >
                    <div
                      className={`shrink-0 ${
                        isPreview ? 'w-14 h-14' : 'w-16 h-16'
                      } rounded-xl overflow-hidden flex items-center justify-center bg-black/15`}
                    >
                      {hasThumb ? (
                        <img
                          src={link.thumbnailUrl}
                          alt={link.title}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setBrokenThumbs((prev) => ({
                              ...prev,
                              [link.id]: true,
                            }))
                          }
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <ShoppingBag className="w-6 h-6 opacity-80" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 text-left space-y-0.5">
                      {(link.badgeText || link.category) && (
                        <p className="text-[11px] font-medium opacity-75 truncate">
                          {[link.badgeText, link.category]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                      <p
                        className={`${
                          isPreview ? 'text-xs' : 'text-sm sm:text-[15px]'
                        } font-semibold leading-snug line-clamp-2`}
                      >
                        {link.title}
                      </p>
                      <div className="flex items-center gap-2 pt-0.5">
                        {link.priceText && (
                          <span className="text-xs sm:text-sm font-bold tabular-nums">
                            {link.priceText}
                          </span>
                        )}
                        {link.subtitle && (
                          <span className="text-[11px] opacity-70 truncate">
                            {link.subtitle}
                          </span>
                        )}
                      </div>
                    </div>

                    <ArrowUpRight className="w-4 h-4 shrink-0 opacity-75 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </motion.a>
                );
              }

              // 5. Featured Banner Card
              if (link.linkType === 'featured') {
                return (
                  <motion.a
                    key={link.id}
                    href={targetHref}
                    target={isPreview || isLocked ? undefined : '_blank'}
                    rel={isPreview || isLocked ? undefined : 'noopener noreferrer'}
                    onClick={(e) => {
                      if (isLocked) {
                        e.preventDefault();
                        handleOpenPinModal(link);
                        return;
                      }
                      if (isPreview) {
                        e.preventDefault();
                        return;
                      }
                      handleClickLink(link.id);
                    }}
                    initial={isPreview ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.24,
                      delay: isPreview ? 0 : Math.min(0.12 + index * 0.04, 0.36),
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    className={`group relative overflow-hidden w-full flex flex-col cursor-pointer transition-shadow duration-200 ${cardSurfaceRadius} ${
                      isGlass
                        ? 'backdrop-blur-md border border-white/25 shadow-sm'
                        : 'shadow-sm hover:shadow-md'
                    }`}
                    style={{
                      backgroundColor: profile.buttonColor || '#141413',
                      color: profile.buttonTextColor || '#FFFFFF',
                    }}
                  >
                    {isSpotlight && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-link-sheen z-10"
                      />
                    )}
                    {hasThumb && (
                      <div className="w-full aspect-[16/9] overflow-hidden bg-black/15">
                        <img
                          src={link.thumbnailUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setBrokenThumbs((prev) => ({
                              ...prev,
                              [link.id]: true,
                            }))
                          }
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                    )}
                    <div className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0 text-left">
                        <div className="flex items-center gap-1.5">
                          {isLocked && (
                            <Lock className="w-3.5 h-3.5 shrink-0 opacity-80" />
                          )}
                          <p
                            className={`${
                              isPreview ? 'text-xs' : 'text-sm sm:text-[15px]'
                            } font-semibold leading-snug`}
                          >
                            {link.title}
                          </p>
                        </div>
                        {link.subtitle && (
                          <p
                            className={`${
                              isPreview ? 'text-[11px]' : 'text-xs'
                            } opacity-75 mt-1 line-clamp-2 leading-relaxed`}
                          >
                            {link.subtitle}
                          </p>
                        )}
                      </div>
                      <ArrowUpRight className="w-4 h-4 shrink-0 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </motion.a>
                );
              }

              // 6. Standard Link Button
              return (
                <motion.a
                  key={link.id}
                  href={targetHref}
                  target={isPreview || isLocked ? undefined : '_blank'}
                  rel={isPreview || isLocked ? undefined : 'noopener noreferrer'}
                  onClick={(e) => {
                    if (isLocked) {
                      e.preventDefault();
                      handleOpenPinModal(link);
                      return;
                    }
                    if (isPreview) {
                      e.preventDefault();
                      return;
                    }
                    handleClickLink(link.id);
                  }}
                  initial={isPreview ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.24,
                    delay: isPreview ? 0 : Math.min(0.12 + index * 0.04, 0.36),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.985 }}
                  className={`group relative overflow-hidden cursor-pointer w-full min-h-[56px] p-2.5 pr-4 flex items-center gap-3.5 transition-[box-shadow,background-color,color,border-radius] duration-200 ${buttonRadiusClass} ${
                    isGlass
                      ? 'backdrop-blur-md border border-white/25 shadow-sm'
                      : 'shadow-sm hover:shadow-md'
                  }`}
                  style={{
                    backgroundColor: profile.buttonColor || '#141413',
                    color: profile.buttonTextColor || '#FFFFFF',
                  }}
                >
                  {isSpotlight && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-link-sheen"
                    />
                  )}

                  {/* Left Thumbnail or Lucide Icon */}
                  <div
                    className={`shrink-0 ${
                      isPreview ? 'w-10 h-10' : 'w-11 h-11'
                    } ${thumbRadius} overflow-hidden flex items-center justify-center bg-black/10`}
                  >
                    {hasThumb ? (
                      <img
                        src={link.thumbnailUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBrokenThumbs((prev) => ({
                            ...prev,
                            [link.id]: true,
                          }))
                        }
                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : isLocked ? (
                      <Lock className={isPreview ? 'w-4 h-4' : 'w-5 h-5'} />
                    ) : (
                      <LinkIcon
                        name={link.icon}
                        className={`${
                          isPreview ? 'w-4 h-4' : 'w-5 h-5'
                        } transition-transform duration-200 group-hover:scale-110`}
                      />
                    )}
                  </div>

                  {/* Link Title */}
                  <span
                    className={`flex-1 text-left ${
                      isPreview ? 'text-xs' : 'text-sm sm:text-[15px]'
                    } font-semibold leading-snug line-clamp-2`}
                  >
                    {link.title}
                  </span>

                  {/* Subtle External Arrow or Lock */}
                  {isLocked ? (
                    <Lock
                      className="w-4 h-4 shrink-0 opacity-70"
                      aria-label="Dilindungi PIN"
                    />
                  ) : (
                    <ArrowUpRight
                      className="w-4 h-4 shrink-0 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-150"
                      aria-hidden="true"
                    />
                  )}
                </motion.a>
              );
            })
          )}
        </div>

        {/* Newsletter / Lead Capture Block */}
        {profile.newsletterEnabled && (
          <motion.form
            onSubmit={handleSubscribe}
            initial={isPreview ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: isPreview ? 0 : 0.22 }}
            className={`w-full mt-6 p-4 sm:p-5 ${cardSurfaceRadius} border border-current/15`}
            style={{
              backgroundColor: isGlass
                ? 'rgba(255,255,255,0.12)'
                : 'rgba(128,128,128,0.08)',
              backdropFilter: isGlass ? 'blur(12px)' : undefined,
            }}
          >
            <div className="flex items-center gap-2 mb-2.5">
              <Mail className="w-4 h-4 opacity-80 shrink-0" />
              <p
                className={`${
                  isPreview ? 'text-xs' : 'text-sm'
                } font-semibold`}
              >
                {profile.newsletterHeading || 'Dapatkan Catatan & Karya Terbaru'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                value={subEmail}
                onChange={(e) => setSubEmail(e.target.value)}
                placeholder={
                  profile.newsletterPlaceholder || 'Masukkan alamat email Anda...'
                }
                className={`flex-1 min-h-[42px] px-3.5 text-xs sm:text-sm bg-white/90 text-[#141413] placeholder:text-stone-400 border border-black/10 focus:outline-none ${
                  profile.buttonShape === 'square'
                    ? 'rounded-none'
                    : 'rounded-xl'
                }`}
              />
              <button
                type="submit"
                disabled={subState === 'submitting'}
                className={`min-h-[42px] px-4 text-xs sm:text-sm font-semibold whitespace-nowrap transition-opacity disabled:opacity-60 ${
                  profile.buttonShape === 'square'
                    ? 'rounded-none'
                    : profile.buttonShape === 'pill'
                    ? 'rounded-full'
                    : 'rounded-xl'
                }`}
                style={{
                  backgroundColor: profile.buttonColor || '#141413',
                  color: profile.buttonTextColor || '#FFFFFF',
                }}
              >
                {subState === 'submitting' ? 'Mengirim...' : 'Gabung'}
              </button>
            </div>
            {subMessage && (
              <p className="text-xs mt-2 opacity-90 font-medium">{subMessage}</p>
            )}
          </motion.form>
        )}

        {/* Visitor Inquiry / Collaboration Form */}
        {profile.inquiryEnabled && (
          <motion.form
            onSubmit={handleInquirySubmit}
            initial={isPreview ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: isPreview ? 0 : 0.25 }}
            className={`w-full mt-4 p-4 sm:p-5 ${cardSurfaceRadius} border border-current/15 space-y-2.5`}
            style={{
              backgroundColor: isGlass
                ? 'rgba(255,255,255,0.12)'
                : 'rgba(128,128,128,0.08)',
              backdropFilter: isGlass ? 'blur(12px)' : undefined,
            }}
          >
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 opacity-80 shrink-0" />
              <p
                className={`${
                  isPreview ? 'text-xs' : 'text-sm'
                } font-semibold`}
              >
                {profile.inquiryHeading || 'Kirim Pesan / Kerja Sama'}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                required
                value={inqName}
                onChange={(e) => setInqName(e.target.value)}
                placeholder="Nama Anda"
                className={`min-h-[40px] px-3 text-xs bg-white/90 text-[#141413] placeholder:text-stone-400 border border-black/10 focus:outline-none ${
                  profile.buttonShape === 'square'
                    ? 'rounded-none'
                    : 'rounded-xl'
                }`}
              />
              <input
                type="text"
                required
                value={inqContact}
                onChange={(e) => setInqContact(e.target.value)}
                placeholder="Email atau No. WhatsApp"
                className={`min-h-[40px] px-3 text-xs bg-white/90 text-[#141413] placeholder:text-stone-400 border border-black/10 focus:outline-none ${
                  profile.buttonShape === 'square'
                    ? 'rounded-none'
                    : 'rounded-xl'
                }`}
              />
            </div>
            <textarea
              rows={2}
              required
              value={inqMessage}
              onChange={(e) => setInqMessage(e.target.value)}
              placeholder="Tulis pertanyaan, penawaran kerja sama, atau detail pesanan..."
              className={`w-full p-3 text-xs bg-white/90 text-[#141413] placeholder:text-stone-400 border border-black/10 focus:outline-none resize-none ${
                profile.buttonShape === 'square'
                  ? 'rounded-none'
                  : 'rounded-xl'
              }`}
            />
            <button
              type="submit"
              disabled={inqState === 'submitting'}
              className={`w-full min-h-[42px] px-4 text-xs sm:text-sm font-semibold transition-opacity disabled:opacity-60 ${
                profile.buttonShape === 'square'
                  ? 'rounded-none'
                  : profile.buttonShape === 'pill'
                  ? 'rounded-full'
                  : 'rounded-xl'
              }`}
              style={{
                backgroundColor: profile.buttonColor || '#141413',
                color: profile.buttonTextColor || '#FFFFFF',
              }}
            >
              {inqState === 'submitting' ? 'Mengirim Pesan...' : 'Kirim Pesan'}
            </button>
            {inqFeedback && (
              <p className="text-xs opacity-90 font-medium">{inqFeedback}</p>
            )}
          </motion.form>
        )}

        {/* Social Links (Bottom position) */}
        {profile.socialPosition === 'bottom' && activeSocials.length > 0 && (
          <div className="mt-7">{renderSocialRow(0.2)}</div>
        )}
      </div>

      {/* Quiet Footer */}
      <footer className="relative z-10 mt-10 pt-4 text-center">
        {isPreview ? (
          <span className="text-[11px] font-medium opacity-55">
            lokabio.id/{profile.username}
          </span>
        ) : (
          <div className="inline-flex items-center justify-center gap-3 text-xs font-medium opacity-65">
            <button
              type="button"
              onClick={onNavigateHome}
              className="hover:opacity-100 transition-opacity py-2 px-2"
            >
              Dibuat dengan LokaBio
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => {
                setReportState('idle');
                setReportFeedback('');
                setReportOpen(true);
              }}
              className="hover:opacity-100 transition-opacity py-2 px-2 inline-flex items-center gap-1"
            >
              <Flag className="w-3 h-3" />
              <span>Laporkan</span>
            </button>
          </div>
        )}
      </footer>

      {/* PIN Access Modal */}
      <AnimatePresence>
        {lockedTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="w-full max-w-sm bg-white text-[#141413] rounded-2xl p-6 shadow-2xl border border-stone-200"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center">
                    <Lock className="w-4 h-4 text-[#141413]" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold">
                      Tautan Terkunci
                    </h3>
                    <p className="text-xs text-stone-500 line-clamp-1">
                      {lockedTarget.title}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLockedTarget(null)}
                  className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
                  aria-label="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {unlockedUrl ? (
                <div className="space-y-4">
                  <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    Kode PIN valid. Silakan buka tautan di bawah ini.
                  </p>
                  <a
                    href={unlockedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setLockedTarget(null)}
                    className="w-full min-h-[44px] px-4 rounded-xl bg-[#141413] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-stone-800"
                  >
                    <span>Buka Tautan Sekarang</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                </div>
              ) : (
                <form onSubmit={handleVerifyPin} className="space-y-3">
                  <label className="block text-xs font-medium text-stone-600">
                    Masukkan kode akses PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoFocus
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="Contoh: 2026"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-stone-200 text-sm font-mono tracking-widest focus:outline-none focus:border-[#141413]"
                  />
                  {pinError && (
                    <p className="text-xs text-red-600">{pinError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={pinSubmitting || !pinInput.trim()}
                    className="w-full min-h-[44px] px-4 rounded-xl bg-[#141413] text-white text-sm font-semibold hover:bg-stone-800 disabled:opacity-50"
                  >
                    {pinSubmitting ? 'Memeriksa...' : 'Buka Akses'}
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Code Modal */}
      <AnimatePresence>
        {qrOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="w-full max-w-xs bg-white text-[#141413] rounded-2xl p-6 shadow-2xl border border-stone-200 text-center"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-display text-sm font-bold">
                  QR Code @{profile.username}
                </span>
                <button
                  type="button"
                  onClick={() => setQrOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
                  aria-label="Tutup QR"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <QrCodeCard
                url={`${window.location.origin}/${profile.username}`}
                username={profile.username}
                compact
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QRIS Payment / Tip Jar Modal */}
      <AnimatePresence>
        {qrisOpen && profile.qrisImageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="w-full max-w-sm bg-white text-[#141413] rounded-2xl p-6 shadow-2xl border border-stone-200 text-center"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-display text-sm font-bold flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[#D97757]" />
                  <span>{profile.qrisTitle || 'Dukung & Bayar via QRIS'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setQrisOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
                  aria-label="Tutup QRIS"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 inline-block max-w-full">
                <img
                  src={profile.qrisImageUrl}
                  alt="Kode QRIS"
                  referrerPolicy="no-referrer"
                  className="max-h-64 w-auto mx-auto rounded-lg object-contain"
                />
              </div>
              <p className="text-xs text-stone-600 mt-3 leading-relaxed">
                {profile.qrisNote ||
                  'Scan kode QRIS melalui aplikasi e-wallet atau mobile banking Anda.'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gallery Lightbox Modal */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxImage(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 p-2.5 rounded-full bg-white/15 text-white hover:bg-white/25"
              aria-label="Tutup gambar"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxImage}
              alt="Pratinjau galeri"
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Report Profile Modal */}
      <AnimatePresence>
        {reportOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="w-full max-w-sm bg-white text-[#141413] rounded-2xl p-6 shadow-2xl border border-stone-200"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                    <Flag className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold">
                      Laporkan @{profile.username}
                    </h3>
                    <p className="text-xs text-stone-500">
                      Bantu kami menjaga keamanan platform LokaBio
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-500"
                  aria-label="Tutup laporan"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {reportState === 'success' ? (
                <div className="space-y-4">
                  <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3 leading-relaxed">
                    {reportFeedback}
                  </p>
                  <button
                    type="button"
                    onClick={() => setReportOpen(false)}
                    className="w-full min-h-[42px] px-4 rounded-xl bg-[#141413] text-white text-sm font-semibold"
                  >
                    Tutup
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReportSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Alasan Pelaporan
                    </label>
                    <select
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="w-full min-h-[42px] px-3 rounded-xl border border-stone-200 text-xs bg-white focus:outline-none focus:border-[#141413]"
                    >
                      <option value="Penipuan / Phishing">
                        Penipuan / Phishing
                      </option>
                      <option value="Peniruan Identitas">
                        Peniruan Identitas / Merek
                      </option>
                      <option value="Konten Tidak Pantas">
                        Konten Tidak Pantas / Terlarang
                      </option>
                      <option value="Spam / Tautan Berbahaya">
                        Spam / Tautan Berbahaya
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Keterangan Tambahan
                    </label>
                    <textarea
                      rows={3}
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      placeholder="Jelaskan tautan atau bagian mana yang bermasalah..."
                      className="w-full p-3 rounded-xl border border-stone-200 text-xs resize-none focus:outline-none focus:border-[#141413]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Email Anda (opsional)
                    </label>
                    <input
                      type="email"
                      value={reportEmail}
                      onChange={(e) => setReportEmail(e.target.value)}
                      placeholder="nama@email.com"
                      className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#141413]"
                    />
                  </div>
                  {reportFeedback && reportState === 'error' && (
                    <p className="text-xs text-red-600">{reportFeedback}</p>
                  )}
                  <button
                    type="submit"
                    disabled={reportState === 'submitting'}
                    className="w-full min-h-[42px] px-4 rounded-xl bg-red-600 text-white text-xs sm:text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                  >
                    {reportState === 'submitting'
                      ? 'Mengirim Laporan...'
                      : 'Kirim Laporan ke Admin'}
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
