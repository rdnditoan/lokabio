export type ThemePresetId =
  | 'minimalist-light'
  | 'dark-mode'
  | 'gradient-sunset'
  | 'glassmorphism'
  | 'custom';

export type BgType = 'solid' | 'gradient' | 'image';
export type ButtonShape = 'square' | 'rounded' | 'pill';
export type FontChoice = 'sans' | 'serif' | 'mono';
export type SocialPosition = 'top' | 'bottom';
export type LinkType =
  | 'standard'
  | 'header'
  | 'featured'
  | 'embed'
  | 'product'
  | 'gallery';

export interface SocialLinkItem {
  platform: string;
  url: string;
}

export interface ThemeConfig {
  themePreset: ThemePresetId | string;
  bgType: BgType | string;
  bgColor: string;
  bgGradient: string;
  bgImageUrl?: string;
  bgBlur?: number;
  bgOverlayOpacity?: number;
  buttonColor: string;
  buttonTextColor: string;
  buttonShape: ButtonShape | string;
  textColor: string;
  fontFamily: FontChoice | string;
}

export interface PublicLinkDTO {
  id: number;
  userId: number;
  linkType: LinkType | string;
  title: string;
  subtitle: string;
  url: string;
  icon: string;
  thumbnailUrl: string;
  priceText?: string;
  badgeText?: string;
  category?: string;
  galleryUrls?: string[];
  pinCode?: string;
  isLocked?: boolean;
  publishAt?: string | Date | null;
  expireAt?: string | Date | null;
  position: number;
  isActive: boolean;
  clicks: number;
}

export type UserRole = 'user' | 'admin';
export type PlanTier = 'free' | 'pro';
export type BulkUserAction =
  | 'verify'
  | 'unverify'
  | 'suspend'
  | 'unsuspend'
  | 'feature'
  | 'unfeature'
  | 'set_pro'
  | 'set_free'
  | 'delete';

export interface PublicProfileDTO extends ThemeConfig {
  id: number;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  coverUrl?: string;
  role?: UserRole | string;
  planTier?: PlanTier | string;
  planExpiresAt?: string | Date | null;
  hideBranding?: boolean;
  adminWarning?: string;
  adminWarningAt?: string | Date | null;
  isVerified: boolean;
  isSuspended?: boolean;
  isFeatured?: boolean;
  profileViews: number;
  socialPosition: SocialPosition | string;
  socialLinks: SocialLinkItem[];
  announcementEnabled?: boolean;
  announcementText?: string;
  announcementUrl?: string;
  whatsappNumber?: string;
  whatsappMessage?: string;
  contactEmail?: string;
  vcardEnabled?: boolean;
  qrisEnabled?: boolean;
  qrisTitle?: string;
  qrisImageUrl?: string;
  qrisNote?: string;
  newsletterEnabled: boolean;
  newsletterHeading: string;
  newsletterPlaceholder: string;
  inquiryEnabled?: boolean;
  inquiryHeading?: string;
  seoTitle: string;
  seoDescription: string;
  utmEnabled?: boolean;
  links: PublicLinkDTO[];
}

export interface SubscriberDTO {
  id: number;
  userId: number;
  email: string;
  name: string;
  createdAt: string | Date;
}

export interface InquiryDTO {
  id: number;
  userId: number;
  senderName: string;
  senderContact: string;
  message: string;
  isRead: boolean;
  createdAt: string | Date;
}

export interface AnalyticsSummaryDTO {
  days: number;
  dailySeries: Array<{ date: string; views: number; clicks: number }>;
  referrers: Array<{ source: string; count: number }>;
  devices: Array<{ device: string; count: number }>;
}

export interface AdminUserSummaryDTO {
  id: number;
  uid: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  role: UserRole | string;
  planTier: PlanTier | string;
  planExpiresAt: string | Date | null;
  hideBranding: boolean;
  adminWarning: string;
  adminWarningAt: string | Date | null;
  lastActiveAt: string | Date;
  isVerified: boolean;
  isSuspended: boolean;
  isFeatured: boolean;
  featuredOrder: number;
  profileViews: number;
  linkCount: number;
  totalClicks: number;
  subscriberCount: number;
  inquiryCount: number;
  createdAt: string | Date;
}

export interface PlatformStatsDTO {
  totalUsers: number;
  totalAdmins: number;
  totalProUsers: number;
  totalVerified: number;
  totalSuspended: number;
  dormantUsers: number;
  totalLinks: number;
  totalViews: number;
  totalClicks: number;
  totalSubscribers: number;
  totalInquiries: number;
  pendingReports: number;
  pendingVerifications: number;
}

export interface AdminUserDetailDTO {
  user: AdminUserSummaryDTO & {
    bio: string;
    whatsappNumber: string;
    contactEmail: string;
  };
  links: Array<{
    id: number;
    linkType: string;
    title: string;
    subtitle: string;
    url: string;
    isActive: boolean;
    clicks: number;
    position: number;
    priceText: string;
    flaggedReason?: string;
  }>;
}

export interface AdminAuditLogDTO {
  id: number;
  adminUserId: number | null;
  adminEmail: string;
  action: string;
  targetUsername: string;
  details: string;
  createdAt: string | Date;
}

export interface ProfileReportDTO {
  id: number;
  reportedUserId: number;
  reportedUsername: string;
  reporterEmail: string;
  reason: string;
  details: string;
  status: 'pending' | 'resolved' | 'dismissed' | string;
  reviewedBy: string;
  reviewedNote: string;
  createdAt: string | Date;
  reviewedAt: string | Date | null;
}

export interface VerificationRequestDTO {
  id: number;
  userId: number;
  username: string;
  displayName?: string;
  email?: string;
  category: string;
  proofUrl: string;
  note: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  reviewedBy: string;
  reviewedNote: string;
  createdAt: string | Date;
  reviewedAt: string | Date | null;
}

export interface PlatformSettingsDTO {
  announcementEnabled: boolean;
  announcementTitle: string;
  announcementMessage: string;
  announcementType: 'info' | 'warning' | 'success' | string;
  reservedUsernames: string[];
  maintenanceMode: boolean;
  maintenanceMessage: string;
  registrationOpen: boolean;
  freeLinkLimit: number;
  blockedDomains: string[];
  updatedBy?: string;
  updatedAt?: string | Date;
}

export interface PublicPlatformStatusDTO {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  registrationOpen: boolean;
  freeLinkLimit: number;
}

export interface PlatformAnalyticsDTO {
  days: number;
  dailySeries: Array<{ date: string; views: number; clicks: number }>;
  topCreators: Array<{
    id: number;
    username: string;
    displayName: string;
    profileViews: number;
    totalClicks: number;
    isVerified: boolean;
  }>;
  dormantCreators: Array<{
    id: number;
    username: string;
    displayName: string;
    email: string;
    lastActiveAt: string | Date;
    profileViews: number;
    linkCount: number;
  }>;
  totalClickEvents: number;
}

export interface ThemePresetDefinition {
  id: Exclude<ThemePresetId, 'custom'>;
  name: string;
  description: string;
  config: Omit<ThemeConfig, 'themePreset'>;
}

export const THEME_PRESETS: ThemePresetDefinition[] = [
  {
    id: 'minimalist-light',
    name: 'Minimalist Light',
    description: 'Kertas hangat dengan kontras tinta editorial yang bersih.',
    config: {
      bgType: 'solid',
      bgColor: '#F6F5F1',
      bgGradient: 'linear-gradient(135deg, #F6F5F1 0%, #EAE7DF 100%)',
      buttonColor: '#141413',
      buttonTextColor: '#FAF9F6',
      buttonShape: 'rounded',
      textColor: '#141413',
      fontFamily: 'sans',
    },
  },
  {
    id: 'dark-mode',
    name: 'Dark Mode',
    description: 'Kanvas arang pekat dengan aksen tombol putih kontras tinggi.',
    config: {
      bgType: 'solid',
      bgColor: '#0C0E12',
      bgGradient: 'linear-gradient(135deg, #0C0E12 0%, #1B2028 100%)',
      buttonColor: '#1E242E',
      buttonTextColor: '#F8FAFC',
      buttonShape: 'rounded',
      textColor: '#F1F5F9',
      fontFamily: 'sans',
    },
  },
  {
    id: 'gradient-sunset',
    name: 'Gradient Sunset',
    description: 'Gradasi senja hangat dengan tombol transparan lembut.',
    config: {
      bgType: 'gradient',
      bgColor: '#7C2D3B',
      bgGradient: 'linear-gradient(155deg, #2A1624 0%, #7C2D3B 52%, #D97757 100%)',
      buttonColor: 'rgba(255, 255, 255, 0.16)',
      buttonTextColor: '#FFF8F5',
      buttonShape: 'pill',
      textColor: '#FFF8F5',
      fontFamily: 'serif',
    },
  },
  {
    id: 'glassmorphism',
    name: 'Glassmorphism',
    description: 'Lapisan kaca buram di atas gradasi samudra tenang.',
    config: {
      bgType: 'gradient',
      bgColor: '#0F293A',
      bgGradient: 'linear-gradient(145deg, #0F2027 0%, #203A43 50%, #2C5364 100%)',
      buttonColor: 'rgba(255, 255, 255, 0.14)',
      buttonTextColor: '#FFFFFF',
      buttonShape: 'rounded',
      textColor: '#F0F9FF',
      fontFamily: 'sans',
    },
  },
];

export const GRADIENT_SWATCHES: { label: string; value: string }[] = [
  {
    label: 'Senja Hangat',
    value: 'linear-gradient(155deg, #2A1624 0%, #7C2D3B 52%, #D97757 100%)',
  },
  {
    label: 'Samudra Kaca',
    value: 'linear-gradient(145deg, #0F2027 0%, #203A43 50%, #2C5364 100%)',
  },
  {
    label: 'Hutan Tropis',
    value: 'linear-gradient(155deg, #132A1E 0%, #1F4E3D 55%, #3B7A57 100%)',
  },
  {
    label: 'Krem Pagi',
    value: 'linear-gradient(160deg, #FDFBF7 0%, #EFEAE0 55%, #E4DDD0 100%)',
  },
  {
    label: 'Batu Slate',
    value: 'linear-gradient(160deg, #0F172A 0%, #1E293B 55%, #334155 100%)',
  },
];

export const LINK_TYPE_OPTIONS = [
  { id: 'standard', label: 'Tombol Tautan' },
  { id: 'product', label: 'Etalase Produk (Rp)' },
  { id: 'featured', label: 'Kartu Unggulan (Banner)' },
  { id: 'gallery', label: 'Galeri Foto (Grid)' },
  { id: 'embed', label: 'Embed YouTube / Spotify' },
  { id: 'header', label: 'Pemisah Bagian (Header)' },
] as const;

export const LINK_ICON_OPTIONS = [
  { id: 'link', label: 'Tautan' },
  { id: 'globe', label: 'Website' },
  { id: 'shopping-bag', label: 'Produk / Toko' },
  { id: 'mic', label: 'Podcast' },
  { id: 'book-open', label: 'Tulisan / Artikel' },
  { id: 'video', label: 'Video' },
  { id: 'camera', label: 'Fotografi' },
  { id: 'calendar', label: 'Jadwal / Booking' },
  { id: 'mail', label: 'Email / Kontak' },
  { id: 'code', label: 'Kode / Proyek' },
  { id: 'music', label: 'Musik' },
  { id: 'sparkles', label: 'Sorotan' },
] as const;

export const SOCIAL_PLATFORM_OPTIONS = [
  { id: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/username' },
  { id: 'twitter', label: 'X / Twitter', placeholder: 'https://x.com/username' },
  { id: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@channel' },
  { id: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@username' },
  { id: 'github', label: 'GitHub', placeholder: 'https://github.com/username' },
  { id: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/username' },
  { id: 'globe', label: 'Website', placeholder: 'https://domainanda.com' },
  { id: 'mail', label: 'Email', placeholder: 'mailto:halo@domainanda.com' },
] as const;

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:')
  ) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function sanitizeUsername(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32);
}

export function getButtonRadiusClass(shape: string): string {
  switch (shape) {
    case 'square':
      return 'rounded-none';
    case 'pill':
      return 'rounded-full';
    case 'rounded':
    default:
      return 'rounded-2xl';
  }
}

export function getFontFamilyStyle(choice: string): string {
  switch (choice) {
    case 'serif':
      return '"Fraunces", Georgia, serif';
    case 'mono':
      return '"JetBrains Mono", ui-monospace, monospace';
    case 'sans':
    default:
      return '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  }
}

export function isLinkScheduledActive(
  link: {
    isActive: boolean;
    publishAt?: string | Date | null;
    expireAt?: string | Date | null;
  },
  now = new Date()
): boolean {
  if (!link.isActive) return false;
  if (link.publishAt) {
    const start = new Date(link.publishAt);
    if (!Number.isNaN(start.getTime()) && now < start) return false;
  }
  if (link.expireAt) {
    const end = new Date(link.expireAt);
    if (!Number.isNaN(end.getTime()) && now > end) return false;
  }
  return true;
}

export function appendUtmParams(
  rawUrl: string,
  username: string,
  utmEnabled?: boolean
): string {
  if (!rawUrl || !utmEnabled) return rawUrl;
  try {
    if (rawUrl.startsWith('mailto:') || rawUrl.startsWith('tel:')) {
      return rawUrl;
    }
    const parsed = new URL(normalizeUrl(rawUrl));
    if (!parsed.searchParams.has('utm_source')) {
      parsed.searchParams.set('utm_source', 'lokabio');
    }
    if (!parsed.searchParams.has('utm_medium')) {
      parsed.searchParams.set('utm_medium', 'biolink');
    }
    if (!parsed.searchParams.has('utm_campaign') && username) {
      parsed.searchParams.set('utm_campaign', username);
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

export function buildWhatsAppHref(
  rawNumber: string,
  message?: string
): string {
  let digits = rawNumber.replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    digits = `62${digits.slice(1)}`;
  }
  const textParam = message?.trim()
    ? `?text=${encodeURIComponent(message.trim())}`
    : '';
  return `https://wa.me/${digits}${textParam}`;
}

export function parseMediaEmbed(rawUrl: string): {
  provider: 'youtube' | 'spotify';
  embedUrl: string;
} | null {
  try {
    const parsed = new URL(normalizeUrl(rawUrl));
    const host = parsed.hostname.replace(/^www\./, '');

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = parsed.searchParams.get('v');
      if (v) {
        return {
          provider: 'youtube',
          embedUrl: `https://www.youtube-nocookie.com/embed/${v}`,
        };
      }
      const shortsMatch = parsed.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]+)/);
      if (shortsMatch?.[1]) {
        return {
          provider: 'youtube',
          embedUrl: `https://www.youtube-nocookie.com/embed/${shortsMatch[1]}`,
        };
      }
    }

    if (host === 'youtu.be') {
      const id = parsed.pathname.replace(/^\/+/, '').split('/')[0];
      if (id) {
        return {
          provider: 'youtube',
          embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
        };
      }
    }

    if (host === 'open.spotify.com') {
      const match = parsed.pathname.match(
        /^\/(track|episode|show|album|playlist)\/([a-zA-Z0-9]+)/
      );
      if (match) {
        return {
          provider: 'spotify',
          embedUrl: `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator`,
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function isUserProActive(user: {
  role?: string;
  planTier?: string;
  planExpiresAt?: string | Date | null;
}): boolean {
  if (user.role === 'admin') return true;
  if (user.planTier !== 'pro') return false;
  if (!user.planExpiresAt) return true;
  const exp = new Date(user.planExpiresAt);
  if (Number.isNaN(exp.getTime())) return true;
  return exp.getTime() > Date.now();
}

export function findBlockedDomainMatch(
  rawUrl: string,
  blockedDomains: string[]
): string | null {
  const cleaned = (rawUrl || '').trim().toLowerCase();
  if (!cleaned || !Array.isArray(blockedDomains) || blockedDomains.length === 0) {
    return null;
  }
  let hostAndPath = cleaned;
  try {
    const parsed = new URL(normalizeUrl(cleaned));
    hostAndPath = `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname}${parsed.search}`.toLowerCase();
  } catch {
    hostAndPath = cleaned;
  }
  for (const rawRule of blockedDomains) {
    const rule = String(rawRule || '').trim().toLowerCase();
    if (rule.length >= 3 && (hostAndPath.includes(rule) || cleaned.includes(rule))) {
      return rule;
    }
  }
  return null;
}
