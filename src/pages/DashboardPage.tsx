import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, Reorder } from 'motion/react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BadgeCheck,
  BarChart3,
  CalendarClock,
  Check,
  Copy,
  CopyPlus,
  Crown,
  Download,
  Eye,
  ExternalLink,
  GripVertical,
  Image as ImageIcon,
  ImagePlus,
  Inbox,
  KeyRound,
  Layers,
  Link2,
  Lock,
  LogOut,
  Mail,
  Megaphone,
  MessageSquare,
  Monitor,
  Palette,
  Pencil,
  Plus,
  QrCode,
  Search,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Smartphone,
  Ticket,
  Trash2,
  Upload,
  User as UserIcon,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthPage } from './AuthPage';
import { BioLinkRenderer } from '../components/BioLinkRenderer';
import { PhoneMockupFrame } from '../components/PhoneMockupFrame';
import { LinkIcon, SocialIcon } from '../components/IconMapper';
import { QrCodeCard } from '../components/QrCodeCard';
import {
  AnalyticsSummaryDTO,
  CuratedThemeTemplateDTO,
  GRADIENT_SWATCHES,
  InquiryDTO,
  isUserProActive,
  LINK_ICON_OPTIONS,
  LINK_TYPE_OPTIONS,
  PlatformSettingsDTO,
  PublicLinkDTO,
  PublicProfileDTO,
  SOCIAL_PLATFORM_OPTIONS,
  SocialLinkItem,
  SubscriberDTO,
  THEME_PRESETS,
  VerificationRequestDTO,
} from '../shared/themes';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
}

type StudioTab = 'links' | 'theme' | 'profile' | 'analytics' | 'seo';

function AnimatedNumber({
  value,
  decimals = 0,
  suffix = '',
}: {
  value: number;
  decimals?: number;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frameId = 0;
    const duration = 420;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [value]);

  const formatted =
    decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString('id-ID');

  return (
    <>
      {formatted}
      {suffix}
    </>
  );
}

function toDatetimeLocalValue(val: string | Date | null | undefined): string {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

const CURATED_AVATARS = [
  {
    label: 'Potret Studio 1',
    url: '/src/assets/images/avatar_creator_one_1795280504938.jpg',
  },
  {
    label: 'Potret Studio 2',
    url: '/src/assets/images/avatar_creator_two_1795280505020.jpg',
  },
];

const CURATED_THUMBNAILS = [
  { label: 'Tanpa Thumbnail', url: '' },
  {
    label: 'Design Kit',
    url: '/src/assets/images/thumb_design_kit_1795280504933.jpg',
  },
  {
    label: 'Podcast Studio',
    url: '/src/assets/images/thumb_podcast_studio_1795280504999.jpg',
  },
  {
    label: 'Meja Kerja',
    url: '/src/assets/images/thumb_newsletter_desk_1795280505174.jpg',
  },
];

function resizeImageFile(
  file: File,
  maxWidth: number,
  maxHeight: number,
  squareCrop = false
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak didukung.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas tidak tersedia.'));
          return;
        }
        if (squareCrop) {
          canvas.width = maxWidth;
          canvas.height = maxHeight;
          const minSide = Math.min(img.width, img.height);
          const sx = (img.width - minSide) / 2;
          const sy = (img.height - minSide) / 2;
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, maxWidth, maxHeight);
        } else {
          const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const {
    user,
    loading: authLoading,
    pendingOnboarding,
    setPendingOnboarding,
    resetPassword,
    signOut,
    authFetch,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<StudioTab>('links');
  const [profile, setProfile] = useState<PublicProfileDTO | null>(null);
  const [links, setLinks] = useState<PublicLinkDTO[]>([]);
  const [subscribersList, setSubscribersList] = useState<SubscriberDTO[]>([]);
  const [inquiriesList, setInquiriesList] = useState<InquiryDTO[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetPasswordSending, setResetPasswordSending] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [platformNotice, setPlatformNotice] = useState<
    | (Pick<
        PlatformSettingsDTO,
        | 'announcementEnabled'
        | 'announcementTitle'
        | 'announcementMessage'
        | 'announcementType'
      > & {
        maintenanceMode?: boolean;
        maintenanceMessage?: string;
        freeLinkLimit?: number;
      })
    | null
  >(null);
  const [dismissingWarning, setDismissingWarning] = useState(false);
  const [verificationReq, setVerificationReq] =
    useState<VerificationRequestDTO | null>(null);
  const [verifyFormOpen, setVerifyFormOpen] = useState(false);
  const [verifyCategory, setVerifyCategory] = useState('Kreator Digital');
  const [verifyProofUrl, setVerifyProofUrl] = useState('');
  const [verifyNote, setVerifyNote] = useState('');
  const [verifySubmitting, setVerifySubmitting] = useState(false);

  // Support Preview (Impersonate Read-Only) + Curated Themes + Promo Coupon
  const [previewUserId] = useState<number | null>(() => {
    const raw = new URLSearchParams(window.location.search).get(
      'previewUserId'
    );
    const num = Number(raw);
    return Number.isFinite(num) && num > 0 ? num : null;
  });
  const isSupportPreview = previewUserId !== null;
  const [curatedThemes, setCuratedThemes] = useState<CuratedThemeTemplateDTO[]>(
    () =>
      THEME_PRESETS.map((p, idx) => ({
        id: idx + 1,
        slug: p.id,
        name: p.name,
        description: p.description,
        ...p.config,
        isActive: true,
        isProOnly: false,
        sortOrder: idx + 1,
      }))
  );
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [redeemingCoupon, setRedeemingCoupon] = useState(false);

  // Add link form
  const [newLinkType, setNewLinkType] = useState<string>('standard');
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newIcon, setNewIcon] = useState('link');
  const [newThumb, setNewThumb] = useState('');
  const [newPriceText, setNewPriceText] = useState('');
  const [newBadgeText, setNewBadgeText] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newGalleryUrls, setNewGalleryUrls] = useState<string[]>([]);
  const [newGalleryInput, setNewGalleryInput] = useState('');
  const [newPinCode, setNewPinCode] = useState('');
  const [newPublishAt, setNewPublishAt] = useState('');
  const [newExpireAt, setNewExpireAt] = useState('');
  const [showAdvancedNew, setShowAdvancedNew] = useState(false);
  const [addingLink, setAddingLink] = useState(false);

  // Edit link inline
  const [editingLinkId, setEditingLinkId] = useState<number | null>(null);
  const [editLinkType, setEditLinkType] = useState('standard');
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editIcon, setEditIcon] = useState('link');
  const [editThumb, setEditThumb] = useState('');
  const [editPriceText, setEditPriceText] = useState('');
  const [editBadgeText, setEditBadgeText] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editGalleryUrls, setEditGalleryUrls] = useState<string[]>([]);
  const [editGalleryInput, setEditGalleryInput] = useState('');
  const [editPinCode, setEditPinCode] = useState('');
  const [editPublishAt, setEditPublishAt] = useState('');
  const [editExpireAt, setEditExpireAt] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Username availability
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    valid: boolean;
    available: boolean;
    checkedValue: string;
  } | null>(null);

  // New social row
  const [newSocialPlatform, setNewSocialPlatform] = useState('instagram');
  const [newSocialUrl, setNewSocialUrl] = useState('');

  // Analytics state
  const [analyticsDays, setAnalyticsDays] = useState<7 | 30>(7);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsSummaryDTO | null>(
    null
  );
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);

  // QR colors
  const [qrFgColor, setQrFgColor] = useState('#141413');
  const [qrBgColor, setQrBgColor] = useState('#FFFFFF');

  const showToast = (type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    setTimeout(() => {
      setToast((curr) => (curr?.text === text ? null : curr));
    }, 3200);
  };

  useEffect(() => {
    document.title = 'Studio Admin — LokaBio';
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLinks([]);
      setSubscribersList([]);
      setInquiriesList([]);
      return;
    }

    let mounted = true;
    setWorkspaceLoading(true);
    setWorkspaceError(null);

    const params = new URLSearchParams();
    if (pendingOnboarding?.username) {
      params.set('username', pendingOnboarding.username);
    }
    if (pendingOnboarding?.displayName) {
      params.set('displayName', pendingOnboarding.displayName);
    }
    const qs = params.toString();
    const workspaceUrl = isSupportPreview
      ? `/api/superadmin/users/${previewUserId}/workspace-preview`
      : qs
      ? `/api/admin/workspace?${qs}`
      : '/api/admin/workspace';

    authFetch(workspaceUrl)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Gagal memuat workspace.');
        }
        return res.json();
      })
      .then((data) => {
        if (!mounted) return;
        const u = data.user;
        const userLinks: PublicLinkDTO[] = data.links || [];
        setProfile({
          ...u,
          socialLinks: Array.isArray(u.socialLinks) ? u.socialLinks : [],
          links: userLinks,
        });
        setLinks(userLinks);
        setSubscribersList(Array.isArray(data.subscribers) ? data.subscribers : []);
        setInquiriesList(Array.isArray(data.inquiries) ? data.inquiries : []);
        setPlatformNotice(data.platformNotice || null);
        setVerificationReq(data.verificationRequest || null);
        if (Array.isArray(data.themeTemplates) && data.themeTemplates.length > 0) {
          setCuratedThemes(data.themeTemplates);
        }
        if (pendingOnboarding) {
          setPendingOnboarding(null);
        }
      })
      .catch((err: unknown) => {
        if (mounted) {
          setWorkspaceError(
            err instanceof Error ? err.message : 'Gagal memuat studio.'
          );
        }
      })
      .finally(() => {
        if (mounted) setWorkspaceLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [user, previewUserId]);

  useEffect(() => {
    if (!user || activeTab !== 'analytics' || isSupportPreview) return;
    let active = true;
    setAnalyticsLoading(true);

    authFetch(`/api/admin/analytics?days=${analyticsDays}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) setAnalyticsData(data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setAnalyticsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user, activeTab, analyticsDays, isSupportPreview]);

  const livePreviewProfile = useMemo<PublicProfileDTO | null>(() => {
    if (!profile) return null;
    return {
      ...profile,
      links,
    };
  }, [profile, links]);

  const totalClicks = useMemo(
    () => links.reduce((sum, l) => sum + (l.clicks || 0), 0),
    [links]
  );

  const ctrPercent = useMemo(() => {
    if (!profile || !profile.profileViews) return '0.0';
    return ((totalClicks / profile.profileViews) * 100).toFixed(1);
  }, [profile, totalClicks]);

  const handleCopyProfileUrl = async () => {
    if (!profile) return;
    const url = `${window.location.origin}/${profile.username}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      showToast('err', 'Gagal menyalin tautan.');
    }
  };

  // --- Link CRUD Handlers ---

  const guardPreviewMutation = (): boolean => {
    if (!isSupportPreview) return false;
    showToast(
      'err',
      'Mode Pratinjau Dukungan (Read-Only): Perubahan data hanya dapat dilakukan melalui Panel Super Admin.'
    );
    return true;
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardPreviewMutation()) return;
    if (!newTitle.trim()) {
      showToast('err', 'Judul wajib diisi.');
      return;
    }
    if (newLinkType !== 'header' && newLinkType !== 'gallery' && !newUrl.trim()) {
      showToast('err', 'URL tautan wajib diisi.');
      return;
    }
    if (newLinkType === 'gallery' && newGalleryUrls.length === 0) {
      showToast('err', 'Tambahkan minimal 1 foto untuk blok galeri.');
      return;
    }
    setAddingLink(true);
    try {
      const res = await authFetch('/api/admin/links', {
        method: 'POST',
        body: JSON.stringify({
          linkType: newLinkType,
          title: newTitle.trim(),
          subtitle: newSubtitle.trim(),
          url: newLinkType === 'header' || newLinkType === 'gallery' ? '' : newUrl.trim(),
          icon: newIcon,
          thumbnailUrl: newThumb.trim(),
          priceText: newLinkType === 'product' ? newPriceText.trim() : '',
          badgeText: newLinkType === 'product' ? newBadgeText.trim() : '',
          category: newLinkType !== 'header' ? newCategory.trim() : '',
          galleryUrls: newLinkType === 'gallery' ? newGalleryUrls : [],
          pinCode: newLinkType === 'header' || newLinkType === 'gallery' ? '' : newPinCode.trim(),
          publishAt: newPublishAt ? new Date(newPublishAt).toISOString() : null,
          expireAt: newExpireAt ? new Date(newExpireAt).toISOString() : null,
          isActive: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah tautan.');
      setLinks((prev) => [...prev, data.link]);
      setNewLinkType('standard');
      setNewTitle('');
      setNewSubtitle('');
      setNewUrl('');
      setNewIcon('link');
      setNewThumb('');
      setNewPriceText('');
      setNewBadgeText('');
      setNewCategory('');
      setNewGalleryUrls([]);
      setNewGalleryInput('');
      setNewPinCode('');
      setNewPublishAt('');
      setNewExpireAt('');
      setShowAdvancedNew(false);
      showToast('ok', 'Blok tautan baru ditambahkan.');
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal menambah tautan.'
      );
    } finally {
      setAddingLink(false);
    }
  };

  const handleToggleLinkActive = async (link: PublicLinkDTO) => {
    if (guardPreviewMutation()) return;
    const nextActive = !link.isActive;
    setLinks((prev) =>
      prev.map((l) => (l.id === link.id ? { ...l, isActive: nextActive } : l))
    );
    try {
      const res = await authFetch(`/api/admin/links/${link.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: nextActive }),
      });
      if (!res.ok) throw new Error('Gagal mengubah status tautan.');
    } catch {
      setLinks((prev) =>
        prev.map((l) =>
          l.id === link.id ? { ...l, isActive: link.isActive } : l
        )
      );
      showToast('err', 'Gagal mengubah status tautan.');
    }
  };

  const startEditLink = (link: PublicLinkDTO) => {
    setEditingLinkId(link.id);
    setEditLinkType(link.linkType || 'standard');
    setEditTitle(link.title);
    setEditSubtitle(link.subtitle || '');
    setEditUrl(link.url);
    setEditIcon(link.icon || 'link');
    setEditThumb(link.thumbnailUrl || '');
    setEditPriceText(link.priceText || '');
    setEditBadgeText(link.badgeText || '');
    setEditCategory(link.category || '');
    setEditGalleryUrls(Array.isArray(link.galleryUrls) ? link.galleryUrls : []);
    setEditGalleryInput('');
    setEditPinCode(link.pinCode || '');
    setEditPublishAt(toDatetimeLocalValue(link.publishAt));
    setEditExpireAt(toDatetimeLocalValue(link.expireAt));
    setConfirmDeleteId(null);
  };

  const handleDismissAdminWarning = async () => {
    setDismissingWarning(true);
    try {
      const res = await authFetch('/api/admin/warning/dismiss', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Gagal menutup peringatan.');
      setProfile((prev) =>
        prev ? { ...prev, adminWarning: '', adminWarningAt: null } : prev
      );
      showToast('ok', 'Peringatan ditandai sudah dibaca.');
    } catch {
      showToast('err', 'Gagal menutup peringatan admin.');
    } finally {
      setDismissingWarning(false);
    }
  };

  const handleSaveEditLink = async (linkId: number) => {
    if (guardPreviewMutation()) return;
    if (!editTitle.trim()) {
      showToast('err', 'Judul tidak boleh kosong.');
      return;
    }
    if (editLinkType !== 'header' && editLinkType !== 'gallery' && !editUrl.trim()) {
      showToast('err', 'URL tidak boleh kosong.');
      return;
    }
    try {
      const res = await authFetch(`/api/admin/links/${linkId}`, {
        method: 'PUT',
        body: JSON.stringify({
          linkType: editLinkType,
          title: editTitle.trim(),
          subtitle: editSubtitle.trim(),
          url: editLinkType === 'header' || editLinkType === 'gallery' ? '' : editUrl.trim(),
          icon: editIcon,
          thumbnailUrl: editThumb.trim(),
          priceText: editLinkType === 'product' ? editPriceText.trim() : '',
          badgeText: editLinkType === 'product' ? editBadgeText.trim() : '',
          category: editLinkType !== 'header' ? editCategory.trim() : '',
          galleryUrls: editLinkType === 'gallery' ? editGalleryUrls : [],
          pinCode: editLinkType === 'header' || editLinkType === 'gallery' ? '' : editPinCode.trim(),
          publishAt: editPublishAt ? new Date(editPublishAt).toISOString() : null,
          expireAt: editExpireAt ? new Date(editExpireAt).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui tautan.');
      setLinks((prev) => prev.map((l) => (l.id === linkId ? data.link : l)));
      setEditingLinkId(null);
      showToast('ok', 'Tautan diperbarui.');
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal memperbarui tautan.'
      );
    }
  };

  const handleDuplicateLink = async (linkId: number) => {
    if (guardPreviewMutation()) return;
    try {
      const res = await authFetch(`/api/admin/links/${linkId}/duplicate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menggandakan tautan.');
      setLinks((prev) => [...prev, data.link]);
      showToast('ok', 'Blok tautan digandakan.');
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal menggandakan tautan.'
      );
    }
  };

  const handleDeleteLink = async (linkId: number) => {
    if (guardPreviewMutation()) return;
    try {
      const res = await authFetch(`/api/admin/links/${linkId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Gagal menghapus tautan.');
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
      setConfirmDeleteId(null);
      showToast('ok', 'Tautan dihapus.');
    } catch {
      showToast('err', 'Gagal menghapus tautan.');
    }
  };

  const persistReorder = async (nextLinks: PublicLinkDTO[]) => {
    if (guardPreviewMutation()) return;
    setLinks(nextLinks);
    try {
      const res = await authFetch('/api/admin/links/reorder', {
        method: 'PATCH',
        body: JSON.stringify({
          orderedIds: nextLinks.map((l) => l.id),
        }),
      });
      if (!res.ok) throw new Error('Gagal menyimpan urutan.');
    } catch {
      showToast('err', 'Gagal menyimpan urutan tautan.');
    }
  };

  const moveLinkStep = (index: number, direction: -1 | 1) => {
    if (guardPreviewMutation()) return;
    const target = index + direction;
    if (target < 0 || target >= links.length) return;
    const copy = [...links];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    persistReorder(copy);
  };

  // --- Profile / Theme / SEO / Newsletter Handlers ---

  const saveProfileFields = async (
    partial: Partial<PublicProfileDTO>,
    successMsg: string
  ) => {
    if (guardPreviewMutation()) return;
    setSaving(true);
    try {
      const res = await authFetch('/api/admin/profile', {
        method: 'PUT',
        body: JSON.stringify(partial),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan perubahan.');
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              ...data.user,
              links,
            }
          : null
      );
      showToast('ok', successMsg);
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal menyimpan perubahan.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleApplyPreset = (presetSlug: string) => {
    if (guardPreviewMutation()) return;
    const preset = curatedThemes.find((p) => p.slug === presetSlug);
    if (!preset || !profile) return;
    if (preset.isProOnly && !isUserProActive(profile)) {
      showToast(
        'err',
        `Tema "${preset.name}" khusus pengguna Pro. Tukarkan kupon promo di tab SEO & QR!`
      );
      return;
    }
    const nextFields = {
      themePreset: preset.slug,
      bgType: preset.bgType,
      bgColor: preset.bgColor,
      bgGradient: preset.bgGradient,
      buttonColor: preset.buttonColor,
      buttonTextColor: preset.buttonTextColor,
      buttonShape: preset.buttonShape,
      textColor: preset.textColor,
      fontFamily: preset.fontFamily,
    };
    setProfile({ ...profile, ...nextFields });
    saveProfileFields(nextFields, `Tema "${preset.name}" diterapkan.`);
  };

  const handleRedeemCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardPreviewMutation()) return;
    const clean = couponCodeInput.trim().toUpperCase();
    if (!clean) {
      showToast('err', 'Masukkan kode kupon promo terlebih dahulu.');
      return;
    }
    setRedeemingCoupon(true);
    try {
      const res = await authFetch('/api/admin/coupons/redeem', {
        method: 'POST',
        body: JSON.stringify({ code: clean }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menukarkan kode kupon.');
      }
      if (data.user) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                planTier: data.user.planTier,
                planExpiresAt: data.user.planExpiresAt,
              }
            : null
        );
      }
      setCouponCodeInput('');
      showToast(
        'ok',
        data.expiresAt
          ? `Selamat! Paket Pro aktif hingga ${new Date(
              data.expiresAt
            ).toLocaleDateString('id-ID')}.`
          : 'Selamat! Paket Pro selamanya berhasil diaktifkan.'
      );
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal menukarkan kode kupon.'
      );
    } finally {
      setRedeemingCoupon(false);
    }
  };

  const handleUsernameCheck = async (val: string) => {
    if (!profile) return;
    const cleaned = val.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    setProfile({ ...profile, username: cleaned });
    if (cleaned.length < 3) {
      setUsernameStatus({
        checking: false,
        valid: false,
        available: false,
        checkedValue: cleaned,
      });
      return;
    }
    setUsernameStatus({
      checking: true,
      valid: true,
      available: true,
      checkedValue: cleaned,
    });
    try {
      const res = await authFetch(
        `/api/admin/username-check?username=${encodeURIComponent(cleaned)}`
      );
      const data = await res.json();
      setUsernameStatus({
        checking: false,
        valid: Boolean(data.valid),
        available: Boolean(data.available),
        checkedValue: cleaned,
      });
    } catch {
      setUsernameStatus(null);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    try {
      const dataUrl = await resizeImageFile(file, 256, 256, true);
      setProfile((prev) => (prev ? { ...prev, avatarUrl: dataUrl } : null));
    } catch {
      showToast('err', 'Gagal memproses foto profil.');
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    try {
      const dataUrl = await resizeImageFile(file, 960, 420);
      setProfile((prev) => (prev ? { ...prev, coverUrl: dataUrl } : null));
    } catch {
      showToast('err', 'Gagal memproses gambar cover.');
    }
  };

  const handleBgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    try {
      const dataUrl = await resizeImageFile(file, 1080, 1920);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              themePreset: 'custom',
              bgType: 'image',
              bgImageUrl: dataUrl,
            }
          : null
      );
    } catch {
      showToast('err', 'Gagal memproses gambar latar.');
    }
  };

  const handleQrisUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    try {
      const dataUrl = await resizeImageFile(file, 640, 640);
      setProfile((prev) => (prev ? { ...prev, qrisImageUrl: dataUrl } : null));
    } catch {
      showToast('err', 'Gagal memproses gambar QRIS.');
    }
  };

  const handleAddSocial = () => {
    if (!profile || !newSocialUrl.trim()) return;
    const nextSocials: SocialLinkItem[] = [
      ...(profile.socialLinks || []),
      { platform: newSocialPlatform, url: newSocialUrl.trim() },
    ];
    setProfile({ ...profile, socialLinks: nextSocials });
    setNewSocialUrl('');
  };

  const handleRemoveSocial = (idx: number) => {
    if (!profile) return;
    const nextSocials = profile.socialLinks.filter((_, i) => i !== idx);
    setProfile({ ...profile, socialLinks: nextSocials });
  };

  const handleDeleteSubscriber = async (subId: number) => {
    try {
      const res = await authFetch(`/api/admin/subscribers/${subId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      setSubscribersList((prev) => prev.filter((s) => s.id !== subId));
      showToast('ok', 'Email subscriber dihapus.');
    } catch {
      showToast('err', 'Gagal menghapus subscriber.');
    }
  };

  const handleToggleInquiryRead = async (inq: InquiryDTO) => {
    const nextRead = !inq.isRead;
    setInquiriesList((prev) =>
      prev.map((item) => (item.id === inq.id ? { ...item, isRead: nextRead } : item))
    );
    try {
      const res = await authFetch(`/api/admin/inquiries/${inq.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isRead: nextRead }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setInquiriesList((prev) =>
        prev.map((item) =>
          item.id === inq.id ? { ...item, isRead: inq.isRead } : item
        )
      );
      showToast('err', 'Gagal memperbarui status pesan.');
    }
  };

  const handleDeleteInquiry = async (inquiryId: number) => {
    try {
      const res = await authFetch(`/api/admin/inquiries/${inquiryId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      setInquiriesList((prev) => prev.filter((item) => item.id !== inquiryId));
      showToast('ok', 'Pesan dihapus.');
    } catch {
      showToast('err', 'Gagal menghapus pesan.');
    }
  };

  const handleExportInquiriesCsv = () => {
    if (!profile || inquiriesList.length === 0) return;
    const rows = [
      ['Nama Pengirim', 'Kontak', 'Pesan', 'Status', 'Tanggal'],
      ...inquiriesList.map((i) => [
        i.senderName,
        i.senderContact,
        i.message,
        i.isRead ? 'Sudah Dibaca' : 'Belum Dibaca',
        new Date(i.createdAt).toISOString(),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lokabio-${profile.username}-pesan-masuk.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendPasswordReset = async () => {
    if (!user?.email) {
      showToast('err', 'Email akun tidak tersedia.');
      return;
    }
    setResetPasswordSending(true);
    try {
      const ok = await resetPassword(user.email);
      if (ok) {
        showToast('ok', `Tautan atur ulang kata sandi dikirim ke ${user.email}.`);
      } else {
        showToast('err', 'Gagal mengirim email reset kata sandi.');
      }
    } finally {
      setResetPasswordSending(false);
    }
  };

  const handleExportSubscribersCsv = () => {
    if (!profile || subscribersList.length === 0) return;
    const rows = [
      ['Email', 'Tanggal Daftar'],
      ...subscribersList.map((s) => [
        s.email,
        new Date(s.createdAt).toISOString(),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lokabio-${profile.username}-subscribers.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAnalyticsCsv = () => {
    if (!profile) return;
    const rows = [
      ['Tipe', 'Judul / Tanggal', 'URL / Metrik', 'Klik / Kunjungan'],
      ...links.map((l) => ['Tautan', l.title, l.url || '-', String(l.clicks)]),
      ...(analyticsData?.dailySeries || []).map((d) => [
        'Harian',
        d.date,
        `Kunjungan: ${d.views}`,
        `Klik: ${d.clicks}`,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lokabio-${profile.username}-analitik.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Auth Loading / Sign-In Gate ---

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-[#141413] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage initialMode="login" onNavigate={onNavigate} />;
  }

  if (workspaceLoading || !profile || !livePreviewProfile) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] flex flex-col items-center justify-center px-4">
        {workspaceError ? (
          <div className="max-w-md w-full bg-white border border-stone-200 rounded-2xl p-6 text-center">
            <p className="text-sm text-red-700 mb-4">{workspaceError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#141413] text-white text-sm font-medium"
            >
              Coba Lagi
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-stone-600">
            <div className="w-8 h-8 border-2 border-stone-300 border-t-[#141413] rounded-full animate-spin" />
            <span className="text-sm font-medium">Menyiapkan Studio Anda...</span>
          </div>
        )}
      </div>
    );
  }

  const unreadInquiriesCount = inquiriesList.filter((i) => !i.isRead).length;

  const tabs: { id: StudioTab; label: string; icon: React.ReactNode }[] = [
    { id: 'links', label: 'Tautan', icon: <Link2 className="w-4 h-4" /> },
    { id: 'theme', label: 'Tema', icon: <Palette className="w-4 h-4" /> },
    {
      id: 'profile',
      label: unreadInquiriesCount > 0 ? `Profil (${unreadInquiriesCount})` : 'Profil',
      icon: <UserIcon className="w-4 h-4" />,
    },
    { id: 'analytics', label: 'Analitik', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'seo', label: 'SEO & QR', icon: <Search className="w-4 h-4" /> },
  ];

  const maxDailyMetric = Math.max(
    1,
    ...(analyticsData?.dailySeries || []).map((d) => Math.max(d.views, d.clicks))
  );

  return (
    <div className="min-h-screen bg-[#F6F5F1] text-[#141413] pb-24 lg:pb-12">
      {/* Studio Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="font-display text-lg font-bold tracking-tight whitespace-nowrap shrink-0"
            >
              LokaBio
            </button>
            <span className="text-stone-300 hidden sm:inline">/</span>
            <div className="hidden sm:flex items-center gap-2 text-xs text-stone-600 min-w-0">
              <span className="truncate font-mono">/{profile.username}</span>
              <button
                type="button"
                onClick={handleCopyProfileUrl}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-600 transition-colors"
                title="Salin tautan profil"
              >
                {copiedUrl ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => onNavigate(`/${profile.username}`)}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-600 transition-colors"
                title="Buka halaman publik"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                isUserProActive(profile)
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-stone-100 border-stone-200 text-stone-600'
              }`}
            >
              {isUserProActive(profile) && <Crown className="w-3 h-3 text-amber-600" />}
              <span>{isUserProActive(profile) ? 'PRO' : 'FREE'}</span>
            </span>
            {profile.role === 'admin' && (
              <button
                type="button"
                onClick={() => onNavigate('/admin')}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#141413] text-white text-xs font-medium hover:bg-stone-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Shield className="w-3.5 h-3.5 text-[#D97757]" />
                <span>Panel Admin</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate(`/${profile.username}`)}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-medium hover:bg-stone-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Lihat Halaman</span>
            </button>
            <button
              type="button"
              onClick={signOut}
              className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium text-stone-600 hover:text-red-700 hover:bg-red-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Inline Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-20 right-4 z-50"
          >
            <div
              className={`px-4 py-2.5 rounded-xl text-xs font-medium shadow-lg border ${
                toast.type === 'ok'
                  ? 'bg-[#141413] text-white border-stone-800'
                  : 'bg-red-600 text-white border-red-700'
              }`}
            >
              {toast.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Support Preview Banner */}
      {isSupportPreview && (
        <div className="bg-[#141413] text-white px-4 sm:px-6 py-2.5 border-b border-stone-800">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#D97757] shrink-0" />
              <span>
                <strong>Mode Pratinjau Dukungan (Read-Only):</strong> Anda sedang memeriksa Studio milik{' '}
                <span className="font-mono text-amber-300">
                  @{profile.username}
                </span>{' '}
                ({profile.displayName}). Perubahan langsung dinonaktifkan di layar ini.
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/admin')}
              className="px-3 py-1 rounded-lg bg-white text-[#141413] font-semibold hover:bg-stone-100 inline-flex items-center gap-1.5 shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Panel Admin</span>
            </button>
          </div>
        </div>
      )}

      {/* Main 2-Column Studio Workspace */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 lg:pt-8">
        {platformNotice?.announcementEnabled &&
          (platformNotice.announcementTitle ||
            platformNotice.announcementMessage) && (
            <div
              className={`mb-5 rounded-2xl border px-5 py-3.5 flex items-start gap-3 ${
                platformNotice.announcementType === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-950'
                  : platformNotice.announcementType === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                  : 'border-stone-200 bg-white text-[#141413]'
              }`}
            >
              <Megaphone className="w-4 h-4 mt-0.5 shrink-0 text-[#D97757]" />
              <div className="text-sm min-w-0">
                {platformNotice.announcementTitle && (
                  <p className="font-semibold">
                    {platformNotice.announcementTitle}
                  </p>
                )}
                {platformNotice.announcementMessage && (
                  <p className="text-xs opacity-85 mt-0.5 leading-relaxed">
                    {platformNotice.announcementMessage}
                  </p>
                )}
              </div>
            </div>
          )}
        {platformNotice?.maintenanceMode && (
          <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 flex items-start gap-3 text-amber-950">
            <Wrench className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm min-w-0">
              <p className="font-semibold">
                Mode Pemeliharaan Platform Sedang Aktif
              </p>
              <p className="text-xs opacity-85 mt-0.5 leading-relaxed">
                {platformNotice.maintenanceMessage ||
                  'Halaman profil publik sementara dialihkan ke halaman pemeliharaan oleh Super Admin.'}
              </p>
            </div>
          </div>
        )}
        {profile.adminWarning && (
          <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 flex items-start justify-between gap-3 text-amber-950">
            <div className="flex items-start gap-3 min-w-0">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm min-w-0">
                <p className="font-semibold">Peringatan dari Super Admin</p>
                <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                  {profile.adminWarning}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={dismissingWarning}
              onClick={handleDismissAdminWarning}
              className="min-h-[34px] px-3 py-1 rounded-xl border border-amber-300 bg-white text-xs font-medium text-amber-900 hover:bg-amber-100 shrink-0 disabled:opacity-50"
            >
              {dismissingWarning ? 'Menutup...' : 'Tandai Dibaca'}
            </button>
          </div>
        )}
        {profile.isSuspended && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 flex items-start gap-3 text-red-900">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">
                Akun ini sedang dinonaktifkan sementara oleh Super Admin
              </p>
              <p className="text-xs text-red-700 mt-1 leading-relaxed">
                Halaman publik Anda disembunyikan dan perubahan profil ditangguhkan hingga akun diaktifkan kembali oleh administrator.
              </p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Editor Panel */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            {/* Segmented Tab Bar with Shared layoutId Pill */}
            <div className="flex items-center gap-1 p-1.5 bg-stone-200/70 rounded-2xl overflow-x-auto">
              {tabs.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex-1 min-w-[92px] min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                      active
                        ? 'text-[#141413]'
                        : 'text-stone-600 hover:text-[#141413]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="studio-tab-pill"
                        transition={{
                          type: 'spring',
                          stiffness: 420,
                          damping: 34,
                        }}
                        className="absolute inset-0 bg-white rounded-xl shadow-xs"
                      />
                    )}
                    <span className="relative z-10 inline-flex items-center gap-2">
                      {tab.icon}
                      <span>{tab.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              {/* TAB 1: LINKS CRUD, TYPES, SCHEDULING, PIN & REORDER */}
              {activeTab === 'links' && (
                <motion.div
                  key="tab-links"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-6"
                >
                  {/* Add New Link Form */}
                  <form
                    onSubmit={handleCreateLink}
                    className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-display text-base font-semibold">
                        Tambah Tautan atau Blok
                      </h2>
                      <span className="text-xs text-stone-500 tabular-nums">
                        {isUserProActive(profile)
                          ? `${links.length} item tersimpan (Tanpa Batas)`
                          : `${links.length} / ${platformNotice?.freeLinkLimit ?? 8} item (Akun Free)`}
                      </span>
                    </div>

                    {/* Link Type Selector */}
                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1.5">
                        Jenis Blok
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {LINK_TYPE_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setNewLinkType(opt.id)}
                            className={`min-h-[38px] px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors truncate ${
                              newLinkType === opt.id
                                ? 'bg-[#141413] text-white border-[#141413]'
                                : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div
                        className={
                          newLinkType === 'header' || newLinkType === 'gallery'
                            ? 'sm:col-span-2'
                            : ''
                        }
                      >
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">
                          {newLinkType === 'header'
                            ? 'Judul Pemisah Bagian'
                            : newLinkType === 'product'
                            ? 'Nama Produk / Layanan'
                            : newLinkType === 'gallery'
                            ? 'Judul Galeri Foto'
                            : 'Judul Tautan'}
                        </label>
                        <input
                          type="text"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder={
                            newLinkType === 'header'
                              ? 'Contoh: Produk & Karya Digital'
                              : newLinkType === 'product'
                              ? 'Contoh: Paket Preset Lightroom Editorial'
                              : newLinkType === 'gallery'
                              ? 'Contoh: Dokumentasi Proyek Terbaru'
                              : newLinkType === 'embed'
                              ? 'Contoh: Episode Podcast Terbaru'
                              : 'Contoh: Portofolio Desain 2026'
                          }
                          className="w-full min-h-[42px] px-3.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#141413]"
                          required
                        />
                      </div>

                      {newLinkType !== 'header' && newLinkType !== 'gallery' && (
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1.5">
                            {newLinkType === 'embed'
                              ? 'URL YouTube atau Spotify'
                              : newLinkType === 'product'
                              ? 'URL Order (WhatsApp / Toko)'
                              : 'URL Tujuan'}
                          </label>
                          <input
                            type="text"
                            value={newUrl}
                            onChange={(e) => setNewUrl(e.target.value)}
                            placeholder={
                              newLinkType === 'embed'
                                ? 'https://open.spotify.com/episode/...'
                                : newLinkType === 'product'
                                ? 'https://wa.me/62812... atau link marketplace'
                                : 'https://domainanda.com'
                            }
                            className="w-full min-h-[42px] px-3.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#141413]"
                            required
                          />
                        </div>
                      )}
                    </div>

                    {newLinkType === 'product' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1.5">
                            Harga Produk
                          </label>
                          <input
                            type="text"
                            value={newPriceText}
                            onChange={(e) => setNewPriceText(e.target.value)}
                            placeholder="Contoh: Rp 149.000"
                            className="w-full min-h-[42px] px-3.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#141413]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1.5">
                            Label Sorotan (Opsional)
                          </label>
                          <input
                            type="text"
                            value={newBadgeText}
                            onChange={(e) => setNewBadgeText(e.target.value)}
                            placeholder="Contoh: Terlaris / Diskon 20%"
                            className="w-full min-h-[42px] px-3.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#141413]"
                          />
                        </div>
                      </div>
                    )}

                    {(newLinkType === 'featured' || newLinkType === 'product') && (
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">
                          {newLinkType === 'product'
                            ? 'Deskripsi Singkat Produk (Opsional)'
                            : 'Deskripsi Singkat Kartu Unggulan'}
                        </label>
                        <input
                          type="text"
                          value={newSubtitle}
                          onChange={(e) => setNewSubtitle(e.target.value)}
                          placeholder="Tambahkan keterangan singkat di bawah judul..."
                          className="w-full min-h-[42px] px-3.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#141413]"
                        />
                      </div>
                    )}

                    {newLinkType === 'gallery' && (
                      <div className="space-y-3 p-4 rounded-xl bg-stone-50 border border-stone-200/80">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="text-xs font-semibold text-stone-700 inline-flex items-center gap-1.5">
                            <ImagePlus className="w-4 h-4 text-[#D97757]" />
                            <span>Foto Galeri ({newGalleryUrls.length}/6)</span>
                          </label>
                          <label className="min-h-[34px] px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-medium hover:bg-stone-50 cursor-pointer inline-flex items-center gap-1.5">
                            <Upload className="w-3.5 h-3.5" />
                            <span>Unggah Foto</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file || newGalleryUrls.length >= 6) return;
                                try {
                                  const dataUrl = await resizeImageFile(file, 720, 720);
                                  setNewGalleryUrls((prev) => [...prev, dataUrl].slice(0, 6));
                                } catch {
                                  showToast('err', 'Gagal membaca foto galeri.');
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                        </div>

                        {newGalleryUrls.length > 0 && (
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {newGalleryUrls.map((gUrl, gIdx) => (
                              <div
                                key={`${gUrl.slice(0, 24)}-${gIdx}`}
                                className="relative aspect-square rounded-lg overflow-hidden border border-stone-200 bg-white"
                              >
                                <img
                                  src={gUrl}
                                  alt=""
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setNewGalleryUrls((prev) =>
                                      prev.filter((_, i) => i !== gIdx)
                                    )
                                  }
                                  aria-label="Hapus foto"
                                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red-600"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-1.5">
                          {CURATED_THUMBNAILS.filter((t) => t.url).map((t) => (
                            <button
                              key={t.label}
                              type="button"
                              disabled={newGalleryUrls.length >= 6}
                              onClick={() =>
                                setNewGalleryUrls((prev) =>
                                  [...prev, t.url].slice(0, 6)
                                )
                              }
                              className="px-2.5 py-1 rounded-lg border border-stone-200 bg-white text-[11px] font-medium text-stone-600 hover:border-stone-400 disabled:opacity-40"
                            >
                              + {t.label}
                            </button>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newGalleryInput}
                            onChange={(e) => setNewGalleryInput(e.target.value)}
                            placeholder="Atau tempel URL foto..."
                            className="flex-1 min-h-[38px] px-3 rounded-xl border border-stone-200 bg-white text-xs"
                          />
                          <button
                            type="button"
                            disabled={newGalleryUrls.length >= 6 || !newGalleryInput.trim()}
                            onClick={() => {
                              if (!newGalleryInput.trim()) return;
                              setNewGalleryUrls((prev) =>
                                [...prev, newGalleryInput.trim()].slice(0, 6)
                              );
                              setNewGalleryInput('');
                            }}
                            className="min-h-[38px] px-3.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold hover:bg-stone-100 disabled:opacity-40"
                          >
                            Tambah
                          </button>
                        </div>
                      </div>
                    )}

                    {(newLinkType === 'standard' ||
                      newLinkType === 'featured' ||
                      newLinkType === 'product') && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1.5">
                            Ikon (Lucide)
                          </label>
                          <select
                            value={newIcon}
                            onChange={(e) => setNewIcon(e.target.value)}
                            className="w-full min-h-[42px] px-3.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:border-[#141413]"
                          >
                            {LINK_ICON_OPTIONS.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-medium text-stone-600">
                              {newLinkType === 'product'
                                ? 'Foto Produk / Thumbnail'
                                : 'Thumbnail / Banner'}
                            </label>
                            <label className="text-[11px] font-medium text-[#D97757] hover:underline cursor-pointer">
                              Unggah Gambar
                              <input
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  try {
                                    const dataUrl = await resizeImageFile(file, 560, 560);
                                    setNewThumb(dataUrl);
                                  } catch {
                                    showToast('err', 'Gagal memuat gambar.');
                                  }
                                }}
                                className="hidden"
                              />
                            </label>
                          </div>
                          <select
                            value={
                              CURATED_THUMBNAILS.some((t) => t.url === newThumb)
                                ? newThumb
                                : '__custom__'
                            }
                            onChange={(e) => {
                              if (e.target.value !== '__custom__') {
                                setNewThumb(e.target.value);
                              }
                            }}
                            className="w-full min-h-[42px] px-3.5 rounded-xl border border-stone-200 text-sm bg-white focus:outline-none focus:border-[#141413]"
                          >
                            {CURATED_THUMBNAILS.map((t) => (
                              <option key={t.label} value={t.url}>
                                {t.label}
                              </option>
                            ))}
                            {!CURATED_THUMBNAILS.some((t) => t.url === newThumb) && (
                              <option value="__custom__">Gambar Kustom Terpilih</option>
                            )}
                          </select>
                        </div>
                      </div>
                    )}

                    {newLinkType !== 'header' && (
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">
                          Kategori Filter (Opsional — muncul sebagai tab di profil)
                        </label>
                        <input
                          type="text"
                          maxLength={40}
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          placeholder="Contoh: Produk, Layanan, Artikel, Promo"
                          className="w-full min-h-[40px] px-3.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#141413]"
                        />
                      </div>
                    )}

                    {/* Advanced Scheduling & PIN Protection */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAdvancedNew((v) => !v)}
                        className="text-xs font-medium text-stone-600 hover:text-[#141413] inline-flex items-center gap-1.5"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>
                          {showAdvancedNew
                            ? 'Sembunyikan Jadwal & Kode PIN'
                            : 'Atur Jadwal Tayang & Kode PIN (Opsional)'}
                        </span>
                      </button>

                      {showAdvancedNew && (
                        <div className="mt-3 pt-3 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Mulai Tayang
                            </label>
                            <input
                              type="datetime-local"
                              value={newPublishAt}
                              onChange={(e) => setNewPublishAt(e.target.value)}
                              className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Kedaluwarsa
                            </label>
                            <input
                              type="datetime-local"
                              value={newExpireAt}
                              onChange={(e) => setNewExpireAt(e.target.value)}
                              className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-xs"
                            />
                          </div>
                          {newLinkType !== 'header' && newLinkType !== 'gallery' && (
                            <div>
                              <label className="block text-xs font-medium text-stone-600 mb-1">
                                Kode PIN Akses
                              </label>
                              <input
                                type="text"
                                maxLength={8}
                                value={newPinCode}
                                onChange={(e) => setNewPinCode(e.target.value)}
                                placeholder="Kosongkan jika publik"
                                className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-xs font-mono"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={addingLink}
                        className="min-h-[42px] px-5 py-2 rounded-xl bg-[#D97757] text-white text-sm font-semibold hover:bg-[#c56647] active:scale-[0.98] transition-all inline-flex items-center gap-2 disabled:opacity-60"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{addingLink ? 'Menambahkan...' : 'Tambah Blok'}</span>
                      </button>
                    </div>
                  </form>

                  {/* Links List with Drag-and-Drop Reorder */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-xs font-medium text-stone-500">
                        Geser ikon pegangan atau gunakan panah untuk mengatur urutan
                      </h3>
                    </div>

                    {links.length === 0 ? (
                      <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
                        <p className="text-sm text-stone-600">
                          Belum ada tautan. Tambahkan tautan pertama Anda di atas.
                        </p>
                      </div>
                    ) : (
                      <Reorder.Group
                        axis="y"
                        values={links}
                        onReorder={persistReorder}
                        className="space-y-3"
                      >
                        <AnimatePresence initial={false}>
                          {links.map((link, index) => {
                            const isEditing = editingLinkId === link.id;
                            const hasSchedule = Boolean(
                              link.publishAt || link.expireAt
                            );
                            const hasPin = Boolean(
                              link.pinCode && link.pinCode.trim()
                            );
                            return (
                              <Reorder.Item
                                key={link.id}
                                value={link}
                                initial={{ opacity: 0, scale: 0.97 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.96 }}
                                transition={{
                                  duration: 0.18,
                                  ease: [0.16, 1, 0.3, 1],
                                }}
                                className="bg-white border border-stone-200 rounded-2xl p-4 transition-shadow hover:shadow-xs"
                              >
                                {isEditing ? (
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                      <select
                                        value={editLinkType}
                                        onChange={(e) =>
                                          setEditLinkType(e.target.value)
                                        }
                                        className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-xs bg-white"
                                      >
                                        {LINK_TYPE_OPTIONS.map((opt) => (
                                          <option key={opt.id} value={opt.id}>
                                            {opt.label}
                                          </option>
                                        ))}
                                      </select>
                                      <input
                                        type="text"
                                        value={editTitle}
                                        onChange={(e) =>
                                          setEditTitle(e.target.value)
                                        }
                                        placeholder="Judul"
                                        className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-sm"
                                      />
                                      {editLinkType !== 'header' &&
                                        editLinkType !== 'gallery' && (
                                          <input
                                            type="text"
                                            value={editUrl}
                                            onChange={(e) =>
                                              setEditUrl(e.target.value)
                                            }
                                            placeholder="https://..."
                                            className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-sm"
                                          />
                                        )}
                                    </div>
                                    {editLinkType === 'product' && (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <input
                                          type="text"
                                          value={editPriceText}
                                          onChange={(e) =>
                                            setEditPriceText(e.target.value)
                                          }
                                          placeholder="Harga (cth. Rp 149.000)"
                                          className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-xs"
                                        />
                                        <input
                                          type="text"
                                          value={editBadgeText}
                                          onChange={(e) =>
                                            setEditBadgeText(e.target.value)
                                          }
                                          placeholder="Label Sorotan (opsional)"
                                          className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-xs"
                                        />
                                      </div>
                                    )}
                                    {(editLinkType === 'featured' ||
                                      editLinkType === 'product') && (
                                      <input
                                        type="text"
                                        value={editSubtitle}
                                        onChange={(e) =>
                                          setEditSubtitle(e.target.value)
                                        }
                                        placeholder="Deskripsi singkat"
                                        className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-sm"
                                      />
                                    )}
                                    {editLinkType === 'gallery' && (
                                      <div className="space-y-2 p-3 rounded-xl bg-stone-50 border border-stone-200">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-medium text-stone-700">
                                            Foto Galeri ({editGalleryUrls.length}/6)
                                          </span>
                                          <label className="px-2.5 py-1 rounded-lg border border-stone-200 bg-white text-[11px] font-medium cursor-pointer hover:bg-stone-50">
                                            Unggah
                                            <input
                                              type="file"
                                              accept="image/*"
                                              onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file || editGalleryUrls.length >= 6) return;
                                                try {
                                                  const dataUrl = await resizeImageFile(file, 720, 720);
                                                  setEditGalleryUrls((prev) =>
                                                    [...prev, dataUrl].slice(0, 6)
                                                  );
                                                } catch {
                                                  showToast('err', 'Gagal memuat foto.');
                                                }
                                              }}
                                              className="hidden"
                                            />
                                          </label>
                                        </div>
                                        {editGalleryUrls.length > 0 && (
                                          <div className="grid grid-cols-6 gap-1.5">
                                            {editGalleryUrls.map((gUrl, gIdx) => (
                                              <div
                                                key={`${gUrl.slice(0, 20)}-${gIdx}`}
                                                className="relative aspect-square rounded-lg overflow-hidden border border-stone-200 bg-white"
                                              >
                                                <img
                                                  src={gUrl}
                                                  alt=""
                                                  referrerPolicy="no-referrer"
                                                  className="w-full h-full object-cover"
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setEditGalleryUrls((prev) =>
                                                      prev.filter((_, i) => i !== gIdx)
                                                    )
                                                  }
                                                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white flex items-center justify-center"
                                                >
                                                  <X className="w-2.5 h-2.5" />
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        <div className="flex gap-2">
                                          <input
                                            type="text"
                                            value={editGalleryInput}
                                            onChange={(e) =>
                                              setEditGalleryInput(e.target.value)
                                            }
                                            placeholder="Tempel URL foto tambahan..."
                                            className="flex-1 min-h-[36px] px-2.5 rounded-lg border border-stone-200 bg-white text-xs"
                                          />
                                          <button
                                            type="button"
                                            disabled={
                                              editGalleryUrls.length >= 6 ||
                                              !editGalleryInput.trim()
                                            }
                                            onClick={() => {
                                              if (!editGalleryInput.trim()) return;
                                              setEditGalleryUrls((prev) =>
                                                [...prev, editGalleryInput.trim()].slice(0, 6)
                                              );
                                              setEditGalleryInput('');
                                            }}
                                            className="px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium disabled:opacity-40"
                                          >
                                            +
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                    {editLinkType !== 'header' && (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                        {editLinkType !== 'gallery' && (
                                          <select
                                            value={editIcon}
                                            onChange={(e) =>
                                              setEditIcon(e.target.value)
                                            }
                                            className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-xs bg-white"
                                          >
                                            {LINK_ICON_OPTIONS.map((opt) => (
                                              <option key={opt.id} value={opt.id}>
                                                {opt.label}
                                              </option>
                                            ))}
                                          </select>
                                        )}
                                        {editLinkType !== 'gallery' && (
                                          <input
                                            type="text"
                                            value={editThumb}
                                            onChange={(e) =>
                                              setEditThumb(e.target.value)
                                            }
                                            placeholder="URL Thumbnail (opsional)"
                                            className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-xs"
                                          />
                                        )}
                                        <input
                                          type="text"
                                          maxLength={40}
                                          value={editCategory}
                                          onChange={(e) =>
                                            setEditCategory(e.target.value)
                                          }
                                          placeholder="Kategori Filter (opsional)"
                                          className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-xs"
                                        />
                                        {editLinkType !== 'gallery' && (
                                          <input
                                            type="text"
                                            maxLength={8}
                                            value={editPinCode}
                                            onChange={(e) =>
                                              setEditPinCode(e.target.value)
                                            }
                                            placeholder="Kode PIN (opsional)"
                                            className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-xs font-mono"
                                          />
                                        )}
                                      </div>
                                    )}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-[11px] text-stone-500 mb-1">
                                          Mulai Tayang
                                        </label>
                                        <input
                                          type="datetime-local"
                                          value={editPublishAt}
                                          onChange={(e) =>
                                            setEditPublishAt(e.target.value)
                                          }
                                          className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 text-xs"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[11px] text-stone-500 mb-1">
                                          Kedaluwarsa
                                        </label>
                                        <input
                                          type="datetime-local"
                                          value={editExpireAt}
                                          onChange={(e) =>
                                            setEditExpireAt(e.target.value)
                                          }
                                          className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 text-xs"
                                        />
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setEditingLinkId(null)}
                                        className="min-h-[38px] px-3.5 rounded-xl border border-stone-200 text-xs font-medium text-stone-600 hover:bg-stone-50"
                                      >
                                        Batal
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveEditLink(link.id)}
                                        className="min-h-[38px] px-4 rounded-xl bg-[#141413] text-white text-xs font-medium hover:bg-stone-800"
                                      >
                                        Simpan
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3">
                                    <div
                                      className="cursor-grab active:cursor-grabbing p-1.5 text-stone-400 hover:text-stone-700 shrink-0"
                                      title="Seret untuk mengurutkan"
                                    >
                                      <GripVertical className="w-4 h-4" />
                                    </div>

                                    {/* Icon or Thumb preview */}
                                    <div className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200/80 overflow-hidden flex items-center justify-center shrink-0">
                                      {link.thumbnailUrl ? (
                                        <img
                                          src={link.thumbnailUrl}
                                          alt=""
                                          referrerPolicy="no-referrer"
                                          className="w-full h-full object-cover"
                                        />
                                      ) : link.linkType === 'gallery' &&
                                        link.galleryUrls?.[0] ? (
                                        <img
                                          src={link.galleryUrls[0]}
                                          alt=""
                                          referrerPolicy="no-referrer"
                                          className="w-full h-full object-cover"
                                        />
                                      ) : link.linkType === 'header' ? (
                                        <span className="text-xs font-bold text-stone-500">
                                          H
                                        </span>
                                      ) : (
                                        <LinkIcon
                                          name={link.icon}
                                          className="w-4 h-4 text-stone-700"
                                        />
                                      )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        {hasPin && (
                                          <Lock
                                            className="w-3.5 h-3.5 text-amber-600 shrink-0"
                                            aria-label="Dilindungi PIN"
                                          />
                                        )}
                                        {hasSchedule && (
                                          <CalendarClock
                                            className="w-3.5 h-3.5 text-sky-600 shrink-0"
                                            aria-label="Terjadwal"
                                          />
                                        )}
                                        <p
                                          className={`text-sm font-semibold truncate ${
                                            link.isActive
                                              ? 'text-[#141413]'
                                              : 'text-stone-400 line-through'
                                          }`}
                                        >
                                          {link.title}
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500 mt-0.5">
                                        <span>
                                          {link.linkType === 'header'
                                            ? 'Pemisah Bagian'
                                            : link.linkType === 'product'
                                            ? 'Etalase Produk'
                                            : link.linkType === 'gallery'
                                            ? `Galeri (${link.galleryUrls?.length || 0} foto)`
                                            : link.linkType === 'featured'
                                            ? 'Kartu Unggulan'
                                            : link.linkType === 'embed'
                                            ? 'Embed Media'
                                            : 'Tautan'}
                                        </span>
                                        {link.priceText && (
                                          <>
                                            <span aria-hidden="true">·</span>
                                            <span className="font-semibold text-[#141413]">
                                              {link.priceText}
                                            </span>
                                          </>
                                        )}
                                        {link.category && (
                                          <>
                                            <span aria-hidden="true">·</span>
                                            <span>{link.category}</span>
                                          </>
                                        )}
                                        {link.linkType !== 'header' &&
                                          link.linkType !== 'gallery' && (
                                            <>
                                              <span aria-hidden="true">·</span>
                                              <span className="truncate max-w-[140px] sm:max-w-[200px]">
                                                {link.url}
                                              </span>
                                              <span aria-hidden="true">·</span>
                                              <span className="tabular-nums whitespace-nowrap">
                                                {link.clicks.toLocaleString('id-ID')}{' '}
                                                klik
                                              </span>
                                            </>
                                          )}
                                      </div>
                                    </div>

                                    {/* Reorder step buttons & Active toggle & Actions */}
                                    <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => moveLinkStep(index, -1)}
                                        disabled={index === 0}
                                        aria-label="Naikkan urutan"
                                        className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 disabled:opacity-30"
                                      >
                                        <ArrowUp className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => moveLinkStep(index, 1)}
                                        disabled={index === links.length - 1}
                                        aria-label="Turunkan urutan"
                                        className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 disabled:opacity-30"
                                      >
                                        <ArrowDown className="w-3.5 h-3.5" />
                                      </button>

                                      <button
                                        type="button"
                                        role="switch"
                                        aria-checked={link.isActive}
                                        aria-label={
                                          link.isActive
                                            ? 'Nonaktifkan tautan'
                                            : 'Aktifkan tautan'
                                        }
                                        onClick={() => handleToggleLinkActive(link)}
                                        className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors mx-1 ${
                                          link.isActive
                                            ? 'bg-emerald-600'
                                            : 'bg-stone-300'
                                        }`}
                                      >
                                        <span
                                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                                            link.isActive
                                              ? 'translate-x-4'
                                              : 'translate-x-0'
                                          }`}
                                        />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleDuplicateLink(link.id)}
                                        aria-label="Duplikat blok"
                                        title="Gandakan blok"
                                        className="p-2 rounded-lg text-stone-500 hover:text-[#141413] hover:bg-stone-100"
                                      >
                                        <CopyPlus className="w-3.5 h-3.5" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => startEditLink(link)}
                                        aria-label="Edit tautan"
                                        className="p-2 rounded-lg text-stone-500 hover:text-[#141413] hover:bg-stone-100"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>

                                      {confirmDeleteId === link.id ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDeleteLink(link.id)
                                          }
                                          className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700"
                                        >
                                          Hapus
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setConfirmDeleteId(link.id)
                                          }
                                          aria-label="Hapus tautan"
                                          className="p-2 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </Reorder.Item>
                            );
                          })}
                        </AnimatePresence>
                      </Reorder.Group>
                    )}
                  </div>
                </motion.div>
              )}

              {/* TAB 2: THEME CUSTOMIZATION */}
              {activeTab === 'theme' && (
                <motion.div
                  key="tab-theme"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-6"
                >
                  {/* Preset Grid (Curated Global Themes) */}
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-display text-base font-semibold">
                        Preset Tema Resmi Platform
                      </h2>
                      <span className="text-[11px] text-stone-500">
                        {curatedThemes.length} tema tersedia
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {curatedThemes.map((preset) => {
                        const active = profile.themePreset === preset.slug;
                        const lockedForFree =
                          preset.isProOnly && !isUserProActive(profile);
                        const previewBg =
                          preset.bgType === 'gradient' && preset.bgGradient
                            ? { backgroundImage: preset.bgGradient }
                            : { backgroundColor: preset.bgColor };
                        return (
                          <button
                            key={preset.slug}
                            type="button"
                            onClick={() => handleApplyPreset(preset.slug)}
                            className={`text-left p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                              active
                                ? 'border-[#141413] ring-1 ring-[#141413] bg-stone-50'
                                : 'border-stone-200 hover:border-stone-300 bg-white'
                            }`}
                          >
                            <div
                              className="w-12 h-14 rounded-xl border border-black/10 shrink-0 flex flex-col items-center justify-center gap-1.5 p-1.5"
                              style={previewBg}
                            >
                              <div
                                className="w-7 h-2 rounded-full"
                                style={{
                                  backgroundColor: preset.buttonColor,
                                }}
                              />
                              <div
                                className="w-7 h-2 rounded-full"
                                style={{
                                  backgroundColor: preset.buttonColor,
                                }}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1.5">
                                <p className="text-sm font-semibold text-[#141413] truncate">
                                  {preset.name}
                                </p>
                                {preset.isProOnly && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                      lockedForFree
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    PRO
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                                {preset.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Background & Colors */}
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-5">
                    <h2 className="font-display text-base font-semibold">
                      Kustomisasi Latar, Tombol &amp; Tipografi
                    </h2>

                    <div className="space-y-3">
                      <label className="block text-xs font-medium text-stone-600">
                        Tipe Latar Belakang
                      </label>
                      <div className="inline-flex flex-wrap p-1 bg-stone-100 rounded-xl gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setProfile({
                              ...profile,
                              themePreset: 'custom',
                              bgType: 'solid',
                            })
                          }
                          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            profile.bgType === 'solid'
                              ? 'bg-white text-[#141413] shadow-xs'
                              : 'text-stone-600'
                          }`}
                        >
                          Warna Solid
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setProfile({
                              ...profile,
                              themePreset: 'custom',
                              bgType: 'gradient',
                            })
                          }
                          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            profile.bgType === 'gradient'
                              ? 'bg-white text-[#141413] shadow-xs'
                              : 'text-stone-600'
                          }`}
                        >
                          Gradasi (Gradient)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setProfile({
                              ...profile,
                              themePreset: 'custom',
                              bgType: 'image',
                            })
                          }
                          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            profile.bgType === 'image'
                              ? 'bg-white text-[#141413] shadow-xs'
                              : 'text-stone-600'
                          }`}
                        >
                          Gambar Latar
                        </button>
                      </div>

                      {profile.bgType === 'solid' ? (
                        <div className="flex items-center gap-3 pt-1">
                          <input
                            type="color"
                            value={
                              profile.bgColor.startsWith('#')
                                ? profile.bgColor
                                : '#F6F5F1'
                            }
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                themePreset: 'custom',
                                bgColor: e.target.value,
                              })
                            }
                            className="w-11 h-11 rounded-xl border border-stone-200 cursor-pointer p-1 bg-white"
                          />
                          <input
                            type="text"
                            value={profile.bgColor}
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                themePreset: 'custom',
                                bgColor: e.target.value,
                              })
                            }
                            className="w-36 min-h-[42px] px-3 rounded-xl border border-stone-200 font-mono text-xs"
                          />
                        </div>
                      ) : profile.bgType === 'image' ? (
                        <div className="space-y-4 pt-1 p-4 rounded-xl bg-stone-50 border border-stone-200/80">
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="min-h-[38px] px-3.5 py-2 rounded-xl border border-stone-200 bg-white text-xs font-medium hover:bg-stone-50 cursor-pointer inline-flex items-center gap-1.5">
                              <Upload className="w-3.5 h-3.5" />
                              <span>Unggah Gambar Latar</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleBgImageUpload}
                                className="hidden"
                              />
                            </label>
                            {CURATED_THUMBNAILS.filter((t) => t.url).map((t) => (
                              <button
                                key={t.label}
                                type="button"
                                onClick={() =>
                                  setProfile({
                                    ...profile,
                                    themePreset: 'custom',
                                    bgType: 'image',
                                    bgImageUrl: t.url,
                                  })
                                }
                                className={`min-h-[38px] px-3 py-2 rounded-xl border text-xs font-medium ${
                                  profile.bgImageUrl === t.url
                                    ? 'border-[#141413] bg-white text-[#141413]'
                                    : 'border-stone-200 bg-white text-stone-600'
                                }`}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            value={profile.bgImageUrl || ''}
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                themePreset: 'custom',
                                bgType: 'image',
                                bgImageUrl: e.target.value,
                              })
                            }
                            placeholder="Atau tempel URL gambar latar..."
                            className="w-full min-h-[40px] px-3.5 rounded-xl border border-stone-200 bg-white text-xs"
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <div className="flex items-center justify-between text-xs text-stone-600 mb-1">
                                <span>Efek Blur Latar</span>
                                <span className="font-mono tabular-nums">
                                  {profile.bgBlur ?? 6}px
                                </span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={20}
                                value={profile.bgBlur ?? 6}
                                onChange={(e) =>
                                  setProfile({
                                    ...profile,
                                    themePreset: 'custom',
                                    bgBlur: Number(e.target.value),
                                  })
                                }
                                className="w-full accent-[#141413]"
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between text-xs text-stone-600 mb-1">
                                <span>Overlay Gelap</span>
                                <span className="font-mono tabular-nums">
                                  {profile.bgOverlayOpacity ?? 45}%
                                </span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={85}
                                value={profile.bgOverlayOpacity ?? 45}
                                onChange={(e) =>
                                  setProfile({
                                    ...profile,
                                    themePreset: 'custom',
                                    bgOverlayOpacity: Number(e.target.value),
                                  })
                                }
                                className="w-full accent-[#141413]"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 pt-1">
                          <div className="flex flex-wrap gap-2">
                            {GRADIENT_SWATCHES.map((swatch) => (
                              <button
                                key={swatch.label}
                                type="button"
                                onClick={() =>
                                  setProfile({
                                    ...profile,
                                    themePreset: 'custom',
                                    bgGradient: swatch.value,
                                  })
                                }
                                className={`px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                                  profile.bgGradient === swatch.value
                                    ? 'border-[#141413] bg-stone-50'
                                    : 'border-stone-200 bg-white'
                                }`}
                              >
                                <span
                                  className="w-4 h-4 rounded-full border border-black/10"
                                  style={{ backgroundImage: swatch.value }}
                                />
                                <span>{swatch.label}</span>
                              </button>
                            ))}
                          </div>
                          <input
                            type="text"
                            value={profile.bgGradient}
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                themePreset: 'custom',
                                bgGradient: e.target.value,
                              })
                            }
                            placeholder="linear-gradient(135deg, #... 0%, #... 100%)"
                            className="w-full min-h-[40px] px-3.5 rounded-xl border border-stone-200 font-mono text-xs"
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">
                          Warna Teks Profil
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={
                              profile.textColor.startsWith('#')
                                ? profile.textColor
                                : '#141413'
                            }
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                themePreset: 'custom',
                                textColor: e.target.value,
                              })
                            }
                            className="w-10 h-10 rounded-lg border border-stone-200 p-0.5 bg-white cursor-pointer"
                          />
                          <input
                            type="text"
                            value={profile.textColor}
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                themePreset: 'custom',
                                textColor: e.target.value,
                              })
                            }
                            className="w-full min-h-[40px] px-2.5 rounded-xl border border-stone-200 font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">
                          Warna Tombol
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={
                              profile.buttonColor.startsWith('#')
                                ? profile.buttonColor
                                : '#141413'
                            }
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                themePreset: 'custom',
                                buttonColor: e.target.value,
                              })
                            }
                            className="w-10 h-10 rounded-lg border border-stone-200 p-0.5 bg-white cursor-pointer"
                          />
                          <input
                            type="text"
                            value={profile.buttonColor}
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                themePreset: 'custom',
                                buttonColor: e.target.value,
                              })
                            }
                            className="w-full min-h-[40px] px-2.5 rounded-xl border border-stone-200 font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">
                          Warna Teks Tombol
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={
                              profile.buttonTextColor.startsWith('#')
                                ? profile.buttonTextColor
                                : '#FFFFFF'
                            }
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                themePreset: 'custom',
                                buttonTextColor: e.target.value,
                              })
                            }
                            className="w-10 h-10 rounded-lg border border-stone-200 p-0.5 bg-white cursor-pointer"
                          />
                          <input
                            type="text"
                            value={profile.buttonTextColor}
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                themePreset: 'custom',
                                buttonTextColor: e.target.value,
                              })
                            }
                            className="w-full min-h-[40px] px-2.5 rounded-xl border border-stone-200 font-mono text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-2">
                          Bentuk Tombol
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'square', label: 'Kotak' },
                            { id: 'rounded', label: 'Rounded' },
                            { id: 'pill', label: 'Pill' },
                          ].map((shape) => (
                            <button
                              key={shape.id}
                              type="button"
                              onClick={() =>
                                setProfile({
                                  ...profile,
                                  themePreset: 'custom',
                                  buttonShape: shape.id,
                                })
                              }
                              className={`min-h-[40px] border text-xs font-medium transition-colors ${
                                shape.id === 'square'
                                  ? 'rounded-none'
                                  : shape.id === 'pill'
                                  ? 'rounded-full'
                                  : 'rounded-xl'
                              } ${
                                profile.buttonShape === shape.id
                                  ? 'bg-[#141413] text-white border-[#141413]'
                                  : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
                              }`}
                            >
                              {shape.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-2">
                          Jenis Huruf (Font)
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'sans', label: 'Sans-serif' },
                            { id: 'serif', label: 'Serif' },
                            { id: 'mono', label: 'Monospace' },
                          ].map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() =>
                                setProfile({
                                  ...profile,
                                  fontFamily: f.id,
                                })
                              }
                              className={`min-h-[40px] rounded-xl border text-xs font-medium transition-colors ${
                                profile.fontFamily === f.id
                                  ? 'bg-[#141413] text-white border-[#141413]'
                                  : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
                              }`}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-3 border-t border-stone-100">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          saveProfileFields(
                            {
                              themePreset: profile.themePreset,
                              bgType: profile.bgType,
                              bgColor: profile.bgColor,
                              bgGradient: profile.bgGradient,
                              bgImageUrl: profile.bgImageUrl || '',
                              bgBlur: profile.bgBlur ?? 6,
                              bgOverlayOpacity: profile.bgOverlayOpacity ?? 45,
                              buttonColor: profile.buttonColor,
                              buttonTextColor: profile.buttonTextColor,
                              buttonShape: profile.buttonShape,
                              textColor: profile.textColor,
                              fontFamily: profile.fontFamily,
                            },
                            'Pengaturan tema berhasil disimpan.'
                          )
                        }
                        className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#D97757] text-white text-sm font-semibold hover:bg-[#c56647] transition-colors disabled:opacity-60"
                      >
                        {saving ? 'Menyimpan...' : 'Simpan Tema'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 3: PROFILE, SOCIALS & NEWSLETTER CAPTURE */}
              {activeTab === 'profile' && (
                <motion.div
                  key="tab-profile"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-6"
                >
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-5">
                    <h2 className="font-display text-base font-semibold">
                      Identitas Profil Publik
                    </h2>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-2">
                      <div className="w-20 h-20 rounded-full overflow-hidden border border-stone-200 bg-stone-100 shrink-0 flex items-center justify-center">
                        {profile.avatarUrl ? (
                          <img
                            src={profile.avatarUrl}
                            alt={profile.displayName}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-7 h-7 text-stone-400" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2 w-full">
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="min-h-[38px] px-3.5 py-2 rounded-xl border border-stone-200 bg-white text-xs font-medium hover:bg-stone-50 cursor-pointer inline-flex items-center gap-1.5">
                            <Upload className="w-3.5 h-3.5" />
                            <span>Unggah Foto</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleAvatarUpload}
                              className="hidden"
                            />
                          </label>
                          {CURATED_AVATARS.map((av) => (
                            <button
                              key={av.label}
                              type="button"
                              onClick={() =>
                                setProfile({ ...profile, avatarUrl: av.url })
                              }
                              className="min-h-[38px] px-3 py-2 rounded-xl border border-stone-200 text-xs font-medium text-stone-600 hover:bg-stone-50"
                            >
                              {av.label}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={profile.avatarUrl}
                          onChange={(e) =>
                            setProfile({ ...profile, avatarUrl: e.target.value })
                          }
                          placeholder="Atau tempel URL foto profil..."
                          className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 text-xs"
                        />
                      </div>
                    </div>

                    {/* Cover Banner Header */}
                    <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs font-semibold text-stone-700">
                          Banner Cover Header (Opsional)
                        </label>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <label className="min-h-[32px] px-3 py-1 rounded-lg border border-stone-200 bg-white text-xs font-medium hover:bg-stone-50 cursor-pointer inline-flex items-center gap-1.5">
                            <Upload className="w-3 h-3" />
                            <span>Unggah Cover</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleCoverUpload}
                              className="hidden"
                            />
                          </label>
                          {profile.coverUrl && (
                            <button
                              type="button"
                              onClick={() => setProfile({ ...profile, coverUrl: '' })}
                              className="min-h-[32px] px-2.5 py-1 rounded-lg border border-stone-200 bg-white text-xs text-red-600 hover:bg-red-50"
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                      </div>
                      {profile.coverUrl && (
                        <div className="h-24 w-full rounded-lg overflow-hidden border border-stone-200 bg-white">
                          <img
                            src={profile.coverUrl}
                            alt="Cover preview"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <input
                        type="text"
                        value={profile.coverUrl || ''}
                        onChange={(e) =>
                          setProfile({ ...profile, coverUrl: e.target.value })
                        }
                        placeholder="Tempel URL gambar cover header (rasio lebar 16:7)..."
                        className="w-full min-h-[36px] px-3 rounded-lg border border-stone-200 bg-white text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">
                          Username Publik (URL)
                        </label>
                        <div className="flex items-center rounded-xl border border-stone-200 overflow-hidden focus-within:border-[#141413]">
                          <span className="px-3 py-2.5 bg-stone-50 text-xs font-mono text-stone-500 border-r border-stone-200">
                            /
                          </span>
                          <input
                            type="text"
                            value={profile.username}
                            onChange={(e) => handleUsernameCheck(e.target.value)}
                            className="w-full min-h-[40px] px-3 text-sm font-mono focus:outline-none"
                          />
                        </div>
                        {usernameStatus &&
                          usernameStatus.checkedValue === profile.username && (
                            <p
                              className={`text-xs mt-1 ${
                                !usernameStatus.valid || !usernameStatus.available
                                  ? 'text-red-600'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {usernameStatus.checking
                                ? 'Memeriksa ketersediaan...'
                                : !usernameStatus.valid
                                ? 'Minimal 3 karakter huruf kecil/angka.'
                                : usernameStatus.available
                                ? 'Username tersedia'
                                : 'Username sudah dipakai pengguna lain.'}
                            </p>
                          )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">
                          Nama Tampilan
                        </label>
                        <input
                          type="text"
                          value={profile.displayName}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              displayName: e.target.value,
                            })
                          }
                          className="w-full min-h-[42px] px-3.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#141413]"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-stone-600">
                          Bio Singkat
                        </label>
                        <span className="text-xs text-stone-400 tabular-nums">
                          {profile.bio.length}/280
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        maxLength={280}
                        value={profile.bio}
                        onChange={(e) =>
                          setProfile({ ...profile, bio: e.target.value })
                        }
                        className="w-full p-3.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#141413]"
                      />
                    </div>

                    <div className="pt-3 border-t border-stone-100 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <BadgeCheck
                            className={`w-5 h-5 shrink-0 ${
                              profile.isVerified
                                ? 'text-sky-500'
                                : 'text-stone-400'
                            }`}
                          />
                          <div>
                            <p className="text-sm font-medium">
                              Status Verifikasi:{' '}
                              <span
                                className={
                                  profile.isVerified
                                    ? 'text-sky-600 font-semibold'
                                    : verificationReq?.status === 'pending'
                                    ? 'text-amber-700 font-semibold'
                                    : verificationReq?.status === 'rejected'
                                    ? 'text-red-600 font-semibold'
                                    : 'text-stone-500 font-normal'
                                }
                              >
                                {profile.isVerified
                                  ? 'Terverifikasi oleh Admin'
                                  : verificationReq?.status === 'pending'
                                  ? 'Menunggu Peninjauan Admin'
                                  : verificationReq?.status === 'rejected'
                                  ? 'Pengajuan Ditolak'
                                  : 'Belum Terverifikasi'}
                              </span>
                            </p>
                            <p className="text-xs text-stone-500">
                              {verificationReq?.status === 'rejected' &&
                              verificationReq.reviewedNote
                                ? `Catatan Admin: ${verificationReq.reviewedNote}`
                                : 'Tanda centang biru diberikan resmi oleh Super Admin LokaBio.'}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {!profile.isVerified &&
                            verificationReq?.status !== 'pending' && (
                              <button
                                type="button"
                                onClick={() => setVerifyFormOpen((v) => !v)}
                                className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-medium text-[#141413] hover:bg-stone-50 transition-colors whitespace-nowrap"
                              >
                                {verifyFormOpen
                                  ? 'Tutup Form'
                                  : 'Ajukan Verifikasi'}
                              </button>
                            )}
                          {profile.role === 'admin' && (
                            <button
                              type="button"
                              onClick={() => onNavigate('/admin')}
                              className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs font-medium text-[#141413] hover:bg-stone-100 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <Shield className="w-3.5 h-3.5 text-[#D97757]" />
                              <span>Kelola di Panel Admin</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {!profile.isVerified && verifyFormOpen && (
                        <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-stone-600 mb-1">
                                Kategori Kreator / Bisnis
                              </label>
                              <select
                                value={verifyCategory}
                                onChange={(e) =>
                                  setVerifyCategory(e.target.value)
                                }
                                className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 bg-white text-xs focus:outline-none focus:border-[#141413]"
                              >
                                <option value="Kreator Digital">
                                  Kreator Digital
                                </option>
                                <option value="UMKM / Brand Lokal">
                                  UMKM / Brand Lokal
                                </option>
                                <option value="Tokoh Publik / Profesional">
                                  Tokoh Publik / Profesional
                                </option>
                                <option value="Komunitas / Organisasi">
                                  Komunitas / Organisasi
                                </option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-stone-600 mb-1">
                                Tautan Bukti Resmi (IG / Website / TikTok)
                              </label>
                              <input
                                type="url"
                                value={verifyProofUrl}
                                onChange={(e) =>
                                  setVerifyProofUrl(e.target.value)
                                }
                                placeholder="https://instagram.com/usernameanda"
                                className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 bg-white text-xs focus:outline-none focus:border-[#141413]"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Catatan Tambahan (opsional)
                            </label>
                            <input
                              type="text"
                              value={verifyNote}
                              onChange={(e) => setVerifyNote(e.target.value)}
                              placeholder="Jelaskan profil atau bisnis Anda secara singkat..."
                              className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 bg-white text-xs focus:outline-none focus:border-[#141413]"
                            />
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              disabled={verifySubmitting}
                              onClick={async () => {
                                if (!verifyProofUrl.trim()) {
                                  showToast(
                                    'err',
                                    'Tautan bukti resmi wajib diisi.'
                                  );
                                  return;
                                }
                                setVerifySubmitting(true);
                                try {
                                  const res = await authFetch(
                                    '/api/admin/verification-request',
                                    {
                                      method: 'POST',
                                      body: JSON.stringify({
                                        category: verifyCategory,
                                        proofUrl: verifyProofUrl.trim(),
                                        note: verifyNote.trim(),
                                      }),
                                    }
                                  );
                                  const data = await res
                                    .json()
                                    .catch(() => ({}));
                                  if (!res.ok) {
                                    throw new Error(
                                      data.error ||
                                        'Gagal mengirim pengajuan verifikasi.'
                                    );
                                  }
                                  setVerificationReq(data.verificationRequest);
                                  setVerifyFormOpen(false);
                                  setVerifyProofUrl('');
                                  setVerifyNote('');
                                  showToast(
                                    'ok',
                                    'Pengajuan verifikasi terkirim ke Super Admin.'
                                  );
                                } catch (err: unknown) {
                                  showToast(
                                    'err',
                                    err instanceof Error
                                      ? err.message
                                      : 'Gagal mengirim pengajuan.'
                                  );
                                } finally {
                                  setVerifySubmitting(false);
                                }
                              }}
                              className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#141413] text-white text-xs font-semibold hover:bg-stone-800 disabled:opacity-50"
                            >
                              {verifySubmitting
                                ? 'Mengirim...'
                                : 'Kirim Pengajuan'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Social Media Row Manager */}
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="font-display text-base font-semibold">
                        Ikon Media Sosial
                      </h2>
                      <div className="inline-flex p-1 bg-stone-100 rounded-xl gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setProfile({ ...profile, socialPosition: 'top' })
                          }
                          className={`px-3 py-1 rounded-lg text-xs font-medium ${
                            profile.socialPosition !== 'bottom'
                              ? 'bg-white text-[#141413] shadow-xs'
                              : 'text-stone-600'
                          }`}
                        >
                          Posisi Atas
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setProfile({ ...profile, socialPosition: 'bottom' })
                          }
                          className={`px-3 py-1 rounded-lg text-xs font-medium ${
                            profile.socialPosition === 'bottom'
                              ? 'bg-white text-[#141413] shadow-xs'
                              : 'text-stone-600'
                          }`}
                        >
                          Posisi Bawah
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {profile.socialLinks.map((item, idx) => (
                        <div
                          key={`${item.platform}-${idx}`}
                          className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200/80"
                        >
                          <SocialIcon
                            platform={item.platform}
                            className="w-4 h-4 text-stone-700 shrink-0"
                          />
                          <span className="text-xs font-semibold capitalize w-20 shrink-0">
                            {item.platform}
                          </span>
                          <span className="text-xs text-stone-600 truncate flex-1">
                            {item.url}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSocial(idx)}
                            aria-label="Hapus media sosial"
                            className="p-1.5 rounded-lg text-stone-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                      <select
                        value={newSocialPlatform}
                        onChange={(e) => setNewSocialPlatform(e.target.value)}
                        className="sm:w-40 min-h-[40px] px-3 rounded-xl border border-stone-200 text-xs bg-white"
                      >
                        {SOCIAL_PLATFORM_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={newSocialUrl}
                        onChange={(e) => setNewSocialUrl(e.target.value)}
                        placeholder={
                          SOCIAL_PLATFORM_OPTIONS.find(
                            (o) => o.id === newSocialPlatform
                          )?.placeholder
                        }
                        className="flex-1 min-h-[40px] px-3 rounded-xl border border-stone-200 text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleAddSocial}
                        className="min-h-[40px] px-4 rounded-xl border border-stone-200 bg-white text-xs font-semibold hover:bg-stone-50 whitespace-nowrap"
                      >
                        Tambah Ikon
                      </button>
                    </div>
                  </div>

                  {/* Newsletter & Subscribers Capture */}
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5">
                        <Mail className="w-5 h-5 text-[#D97757]" />
                        <div>
                          <h2 className="font-display text-base font-semibold">
                            Blok Pengumpul Email (Newsletter)
                          </h2>
                          <p className="text-xs text-stone-500">
                            Kumpulkan email pengunjung langsung dari halaman profil
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={profile.newsletterEnabled}
                        onClick={() =>
                          setProfile({
                            ...profile,
                            newsletterEnabled: !profile.newsletterEnabled,
                          })
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          profile.newsletterEnabled
                            ? 'bg-emerald-600'
                            : 'bg-stone-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                            profile.newsletterEnabled
                              ? 'translate-x-5'
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {profile.newsletterEnabled && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1.5">
                            Judul Formulir
                          </label>
                          <input
                            type="text"
                            value={profile.newsletterHeading}
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                newsletterHeading: e.target.value,
                              })
                            }
                            className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1.5">
                            Placeholder Input Email
                          </label>
                          <input
                            type="text"
                            value={profile.newsletterPlaceholder}
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                newsletterPlaceholder: e.target.value,
                              })
                            }
                            className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {/* Subscribers Table */}
                    <div className="pt-3 border-t border-stone-100">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-stone-600 tabular-nums">
                          Daftar Email Terkumpul ({subscribersList.length})
                        </span>
                        {subscribersList.length > 0 && (
                          <button
                            type="button"
                            onClick={handleExportSubscribersCsv}
                            className="text-xs font-medium text-[#141413] hover:underline inline-flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Ekspor CSV</span>
                          </button>
                        )}
                      </div>
                      {subscribersList.length === 0 ? (
                        <p className="text-xs text-stone-400 py-2">
                          Belum ada pengunjung yang mendaftarkan email.
                        </p>
                      ) : (
                        <div className="divide-y divide-stone-100 max-h-48 overflow-y-auto">
                          {subscribersList.map((sub) => (
                            <div
                              key={sub.id}
                              className="py-2 flex items-center justify-between gap-3 text-xs"
                            >
                              <span className="font-medium truncate">
                                {sub.email}
                              </span>
                              <div className="flex items-center gap-3 shrink-0 text-stone-400">
                                <span className="tabular-nums">
                                  {new Date(sub.createdAt).toLocaleDateString(
                                    'id-ID'
                                  )}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSubscriber(sub.id)}
                                  className="p-1 text-stone-400 hover:text-red-600"
                                  aria-label="Hapus subscriber"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Announcement Bar */}
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5">
                        <Megaphone className="w-5 h-5 text-[#D97757]" />
                        <div>
                          <h2 className="font-display text-base font-semibold">
                            Banner Pengumuman Atas
                          </h2>
                          <p className="text-xs text-stone-500">
                            Pita info promo, jadwal live, atau rilis terbaru di puncak halaman
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(profile.announcementEnabled)}
                        onClick={() =>
                          setProfile({
                            ...profile,
                            announcementEnabled: !profile.announcementEnabled,
                          })
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          profile.announcementEnabled
                            ? 'bg-emerald-600'
                            : 'bg-stone-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                            profile.announcementEnabled
                              ? 'translate-x-5'
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {profile.announcementEnabled && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1.5">
                            Teks Pengumuman
                          </label>
                          <input
                            type="text"
                            maxLength={140}
                            value={profile.announcementText || ''}
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                announcementText: e.target.value,
                              })
                            }
                            placeholder="Contoh: Open Order Batch Maret — Diskon 15%!"
                            className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1.5">
                            URL Tujuan Banner (Opsional)
                          </label>
                          <input
                            type="text"
                            value={profile.announcementUrl || ''}
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                announcementUrl: e.target.value,
                              })
                            }
                            placeholder="https://..."
                            className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Contact (WhatsApp, vCard) & QRIS Modal */}
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-5">
                    <div className="flex items-center gap-2.5">
                      <Wallet className="w-5 h-5 text-[#D97757]" />
                      <div>
                        <h2 className="font-display text-base font-semibold">
                          Kontak Cepat (WhatsApp &amp; vCard) + QRIS
                        </h2>
                        <p className="text-xs text-stone-500">
                          Permudah pengunjung menghubungi Anda atau mengirim dukungan/pembayaran
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">
                          Nomor WhatsApp
                        </label>
                        <input
                          type="text"
                          value={profile.whatsappNumber || ''}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              whatsappNumber: e.target.value,
                            })
                          }
                          placeholder="Contoh: 081234567890"
                          className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">
                          Email Bisnis (untuk Kartu Kontak .vcf)
                        </label>
                        <input
                          type="email"
                          value={profile.contactEmail || ''}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              contactEmail: e.target.value,
                            })
                          }
                          placeholder="halo@domainanda.com"
                          className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1.5">
                        Pesan Otomatis WhatsApp (Opsional)
                      </label>
                      <input
                        type="text"
                        maxLength={240}
                        value={profile.whatsappMessage || ''}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            whatsappMessage: e.target.value,
                          })
                        }
                        placeholder="Halo! Saya menemukan profil Anda lewat LokaBio dan ingin bertanya..."
                        className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-sm"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                      <div>
                        <p className="text-sm font-medium">
                          Tombol Simpan Kontak (.vcf)
                        </p>
                        <p className="text-xs text-stone-500">
                          Pengunjung dapat menyimpan profil Anda langsung ke buku telepon HP
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(profile.vcardEnabled)}
                        onClick={() =>
                          setProfile({
                            ...profile,
                            vcardEnabled: !profile.vcardEnabled,
                          })
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          profile.vcardEnabled ? 'bg-emerald-600' : 'bg-stone-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                            profile.vcardEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="pt-3 border-t border-stone-100 space-y-3.5">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium">
                            Tombol Pembayaran / Tip QRIS
                          </p>
                          <p className="text-xs text-stone-500">
                            Tampilkan modal QRIS resmi Anda saat tombol diklik pengunjung
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={Boolean(profile.qrisEnabled)}
                          onClick={() =>
                            setProfile({
                              ...profile,
                              qrisEnabled: !profile.qrisEnabled,
                            })
                          }
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                            profile.qrisEnabled ? 'bg-emerald-600' : 'bg-stone-300'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                              profile.qrisEnabled
                                ? 'translate-x-5'
                                : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {profile.qrisEnabled && (
                        <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-stone-600 mb-1">
                                Judul Tombol / Modal QRIS
                              </label>
                              <input
                                type="text"
                                value={profile.qrisTitle || ''}
                                onChange={(e) =>
                                  setProfile({
                                    ...profile,
                                    qrisTitle: e.target.value,
                                  })
                                }
                                placeholder="Dukung via QRIS"
                                className="w-full min-h-[38px] px-3 rounded-lg border border-stone-200 bg-white text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-stone-600 mb-1">
                                Catatan Bawah QRIS
                              </label>
                              <input
                                type="text"
                                value={profile.qrisNote || ''}
                                onChange={(e) =>
                                  setProfile({
                                    ...profile,
                                    qrisNote: e.target.value,
                                  })
                                }
                                placeholder="Scan melalui GoPay, OVO, DANA, atau Mobile Banking."
                                className="w-full min-h-[38px] px-3 rounded-lg border border-stone-200 bg-white text-xs"
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            {profile.qrisImageUrl && (
                              <img
                                src={profile.qrisImageUrl}
                                alt="QRIS preview"
                                referrerPolicy="no-referrer"
                                className="w-16 h-16 rounded-lg object-contain bg-white border border-stone-200 p-1"
                              />
                            )}
                            <label className="min-h-[36px] px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-xs font-medium hover:bg-stone-50 cursor-pointer inline-flex items-center gap-1.5">
                              <Upload className="w-3.5 h-3.5" />
                              <span>Unggah Gambar QRIS</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleQrisUpload}
                                className="hidden"
                              />
                            </label>
                            <input
                              type="text"
                              value={profile.qrisImageUrl || ''}
                              onChange={(e) =>
                                setProfile({
                                  ...profile,
                                  qrisImageUrl: e.target.value,
                                })
                              }
                              placeholder="Atau tempel URL gambar QRIS..."
                              className="flex-1 min-w-[200px] min-h-[36px] px-3 rounded-lg border border-stone-200 bg-white text-xs"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Inquiry Form & Inbox */}
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2.5">
                        <MessageSquare className="w-5 h-5 text-[#D97757]" />
                        <div>
                          <h2 className="font-display text-base font-semibold">
                            Formulir Pesan / Kerja Sama &amp; Kotak Masuk
                          </h2>
                          <p className="text-xs text-stone-500">
                            Terima penawaran proyek, endorsement, atau pertanyaan pengunjung
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(profile.inquiryEnabled)}
                        onClick={() =>
                          setProfile({
                            ...profile,
                            inquiryEnabled: !profile.inquiryEnabled,
                          })
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          profile.inquiryEnabled ? 'bg-emerald-600' : 'bg-stone-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                            profile.inquiryEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {profile.inquiryEnabled && (
                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1.5">
                          Judul Formulir Pesan
                        </label>
                        <input
                          type="text"
                          value={profile.inquiryHeading || ''}
                          onChange={(e) =>
                            setProfile({
                              ...profile,
                              inquiryHeading: e.target.value,
                            })
                          }
                          placeholder="Kirim Pesan / Ajukan Kerja Sama"
                          className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-sm"
                        />
                      </div>
                    )}

                    {/* Inbox List */}
                    <div className="pt-3 border-t border-stone-100">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-stone-700 inline-flex items-center gap-1.5 tabular-nums">
                          <Inbox className="w-3.5 h-3.5 text-stone-500" />
                          <span>
                            Kotak Masuk ({inquiriesList.length}
                            {unreadInquiriesCount > 0
                              ? ` · ${unreadInquiriesCount} baru`
                              : ''}
                            )
                          </span>
                        </span>
                        {inquiriesList.length > 0 && (
                          <button
                            type="button"
                            onClick={handleExportInquiriesCsv}
                            className="text-xs font-medium text-[#141413] hover:underline inline-flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Ekspor CSV</span>
                          </button>
                        )}
                      </div>

                      {inquiriesList.length === 0 ? (
                        <p className="text-xs text-stone-400 py-2">
                          Belum ada pesan atau pengajuan kerja sama yang masuk.
                        </p>
                      ) : (
                        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                          {inquiriesList.map((inq) => (
                            <div
                              key={inq.id}
                              className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                                inq.isRead
                                  ? 'bg-stone-50/70 border-stone-200/80'
                                  : 'bg-amber-50/50 border-amber-200'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-semibold text-[#141413] truncate">
                                    {inq.senderName}{' '}
                                    <span className="font-normal text-stone-500">
                                      ({inq.senderContact})
                                    </span>
                                  </p>
                                  <p className="text-[11px] text-stone-400 tabular-nums mt-0.5">
                                    {new Date(inq.createdAt).toLocaleString('id-ID', {
                                      dateStyle: 'medium',
                                      timeStyle: 'short',
                                    })}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleInquiryRead(inq)}
                                    className="px-2.5 py-1 rounded-lg border border-stone-200 bg-white text-[11px] font-medium hover:bg-stone-50"
                                  >
                                    {inq.isRead ? 'Tandai Baru' : 'Tandai Dibaca'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteInquiry(inq.id)}
                                    aria-label="Hapus pesan"
                                    className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-stone-700 leading-relaxed whitespace-pre-wrap">
                                {inq.message}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-3 border-t border-stone-100">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          saveProfileFields(
                            {
                              username: profile.username,
                              displayName: profile.displayName,
                              bio: profile.bio,
                              avatarUrl: profile.avatarUrl,
                              coverUrl: profile.coverUrl || '',
                              socialPosition: profile.socialPosition,
                              socialLinks: profile.socialLinks,
                              announcementEnabled: Boolean(profile.announcementEnabled),
                              announcementText: profile.announcementText || '',
                              announcementUrl: profile.announcementUrl || '',
                              whatsappNumber: profile.whatsappNumber || '',
                              whatsappMessage: profile.whatsappMessage || '',
                              contactEmail: profile.contactEmail || '',
                              vcardEnabled: Boolean(profile.vcardEnabled),
                              qrisEnabled: Boolean(profile.qrisEnabled),
                              qrisTitle: profile.qrisTitle || 'Dukung via QRIS',
                              qrisImageUrl: profile.qrisImageUrl || '',
                              qrisNote: profile.qrisNote || '',
                              newsletterEnabled: profile.newsletterEnabled,
                              newsletterHeading: profile.newsletterHeading,
                              newsletterPlaceholder:
                                profile.newsletterPlaceholder,
                              inquiryEnabled: Boolean(profile.inquiryEnabled),
                              inquiryHeading:
                                profile.inquiryHeading ||
                                'Kirim Pesan / Kerja Sama',
                            },
                            'Profil, kontak, QRIS & pengaturan berhasil disimpan.'
                          )
                        }
                        className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#D97757] text-white text-sm font-semibold hover:bg-[#c56647] transition-colors disabled:opacity-60"
                      >
                        {saving ? 'Menyimpan...' : 'Simpan Profil & Pengaturan'}
                      </button>
                    </div>
                  </div>

                  {/* Account Security Card */}
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4">
                    <div className="flex items-center gap-2.5">
                      <KeyRound className="w-5 h-5 text-stone-700" />
                      <div>
                        <h2 className="font-display text-base font-semibold">
                          Pengaturan Akun &amp; Keamanan
                        </h2>
                        <p className="text-xs text-stone-500">
                          Kelola akses masuk untuk akun studio Anda
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-stone-50 border border-stone-200/80">
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs text-stone-500">Email Terdaftar</p>
                        <p className="text-sm font-semibold text-[#141413] truncate">
                          {user.email || 'Akun Terhubung'}
                        </p>
                        <p className="text-[11px] text-stone-500">
                          Metode:{' '}
                          {user.providerData.some((p) => p.providerId === 'google.com')
                            ? 'Google'
                            : 'Email & Kata Sandi'}{' '}
                          &middot; Peran Akun:{' '}
                          <span className="font-semibold text-[#141413]">
                            {profile.role === 'admin'
                              ? 'Super Admin'
                              : 'User (Kreator)'}
                          </span>
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {profile.role === 'admin' && (
                          <button
                            type="button"
                            onClick={() => onNavigate('/admin')}
                            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#141413] text-white text-xs font-medium hover:bg-stone-800 inline-flex items-center gap-1.5"
                          >
                            <Shield className="w-3.5 h-3.5 text-[#D97757]" />
                            <span>Buka Panel Super Admin</span>
                          </button>
                        )}
                        {user.email && (
                          <button
                            type="button"
                            disabled={resetPasswordSending}
                            onClick={handleSendPasswordReset}
                            className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-medium hover:bg-stone-100 disabled:opacity-50"
                          >
                            {resetPasswordSending
                              ? 'Mengirim...'
                              : 'Atur Ulang Kata Sandi'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={signOut}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-red-200 bg-white text-xs font-medium text-red-700 hover:bg-red-50 inline-flex items-center gap-1.5"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Keluar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* TAB 4: ENHANCED TIME-SERIES, REFERRER & DEVICE ANALYTICS */}
              {activeTab === 'analytics' && (
                <motion.div
                  key="tab-analytics"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                    <div className="bg-white border border-stone-200 rounded-2xl p-4">
                      <p className="text-xs text-stone-500">Kunjungan Profil</p>
                      <p className="font-display text-2xl font-bold tabular-nums mt-1">
                        <AnimatedNumber value={profile.profileViews} />
                      </p>
                    </div>
                    <div className="bg-white border border-stone-200 rounded-2xl p-4">
                      <p className="text-xs text-stone-500">Total Klik Tautan</p>
                      <p className="font-display text-2xl font-bold tabular-nums mt-1">
                        <AnimatedNumber value={totalClicks} />
                      </p>
                    </div>
                    <div className="bg-white border border-stone-200 rounded-2xl p-4">
                      <p className="text-xs text-stone-500">Rasio Klik (CTR)</p>
                      <p className="font-display text-2xl font-bold tabular-nums mt-1">
                        <AnimatedNumber
                          value={Number(ctrPercent) || 0}
                          decimals={1}
                          suffix="%"
                        />
                      </p>
                    </div>
                    <div className="bg-white border border-stone-200 rounded-2xl p-4">
                      <p className="text-xs text-stone-500">Tautan Aktif</p>
                      <p className="font-display text-2xl font-bold tabular-nums mt-1">
                        {links.filter((l) => l.isActive).length}/{links.length}
                      </p>
                    </div>
                  </div>

                  {/* Daily Trend Chart */}
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="font-display text-base font-semibold">
                          Tren Kunjungan &amp; Klik Harian
                        </h2>
                        <p className="text-xs text-stone-500">
                          Data aktivitas real-time dari pengunjung halaman Anda
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="inline-flex p-1 bg-stone-100 rounded-xl gap-1">
                          <button
                            type="button"
                            onClick={() => setAnalyticsDays(7)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium ${
                              analyticsDays === 7
                                ? 'bg-white text-[#141413] shadow-xs'
                                : 'text-stone-600'
                            }`}
                          >
                            7 Hari
                          </button>
                          <button
                            type="button"
                            onClick={() => setAnalyticsDays(30)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium ${
                              analyticsDays === 30
                                ? 'bg-white text-[#141413] shadow-xs'
                                : 'text-stone-600'
                            }`}
                          >
                            30 Hari
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={handleExportAnalyticsCsv}
                          className="min-h-[34px] px-3 rounded-xl border border-stone-200 text-xs font-medium hover:bg-stone-50 inline-flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>CSV</span>
                        </button>
                      </div>
                    </div>

                    {analyticsLoading ? (
                      <div className="h-44 w-full bg-stone-100 animate-pulse rounded-xl" />
                    ) : analyticsData ? (
                      <div>
                        <div className="h-44 flex items-end gap-1.5 pt-4 pb-2 border-b border-stone-200">
                          {analyticsData.dailySeries.map((day, idx) => {
                            const viewPct = Math.round(
                              (day.views / maxDailyMetric) * 100
                            );
                            const clickPct = Math.round(
                              (day.clicks / maxDailyMetric) * 100
                            );
                            const isHovered = hoveredDayIndex === idx;
                            return (
                              <div
                                key={day.date}
                                onMouseEnter={() => setHoveredDayIndex(idx)}
                                onMouseLeave={() => setHoveredDayIndex(null)}
                                className="relative flex-1 h-full flex items-end justify-center gap-0.5 group cursor-default"
                              >
                                {isHovered && (
                                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-10 px-2.5 py-1.5 rounded-lg bg-[#141413] text-white text-[11px] whitespace-nowrap shadow-md tabular-nums">
                                    {day.date.slice(5)}: {day.views} kunj ·{' '}
                                    {day.clicks} klik
                                  </div>
                                )}
                                <motion.div
                                  initial={{ scaleY: 0 }}
                                  animate={{ scaleY: 1 }}
                                  transition={{ duration: 0.35, delay: idx * 0.015 }}
                                  style={{
                                    height: `${Math.max(viewPct, day.views > 0 ? 6 : 2)}%`,
                                  }}
                                  className="w-full max-w-[14px] bg-stone-800 rounded-t-sm origin-bottom opacity-85 group-hover:opacity-100"
                                />
                                <motion.div
                                  initial={{ scaleY: 0 }}
                                  animate={{ scaleY: 1 }}
                                  transition={{ duration: 0.35, delay: idx * 0.015 }}
                                  style={{
                                    height: `${Math.max(
                                      clickPct,
                                      day.clicks > 0 ? 6 : 2
                                    )}%`,
                                  }}
                                  className="w-full max-w-[14px] bg-[#D97757] rounded-t-sm origin-bottom opacity-90 group-hover:opacity-100"
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between pt-2 text-[11px] text-stone-500">
                          <span className="tabular-nums">
                            {analyticsData.dailySeries[0]?.date}
                          </span>
                          <div className="flex items-center gap-4">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-xs bg-stone-800" />
                              Kunjungan
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-xs bg-[#D97757]" />
                              Klik Tautan
                            </span>
                          </div>
                          <span className="tabular-nums">
                            {
                              analyticsData.dailySeries[
                                analyticsData.dailySeries.length - 1
                              ]?.date
                            }
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Referrers & Devices Grid */}
                  {analyticsData && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="bg-white border border-stone-200 rounded-2xl p-5">
                        <h3 className="font-display text-sm font-semibold mb-3">
                          Sumber Trafik ({analyticsDays} Hari)
                        </h3>
                        {analyticsData.referrers.length === 0 ? (
                          <p className="text-xs text-stone-400 py-4">
                            Belum ada data sumber kunjungan.
                          </p>
                        ) : (
                          <div className="space-y-2.5">
                            {analyticsData.referrers.map((r) => (
                              <div
                                key={r.source}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="font-medium text-stone-700">
                                  {r.source}
                                </span>
                                <span className="font-semibold tabular-nums">
                                  {r.count.toLocaleString('id-ID')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="bg-white border border-stone-200 rounded-2xl p-5">
                        <h3 className="font-display text-sm font-semibold mb-3">
                          Perangkat Pengunjung ({analyticsDays} Hari)
                        </h3>
                        {analyticsData.devices.length === 0 ? (
                          <p className="text-xs text-stone-400 py-4">
                            Belum ada data perangkat pengunjung.
                          </p>
                        ) : (
                          <div className="space-y-2.5">
                            {analyticsData.devices.map((d) => (
                              <div
                                key={d.device}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="inline-flex items-center gap-2 font-medium text-stone-700">
                                  {d.device === 'Mobile' ? (
                                    <Smartphone className="w-3.5 h-3.5 text-stone-500" />
                                  ) : (
                                    <Monitor className="w-3.5 h-3.5 text-stone-500" />
                                  )}
                                  <span>{d.device}</span>
                                </span>
                                <span className="font-semibold tabular-nums">
                                  {d.count.toLocaleString('id-ID')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Per-Link Click Breakdown */}
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6">
                    <h2 className="font-display text-base font-semibold mb-4">
                      Performa Klik per Tautan
                    </h2>
                    {links.filter((l) => l.linkType !== 'header').length === 0 ? (
                      <p className="text-sm text-stone-500 py-6 text-center">
                        Belum ada data tautan untuk dianalisis.
                      </p>
                    ) : (
                      <div className="divide-y divide-stone-100">
                        {[...links]
                          .filter((l) => l.linkType !== 'header')
                          .sort((a, b) => b.clicks - a.clicks)
                          .map((link, idx) => {
                            const share =
                              totalClicks > 0
                                ? Math.round((link.clicks / totalClicks) * 100)
                                : 0;
                            return (
                              <div key={link.id} className="py-3.5 space-y-2">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {link.title}
                                    </p>
                                    <p className="text-xs text-stone-400 truncate">
                                      {link.url}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="text-sm font-semibold tabular-nums">
                                      {link.clicks.toLocaleString('id-ID')}
                                    </span>
                                    <span className="text-xs text-stone-400 ml-1.5 tabular-nums">
                                      ({share}%)
                                    </span>
                                  </div>
                                </div>
                                <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                  <motion.div
                                    initial={{ scaleX: 0 }}
                                    animate={{ scaleX: share / 100 }}
                                    transition={{
                                      duration: 0.45,
                                      delay: Math.min(idx * 0.05, 0.25),
                                      ease: [0.16, 1, 0.3, 1],
                                    }}
                                    className="h-full w-full bg-[#D97757] rounded-full origin-left"
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* TAB 5: DYNAMIC SEO, OPEN GRAPH & QR CODE GENERATOR */}
              {activeTab === 'seo' && (
                <motion.div
                  key="tab-seo"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-6"
                >
                  {/* Paket Pro & Tukar Kupon Promo Card */}
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isUserProActive(profile)
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          <Crown className="w-4 h-4" />
                        </div>
                        <div>
                          <h2 className="font-display text-base font-semibold">
                            Status Paket:{' '}
                            {isUserProActive(profile)
                              ? 'LokaBio PRO Aktif'
                              : 'Paket Free'}
                          </h2>
                          <p className="text-xs text-stone-500">
                            {isUserProActive(profile)
                              ? profile.planExpiresAt
                                ? `Berlaku hingga ${new Date(
                                    profile.planExpiresAt
                                  ).toLocaleDateString('id-ID', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                  })}`
                                : 'Aktif selamanya — tautan tak terbatas, tema Pro & sembunyikan branding.'
                              : `Maksimal ${
                                  platformNotice?.freeLinkLimit ?? 8
                                } blok tautan. Punya kode kupon promo? Tukarkan di bawah ini.`}
                          </p>
                        </div>
                      </div>
                    </div>

                    <form
                      onSubmit={handleRedeemCoupon}
                      className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-stone-100"
                    >
                      <div className="relative flex-1">
                        <Ticket className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={couponCodeInput}
                          onChange={(e) =>
                            setCouponCodeInput(
                              e.target.value
                                .toUpperCase()
                                .replace(/[^A-Z0-9_-]/g, '')
                            )
                          }
                          placeholder="Masukkan kode kupon promo (misal: LOKABIO30)"
                          className="w-full min-h-[40px] pl-9 pr-3 rounded-xl border border-stone-200 text-xs font-mono uppercase focus:outline-none focus:border-[#141413]"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={redeemingCoupon || !couponCodeInput.trim()}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-[#141413] text-white text-xs font-semibold hover:bg-stone-800 disabled:opacity-45 whitespace-nowrap"
                      >
                        {redeemingCoupon
                          ? 'Memproses...'
                          : 'Tukarkan Kupon Pro'}
                      </button>
                    </form>
                  </div>

                  {/* QR Code Generator Card */}
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <QrCodeCard
                        url={`${window.location.origin}/${profile.username}`}
                        username={profile.username}
                        fgColor={qrFgColor}
                        bgColor={qrBgColor}
                      />
                      <div className="flex-1 space-y-4 w-full">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <QrCode className="w-4 h-4 text-[#D97757]" />
                            <h2 className="font-display text-base font-semibold">
                              QR Code Profil (PNG &amp; SVG)
                            </h2>
                          </div>
                          <p className="text-xs text-stone-500 leading-relaxed">
                            Gunakan QR Code ini pada kartu nama, poster acara, atau kemasan produk untuk mengarahkan pengunjung langsung ke{' '}
                            <code className="font-mono">/{profile.username}</code>.
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Warna Pola QR
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={qrFgColor}
                                onChange={(e) => setQrFgColor(e.target.value)}
                                className="w-9 h-9 rounded-lg border border-stone-200 p-0.5 bg-white cursor-pointer"
                              />
                              <span className="font-mono text-xs text-stone-600">
                                {qrFgColor}
                              </span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">
                              Warna Latar QR
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={qrBgColor}
                                onChange={(e) => setQrBgColor(e.target.value)}
                                className="w-9 h-9 rounded-lg border border-stone-200 p-0.5 bg-white cursor-pointer"
                              />
                              <span className="font-mono text-xs text-stone-600">
                                {qrBgColor}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (profile.buttonColor.startsWith('#')) {
                              setQrFgColor(profile.buttonColor);
                            }
                            if (profile.bgColor.startsWith('#')) {
                              setQrBgColor(profile.bgColor);
                            }
                          }}
                          className="text-xs font-medium text-[#141413] underline underline-offset-4 hover:opacity-75"
                        >
                          Sesuaikan warna dengan tema profil
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* SEO Editor */}
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4">
                    <h2 className="font-display text-base font-semibold">
                      Metadata SEO &amp; Open Graph
                    </h2>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      Metadata ini disuntikkan secara otomatis ke HTML server saat tautan profil Anda dibagikan ke WhatsApp, Instagram, atau X/Twitter. Foto profil Anda otomatis digunakan sebagai gambar{' '}
                      <code className="font-mono">og:image</code>.
                    </p>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-stone-600">
                          Judul SEO (og:title)
                        </label>
                        <span className="text-xs text-stone-400 tabular-nums">
                          {profile.seoTitle.length}/120
                        </span>
                      </div>
                      <input
                        type="text"
                        maxLength={120}
                        value={profile.seoTitle}
                        onChange={(e) =>
                          setProfile({ ...profile, seoTitle: e.target.value })
                        }
                        placeholder={`${profile.displayName} (@${profile.username}) — LokaBio`}
                        className="w-full min-h-[42px] px-3.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#141413]"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-stone-600">
                          Deskripsi SEO (og:description)
                        </label>
                        <span className="text-xs text-stone-400 tabular-nums">
                          {profile.seoDescription.length}/300
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        maxLength={300}
                        value={profile.seoDescription}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            seoDescription: e.target.value,
                          })
                        }
                        placeholder={
                          profile.bio ||
                          `Jelajahi tautan resmi dan karya ${profile.displayName}.`
                        }
                        className="w-full p-3.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#141413]"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                      <div>
                        <p className="text-sm font-medium">
                          Tagging UTM Otomatis
                        </p>
                        <p className="text-xs text-stone-500">
                          Tambahkan parameter{' '}
                          <code className="font-mono">
                            ?utm_source=lokabio&amp;utm_medium=biolink
                          </code>{' '}
                          ke semua tautan keluar untuk pelacakan Google Analytics
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={profile.utmEnabled ?? true}
                        onClick={() =>
                          setProfile({
                            ...profile,
                            utmEnabled: !(profile.utmEnabled ?? true),
                          })
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          (profile.utmEnabled ?? true)
                            ? 'bg-emerald-600'
                            : 'bg-stone-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                            (profile.utmEnabled ?? true)
                              ? 'translate-x-5'
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-stone-100 gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">
                            Sembunyikan Branding LokaBio
                          </p>
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                            PRO
                          </span>
                        </div>
                        <p className="text-xs text-stone-500">
                          Menghapus teks &ldquo;Dibuat dengan LokaBio&rdquo; di footer halaman profil publik Anda
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        disabled={!isUserProActive(profile)}
                        aria-checked={Boolean(profile.hideBranding && isUserProActive(profile))}
                        onClick={() =>
                          setProfile({
                            ...profile,
                            hideBranding: !profile.hideBranding,
                          })
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                          !isUserProActive(profile)
                            ? 'bg-stone-200 cursor-not-allowed opacity-60'
                            : profile.hideBranding
                            ? 'bg-emerald-600 cursor-pointer'
                            : 'bg-stone-300 cursor-pointer'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                            profile.hideBranding && isUserProActive(profile)
                              ? 'translate-x-5'
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          saveProfileFields(
                            {
                              seoTitle: profile.seoTitle,
                              seoDescription: profile.seoDescription,
                              utmEnabled: profile.utmEnabled ?? true,
                              ...(isUserProActive(profile)
                                ? { hideBranding: Boolean(profile.hideBranding) }
                                : {}),
                            },
                            'Pengaturan SEO & UTM berhasil disimpan.'
                          )
                        }
                        className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#D97757] text-white text-sm font-semibold hover:bg-[#c56647] transition-colors disabled:opacity-60"
                      >
                        {saving ? 'Menyimpan...' : 'Simpan Pengaturan SEO'}
                      </button>
                    </div>
                  </div>

                  {/* Live Social Share Card Preview */}
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4">
                    <h3 className="text-xs font-semibold text-stone-500">
                      Pratinjau Kartu Bagikan (WhatsApp / X)
                    </h3>
                    <div className="border border-stone-200 rounded-2xl overflow-hidden max-w-md bg-stone-50">
                      <div className="flex items-center gap-4 p-4 bg-white">
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-100 shrink-0">
                          {profile.avatarUrl ? (
                            <img
                              src={profile.avatarUrl}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] text-stone-400 truncate">
                            {window.location.host}/{profile.username}
                          </p>
                          <p className="text-sm font-semibold text-[#141413] line-clamp-1 mt-0.5">
                            {profile.seoTitle ||
                              `${profile.displayName} (@${profile.username}) — LokaBio`}
                          </p>
                          <p className="text-xs text-stone-600 line-clamp-2 mt-0.5">
                            {profile.seoDescription ||
                              profile.bio ||
                              `Kumpulan tautan resmi ${profile.displayName}.`}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-stone-500">
                      <a
                        href="/sitemap.xml"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:text-[#141413] underline underline-offset-4"
                      >
                        <span>Buka /sitemap.xml</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <a
                        href="/robots.txt"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:text-[#141413] underline underline-offset-4"
                      >
                        <span>Buka /robots.txt</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Sticky Live Phone Preview (Desktop) */}
          <aside className="hidden lg:flex lg:col-span-5 xl:col-span-4 justify-center sticky top-24">
            <div className="w-full max-w-[356px]">
              <div className="flex items-center justify-between px-2 mb-3 text-xs text-stone-500">
                <span className="font-medium inline-flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Pratinjau Real-Time</span>
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate(`/${profile.username}`)}
                  className="font-medium text-[#141413] hover:underline underline-offset-4"
                >
                  /{profile.username}
                </button>
              </div>
              <PhoneMockupFrame screenHeightClass="h-[620px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={profile.themePreset}
                    initial={{ opacity: 0.7 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0.7 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="min-h-full"
                  >
                    <BioLinkRenderer profile={livePreviewProfile} isPreview />
                  </motion.div>
                </AnimatePresence>
              </PhoneMockupFrame>
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile Floating Preview Trigger */}
      <div className="lg:hidden fixed bottom-5 right-5 z-40">
        <button
          type="button"
          onClick={() => setMobilePreviewOpen(true)}
          className="min-h-[48px] px-5 py-3 rounded-full bg-[#141413] text-white text-sm font-semibold shadow-xl inline-flex items-center gap-2 active:scale-95 transition-transform"
        >
          <Layers className="w-4 h-4" />
          <span>Pratinjau</span>
        </button>
      </div>

      {/* Mobile Live Preview Sheet */}
      <AnimatePresence>
        {mobilePreviewOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end justify-center"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md bg-white rounded-t-3xl h-[86vh] flex flex-col overflow-hidden"
            >
              <div className="px-5 py-3.5 border-b border-stone-200 flex items-center justify-between">
                <span className="text-sm font-semibold">
                  Pratinjau /{profile.username}
                </span>
                <button
                  type="button"
                  onClick={() => setMobilePreviewOpen(false)}
                  className="p-2 rounded-full hover:bg-stone-100"
                  aria-label="Tutup pratinjau"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto no-scrollbar">
                <BioLinkRenderer profile={livePreviewProfile} isPreview />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
