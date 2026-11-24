import crypto from 'node:crypto';
import { and, asc, desc, eq, gte, inArray, lt, ne, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import {
  adminAuditLogs,
  clickEvents,
  inquiries,
  type LinkRecord,
  links,
  platformSettings,
  profileReports,
  promoCoupons,
  proSubscriptionsLog,
  type SocialLinkItem,
  subscribers,
  themeTemplates,
  type UserRecord,
  users,
  verificationRequests,
} from './schema.ts';
import {
  type AdminAuditLogDTO,
  type AdminUserDetailDTO,
  type AdminUserSummaryDTO,
  type AnalyticsSummaryDTO,
  type BulkUserAction,
  type CuratedThemeTemplateDTO,
  findBlockedDomainMatch,
  isLinkScheduledActive,
  isUserProActive,
  normalizeUrl,
  type PlatformAnalyticsDTO,
  type PlatformBackupDTO,
  type PlatformSettingsDTO,
  type PlatformStatsDTO,
  type ProfileReportDTO,
  type PromoCouponDTO,
  type ProSubscriptionLogDTO,
  type PublicLinkDTO,
  type PublicPlatformStatusDTO,
  sanitizeUsername,
  THEME_PRESETS,
  type VerificationRequestDTO,
} from '../shared/themes.ts';

const DEFAULT_ADMIN_EMAILS = ['rdnditoan@gmail.com', 'radenditoan@gmail.com'];

export function isBootstrapAdminEmail(email: string | undefined | null): boolean {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return false;
  const envList = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return DEFAULT_ADMIN_EMAILS.includes(normalized) || envList.includes(normalized);
}

export function normalizeReferrerSource(rawReferrer: string): string {
  const ref = (rawReferrer || '').trim().toLowerCase();
  if (!ref) return 'Direct';
  if (ref.includes('instagram.com') || ref === 'instagram') return 'Instagram';
  if (ref.includes('whatsapp.com') || ref.includes('wa.me') || ref === 'whatsapp')
    return 'WhatsApp';
  if (ref.includes('twitter.com') || ref.includes('x.com') || ref.includes('t.co'))
    return 'X / Twitter';
  if (ref.includes('tiktok.com')) return 'TikTok';
  if (ref.includes('youtube.com') || ref.includes('youtu.be')) return 'YouTube';
  if (ref.includes('facebook.com') || ref.includes('fb.com')) return 'Facebook';
  if (ref.includes('linkedin.com')) return 'LinkedIn';
  if (ref.includes('google.')) return 'Google';
  try {
    const parsed = new URL(ref.startsWith('http') ? ref : `https://${ref}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'Direct';
  }
}

export function detectDeviceType(userAgent: string): 'Mobile' | 'Desktop' {
  const ua = (userAgent || '').toLowerCase();
  if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(ua)) {
    return 'Mobile';
  }
  return 'Desktop';
}

export function toPublicLinkDTO(link: LinkRecord): PublicLinkDTO {
  const hasPin = Boolean(link.pinCode && link.pinCode.trim().length > 0);
  return {
    id: link.id,
    userId: link.userId,
    linkType: link.linkType,
    title: link.title,
    subtitle: link.subtitle,
    url: hasPin ? '' : link.url,
    icon: link.icon,
    thumbnailUrl: link.thumbnailUrl,
    priceText: link.priceText,
    badgeText: link.badgeText,
    category: link.category,
    galleryUrls: Array.isArray(link.galleryUrls) ? link.galleryUrls : [],
    isLocked: hasPin,
    publishAt: link.publishAt,
    expireAt: link.expireAt,
    position: link.position,
    isActive: link.isActive,
    clicks: link.clicks,
  };
}

export async function getUserByUid(uid: string): Promise<UserRecord | null> {
  try {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed (getUserByUid):', error);
    throw new Error('Gagal memuat profil pengguna.', { cause: error });
  }
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string,
  photoUrl?: string,
  preferredUsername?: string
): Promise<UserRecord> {
  try {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1);

    if (existing[0]) {
      const nextPatch: Record<string, unknown> = { lastActiveAt: new Date() };
      if (isBootstrapAdminEmail(email) && existing[0].role !== 'admin') {
        nextPatch.role = 'admin';
        nextPatch.planTier = 'pro';
        nextPatch.updatedAt = new Date();
      }
      const touched = await db
        .update(users)
        .set(nextPatch)
        .where(eq(users.id, existing[0].id))
        .returning();
      return touched[0] ?? existing[0];
    }

    const cleanAuthEmail = (email || '').trim().toLowerCase();
    if (cleanAuthEmail) {
      const preProvisioned = await db
        .select()
        .from(users)
        .where(
          and(
            sql`lower(${users.email}) = ${cleanAuthEmail}`,
            sql`${users.uid} like 'pre_%'`
          )
        )
        .limit(1);

      if (preProvisioned[0]) {
        const claimed = await db
          .update(users)
          .set({
            uid,
            lastActiveAt: new Date(),
            updatedAt: new Date(),
            ...(photoUrl && !preProvisioned[0].avatarUrl
              ? { avatarUrl: photoUrl }
              : {}),
            ...(isBootstrapAdminEmail(email)
              ? { role: 'admin', planTier: 'pro' }
              : {}),
          })
          .where(eq(users.id, preProvisioned[0].id))
          .returning();
        if (claimed[0]) return claimed[0];
      }
    }

    const settings = await getOrCreatePlatformSettings();
    if (!settings.registrationOpen && !isBootstrapAdminEmail(email)) {
      throw new Error(
        'Pendaftaran akun baru saat ini sedang ditutup oleh administrator.'
      );
    }

    let candidate = '';
    if (preferredUsername) {
      const check = await isUsernameAvailable(preferredUsername);
      if (check.valid && check.available) {
        candidate = check.normalized;
      }
    }

    if (!candidate) {
      const baseHandle =
        sanitizeUsername((email || 'creator').split('@')[0] || 'creator') ||
        'creator';
      candidate = baseHandle;
      const suffix = uid.slice(-4).toLowerCase().replace(/[^a-z0-9]/g, 'x');

      const conflict = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, candidate))
        .limit(1);

      if (conflict[0]) {
        candidate = `${baseHandle.slice(0, 24)}_${suffix}`;
      }
    }

    const cleanName = (displayName || candidate).trim();
    const safeAvatar =
      photoUrl || '/src/assets/images/avatar_creator_one_1795280504938.jpg';
    const assignedRole = isBootstrapAdminEmail(email) ? 'admin' : 'user';

    const inserted = await db
      .insert(users)
      .values({
        uid,
        email: email || `${candidate}@lokabio.id`,
        username: candidate,
        displayName: cleanName,
        bio: 'Kreator digital & pengelola tautan. Klik tautan di bawah untuk terhubung.',
        avatarUrl: safeAvatar,
        role: assignedRole,
        isVerified: assignedRole === 'admin',
        profileViews: 1,
        themePreset: 'minimalist-light',
        bgType: 'solid',
        bgColor: '#F6F5F1',
        bgGradient:
          'linear-gradient(155deg, #2A1624 0%, #7C2D3B 52%, #D97757 100%)',
        buttonColor: '#141413',
        buttonTextColor: '#FAF9F6',
        buttonShape: 'rounded',
        textColor: '#141413',
        fontFamily: 'sans',
        socialPosition: 'top',
        socialLinks: [
          { platform: 'instagram', url: 'https://instagram.com' },
          { platform: 'globe', url: 'https://lokabio.id' },
        ],
        newsletterEnabled: false,
        newsletterHeading: 'Dapatkan Catatan & Karya Terbaru',
        newsletterPlaceholder: 'Masukkan alamat email Anda...',
        seoTitle: `${cleanName} — Tautan Resmi`,
        seoDescription: `Jelajahi profil dan kumpulan tautan resmi dari ${cleanName}.`,
      })
      .onConflictDoNothing({ target: users.uid })
      .returning();

    const userRow =
      inserted[0] ??
      (await db.select().from(users).where(eq(users.uid, uid)).limit(1))[0];

    if (!userRow) {
      throw new Error('Tidak dapat membuat profil pengguna baru.');
    }

    const existingLinks = await db
      .select({ id: links.id })
      .from(links)
      .where(eq(links.userId, userRow.id))
      .limit(1);

    if (!existingLinks[0]) {
      await db.insert(links).values([
        {
          userId: userRow.id,
          linkType: 'featured',
          title: 'Portofolio & Karya Terbaru',
          subtitle: 'Kumpulan studi kasus dan proyek desain pilihan.',
          url: 'https://example.com/portfolio',
          icon: 'globe',
          thumbnailUrl: '/src/assets/images/thumb_design_kit_1795280504933.jpg',
          position: 0,
          isActive: true,
          clicks: 0,
        },
        {
          userId: userRow.id,
          linkType: 'standard',
          title: 'Daftar Newsletter Mingguan',
          url: 'https://example.com/newsletter',
          icon: 'book-open',
          thumbnailUrl:
            '/src/assets/images/thumb_newsletter_desk_1795280505174.jpg',
          position: 1,
          isActive: true,
          clicks: 0,
        },
        {
          userId: userRow.id,
          linkType: 'standard',
          title: 'Jadwalkan Diskusi / Kolaborasi',
          url: 'https://cal.com',
          icon: 'calendar',
          thumbnailUrl: '',
          position: 2,
          isActive: true,
          clicks: 0,
        },
      ]);
    }

    return userRow;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Pendaftaran akun baru')
    ) {
      throw error;
    }
    console.error('Database query failed (getOrCreateUser):', error);
    throw new Error('Gagal menyiapkan akun pengguna.', { cause: error });
  }
}

export async function getPublicProfileByUsername(username: string) {
  try {
    const clean = sanitizeUsername(username);
    if (!clean) return null;

    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.username, clean))
      .limit(1);

    const user = userRows[0];
    if (!user) return null;

    const userLinks = await db
      .select()
      .from(links)
      .where(eq(links.userId, user.id))
      .orderBy(asc(links.position), asc(links.id));

    return {
      ...user,
      hideBranding: isUserProActive(user) ? user.hideBranding : false,
      links: userLinks,
    };
  } catch (error) {
    console.error('Database query failed (getPublicProfileByUsername):', error);
    throw new Error('Gagal memuat halaman profil.', { cause: error });
  }
}

export async function getAdminWorkspaceByUid(uid: string) {
  try {
    const user = await getUserByUid(uid);
    if (!user) return null;

    const userLinks = await db
      .select()
      .from(links)
      .where(eq(links.userId, user.id))
      .orderBy(asc(links.position), asc(links.id));

    const userSubscribers = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.userId, user.id))
      .orderBy(desc(subscribers.createdAt));

    const userInquiries = await db
      .select()
      .from(inquiries)
      .where(eq(inquiries.userId, user.id))
      .orderBy(desc(inquiries.createdAt));

    return {
      user,
      links: userLinks,
      subscribers: userSubscribers,
      inquiries: userInquiries,
    };
  } catch (error) {
    console.error('Database query failed (getAdminWorkspaceByUid):', error);
    throw new Error('Gagal memuat data studio.', { cause: error });
  }
}

export async function getFeaturedProfiles() {
  try {
    const rows = await db
      .select()
      .from(users)
      .where(and(eq(users.isSuspended, false), eq(users.isFeatured, true)))
      .orderBy(asc(users.featuredOrder), desc(users.profileViews), asc(users.id))
      .limit(8);

    const now = new Date();
    const profilesWithLinks = await Promise.all(
      rows.map(async (user) => {
        const activeLinks = await db
          .select()
          .from(links)
          .where(and(eq(links.userId, user.id), eq(links.isActive, true)))
          .orderBy(asc(links.position), asc(links.id));
        return {
          ...user,
          links: activeLinks
            .filter((l) => isLinkScheduledActive(l, now))
            .map(toPublicLinkDTO),
        };
      })
    );

    return profilesWithLinks;
  } catch (error) {
    console.error('Database query failed (getFeaturedProfiles):', error);
    throw new Error('Gagal memuat profil unggulan.', { cause: error });
  }
}

export async function getAllUsernamesForSitemap(): Promise<
  Array<{ username: string; updatedAt: Date }>
> {
  try {
    return await db
      .select({
        username: users.username,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.isSuspended, false))
      .orderBy(desc(users.updatedAt));
  } catch (error) {
    console.error('Database query failed (getAllUsernamesForSitemap):', error);
    throw new Error('Gagal memuat daftar sitemap.', { cause: error });
  }
}

const BUILTIN_RESERVED_USERNAMES = new Set([
  'api',
  'dashboard',
  'admin',
  'login',
  'masuk',
  'register',
  'daftar',
  'sitemap.xml',
  'robots.txt',
  'assets',
  'src',
]);

export async function getOrCreatePlatformSettings(): Promise<PlatformSettingsDTO> {
  try {
    const existing = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, 'global'))
      .limit(1);

    if (existing[0]) {
      return {
        announcementEnabled: existing[0].announcementEnabled,
        announcementTitle: existing[0].announcementTitle,
        announcementMessage: existing[0].announcementMessage,
        announcementType: existing[0].announcementType,
        reservedUsernames: Array.isArray(existing[0].reservedUsernames)
          ? existing[0].reservedUsernames
          : [],
        maintenanceMode: Boolean(existing[0].maintenanceMode),
        maintenanceMessage:
          existing[0].maintenanceMessage ||
          'Platform sedang dalam pemeliharaan terjadwal. Silakan kembali beberapa saat lagi.',
        registrationOpen:
          existing[0].registrationOpen !== undefined
            ? Boolean(existing[0].registrationOpen)
            : true,
        freeLinkLimit:
          Number(existing[0].freeLinkLimit) > 0
            ? Number(existing[0].freeLinkLimit)
            : 8,
        blockedDomains: Array.isArray(existing[0].blockedDomains)
          ? existing[0].blockedDomains
          : [],
        updatedBy: existing[0].updatedBy,
        updatedAt: existing[0].updatedAt,
      };
    }

    const inserted = await db
      .insert(platformSettings)
      .values({
        key: 'global',
        announcementEnabled: false,
        announcementTitle: '',
        announcementMessage: '',
        announcementType: 'info',
        reservedUsernames: [
          'official',
          'cs',
          'support',
          'help',
          'bri',
          'bca',
          'dana',
          'ovo',
          'gopay',
          'lokabio',
        ],
        maintenanceMode: false,
        maintenanceMessage:
          'Platform sedang dalam pemeliharaan terjadwal. Silakan kembali beberapa saat lagi.',
        registrationOpen: true,
        freeLinkLimit: 8,
        blockedDomains: ['slotgacor', 'judionline', 'togelonline'],
        updatedBy: 'system',
      })
      .onConflictDoNothing({ target: platformSettings.key })
      .returning();

    const row =
      inserted[0] ??
      (
        await db
          .select()
          .from(platformSettings)
          .where(eq(platformSettings.key, 'global'))
          .limit(1)
      )[0];

    return {
      announcementEnabled: row?.announcementEnabled ?? false,
      announcementTitle: row?.announcementTitle ?? '',
      announcementMessage: row?.announcementMessage ?? '',
      announcementType: row?.announcementType ?? 'info',
      reservedUsernames: Array.isArray(row?.reservedUsernames)
        ? row.reservedUsernames
        : [],
      maintenanceMode: Boolean(row?.maintenanceMode),
      maintenanceMessage:
        row?.maintenanceMessage ||
        'Platform sedang dalam pemeliharaan terjadwal. Silakan kembali beberapa saat lagi.',
      registrationOpen:
        row?.registrationOpen !== undefined ? Boolean(row.registrationOpen) : true,
      freeLinkLimit: Number(row?.freeLinkLimit) > 0 ? Number(row?.freeLinkLimit) : 8,
      blockedDomains: Array.isArray(row?.blockedDomains)
        ? row.blockedDomains
        : [],
      updatedBy: row?.updatedBy ?? '',
      updatedAt: row?.updatedAt,
    };
  } catch (error) {
    console.error('Database query failed (getOrCreatePlatformSettings):', error);
    return {
      announcementEnabled: false,
      announcementTitle: '',
      announcementMessage: '',
      announcementType: 'info',
      reservedUsernames: [],
      maintenanceMode: false,
      maintenanceMessage:
        'Platform sedang dalam pemeliharaan terjadwal. Silakan kembali beberapa saat lagi.',
      registrationOpen: true,
      freeLinkLimit: 8,
      blockedDomains: [],
    };
  }
}

export async function getPublicPlatformStatus(): Promise<PublicPlatformStatusDTO> {
  const settings = await getOrCreatePlatformSettings();
  return {
    maintenanceMode: settings.maintenanceMode,
    maintenanceMessage: settings.maintenanceMessage,
    registrationOpen: settings.registrationOpen,
    freeLinkLimit: settings.freeLinkLimit,
  };
}

export async function isUsernameAvailable(
  username: string,
  excludeUid?: string
): Promise<{ valid: boolean; available: boolean; normalized: string }> {
  try {
    const normalized = sanitizeUsername(username);
    const settings = await getOrCreatePlatformSettings();
    const customReserved = new Set(
      (settings.reservedUsernames || []).map((w) => sanitizeUsername(w)).filter(Boolean)
    );
    if (
      normalized.length < 3 ||
      BUILTIN_RESERVED_USERNAMES.has(normalized) ||
      customReserved.has(normalized)
    ) {
      return { valid: false, available: false, normalized };
    }

    const existing = excludeUid
      ? await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.username, normalized), ne(users.uid, excludeUid)))
          .limit(1)
      : await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.username, normalized))
          .limit(1);

    return {
      valid: true,
      available: !existing[0],
      normalized,
    };
  } catch (error) {
    console.error('Database query failed (isUsernameAvailable):', error);
    throw new Error('Gagal memeriksa ketersediaan username.', { cause: error });
  }
}

export interface UpdateProfileInput {
  username?: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  coverUrl?: string;
  isVerified?: boolean;
  themePreset?: string;
  bgType?: string;
  bgColor?: string;
  bgGradient?: string;
  bgImageUrl?: string;
  bgBlur?: number;
  bgOverlayOpacity?: number;
  buttonColor?: string;
  buttonTextColor?: string;
  buttonShape?: string;
  textColor?: string;
  fontFamily?: string;
  socialPosition?: string;
  socialLinks?: SocialLinkItem[];
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
  newsletterEnabled?: boolean;
  newsletterHeading?: string;
  newsletterPlaceholder?: string;
  inquiryEnabled?: boolean;
  inquiryHeading?: string;
  seoTitle?: string;
  seoDescription?: string;
  utmEnabled?: boolean;
  hideBranding?: boolean;
}

export async function updateUserProfile(
  uid: string,
  input: UpdateProfileInput
): Promise<UserRecord> {
  try {
    const currentUser = await getUserByUid(uid);
    if (!currentUser) {
      throw new Error('Pengguna tidak ditemukan.');
    }
    if (currentUser.isSuspended) {
      throw new Error('Akun Anda sedang dinonaktifkan sementara oleh administrator.');
    }

    const settings = await getOrCreatePlatformSettings();

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      lastActiveAt: new Date(),
    };

    if (input.username !== undefined) {
      const check = await isUsernameAvailable(input.username, uid);
      if (!check.valid) {
        throw new Error(
          'Username harus minimal 3 karakter (huruf kecil, angka, tanda hubung, atau garis bawah).'
        );
      }
      if (!check.available) {
        throw new Error('Username sudah digunakan oleh pengguna lain.');
      }
      updateData.username = check.normalized;
    }

    if (input.displayName !== undefined) {
      updateData.displayName = input.displayName.trim().slice(0, 80) || 'Kreator';
    }
    if (input.bio !== undefined) {
      updateData.bio = input.bio.trim().slice(0, 280);
    }
    if (input.avatarUrl !== undefined) {
      updateData.avatarUrl = input.avatarUrl.trim();
    }
    if (input.coverUrl !== undefined) {
      updateData.coverUrl = input.coverUrl.trim();
    }
    // Hanya Super Admin yang bisa mengubah isVerified/role/isSuspended/isFeatured melalui panel /admin.
    if (input.themePreset !== undefined) {
      updateData.themePreset = input.themePreset;
    }
    if (input.bgType !== undefined) {
      updateData.bgType = ['solid', 'gradient', 'image'].includes(input.bgType)
        ? input.bgType
        : 'solid';
    }
    if (input.bgColor !== undefined) {
      updateData.bgColor = input.bgColor;
    }
    if (input.bgGradient !== undefined) {
      updateData.bgGradient = input.bgGradient;
    }
    if (input.bgImageUrl !== undefined) {
      updateData.bgImageUrl = input.bgImageUrl.trim();
    }
    if (input.bgBlur !== undefined) {
      const blur = Math.max(0, Math.min(20, Number(input.bgBlur) || 0));
      updateData.bgBlur = blur;
    }
    if (input.bgOverlayOpacity !== undefined) {
      const opacity = Math.max(0, Math.min(85, Number(input.bgOverlayOpacity) || 0));
      updateData.bgOverlayOpacity = opacity;
    }
    if (input.buttonColor !== undefined) {
      updateData.buttonColor = input.buttonColor;
    }
    if (input.buttonTextColor !== undefined) {
      updateData.buttonTextColor = input.buttonTextColor;
    }
    if (input.buttonShape !== undefined) {
      updateData.buttonShape = ['square', 'rounded', 'pill'].includes(
        input.buttonShape
      )
        ? input.buttonShape
        : 'rounded';
    }
    if (input.textColor !== undefined) {
      updateData.textColor = input.textColor;
    }
    if (input.fontFamily !== undefined) {
      updateData.fontFamily = ['sans', 'serif', 'mono'].includes(
        input.fontFamily
      )
        ? input.fontFamily
        : 'sans';
    }
    if (input.socialPosition !== undefined) {
      updateData.socialPosition =
        input.socialPosition === 'bottom' ? 'bottom' : 'top';
    }
    if (input.socialLinks !== undefined) {
      const sanitizedSocials = input.socialLinks
        .filter((s) => s && s.platform && s.url.trim())
        .map((s) => ({
          platform: s.platform,
          url: normalizeUrl(s.url),
        }));
      for (const s of sanitizedSocials) {
        const matched = findBlockedDomainMatch(s.url, settings.blockedDomains);
        if (matched) {
          throw new Error(
            `Tautan media sosial ditolak oleh filter keamanan (terdeteksi: "${matched}").`
          );
        }
      }
      updateData.socialLinks = sanitizedSocials;
    }
    if (input.announcementEnabled !== undefined) {
      updateData.announcementEnabled = Boolean(input.announcementEnabled);
    }
    if (input.announcementText !== undefined) {
      updateData.announcementText = input.announcementText.trim().slice(0, 140);
    }
    if (input.announcementUrl !== undefined) {
      const normalizedAnnUrl = input.announcementUrl.trim()
        ? normalizeUrl(input.announcementUrl)
        : '';
      if (normalizedAnnUrl) {
        const matched = findBlockedDomainMatch(
          normalizedAnnUrl,
          settings.blockedDomains
        );
        if (matched) {
          throw new Error(
            `URL pengumuman ditolak oleh filter keamanan (terdeteksi: "${matched}").`
          );
        }
      }
      updateData.announcementUrl = normalizedAnnUrl;
    }
    if (input.whatsappNumber !== undefined) {
      updateData.whatsappNumber = input.whatsappNumber
        .replace(/[^0-9+]/g, '')
        .slice(0, 20);
    }
    if (input.whatsappMessage !== undefined) {
      updateData.whatsappMessage =
        input.whatsappMessage.trim().slice(0, 200) ||
        'Halo, saya melihat profil Anda di LokaBio.';
    }
    if (input.contactEmail !== undefined) {
      updateData.contactEmail = input.contactEmail.trim().slice(0, 120);
    }
    if (input.vcardEnabled !== undefined) {
      updateData.vcardEnabled = Boolean(input.vcardEnabled);
    }
    if (input.qrisEnabled !== undefined) {
      updateData.qrisEnabled = Boolean(input.qrisEnabled);
    }
    if (input.qrisTitle !== undefined) {
      updateData.qrisTitle =
        input.qrisTitle.trim().slice(0, 80) || 'Dukung & Bayar via QRIS';
    }
    if (input.qrisImageUrl !== undefined) {
      updateData.qrisImageUrl = input.qrisImageUrl.trim();
    }
    if (input.qrisNote !== undefined) {
      updateData.qrisNote =
        input.qrisNote.trim().slice(0, 180) ||
        'Scan kode QRIS melalui aplikasi e-wallet atau mobile banking Anda.';
    }
    if (input.newsletterEnabled !== undefined) {
      updateData.newsletterEnabled = Boolean(input.newsletterEnabled);
    }
    if (input.newsletterHeading !== undefined) {
      updateData.newsletterHeading =
        input.newsletterHeading.trim().slice(0, 100) ||
        'Dapatkan Catatan & Karya Terbaru';
    }
    if (input.newsletterPlaceholder !== undefined) {
      updateData.newsletterPlaceholder =
        input.newsletterPlaceholder.trim().slice(0, 80) ||
        'Masukkan alamat email Anda...';
    }
    if (input.inquiryEnabled !== undefined) {
      updateData.inquiryEnabled = Boolean(input.inquiryEnabled);
    }
    if (input.inquiryHeading !== undefined) {
      updateData.inquiryHeading =
        input.inquiryHeading.trim().slice(0, 100) ||
        'Kirim Pesan / Kerja Sama';
    }
    if (input.seoTitle !== undefined) {
      updateData.seoTitle = input.seoTitle.trim().slice(0, 120);
    }
    if (input.seoDescription !== undefined) {
      updateData.seoDescription = input.seoDescription.trim().slice(0, 300);
    }
    if (input.utmEnabled !== undefined) {
      updateData.utmEnabled = Boolean(input.utmEnabled);
    }
    if (input.hideBranding !== undefined) {
      if (input.hideBranding && !isUserProActive(currentUser)) {
        throw new Error(
          'Fitur sembunyikan branding LokaBio hanya tersedia untuk akun Pro.'
        );
      }
      updateData.hideBranding = Boolean(input.hideBranding);
    }

    const updated = await db
      .update(users)
      .set(updateData)
      .where(eq(users.uid, uid))
      .returning();

    if (!updated[0]) {
      throw new Error('Profil pengguna tidak ditemukan.');
    }

    return updated[0];
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('Username') ||
        error.message.includes('tidak ditemukan') ||
        error.message.includes('filter keamanan') ||
        error.message.includes('akun Pro'))
    ) {
      throw error;
    }
    console.error('Database query failed (updateUserProfile):', error);
    throw new Error('Gagal menyimpan perubahan profil.', { cause: error });
  }
}

export async function dismissUserAdminWarning(uid: string): Promise<void> {
  try {
    await db
      .update(users)
      .set({ adminWarning: '', adminWarningAt: null, lastActiveAt: new Date() })
      .where(eq(users.uid, uid));
  } catch (error) {
    console.error('Database query failed (dismissUserAdminWarning):', error);
    throw new Error('Gagal menutup peringatan admin.', { cause: error });
  }
}

export async function incrementProfileViews(
  username: string,
  meta?: { referrer?: string; device?: string }
): Promise<number> {
  try {
    const clean = sanitizeUsername(username);
    if (!clean) return 0;

    const updated = await db
      .update(users)
      .set({
        profileViews: sql`${users.profileViews} + 1`,
      })
      .where(eq(users.username, clean))
      .returning({
        id: users.id,
        profileViews: users.profileViews,
      });

    if (updated[0]) {
      await db.insert(clickEvents).values({
        userId: updated[0].id,
        linkId: null,
        eventType: 'view',
        referrer: normalizeReferrerSource(meta?.referrer || ''),
        device: meta?.device === 'Mobile' ? 'Mobile' : 'Desktop',
      });
    }

    return updated[0]?.profileViews ?? 0;
  } catch (error) {
    console.error('Database query failed (incrementProfileViews):', error);
    throw new Error('Gagal mencatat kunjungan profil.', { cause: error });
  }
}

function parseOptionalDate(val: unknown): Date | null | undefined {
  if (val === undefined) return undefined;
  if (val === null || val === '') return null;
  const parsed = new Date(String(val));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function createUserLink(
  uid: string,
  input: {
    linkType?: string;
    title: string;
    subtitle?: string;
    url?: string;
    icon?: string;
    thumbnailUrl?: string;
    priceText?: string;
    badgeText?: string;
    category?: string;
    galleryUrls?: string[];
    pinCode?: string;
    publishAt?: string | null;
    expireAt?: string | null;
    isActive?: boolean;
  }
) {
  try {
    const user = await getUserByUid(uid);
    if (!user) throw new Error('Pengguna tidak ditemukan.');

    const settings = await getOrCreatePlatformSettings();

    const currentLinks = await db
      .select({ id: links.id, position: links.position })
      .from(links)
      .where(eq(links.userId, user.id))
      .orderBy(desc(links.position));

    if (
      !isUserProActive(user) &&
      settings.freeLinkLimit > 0 &&
      currentLinks.length >= settings.freeLinkLimit
    ) {
      throw new Error(
        `Batas maksimal akun Free (${settings.freeLinkLimit} tautan) telah tercapai. Hapus tautan lama atau upgrade ke Pro.`
      );
    }

    const nextPosition =
      currentLinks[0] !== undefined ? currentLinks[0].position + 1 : 0;

    const allowedTypes = [
      'standard',
      'header',
      'featured',
      'embed',
      'product',
      'gallery',
    ];
    const linkType = allowedTypes.includes(input.linkType || '')
      ? String(input.linkType)
      : 'standard';

    const cleanPin = (input.pinCode || '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 8);
    const cleanGallery = Array.isArray(input.galleryUrls)
      ? input.galleryUrls
          .map((u) => String(u).trim())
          .filter(Boolean)
          .slice(0, 6)
      : [];

    const noUrlRequired = linkType === 'header' || linkType === 'gallery';
    const finalUrl = noUrlRequired
      ? input.url?.trim()
        ? normalizeUrl(input.url)
        : ''
      : normalizeUrl(input.url || '');

    if (finalUrl) {
      const matched = findBlockedDomainMatch(finalUrl, settings.blockedDomains);
      if (matched) {
        throw new Error(
          `URL ditolak oleh filter keamanan platform (terdeteksi domain/kata terlarang: "${matched}").`
        );
      }
    }

    const inserted = await db
      .insert(links)
      .values({
        userId: user.id,
        linkType,
        title: input.title.trim().slice(0, 120),
        subtitle: (input.subtitle || '').trim().slice(0, 180),
        url: finalUrl,
        icon: input.icon?.trim() || 'link',
        thumbnailUrl: input.thumbnailUrl?.trim() || '',
        priceText: (input.priceText || '').trim().slice(0, 40),
        badgeText: (input.badgeText || '').trim().slice(0, 32),
        category: (input.category || '').trim().slice(0, 32),
        galleryUrls: cleanGallery,
        pinCode: noUrlRequired ? '' : cleanPin,
        publishAt: parseOptionalDate(input.publishAt) ?? null,
        expireAt: parseOptionalDate(input.expireAt) ?? null,
        position: nextPosition,
        isActive: input.isActive !== undefined ? Boolean(input.isActive) : true,
        clicks: 0,
      })
      .returning();

    await db
      .update(users)
      .set({ lastActiveAt: new Date() })
      .where(eq(users.id, user.id));

    return inserted[0];
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('Batas maksimal') ||
        error.message.includes('filter keamanan'))
    ) {
      throw error;
    }
    console.error('Database query failed (createUserLink):', error);
    throw new Error('Gagal menambahkan tautan baru.', { cause: error });
  }
}

export async function updateUserLink(
  uid: string,
  linkId: number,
  input: {
    linkType?: string;
    title?: string;
    subtitle?: string;
    url?: string;
    icon?: string;
    thumbnailUrl?: string;
    priceText?: string;
    badgeText?: string;
    category?: string;
    galleryUrls?: string[];
    pinCode?: string;
    publishAt?: string | null;
    expireAt?: string | null;
    isActive?: boolean;
  }
) {
  try {
    const user = await getUserByUid(uid);
    if (!user) throw new Error('Pengguna tidak ditemukan.');

    const settings = await getOrCreatePlatformSettings();

    const allowedTypes = [
      'standard',
      'header',
      'featured',
      'embed',
      'product',
      'gallery',
    ];
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (input.linkType !== undefined && allowedTypes.includes(input.linkType)) {
      updateData.linkType = input.linkType;
    }
    if (input.title !== undefined) {
      updateData.title = input.title.trim().slice(0, 120);
    }
    if (input.subtitle !== undefined) {
      updateData.subtitle = input.subtitle.trim().slice(0, 180);
    }
    if (input.url !== undefined) {
      const normalized = input.url.trim() ? normalizeUrl(input.url) : '';
      if (normalized) {
        const matched = findBlockedDomainMatch(normalized, settings.blockedDomains);
        if (matched) {
          throw new Error(
            `URL ditolak oleh filter keamanan platform (terdeteksi domain/kata terlarang: "${matched}").`
          );
        }
      }
      updateData.url = normalized;
    }
    if (input.icon !== undefined) {
      updateData.icon = input.icon.trim() || 'link';
    }
    if (input.thumbnailUrl !== undefined) {
      updateData.thumbnailUrl = input.thumbnailUrl.trim();
    }
    if (input.priceText !== undefined) {
      updateData.priceText = input.priceText.trim().slice(0, 40);
    }
    if (input.badgeText !== undefined) {
      updateData.badgeText = input.badgeText.trim().slice(0, 32);
    }
    if (input.category !== undefined) {
      updateData.category = input.category.trim().slice(0, 32);
    }
    if (input.galleryUrls !== undefined) {
      updateData.galleryUrls = Array.isArray(input.galleryUrls)
        ? input.galleryUrls
            .map((u) => String(u).trim())
            .filter(Boolean)
            .slice(0, 6)
        : [];
    }
    if (input.pinCode !== undefined) {
      updateData.pinCode = input.pinCode
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 8);
    }
    if (input.publishAt !== undefined) {
      updateData.publishAt = parseOptionalDate(input.publishAt);
    }
    if (input.expireAt !== undefined) {
      updateData.expireAt = parseOptionalDate(input.expireAt);
    }
    if (input.isActive !== undefined) {
      updateData.isActive = Boolean(input.isActive);
    }

    const updated = await db
      .update(links)
      .set(updateData)
      .where(and(eq(links.id, linkId), eq(links.userId, user.id)))
      .returning();

    if (!updated[0]) {
      throw new Error('Tautan tidak ditemukan.');
    }

    await db
      .update(users)
      .set({ lastActiveAt: new Date() })
      .where(eq(users.id, user.id));

    return updated[0];
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('filter keamanan') ||
        error.message.includes('tidak ditemukan'))
    ) {
      throw error;
    }
    console.error('Database query failed (updateUserLink):', error);
    throw new Error('Gagal memperbarui tautan.', { cause: error });
  }
}

export async function duplicateUserLink(uid: string, linkId: number) {
  try {
    const user = await getUserByUid(uid);
    if (!user) throw new Error('Pengguna tidak ditemukan.');

    const settings = await getOrCreatePlatformSettings();

    const allUserLinks = await db
      .select({ id: links.id, position: links.position })
      .from(links)
      .where(eq(links.userId, user.id))
      .orderBy(desc(links.position));

    if (
      !isUserProActive(user) &&
      settings.freeLinkLimit > 0 &&
      allUserLinks.length >= settings.freeLinkLimit
    ) {
      throw new Error(
        `Batas maksimal akun Free (${settings.freeLinkLimit} tautan) telah tercapai. Hapus tautan lama atau upgrade ke Pro.`
      );
    }

    const existing = await db
      .select()
      .from(links)
      .where(and(eq(links.id, linkId), eq(links.userId, user.id)))
      .limit(1);

    const src = existing[0];
    if (!src) throw new Error('Tautan tidak ditemukan.');

    const nextPosition =
      allUserLinks[0] !== undefined ? allUserLinks[0].position + 1 : 0;

    const inserted = await db
      .insert(links)
      .values({
        userId: user.id,
        linkType: src.linkType,
        title: `${src.title.slice(0, 105)} (Salinan)`,
        subtitle: src.subtitle,
        url: src.url,
        icon: src.icon,
        thumbnailUrl: src.thumbnailUrl,
        priceText: src.priceText,
        badgeText: src.badgeText,
        category: src.category,
        galleryUrls: src.galleryUrls,
        pinCode: src.pinCode,
        publishAt: src.publishAt,
        expireAt: src.expireAt,
        position: nextPosition,
        isActive: src.isActive,
        clicks: 0,
      })
      .returning();

    return inserted[0];
  } catch (error) {
    if (error instanceof Error && error.message.includes('Batas maksimal')) {
      throw error;
    }
    console.error('Database query failed (duplicateUserLink):', error);
    throw new Error('Gagal menggandakan tautan.', { cause: error });
  }
}

export async function deleteUserLink(uid: string, linkId: number) {
  try {
    const user = await getUserByUid(uid);
    if (!user) throw new Error('Pengguna tidak ditemukan.');

    const deleted = await db
      .delete(links)
      .where(and(eq(links.id, linkId), eq(links.userId, user.id)))
      .returning();

    if (!deleted[0]) {
      throw new Error('Tautan tidak ditemukan.');
    }

    return deleted[0];
  } catch (error) {
    console.error('Database query failed (deleteUserLink):', error);
    throw new Error('Gagal menghapus tautan.', { cause: error });
  }
}

export async function reorderUserLinks(uid: string, orderedIds: number[]) {
  try {
    const user = await getUserByUid(uid);
    if (!user) throw new Error('Pengguna tidak ditemukan.');

    await db.transaction(async (tx) => {
      for (let idx = 0; idx < orderedIds.length; idx++) {
        const id = orderedIds[idx];
        await tx
          .update(links)
          .set({ position: idx, updatedAt: new Date() })
          .where(and(eq(links.id, id), eq(links.userId, user.id)));
      }
    });

    return await db
      .select()
      .from(links)
      .where(eq(links.userId, user.id))
      .orderBy(asc(links.position), asc(links.id));
  } catch (error) {
    console.error('Database query failed (reorderUserLinks):', error);
    throw new Error('Gagal memperbarui urutan tautan.', { cause: error });
  }
}

export async function incrementLinkClick(
  linkId: number,
  meta?: { referrer?: string; device?: string }
) {
  try {
    const updated = await db
      .update(links)
      .set({
        clicks: sql`${links.clicks} + 1`,
      })
      .where(eq(links.id, linkId))
      .returning({
        id: links.id,
        userId: links.userId,
        clicks: links.clicks,
        url: links.url,
        pinCode: links.pinCode,
      });

    const row = updated[0];
    if (!row) return null;

    await db.insert(clickEvents).values({
      userId: row.userId,
      linkId: row.id,
      eventType: 'click',
      referrer: normalizeReferrerSource(meta?.referrer || ''),
      device: meta?.device === 'Mobile' ? 'Mobile' : 'Desktop',
    });

    return {
      id: row.id,
      clicks: row.clicks,
      url: row.pinCode ? '' : row.url,
    };
  } catch (error) {
    console.error('Database query failed (incrementLinkClick):', error);
    throw new Error('Gagal mencatat klik tautan.', { cause: error });
  }
}

export async function unlockPinProtectedLink(
  linkId: number,
  pin: string,
  meta?: { referrer?: string; device?: string }
): Promise<{ unlocked: boolean; url?: string; error?: string }> {
  try {
    const rows = await db
      .select()
      .from(links)
      .where(eq(links.id, linkId))
      .limit(1);

    const link = rows[0];
    if (!link) {
      return { unlocked: false, error: 'Tautan tidak ditemukan.' };
    }

    if (link.pinCode && link.pinCode.trim() !== pin.trim()) {
      return { unlocked: false, error: 'Kode PIN salah. Silakan coba lagi.' };
    }

    await db
      .update(links)
      .set({ clicks: sql`${links.clicks} + 1` })
      .where(eq(links.id, linkId));

    await db.insert(clickEvents).values({
      userId: link.userId,
      linkId: link.id,
      eventType: 'click',
      referrer: normalizeReferrerSource(meta?.referrer || ''),
      device: meta?.device === 'Mobile' ? 'Mobile' : 'Desktop',
    });

    return { unlocked: true, url: link.url };
  } catch (error) {
    console.error('Database query failed (unlockPinProtectedLink):', error);
    throw new Error('Gagal memverifikasi PIN tautan.', { cause: error });
  }
}

export async function getUserAnalyticsSummary(
  uid: string,
  days = 7
): Promise<AnalyticsSummaryDTO> {
  try {
    const user = await getUserByUid(uid);
    if (!user) throw new Error('Pengguna tidak ditemukan.');

    const safeDays = days === 30 ? 30 : 7;
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (safeDays - 1));

    const events = await db
      .select()
      .from(clickEvents)
      .where(
        and(eq(clickEvents.userId, user.id), gte(clickEvents.createdAt, since))
      );

    const dailyMap = new Map<string, { views: number; clicks: number }>();
    for (let i = 0; i < safeDays; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyMap.set(key, { views: 0, clicks: 0 });
    }

    const referrerMap = new Map<string, number>();
    const deviceMap = new Map<string, number>();

    for (const ev of events) {
      const dayKey = new Date(ev.createdAt).toISOString().slice(0, 10);
      const bucket = dailyMap.get(dayKey);
      if (bucket) {
        if (ev.eventType === 'view') bucket.views += 1;
        if (ev.eventType === 'click') bucket.clicks += 1;
      }

      const ref = ev.referrer || 'Direct';
      referrerMap.set(ref, (referrerMap.get(ref) || 0) + 1);

      const dev = ev.device || 'Desktop';
      deviceMap.set(dev, (deviceMap.get(dev) || 0) + 1);
    }

    return {
      days: safeDays,
      dailySeries: Array.from(dailyMap.entries()).map(([date, vals]) => ({
        date,
        views: vals.views,
        clicks: vals.clicks,
      })),
      referrers: Array.from(referrerMap.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
      devices: Array.from(deviceMap.entries())
        .map(([device, count]) => ({ device, count }))
        .sort((a, b) => b.count - a.count),
    };
  } catch (error) {
    console.error('Database query failed (getUserAnalyticsSummary):', error);
    throw new Error('Gagal memuat ringkasan analitik.', { cause: error });
  }
}

export async function subscribeToProfile(
  username: string,
  email: string,
  name = ''
): Promise<{ alreadySubscribed: boolean }> {
  try {
    const cleanUsername = sanitizeUsername(username);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Format alamat email tidak valid.');
    }

    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.username, cleanUsername))
      .limit(1);

    const user = userRows[0];
    if (!user || !user.newsletterEnabled) {
      throw new Error('Formulir langganan tidak tersedia untuk profil ini.');
    }

    const existing = await db
      .select({ id: subscribers.id })
      .from(subscribers)
      .where(
        and(eq(subscribers.userId, user.id), eq(subscribers.email, cleanEmail))
      )
      .limit(1);

    if (existing[0]) {
      return { alreadySubscribed: true };
    }

    await db.insert(subscribers).values({
      userId: user.id,
      email: cleanEmail.slice(0, 160),
      name: name.trim().slice(0, 100),
    });

    return { alreadySubscribed: false };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('email') || error.message.includes('Formulir'))
    ) {
      throw error;
    }
    console.error('Database query failed (subscribeToProfile):', error);
    throw new Error('Gagal mendaftarkan email.', { cause: error });
  }
}

export async function deleteUserSubscriber(uid: string, subscriberId: number) {
  try {
    const user = await getUserByUid(uid);
    if (!user) throw new Error('Pengguna tidak ditemukan.');

    const deleted = await db
      .delete(subscribers)
      .where(
        and(eq(subscribers.id, subscriberId), eq(subscribers.userId, user.id))
      )
      .returning();

    return deleted[0] ?? null;
  } catch (error) {
    console.error('Database query failed (deleteUserSubscriber):', error);
    throw new Error('Gagal menghapus subscriber.', { cause: error });
  }
}

export async function submitProfileInquiry(
  username: string,
  senderName: string,
  senderContact: string,
  message: string
) {
  try {
    const cleanUsername = sanitizeUsername(username);
    const cleanName = senderName.trim().slice(0, 100);
    const cleanContact = senderContact.trim().slice(0, 140);
    const cleanMsg = message.trim().slice(0, 1000);

    if (!cleanName) throw new Error('Nama pengirim wajib diisi.');
    if (!cleanContact) throw new Error('Email atau nomor WhatsApp wajib diisi.');
    if (!cleanMsg || cleanMsg.length < 5) {
      throw new Error('Pesan minimal 5 karakter.');
    }

    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.username, cleanUsername))
      .limit(1);

    const user = userRows[0];
    if (!user || !user.inquiryEnabled) {
      throw new Error('Formulir pesan tidak tersedia untuk profil ini.');
    }

    const inserted = await db
      .insert(inquiries)
      .values({
        userId: user.id,
        senderName: cleanName,
        senderContact: cleanContact,
        message: cleanMsg,
        isRead: false,
      })
      .returning();

    return inserted[0];
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('wajib') ||
        error.message.includes('minimal') ||
        error.message.includes('Formulir'))
    ) {
      throw error;
    }
    console.error('Database query failed (submitProfileInquiry):', error);
    throw new Error('Gagal mengirim pesan.', { cause: error });
  }
}

export async function markUserInquiryRead(
  uid: string,
  inquiryId: number,
  isRead: boolean
) {
  try {
    const user = await getUserByUid(uid);
    if (!user) throw new Error('Pengguna tidak ditemukan.');

    const updated = await db
      .update(inquiries)
      .set({ isRead: Boolean(isRead) })
      .where(and(eq(inquiries.id, inquiryId), eq(inquiries.userId, user.id)))
      .returning();

    return updated[0] ?? null;
  } catch (error) {
    console.error('Database query failed (markUserInquiryRead):', error);
    throw new Error('Gagal memperbarui status pesan.', { cause: error });
  }
}

export async function deleteUserInquiry(uid: string, inquiryId: number) {
  try {
    const user = await getUserByUid(uid);
    if (!user) throw new Error('Pengguna tidak ditemukan.');

    const deleted = await db
      .delete(inquiries)
      .where(and(eq(inquiries.id, inquiryId), eq(inquiries.userId, user.id)))
      .returning();

    return deleted[0] ?? null;
  } catch (error) {
    console.error('Database query failed (deleteUserInquiry):', error);
    throw new Error('Gagal menghapus pesan.', { cause: error });
  }
}

// --- Creator Verification Request & Visitor Profile Reporting ---

export async function getUserLatestVerificationRequest(
  userId: number
): Promise<VerificationRequestDTO | null> {
  try {
    const rows = await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.userId, userId))
      .orderBy(desc(verificationRequests.createdAt))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error(
      'Database query failed (getUserLatestVerificationRequest):',
      error
    );
    return null;
  }
}

export async function submitVerificationRequest(
  uid: string,
  input: { category: string; proofUrl: string; note?: string }
): Promise<VerificationRequestDTO> {
  try {
    const user = await getUserByUid(uid);
    if (!user) throw new Error('Pengguna tidak ditemukan.');
    if (user.isSuspended) {
      throw new Error('Akun Anda sedang dinonaktifkan sementara.');
    }
    if (user.isVerified) {
      throw new Error('Akun Anda sudah terverifikasi centang biru.');
    }

    const existingPending = await db
      .select({ id: verificationRequests.id })
      .from(verificationRequests)
      .where(
        and(
          eq(verificationRequests.userId, user.id),
          eq(verificationRequests.status, 'pending')
        )
      )
      .limit(1);

    if (existingPending[0]) {
      throw new Error(
        'Pengajuan verifikasi Anda sebelumnya masih menunggu peninjauan Super Admin.'
      );
    }

    const cleanCategory = (input.category || '').trim().slice(0, 60);
    const cleanProof = normalizeUrl((input.proofUrl || '').trim()).slice(0, 300);
    const cleanNote = (input.note || '').trim().slice(0, 500);

    if (!cleanCategory) throw new Error('Kategori kreator/bisnis wajib dipilih.');
    if (!cleanProof || cleanProof.length < 8) {
      throw new Error('Tautan bukti media sosial/website resmi wajib diisi.');
    }

    const inserted = await db
      .insert(verificationRequests)
      .values({
        userId: user.id,
        username: user.username,
        category: cleanCategory,
        proofUrl: cleanProof,
        note: cleanNote,
        status: 'pending',
      })
      .returning();

    return inserted[0];
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('wajib') ||
        error.message.includes('sudah') ||
        error.message.includes('menunggu') ||
        error.message.includes('dinonaktifkan'))
    ) {
      throw error;
    }
    console.error('Database query failed (submitVerificationRequest):', error);
    throw new Error('Gagal mengirim pengajuan verifikasi.', { cause: error });
  }
}

export async function submitProfileReport(
  username: string,
  input: { reason: string; details?: string; reporterEmail?: string }
): Promise<ProfileReportDTO> {
  try {
    const cleanUsername = sanitizeUsername(username);
    const reason = (input.reason || '').trim().slice(0, 80);
    const details = (input.details || '').trim().slice(0, 800);
    const reporterEmail = (input.reporterEmail || '').trim().slice(0, 120);

    if (!reason) throw new Error('Alasan laporan wajib dipilih.');

    const targetRows = await db
      .select()
      .from(users)
      .where(eq(users.username, cleanUsername))
      .limit(1);

    const target = targetRows[0];
    if (!target) {
      throw new Error('Profil yang dilaporkan tidak ditemukan.');
    }

    const inserted = await db
      .insert(profileReports)
      .values({
        reportedUserId: target.id,
        reportedUsername: target.username,
        reporterEmail,
        reason,
        details,
        status: 'pending',
      })
      .returning();

    return inserted[0];
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('wajib') ||
        error.message.includes('tidak ditemukan'))
    ) {
      throw error;
    }
    console.error('Database query failed (submitProfileReport):', error);
    throw new Error('Gagal mengirim laporan profil.', { cause: error });
  }
}

// --- Super Admin Platform Management & Audit Queries ---

async function recordAdminAuditLog(params: {
  actingAdminUid: string;
  actingAdminEmail: string;
  action: string;
  targetUsername?: string;
  details: string;
}) {
  try {
    const adminRow = await getUserByUid(params.actingAdminUid);
    await db.insert(adminAuditLogs).values({
      adminUserId: adminRow?.id ?? null,
      adminEmail: params.actingAdminEmail || adminRow?.email || 'admin',
      action: params.action,
      targetUsername: params.targetUsername || '',
      details: params.details.slice(0, 500),
    });
  } catch (error) {
    console.error('Failed to write admin audit log:', error);
  }
}

export async function getPlatformAdminOverview(search?: string): Promise<{
  stats: PlatformStatsDTO;
  users: AdminUserSummaryDTO[];
  settings: PlatformSettingsDTO;
}> {
  try {
    const [allUsers, allLinks, allSubscribers, allInquiries, pendingRepRows, pendingVerRows, settings] =
      await Promise.all([
        db.select().from(users).orderBy(desc(users.createdAt), asc(users.id)),
        db.select({ userId: links.userId, clicks: links.clicks }).from(links),
        db.select({ userId: subscribers.userId }).from(subscribers),
        db.select({ userId: inquiries.userId }).from(inquiries),
        db
          .select({ id: profileReports.id })
          .from(profileReports)
          .where(eq(profileReports.status, 'pending')),
        db
          .select({ id: verificationRequests.id })
          .from(verificationRequests)
          .where(eq(verificationRequests.status, 'pending')),
        getOrCreatePlatformSettings(),
      ]);

    const linksByUser = new Map<number, { count: number; clicks: number }>();
    for (const row of allLinks) {
      const curr = linksByUser.get(row.userId) || { count: 0, clicks: 0 };
      curr.count += 1;
      curr.clicks += row.clicks || 0;
      linksByUser.set(row.userId, curr);
    }

    const subsByUser = new Map<number, number>();
    for (const row of allSubscribers) {
      subsByUser.set(row.userId, (subsByUser.get(row.userId) || 0) + 1);
    }

    const inqByUser = new Map<number, number>();
    for (const row of allInquiries) {
      inqByUser.set(row.userId, (inqByUser.get(row.userId) || 0) + 1);
    }

    const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const stats: PlatformStatsDTO = {
      totalUsers: allUsers.length,
      totalAdmins: allUsers.filter((u) => u.role === 'admin').length,
      totalProUsers: allUsers.filter((u) => isUserProActive(u)).length,
      totalVerified: allUsers.filter((u) => u.isVerified).length,
      totalSuspended: allUsers.filter((u) => u.isSuspended).length,
      dormantUsers: allUsers.filter(
        (u) => new Date(u.lastActiveAt).getTime() < thirtyDaysAgoMs
      ).length,
      totalLinks: allLinks.length,
      totalViews: allUsers.reduce((acc, u) => acc + (u.profileViews || 0), 0),
      totalClicks: allLinks.reduce((acc, l) => acc + (l.clicks || 0), 0),
      totalSubscribers: allSubscribers.length,
      totalInquiries: allInquiries.length,
      pendingReports: pendingRepRows.length,
      pendingVerifications: pendingVerRows.length,
    };

    const q = (search || '').trim().toLowerCase();
    const mapped: AdminUserSummaryDTO[] = allUsers
      .filter((u) => {
        if (!q) return true;
        return (
          u.username.toLowerCase().includes(q) ||
          u.displayName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        );
      })
      .map((u) => {
        const lStats = linksByUser.get(u.id) || { count: 0, clicks: 0 };
        return {
          id: u.id,
          uid: u.uid,
          email: u.email,
          username: u.username,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
          role: u.role,
          planTier: isUserProActive(u) ? 'pro' : 'free',
          planExpiresAt: u.planExpiresAt,
          hideBranding: Boolean(u.hideBranding),
          adminWarning: u.adminWarning || '',
          adminWarningAt: u.adminWarningAt,
          lastActiveAt: u.lastActiveAt || u.updatedAt || u.createdAt,
          isVerified: u.isVerified,
          isSuspended: u.isSuspended,
          isFeatured: u.isFeatured,
          featuredOrder: u.featuredOrder ?? 0,
          profileViews: u.profileViews,
          linkCount: lStats.count,
          totalClicks: lStats.clicks,
          subscriberCount: subsByUser.get(u.id) || 0,
          inquiryCount: inqByUser.get(u.id) || 0,
          createdAt: u.createdAt,
        };
      });

    return { stats, users: mapped, settings };
  } catch (error) {
    console.error('Database query failed (getPlatformAdminOverview):', error);
    throw new Error('Gagal memuat ringkasan Super Admin.', { cause: error });
  }
}

export async function getPlatformGlobalAnalytics(
  days = 14
): Promise<PlatformAnalyticsDTO> {
  try {
    const safeDays = Math.max(7, Math.min(30, Number(days) || 14));
    const sinceDate = new Date();
    sinceDate.setHours(0, 0, 0, 0);
    sinceDate.setDate(sinceDate.getDate() - (safeDays - 1));

    const [events, totalEventsRow, allUsers, allLinks] = await Promise.all([
      db
        .select()
        .from(clickEvents)
        .where(gte(clickEvents.createdAt, sinceDate)),
      db.select({ count: sql<number>`count(*)::int` }).from(clickEvents),
      db.select().from(users),
      db.select({ userId: links.userId, clicks: links.clicks }).from(links),
    ]);

    const dailyMap = new Map<string, { views: number; clicks: number }>();
    for (let i = 0; i < safeDays; i++) {
      const d = new Date(sinceDate);
      d.setDate(sinceDate.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyMap.set(key, { views: 0, clicks: 0 });
    }

    for (const ev of events) {
      const key = new Date(ev.createdAt).toISOString().slice(0, 10);
      const bucket = dailyMap.get(key);
      if (bucket) {
        if (ev.eventType === 'view') bucket.views += 1;
        if (ev.eventType === 'click') bucket.clicks += 1;
      }
    }

    const dailySeries = Array.from(dailyMap.entries()).map(([date, val]) => ({
      date,
      views: val.views,
      clicks: val.clicks,
    }));

    const linkStatsByUser = new Map<number, { count: number; clicks: number }>();
    for (const row of allLinks) {
      const prev = linkStatsByUser.get(row.userId) || { count: 0, clicks: 0 };
      prev.count += 1;
      prev.clicks += row.clicks || 0;
      linkStatsByUser.set(row.userId, prev);
    }

    const topCreators = allUsers
      .filter((u) => !u.isSuspended)
      .map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        profileViews: u.profileViews || 0,
        totalClicks: linkStatsByUser.get(u.id)?.clicks || 0,
        isVerified: u.isVerified,
      }))
      .sort(
        (a, b) =>
          b.profileViews + b.totalClicks - (a.profileViews + a.totalClicks)
      )
      .slice(0, 6);

    const dormantCreators = allUsers
      .filter((u) => u.role !== 'admin')
      .map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        email: u.email,
        lastActiveAt: u.lastActiveAt || u.updatedAt || u.createdAt,
        profileViews: u.profileViews || 0,
        linkCount: linkStatsByUser.get(u.id)?.count || 0,
      }))
      .sort(
        (a, b) =>
          new Date(a.lastActiveAt).getTime() - new Date(b.lastActiveAt).getTime()
      )
      .slice(0, 10);

    return {
      days: safeDays,
      dailySeries,
      topCreators,
      dormantCreators,
      totalClickEvents: totalEventsRow[0]?.count ?? 0,
    };
  } catch (error) {
    console.error('Database query failed (getPlatformGlobalAnalytics):', error);
    throw new Error('Gagal memuat analitik platform.', { cause: error });
  }
}

export async function getAdminUserDetail(
  targetUserId: number
): Promise<AdminUserDetailDTO> {
  try {
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    const u = userRows[0];
    if (!u) throw new Error('Pengguna tidak ditemukan.');

    const [userLinks, userSubs, userInq, settings] = await Promise.all([
      db
        .select()
        .from(links)
        .where(eq(links.userId, u.id))
        .orderBy(asc(links.position), asc(links.id)),
      db.select({ id: subscribers.id }).from(subscribers).where(eq(subscribers.userId, u.id)),
      db.select({ id: inquiries.id }).from(inquiries).where(eq(inquiries.userId, u.id)),
      getOrCreatePlatformSettings(),
    ]);

    return {
      user: {
        id: u.id,
        uid: u.uid,
        email: u.email,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        role: u.role,
        planTier: isUserProActive(u) ? 'pro' : 'free',
        planExpiresAt: u.planExpiresAt,
        hideBranding: Boolean(u.hideBranding),
        adminWarning: u.adminWarning || '',
        adminWarningAt: u.adminWarningAt,
        lastActiveAt: u.lastActiveAt || u.updatedAt || u.createdAt,
        isVerified: u.isVerified,
        isSuspended: u.isSuspended,
        isFeatured: u.isFeatured,
        featuredOrder: u.featuredOrder ?? 0,
        profileViews: u.profileViews,
        linkCount: userLinks.length,
        totalClicks: userLinks.reduce((acc, l) => acc + (l.clicks || 0), 0),
        subscriberCount: userSubs.length,
        inquiryCount: userInq.length,
        createdAt: u.createdAt,
        bio: u.bio,
        whatsappNumber: u.whatsappNumber,
        contactEmail: u.contactEmail,
        seoTitle: u.seoTitle,
        seoDescription: u.seoDescription,
      },
      links: userLinks.map((l) => {
        const matched = l.url
          ? findBlockedDomainMatch(l.url, settings.blockedDomains)
          : null;
        return {
          id: l.id,
          linkType: l.linkType,
          title: l.title,
          subtitle: l.subtitle,
          url: l.url,
          icon: l.icon,
          isActive: l.isActive,
          clicks: l.clicks,
          position: l.position,
          priceText: l.priceText,
          badgeText: l.badgeText,
          flaggedReason: matched || undefined,
        };
      }),
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('tidak ditemukan')) {
      throw error;
    }
    console.error('Database query failed (getAdminUserDetail):', error);
    throw new Error('Gagal memuat detail pengguna.', { cause: error });
  }
}

function sanitizeSafeAvatarOrAssetUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/src/assets/') || trimmed.startsWith('/assets/')) {
    return trimmed.slice(0, 500);
  }
  const normalized = normalizeUrl(trimmed);
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('URL avatar harus menggunakan protokol http atau https.');
    }
    return parsed.toString().slice(0, 500);
  } catch (err) {
    if (err instanceof Error && err.message.includes('protokol')) {
      throw err;
    }
    throw new Error('Format URL avatar tidak valid.');
  }
}

export async function superAdminCreateUser(
  actingAdminUid: string,
  actingAdminEmail: string,
  input: {
    email: string;
    password?: string;
    username: string;
    displayName: string;
    bio?: string;
    avatarUrl?: string;
    whatsappNumber?: string;
    contactEmail?: string;
    role?: string;
    planTier?: string;
    planExpiresAt?: string | null;
    isVerified?: boolean;
    isFeatured?: boolean;
  }
): Promise<AdminUserSummaryDTO> {
  try {
    const cleanEmail = (input.email || '').trim().toLowerCase().slice(0, 120);
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Alamat email pengguna tidak valid.');
    }

    const cleanDisplayName = (input.displayName || '').trim().slice(0, 80);
    if (!cleanDisplayName) {
      throw new Error('Nama tampilan wajib diisi.');
    }

    const normalizedUsername = sanitizeUsername(input.username || '');
    const settings = await getOrCreatePlatformSettings();
    const allReserved = new Set([
      ...BUILTIN_RESERVED_USERNAMES,
      ...settings.reservedUsernames,
    ]);
    if (normalizedUsername.length < 3) {
      throw new Error('Username minimal 3 karakter (huruf, angka, _, -).');
    }
    if (allReserved.has(normalizedUsername)) {
      throw new Error(`Username @${normalizedUsername} tidak tersedia / terlarang.`);
    }

    const [existingByUsername, existingByEmail] = await Promise.all([
      db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, normalizedUsername))
        .limit(1),
      db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = ${cleanEmail}`)
        .limit(1),
    ]);

    if (existingByUsername[0]) {
      throw new Error(`Username @${normalizedUsername} sudah dipakai akun lain.`);
    }
    if (existingByEmail[0]) {
      throw new Error(`Email ${cleanEmail} sudah terdaftar di LokaBio.`);
    }

    const rawPassword = typeof input.password === 'string' ? input.password : '';
    if (rawPassword && rawPassword.length < 6) {
      throw new Error('Password awal minimal 6 karakter.');
    }

    let resolvedUid = '';
    let authCreatedMethod = 'pra-registrasi';

    if (rawPassword) {
      try {
        const fbExisting = await adminAuth.getUserByEmail(cleanEmail).catch(() => null);
        if (fbExisting) {
          throw new Error(
            'Email ini sudah terdaftar di Firebase Auth. Kosongkan kolom password untuk menautkan akun Google/Firebase yang sudah ada.'
          );
        }
        const createdFb = await adminAuth.createUser({
          email: cleanEmail,
          password: rawPassword,
          displayName: cleanDisplayName,
        });
        resolvedUid = createdFb.uid;
        authCreatedMethod = 'Firebase Email/Password';
      } catch (fbError: unknown) {
        const msg =
          fbError instanceof Error ? fbError.message : String(fbError || '');
        if (msg.includes('sudah terdaftar di Firebase Auth')) {
          throw fbError;
        }
        if (
          msg.includes('default credentials') ||
          msg.includes('credential') ||
          msg.includes('Could not load')
        ) {
          throw new Error(
            'Pembuatan password langsung memerlukan kredensial Service Account Firebase Admin (GOOGLE_APPLICATION_CREDENTIALS). Kosongkan kolom password untuk membuat akun pra-registrasi (login Google / daftar mandiri).'
          );
        }
        throw new Error(`Gagal membuat akun Firebase Auth: ${msg}`);
      }
    } else {
      try {
        const fbExisting = await adminAuth.getUserByEmail(cleanEmail);
        resolvedUid = fbExisting.uid;
        authCreatedMethod = 'tautan Firebase existing';
      } catch {
        resolvedUid = `pre_${crypto.randomUUID()}`;
      }
    }

    const nextRole = input.role === 'admin' ? 'admin' : 'user';
    const nextPlan = input.planTier === 'pro' ? 'pro' : 'free';
    const parsedExp =
      nextPlan === 'pro' ? parseOptionalDate(input.planExpiresAt) ?? null : null;
    const safeAvatar = input.avatarUrl
      ? sanitizeSafeAvatarOrAssetUrl(input.avatarUrl)
      : '/src/assets/images/avatar_creator_one_1795280504938.jpg';

    const inserted = await db
      .insert(users)
      .values({
        uid: resolvedUid,
        email: cleanEmail,
        username: normalizedUsername,
        displayName: cleanDisplayName,
        bio:
          (input.bio || '').trim().slice(0, 300) ||
          'Kreator digital & pengelola tautan di LokaBio.',
        avatarUrl: safeAvatar,
        role: nextRole,
        planTier: nextPlan,
        planExpiresAt: parsedExp,
        isVerified: Boolean(input.isVerified),
        isFeatured: Boolean(input.isFeatured),
        whatsappNumber: (input.whatsappNumber || '')
          .replace(/[^0-9+]/g, '')
          .slice(0, 20),
        contactEmail: (input.contactEmail || '').trim().slice(0, 120),
        profileViews: 0,
        themePreset: 'minimalist-light',
        bgType: 'solid',
        bgColor: '#F6F5F1',
        bgGradient:
          'linear-gradient(155deg, #2A1624 0%, #7C2D3B 52%, #D97757 100%)',
        buttonColor: '#141413',
        buttonTextColor: '#FAF9F6',
        buttonShape: 'rounded',
        textColor: '#141413',
        fontFamily: 'sans',
        socialPosition: 'top',
        socialLinks: [],
      })
      .returning();

    const created = inserted[0];
    await recordAdminAuditLog({
      actingAdminUid,
      actingAdminEmail,
      action: 'CREATE_USER',
      targetUsername: created.username,
      details: `Membuat akun @${created.username} (${created.email}, role: ${nextRole}, paket: ${nextPlan.toUpperCase()}, mode: ${authCreatedMethod})`,
    });

    return {
      id: created.id,
      uid: created.uid,
      email: created.email,
      username: created.username,
      displayName: created.displayName,
      avatarUrl: created.avatarUrl,
      role: created.role,
      planTier: isUserProActive(created) ? 'pro' : 'free',
      planExpiresAt: created.planExpiresAt,
      hideBranding: Boolean(created.hideBranding),
      adminWarning: created.adminWarning || '',
      adminWarningAt: created.adminWarningAt,
      lastActiveAt: created.lastActiveAt || created.createdAt,
      isVerified: created.isVerified,
      isSuspended: created.isSuspended,
      isFeatured: created.isFeatured,
      featuredOrder: created.featuredOrder ?? 0,
      profileViews: created.profileViews,
      linkCount: 0,
      totalClicks: 0,
      subscriberCount: 0,
      inquiryCount: 0,
      createdAt: created.createdAt,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('email') ||
        error.message.includes('Email') ||
        error.message.includes('Username') ||
        error.message.includes('wajib') ||
        error.message.includes('Password') ||
        error.message.includes('kredensial') ||
        error.message.includes('Firebase') ||
        error.message.includes('protokol') ||
        error.message.includes('avatar'))
    ) {
      throw error;
    }
    console.error('Database query failed (superAdminCreateUser):', error);
    throw new Error('Gagal membuat akun pengguna baru.', { cause: error });
  }
}

export async function superAdminUpdateUser(
  targetUserId: number,
  actingAdminUid: string,
  actingAdminEmail: string,
  patch: {
    role?: string;
    isVerified?: boolean;
    isSuspended?: boolean;
    isFeatured?: boolean;
    featuredOrder?: number;
    newUsername?: string;
    displayName?: string;
    email?: string;
    bio?: string;
    avatarUrl?: string;
    whatsappNumber?: string;
    contactEmail?: string;
    seoTitle?: string;
    seoDescription?: string;
    hideBranding?: boolean;
    planTier?: string;
    planExpiresAt?: string | null;
    adminWarning?: string;
  }
): Promise<UserRecord> {
  try {
    const existingRows = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    const target = existingRows[0];
    if (!target) {
      throw new Error('Pengguna tidak ditemukan.');
    }

    const isSelf = target.uid === actingAdminUid;
    if (isSelf && patch.role !== undefined && patch.role !== 'admin') {
      throw new Error('Anda tidak dapat mencabut hak akses Admin akun sendiri.');
    }
    if (isSelf && patch.isSuspended === true) {
      throw new Error('Anda tidak dapat menonaktifkan akun Anda sendiri.');
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    const changes: string[] = [];

    if (patch.role !== undefined) {
      const nextRole = patch.role === 'admin' ? 'admin' : 'user';
      updateData.role = nextRole;
      changes.push(`Peran → ${nextRole === 'admin' ? 'Super Admin' : 'User'}`);
    }
    if (patch.displayName !== undefined) {
      const cleanName = patch.displayName.trim().slice(0, 80);
      if (!cleanName) throw new Error('Nama tampilan tidak boleh kosong.');
      if (cleanName !== target.displayName) {
        updateData.displayName = cleanName;
        changes.push(`Nama → "${cleanName}"`);
      }
    }
    if (patch.email !== undefined) {
      const cleanEmail = patch.email.trim().toLowerCase().slice(0, 120);
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw new Error('Format alamat email tidak valid.');
      }
      if (cleanEmail !== target.email.toLowerCase()) {
        const emailConflict = await db
          .select({ id: users.id })
          .from(users)
          .where(
            and(
              sql`lower(${users.email}) = ${cleanEmail}`,
              ne(users.id, targetUserId)
            )
          )
          .limit(1);
        if (emailConflict[0]) {
          throw new Error(`Email ${cleanEmail} sudah dipakai akun lain.`);
        }
        updateData.email = cleanEmail;
        changes.push(`Email → ${cleanEmail}`);
      }
    }
    if (patch.bio !== undefined) {
      const cleanBio = patch.bio.trim().slice(0, 300);
      if (cleanBio !== target.bio) {
        updateData.bio = cleanBio;
        changes.push('Bio diperbarui');
      }
    }
    if (patch.avatarUrl !== undefined) {
      const cleanAvatar = sanitizeSafeAvatarOrAssetUrl(patch.avatarUrl);
      if (cleanAvatar !== target.avatarUrl) {
        updateData.avatarUrl = cleanAvatar;
        changes.push('Avatar diperbarui');
      }
    }
    if (patch.whatsappNumber !== undefined) {
      const cleanWa = patch.whatsappNumber.replace(/[^0-9+]/g, '').slice(0, 20);
      if (cleanWa !== target.whatsappNumber) {
        updateData.whatsappNumber = cleanWa;
        changes.push('WhatsApp diperbarui');
      }
    }
    if (patch.contactEmail !== undefined) {
      const cleanContact = patch.contactEmail.trim().slice(0, 120);
      if (cleanContact !== target.contactEmail) {
        updateData.contactEmail = cleanContact;
        changes.push('Email kontak diperbarui');
      }
    }
    if (patch.seoTitle !== undefined) {
      const cleanSeoTitle = patch.seoTitle.trim().slice(0, 120);
      if (cleanSeoTitle !== target.seoTitle) {
        updateData.seoTitle = cleanSeoTitle;
        changes.push('SEO Title diperbarui');
      }
    }
    if (patch.seoDescription !== undefined) {
      const cleanSeoDesc = patch.seoDescription.trim().slice(0, 300);
      if (cleanSeoDesc !== target.seoDescription) {
        updateData.seoDescription = cleanSeoDesc;
        changes.push('SEO Description diperbarui');
      }
    }
    if (patch.hideBranding !== undefined) {
      const nextHide = Boolean(patch.hideBranding);
      if (nextHide !== target.hideBranding) {
        updateData.hideBranding = nextHide;
        changes.push(
          nextHide ? 'Sembunyikan branding aktif' : 'Branding footer tampil'
        );
      }
    }
    if (patch.planTier !== undefined) {
      const nextPlan = patch.planTier === 'pro' ? 'pro' : 'free';
      updateData.planTier = nextPlan;
      if (nextPlan === 'free') {
        updateData.planExpiresAt = null;
        updateData.hideBranding = false;
      }
      changes.push(`Paket → ${nextPlan.toUpperCase()}`);
    }
    if (patch.planExpiresAt !== undefined) {
      const parsedExp = parseOptionalDate(patch.planExpiresAt);
      updateData.planExpiresAt = parsedExp ?? null;
      changes.push(
        parsedExp
          ? `Masa Pro s/d ${new Date(parsedExp).toISOString().slice(0, 10)}`
          : 'Masa Pro selamanya'
      );
    }
    if (patch.adminWarning !== undefined) {
      const cleanWarning = patch.adminWarning.trim().slice(0, 320);
      updateData.adminWarning = cleanWarning;
      updateData.adminWarningAt = cleanWarning ? new Date() : null;
      changes.push(
        cleanWarning
          ? `Kirim peringatan: "${cleanWarning.slice(0, 60)}"`
          : 'Hapus peringatan akun'
      );
    }
    if (patch.isVerified !== undefined) {
      updateData.isVerified = Boolean(patch.isVerified);
      changes.push(patch.isVerified ? 'Verifikasi diaktifkan' : 'Verifikasi dicabut');
    }
    if (patch.isSuspended !== undefined) {
      updateData.isSuspended = Boolean(patch.isSuspended);
      changes.push(patch.isSuspended ? 'Akun dinonaktifkan' : 'Akun diaktifkan');
    }
    if (patch.isFeatured !== undefined) {
      updateData.isFeatured = Boolean(patch.isFeatured);
      if (!patch.isFeatured) {
        updateData.featuredOrder = 0;
      }
      changes.push(
        patch.isFeatured
          ? 'Ditampilkan di pratinjau beranda'
          : 'Disembunyikan dari pratinjau beranda'
      );
    }
    if (patch.featuredOrder !== undefined) {
      updateData.featuredOrder = Math.max(0, Number(patch.featuredOrder) || 0);
      changes.push(`Urutan pratinjau → ${updateData.featuredOrder}`);
    }
    if (patch.newUsername !== undefined) {
      const normalized = sanitizeUsername(patch.newUsername);
      if (normalized.length < 3 || BUILTIN_RESERVED_USERNAMES.has(normalized)) {
        throw new Error(
          'Username baru minimal 3 karakter dan tidak memakai rute sistem.'
        );
      }
      if (normalized !== target.username) {
        const conflict = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.username, normalized), ne(users.id, targetUserId)))
          .limit(1);
        if (conflict[0]) {
          throw new Error(`Username @${normalized} sudah dipakai akun lain.`);
        }
        updateData.username = normalized;
        changes.push(`Ubah handle @${target.username} → @${normalized}`);
      }
    }

    const updated = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, targetUserId))
      .returning();

    if (patch.planTier !== undefined && updated[0]) {
      await db.insert(proSubscriptionsLog).values({
        userId: updated[0].id,
        username: updated[0].username,
        source: 'admin_manual',
        couponCode: '',
        planTier: updated[0].planTier,
        durationDays: null,
        expiresAt: updated[0].planExpiresAt ?? null,
        actorEmail: actingAdminEmail,
        note:
          updated[0].planTier === 'pro'
            ? updated[0].planExpiresAt
              ? `Paket Pro manual s/d ${new Date(updated[0].planExpiresAt).toISOString().slice(0, 10)}`
              : 'Paket Pro manual permanen'
            : 'Diturunkan ke paket Free oleh Admin',
      });
    }

    if (changes.length > 0) {
      await recordAdminAuditLog({
        actingAdminUid,
        actingAdminEmail,
        action: 'UPDATE_USER',
        targetUsername: updated[0]?.username || target.username,
        details: changes.join('; '),
      });
    }

    return updated[0];
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('tidak dapat') ||
        error.message.includes('Username') ||
        error.message.includes('sudah dipakai') ||
        error.message.includes('tidak ditemukan') ||
        error.message.includes('tidak boleh kosong') ||
        error.message.includes('email') ||
        error.message.includes('protokol') ||
        error.message.includes('avatar'))
    ) {
      throw error;
    }
    console.error('Database query failed (superAdminUpdateUser):', error);
    throw new Error('Gagal memperbarui pengguna.', { cause: error });
  }
}

export async function superAdminBulkUsersAction(
  userIds: number[],
  action: BulkUserAction,
  actingAdminUid: string,
  actingAdminEmail: string
): Promise<{ affectedCount: number; skippedSelf: boolean }> {
  try {
    const cleanIds = Array.from(
      new Set(userIds.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0))
    ).slice(0, 100);

    if (cleanIds.length === 0) {
      throw new Error('Pilih minimal satu pengguna.');
    }

    const targets = await db
      .select()
      .from(users)
      .where(inArray(users.id, cleanIds));

    let skippedSelf = false;
    const eligibleIds: number[] = [];
    for (const u of targets) {
      const isSelf = u.uid === actingAdminUid;
      if (isSelf && (action === 'suspend' || action === 'delete')) {
        skippedSelf = true;
        continue;
      }
      eligibleIds.push(u.id);
    }

    if (eligibleIds.length === 0) {
      return { affectedCount: 0, skippedSelf };
    }

    const now = new Date();
    switch (action) {
      case 'verify':
        await db
          .update(users)
          .set({ isVerified: true, updatedAt: now })
          .where(inArray(users.id, eligibleIds));
        break;
      case 'unverify':
        await db
          .update(users)
          .set({ isVerified: false, updatedAt: now })
          .where(inArray(users.id, eligibleIds));
        break;
      case 'suspend':
        await db
          .update(users)
          .set({ isSuspended: true, updatedAt: now })
          .where(inArray(users.id, eligibleIds));
        break;
      case 'unsuspend':
        await db
          .update(users)
          .set({ isSuspended: false, updatedAt: now })
          .where(inArray(users.id, eligibleIds));
        break;
      case 'feature':
        await db
          .update(users)
          .set({ isFeatured: true, updatedAt: now })
          .where(inArray(users.id, eligibleIds));
        break;
      case 'unfeature':
        await db
          .update(users)
          .set({ isFeatured: false, featuredOrder: 0, updatedAt: now })
          .where(inArray(users.id, eligibleIds));
        break;
      case 'set_pro':
        await db
          .update(users)
          .set({ planTier: 'pro', updatedAt: now })
          .where(inArray(users.id, eligibleIds));
        break;
      case 'set_free':
        await db
          .update(users)
          .set({
            planTier: 'free',
            planExpiresAt: null,
            hideBranding: false,
            updatedAt: now,
          })
          .where(inArray(users.id, eligibleIds));
        break;
      case 'delete':
        await db.delete(users).where(inArray(users.id, eligibleIds));
        break;
      default:
        throw new Error('Aksi massal tidak dikenali.');
    }

    if (action === 'set_pro' || action === 'set_free') {
      const affectedTargets = targets.filter((t) => eligibleIds.includes(t.id));
      if (affectedTargets.length > 0) {
        await db.insert(proSubscriptionsLog).values(
          affectedTargets.map((t) => ({
            userId: t.id,
            username: t.username,
            source: 'bulk_admin',
            couponCode: '',
            planTier: action === 'set_pro' ? 'pro' : 'free',
            durationDays: null,
            expiresAt: null,
            actorEmail: actingAdminEmail,
            note:
              action === 'set_pro'
                ? 'Aksi massal naik ke paket Pro'
                : 'Aksi massal turun ke paket Free',
          }))
        );
      }
    }

    await recordAdminAuditLog({
      actingAdminUid,
      actingAdminEmail,
      action: 'BULK_USER_ACTION',
      details: `Aksi massal "${action}" pada ${eligibleIds.length} pengguna`,
    });

    return { affectedCount: eligibleIds.length, skippedSelf };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('Pilih minimal') ||
        error.message.includes('tidak dikenali'))
    ) {
      throw error;
    }
    console.error('Database query failed (superAdminBulkUsersAction):', error);
    throw new Error('Gagal menjalankan aksi massal.', { cause: error });
  }
}

export async function superAdminDeleteUser(
  targetUserId: number,
  actingAdminUid: string,
  actingAdminEmail: string
): Promise<void> {
  try {
    const existingRows = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    const target = existingRows[0];
    if (!target) {
      throw new Error('Pengguna tidak ditemukan.');
    }
    if (target.uid === actingAdminUid) {
      throw new Error('Anda tidak dapat menghapus akun Anda sendiri.');
    }

    await db.delete(users).where(eq(users.id, targetUserId));

    await recordAdminAuditLog({
      actingAdminUid,
      actingAdminEmail,
      action: 'DELETE_USER',
      targetUsername: target.username,
      details: `Menghapus akun @${target.username} (${target.email})`,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('tidak dapat')) {
      throw error;
    }
    console.error('Database query failed (superAdminDeleteUser):', error);
    throw new Error('Gagal menghapus akun pengguna.', { cause: error });
  }
}

export async function superAdminModerateLink(
  linkId: number,
  actingAdminUid: string,
  actingAdminEmail: string,
  isActive: boolean
) {
  try {
    const rows = await db
      .select()
      .from(links)
      .where(eq(links.id, linkId))
      .limit(1);

    const link = rows[0];
    if (!link) throw new Error('Tautan tidak ditemukan.');

    const ownerRows = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, link.userId))
      .limit(1);

    const updated = await db
      .update(links)
      .set({ isActive: Boolean(isActive), updatedAt: new Date() })
      .where(eq(links.id, linkId))
      .returning();

    await recordAdminAuditLog({
      actingAdminUid,
      actingAdminEmail,
      action: 'MODERATE_LINK',
      targetUsername: ownerRows[0]?.username || '',
      details: `${isActive ? 'Mengaktifkan' : 'Menonaktifkan'} tautan "${link.title}"`,
    });

    return updated[0];
  } catch (error) {
    console.error('Database query failed (superAdminModerateLink):', error);
    throw new Error('Gagal memoderasi tautan.', { cause: error });
  }
}

export async function superAdminDeleteLink(
  linkId: number,
  actingAdminUid: string,
  actingAdminEmail: string
) {
  try {
    const rows = await db
      .select()
      .from(links)
      .where(eq(links.id, linkId))
      .limit(1);

    const link = rows[0];
    if (!link) throw new Error('Tautan tidak ditemukan.');

    const ownerRows = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, link.userId))
      .limit(1);

    await db.delete(links).where(eq(links.id, linkId));

    await recordAdminAuditLog({
      actingAdminUid,
      actingAdminEmail,
      action: 'DELETE_LINK',
      targetUsername: ownerRows[0]?.username || '',
      details: `Menghapus tautan "${link.title}" (${link.url})`,
    });
  } catch (error) {
    console.error('Database query failed (superAdminDeleteLink):', error);
    throw new Error('Gagal menghapus tautan.', { cause: error });
  }
}

export async function superAdminUpdateFeaturedOrder(
  orderedUserIds: number[],
  actingAdminUid: string,
  actingAdminEmail: string
) {
  try {
    for (let idx = 0; idx < orderedUserIds.length; idx++) {
      const uidNum = orderedUserIds[idx];
      await db
        .update(users)
        .set({ featuredOrder: idx + 1, updatedAt: new Date() })
        .where(eq(users.id, uidNum));
    }

    await recordAdminAuditLog({
      actingAdminUid,
      actingAdminEmail,
      action: 'REORDER_FEATURED',
      details: `Mengatur urutan ${orderedUserIds.length} profil pratinjau beranda`,
    });
  } catch (error) {
    console.error('Database query failed (superAdminUpdateFeaturedOrder):', error);
    throw new Error('Gagal menyimpan urutan pratinjau.', { cause: error });
  }
}

export async function getAdminReports(): Promise<ProfileReportDTO[]> {
  try {
    return await db
      .select()
      .from(profileReports)
      .orderBy(desc(profileReports.createdAt))
      .limit(100);
  } catch (error) {
    console.error('Database query failed (getAdminReports):', error);
    throw new Error('Gagal memuat daftar laporan.', { cause: error });
  }
}

export async function superAdminReviewReport(
  reportId: number,
  actingAdminUid: string,
  actingAdminEmail: string,
  input: {
    status: 'resolved' | 'dismissed';
    reviewedNote?: string;
    suspendUser?: boolean;
  }
): Promise<ProfileReportDTO> {
  try {
    const existing = await db
      .select()
      .from(profileReports)
      .where(eq(profileReports.id, reportId))
      .limit(1);

    const report = existing[0];
    if (!report) throw new Error('Laporan tidak ditemukan.');

    const nextStatus = input.status === 'dismissed' ? 'dismissed' : 'resolved';
    const note = (input.reviewedNote || '').trim().slice(0, 300);

    const updated = await db
      .update(profileReports)
      .set({
        status: nextStatus,
        reviewedBy: actingAdminEmail,
        reviewedNote: note,
        reviewedAt: new Date(),
      })
      .where(eq(profileReports.id, reportId))
      .returning();

    if (input.suspendUser) {
      const targetUserRows = await db
        .select({ uid: users.uid })
        .from(users)
        .where(eq(users.id, report.reportedUserId))
        .limit(1);
      if (targetUserRows[0]?.uid !== actingAdminUid) {
        await db
          .update(users)
          .set({ isSuspended: true, updatedAt: new Date() })
          .where(eq(users.id, report.reportedUserId));
      }
    }

    await recordAdminAuditLog({
      actingAdminUid,
      actingAdminEmail,
      action: 'REVIEW_REPORT',
      targetUsername: report.reportedUsername,
      details: `Laporan #${report.id} (${report.reason}) → ${nextStatus}${
        input.suspendUser ? ' + Nonaktifkan akun' : ''
      }`,
    });

    return updated[0];
  } catch (error) {
    console.error('Database query failed (superAdminReviewReport):', error);
    throw new Error('Gagal memproses laporan.', { cause: error });
  }
}

export async function getAdminVerificationRequests(): Promise<
  VerificationRequestDTO[]
> {
  try {
    const rows = await db
      .select({
        id: verificationRequests.id,
        userId: verificationRequests.userId,
        username: verificationRequests.username,
        displayName: users.displayName,
        email: users.email,
        category: verificationRequests.category,
        proofUrl: verificationRequests.proofUrl,
        note: verificationRequests.note,
        status: verificationRequests.status,
        reviewedBy: verificationRequests.reviewedBy,
        reviewedNote: verificationRequests.reviewedNote,
        createdAt: verificationRequests.createdAt,
        reviewedAt: verificationRequests.reviewedAt,
      })
      .from(verificationRequests)
      .leftJoin(users, eq(verificationRequests.userId, users.id))
      .orderBy(desc(verificationRequests.createdAt))
      .limit(100);

    return rows.map((r) => ({
      ...r,
      displayName: r.displayName || r.username,
      email: r.email || '',
    }));
  } catch (error) {
    console.error('Database query failed (getAdminVerificationRequests):', error);
    throw new Error('Gagal memuat antrean verifikasi.', { cause: error });
  }
}

export async function superAdminReviewVerification(
  requestId: number,
  actingAdminUid: string,
  actingAdminEmail: string,
  input: { status: 'approved' | 'rejected'; reviewedNote?: string }
): Promise<VerificationRequestDTO> {
  try {
    const existing = await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.id, requestId))
      .limit(1);

    const reqRow = existing[0];
    if (!reqRow) throw new Error('Pengajuan verifikasi tidak ditemukan.');

    const nextStatus = input.status === 'approved' ? 'approved' : 'rejected';
    const note = (input.reviewedNote || '').trim().slice(0, 300);

    const updated = await db
      .update(verificationRequests)
      .set({
        status: nextStatus,
        reviewedBy: actingAdminEmail,
        reviewedNote: note,
        reviewedAt: new Date(),
      })
      .where(eq(verificationRequests.id, requestId))
      .returning();

    if (nextStatus === 'approved') {
      await db
        .update(users)
        .set({ isVerified: true, updatedAt: new Date() })
        .where(eq(users.id, reqRow.userId));
    }

    await recordAdminAuditLog({
      actingAdminUid,
      actingAdminEmail,
      action: 'REVIEW_VERIFICATION',
      targetUsername: reqRow.username,
      details: `Verifikasi @${reqRow.username} (${reqRow.category}) → ${
        nextStatus === 'approved' ? 'Disetujui (+ Centang Biru)' : 'Ditolak'
      }`,
    });

    return updated[0];
  } catch (error) {
    console.error('Database query failed (superAdminReviewVerification):', error);
    throw new Error('Gagal memproses pengajuan verifikasi.', { cause: error });
  }
}

export async function getAdminAuditLogs(options?: {
  limit?: number;
  action?: string;
  search?: string;
}): Promise<AdminAuditLogDTO[]> {
  try {
    const limit = Math.max(10, Math.min(200, Number(options?.limit) || 120));
    const actionFilter = (options?.action || '').trim();
    const q = (options?.search || '').trim().toLowerCase();

    const rows = actionFilter
      ? await db
          .select()
          .from(adminAuditLogs)
          .where(eq(adminAuditLogs.action, actionFilter))
          .orderBy(desc(adminAuditLogs.createdAt))
          .limit(limit)
      : await db
          .select()
          .from(adminAuditLogs)
          .orderBy(desc(adminAuditLogs.createdAt))
          .limit(limit);

    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.adminEmail.toLowerCase().includes(q) ||
        r.targetUsername.toLowerCase().includes(q) ||
        r.details.toLowerCase().includes(q) ||
        r.action.toLowerCase().includes(q)
    );
  } catch (error) {
    console.error('Database query failed (getAdminAuditLogs):', error);
    throw new Error('Gagal memuat log aktivitas admin.', { cause: error });
  }
}

export async function superAdminCleanupClickEvents(
  olderThanDays: number,
  actingAdminUid: string,
  actingAdminEmail: string
): Promise<{ deletedCount: number }> {
  try {
    const safeDays = Math.max(7, Math.min(365, Number(olderThanDays) || 90));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - safeDays);

    const deleted = await db
      .delete(clickEvents)
      .where(lt(clickEvents.createdAt, cutoff))
      .returning({ id: clickEvents.id });

    await recordAdminAuditLog({
      actingAdminUid,
      actingAdminEmail,
      action: 'CLEANUP_CLICK_EVENTS',
      details: `Membersihkan ${deleted.length} log klik/kunjungan lebih lama dari ${safeDays} hari`,
    });

    return { deletedCount: deleted.length };
  } catch (error) {
    console.error('Database query failed (superAdminCleanupClickEvents):', error);
    throw new Error('Gagal membersihkan log event lama.', { cause: error });
  }
}

export async function superAdminUpdatePlatformSettings(
  actingAdminUid: string,
  actingAdminEmail: string,
  patch: {
    announcementEnabled?: boolean;
    announcementTitle?: string;
    announcementMessage?: string;
    announcementType?: string;
    reservedUsernames?: string[];
    maintenanceMode?: boolean;
    maintenanceMessage?: string;
    registrationOpen?: boolean;
    freeLinkLimit?: number;
    blockedDomains?: string[];
  }
): Promise<PlatformSettingsDTO> {
  try {
    const current = await getOrCreatePlatformSettings();

    const nextEnabled =
      patch.announcementEnabled !== undefined
        ? Boolean(patch.announcementEnabled)
        : current.announcementEnabled;
    const nextTitle =
      patch.announcementTitle !== undefined
        ? patch.announcementTitle.trim().slice(0, 100)
        : current.announcementTitle;
    const nextMessage =
      patch.announcementMessage !== undefined
        ? patch.announcementMessage.trim().slice(0, 320)
        : current.announcementMessage;
    const nextType =
      patch.announcementType &&
      ['info', 'warning', 'success'].includes(patch.announcementType)
        ? patch.announcementType
        : current.announcementType;
    const nextReserved = Array.isArray(patch.reservedUsernames)
      ? Array.from(
          new Set(
            patch.reservedUsernames
              .map((w) => sanitizeUsername(String(w)))
              .filter((w) => w.length >= 2)
          )
        ).slice(0, 100)
      : current.reservedUsernames;
    const nextMaintenanceMode =
      patch.maintenanceMode !== undefined
        ? Boolean(patch.maintenanceMode)
        : current.maintenanceMode;
    const nextMaintenanceMessage =
      patch.maintenanceMessage !== undefined
        ? patch.maintenanceMessage.trim().slice(0, 320) ||
          'Platform sedang dalam pemeliharaan terjadwal. Silakan kembali beberapa saat lagi.'
        : current.maintenanceMessage;
    const nextRegistrationOpen =
      patch.registrationOpen !== undefined
        ? Boolean(patch.registrationOpen)
        : current.registrationOpen;
    const nextFreeLinkLimit =
      patch.freeLinkLimit !== undefined
        ? Math.max(1, Math.min(100, Number(patch.freeLinkLimit) || 8))
        : current.freeLinkLimit;
    const nextBlockedDomains = Array.isArray(patch.blockedDomains)
      ? Array.from(
          new Set(
            patch.blockedDomains
              .map((d) => String(d).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, ''))
              .filter((d) => d.length >= 3 && d.length <= 120)
          )
        ).slice(0, 150)
      : current.blockedDomains;

    const updated = await db
      .update(platformSettings)
      .set({
        announcementEnabled: nextEnabled,
        announcementTitle: nextTitle,
        announcementMessage: nextMessage,
        announcementType: nextType,
        reservedUsernames: nextReserved,
        maintenanceMode: nextMaintenanceMode,
        maintenanceMessage: nextMaintenanceMessage,
        registrationOpen: nextRegistrationOpen,
        freeLinkLimit: nextFreeLinkLimit,
        blockedDomains: nextBlockedDomains,
        updatedBy: actingAdminEmail,
        updatedAt: new Date(),
      })
      .where(eq(platformSettings.key, 'global'))
      .returning();

    await recordAdminAuditLog({
      actingAdminUid,
      actingAdminEmail,
      action: 'UPDATE_PLATFORM_SETTINGS',
      details: `Maintenance: ${nextMaintenanceMode ? 'ON' : 'OFF'} · Registrasi: ${
        nextRegistrationOpen ? 'Buka' : 'Tutup'
      } · Limit Free: ${nextFreeLinkLimit} · ${nextBlockedDomains.length} domain terblokir`,
    });

    const row = updated[0];
    return {
      announcementEnabled: row.announcementEnabled,
      announcementTitle: row.announcementTitle,
      announcementMessage: row.announcementMessage,
      announcementType: row.announcementType,
      reservedUsernames: Array.isArray(row.reservedUsernames)
        ? row.reservedUsernames
        : [],
      maintenanceMode: Boolean(row.maintenanceMode),
      maintenanceMessage: row.maintenanceMessage,
      registrationOpen: Boolean(row.registrationOpen),
      freeLinkLimit: Number(row.freeLinkLimit) || 8,
      blockedDomains: Array.isArray(row.blockedDomains)
        ? row.blockedDomains
        : [],
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    };
  } catch (error) {
    console.error(
      'Database query failed (superAdminUpdatePlatformSettings):',
      error
    );
    throw new Error('Gagal menyimpan pengaturan platform.', { cause: error });
  }
}

// --- Super Admin Direct Link CRUD, Password Reset & Support Preview ---

export async function superAdminCreateUserLink(
  targetUserId: number,
  actingAdminUid: string,
  actingAdminEmail: string,
  input: {
    linkType?: string;
    title: string;
    subtitle?: string;
    url?: string;
    icon?: string;
    priceText?: string;
    badgeText?: string;
    isActive?: boolean;
  }
) {
  try {
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);
    const target = userRows[0];
    if (!target) throw new Error('Pengguna tidak ditemukan.');

    const cleanTitle = (input.title || '').trim().slice(0, 120);
    if (!cleanTitle) throw new Error('Judul tautan wajib diisi.');

    const allowedTypes = [
      'standard',
      'header',
      'featured',
      'embed',
      'product',
      'gallery',
    ];
    const linkType = allowedTypes.includes(input.linkType || '')
      ? String(input.linkType)
      : 'standard';

    const noUrlRequired = linkType === 'header' || linkType === 'gallery';
    const rawUrl = (input.url || '').trim();
    if (!noUrlRequired && !rawUrl) {
      throw new Error('URL tautan wajib diisi.');
    }
    const finalUrl = rawUrl ? normalizeUrl(rawUrl) : '';
    if (finalUrl) {
      try {
        const parsed = new URL(finalUrl);
        if (
          parsed.protocol !== 'http:' &&
          parsed.protocol !== 'https:' &&
          parsed.protocol !== 'mailto:' &&
          parsed.protocol !== 'tel:'
        ) {
          throw new Error('Protokol URL tidak valid.');
        }
      } catch {
        throw new Error('Format URL tautan tidak valid.');
      }
      const settings = await getOrCreatePlatformSettings();
      const matched = findBlockedDomainMatch(finalUrl, settings.blockedDomains);
      if (matched) {
        throw new Error(
          `URL ditolak oleh filter keamanan platform (terdeteksi: "${matched}").`
        );
      }
    }

    const existingLinks = await db
      .select({ position: links.position })
      .from(links)
      .where(eq(links.userId, target.id))
      .orderBy(desc(links.position))
      .limit(1);
    const nextPos = existingLinks[0] ? existingLinks[0].position + 1 : 0;

    const inserted = await db
      .insert(links)
      .values({
        userId: target.id,
        linkType,
        title: cleanTitle,
        subtitle: (input.subtitle || '').trim().slice(0, 180),
        url: finalUrl,
        icon: (input.icon || '').trim() || 'link',
        priceText: (input.priceText || '').trim().slice(0, 40),
        badgeText: (input.badgeText || '').trim().slice(0, 32),
        position: nextPos,
        isActive: input.isActive !== undefined ? Boolean(input.isActive) : true,
        clicks: 0,
      })
      .returning();

    await recordAdminAuditLog({
      actingAdminUid,
      actingAdminEmail,
      action: 'ADMIN_CREATE_LINK',
      targetUsername: target.username,
      details: `Menambahkan tautan "${cleanTitle}" (${linkType}) ke akun @${target.username}`,
    });

    return inserted[0];
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('wajib') ||
        error.message.includes('tidak ditemukan') ||
        error.message.includes('Format URL') ||
        error.message.includes('Protokol') ||
        error.message.includes('filter keamanan'))
    ) {
      throw error;
    }
    console.error('Database query failed (superAdminCreateUserLink):', error);
    throw new Error('Gagal menambahkan tautan pengguna.', { cause: error });
  }
}

export async function superAdminUpdateLink(
  linkId: number,
  actingAdminUid: string,
  actingAdminEmail: string,
  patch: {
    linkType?: string;
    title?: string;
    subtitle?: string;
    url?: string;
    icon?: string;
    priceText?: string;
    badgeText?: string;
    isActive?: boolean;
  }
) {
  try {
    const rows = await db
      .select()
      .from(links)
      .where(eq(links.id, linkId))
      .limit(1);
    const existing = rows[0];
    if (!existing) throw new Error('Tautan tidak ditemukan.');

    const ownerRows = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, existing.userId))
      .limit(1);

    const allowedTypes = [
      'standard',
      'header',
      'featured',
      'embed',
      'product',
      'gallery',
    ];
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (patch.linkType !== undefined && allowedTypes.includes(patch.linkType)) {
      updateData.linkType = patch.linkType;
    }
    if (patch.title !== undefined) {
      const cleanTitle = patch.title.trim().slice(0, 120);
      if (!cleanTitle) throw new Error('Judul tautan tidak boleh kosong.');
      updateData.title = cleanTitle;
    }
    if (patch.subtitle !== undefined) {
      updateData.subtitle = patch.subtitle.trim().slice(0, 180);
    }
    if (patch.url !== undefined) {
      const normalized = patch.url.trim() ? normalizeUrl(patch.url) : '';
      if (normalized) {
        const settings = await getOrCreatePlatformSettings();
        const matched = findBlockedDomainMatch(
          normalized,
          settings.blockedDomains
        );
        if (matched) {
          throw new Error(
            `URL ditolak oleh filter keamanan platform (terdeteksi: "${matched}").`
          );
        }
      }
      updateData.url = normalized;
    }
    if (patch.icon !== undefined) {
      updateData.icon = patch.icon.trim() || 'link';
    }
    if (patch.priceText !== undefined) {
      updateData.priceText = patch.priceText.trim().slice(0, 40);
    }
    if (patch.badgeText !== undefined) {
      updateData.badgeText = patch.badgeText.trim().slice(0, 32);
    }
    if (patch.isActive !== undefined) {
      updateData.isActive = Boolean(patch.isActive);
    }

    const updated = await db
      .update(links)
      .set(updateData)
      .where(eq(links.id, linkId))
      .returning();

    await recordAdminAuditLog({
      actingAdminUid,
      actingAdminEmail,
      action: 'ADMIN_UPDATE_LINK',
      targetUsername: ownerRows[0]?.username || '',
      details: `Memperbarui tautan "${updated[0]?.title || existing.title}"`,
    });

    return updated[0];
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('tidak ditemukan') ||
        error.message.includes('tidak boleh kosong') ||
        error.message.includes('filter keamanan'))
    ) {
      throw error;
    }
    console.error('Database query failed (superAdminUpdateLink):', error);
    throw new Error('Gagal memperbarui tautan pengguna.', { cause: error });
  }
}

export async function superAdminGeneratePasswordResetLink(
  targetUserId: number,
  actingAdminUid: string,
  actingAdminEmail: string
): Promise<{ email: string; resetLink: string }> {
  try {
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);
    const target = userRows[0];
    if (!target) throw new Error('Pengguna tidak ditemukan.');
    if (target.uid.startsWith('pre_')) {
      throw new Error(
        'Akun ini berstatus pra-registrasi dan belum pernah login ke Firebase Auth, sehingga belum memiliki kata sandi untuk direset.'
      );
    }

    let resetLink = '';
    try {
      resetLink = await adminAuth.generatePasswordResetLink(target.email);
    } catch (fbError: unknown) {
      const msg =
        fbError instanceof Error ? fbError.message : String(fbError || '');
      if (
        msg.includes('default credentials') ||
        msg.includes('credential') ||
        msg.includes('Could not load')
      ) {
        throw new Error(
          'Membuat tautan reset password di server memerlukan kredensial Service Account Firebase Admin (GOOGLE_APPLICATION_CREDENTIALS). Saat berjalan lokal tanpa kredensial tersebut, minta pengguna klik "Lupa Kata Sandi" di halaman login.'
        );
      }
      if (msg.includes('no user record') || msg.includes('USER_NOT_FOUND')) {
        throw new Error(
          `Email ${target.email} belum terdaftar di Firebase Auth.`
        );
      }
      throw new Error(`Gagal membuat tautan reset password: ${msg}`);
    }

    await recordAdminAuditLog({
      actingAdminUid,
      actingAdminEmail,
      action: 'GENERATE_PASSWORD_RESET',
      targetUsername: target.username,
      details: `Membuat tautan reset password untuk @${target.username} (${target.email})`,
    });

    return { email: target.email, resetLink };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('Pengguna') ||
        error.message.includes('pra-registrasi') ||
        error.message.includes('kredensial') ||
        error.message.includes('Firebase') ||
        error.message.includes('reset password'))
    ) {
      throw error;
    }
    console.error(
      'Database query failed (superAdminGeneratePasswordResetLink):',
      error
    );
    throw new Error('Gagal membuat tautan reset password.', { cause: error });
  }
}

export async function getAdminWorkspacePreviewById(
  targetUserId: number,
  actingAdminUid: string,
  actingAdminEmail: string
) {
  try {
    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);
    const target = userRows[0];
    if (!target) throw new Error('Pengguna tidak ditemukan.');

    const [
      userLinks,
      userSubs,
      userInq,
      settings,
      verificationRequest,
      templates,
    ] = await Promise.all([
      db
        .select()
        .from(links)
        .where(eq(links.userId, target.id))
        .orderBy(asc(links.position), asc(links.id)),
      db
        .select()
        .from(subscribers)
        .where(eq(subscribers.userId, target.id))
        .orderBy(desc(subscribers.createdAt)),
      db
        .select()
        .from(inquiries)
        .where(eq(inquiries.userId, target.id))
        .orderBy(desc(inquiries.createdAt)),
      getOrCreatePlatformSettings(),
      getUserLatestVerificationRequest(target.id),
      getOrSeedThemeTemplates(true),
    ]);

    await recordAdminAuditLog({
      actingAdminUid,
      actingAdminEmail,
      action: 'SUPPORT_PREVIEW',
      targetUsername: target.username,
      details: `Membuka pratinjau Studio (read-only) akun @${target.username}`,
    });

    return {
      user: target,
      links: userLinks,
      subscribers: userSubs,
      inquiries: userInq,
      platformNotice: {
        announcementEnabled: settings.announcementEnabled,
        announcementTitle: settings.announcementTitle,
        announcementMessage: settings.announcementMessage,
        announcementType: settings.announcementType,
        maintenanceMode: settings.maintenanceMode,
        maintenanceMessage: settings.maintenanceMessage,
        freeLinkLimit: settings.freeLinkLimit,
      },
      verificationRequest,
      themeTemplates: templates,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('tidak ditemukan')) {
      throw error;
    }
    console.error(
      'Database query failed (getAdminWorkspacePreviewById):',
      error
    );
    throw new Error('Gagal memuat pratinjau studio pengguna.', { cause: error });
  }
}

// --- Promo Coupons & Pro Upgrade History ---

export async function getAdminCouponsAndHistory(): Promise<{
  coupons: PromoCouponDTO[];
  history: ProSubscriptionLogDTO[];
}> {
  try {
    const [couponRows, historyRows] = await Promise.all([
      db.select().from(promoCoupons).orderBy(desc(promoCoupons.createdAt)),
      db
        .select()
        .from(proSubscriptionsLog)
        .orderBy(desc(proSubscriptionsLog.createdAt))
        .limit(100),
    ]);
    return {
      coupons: couponRows,
      history: historyRows,
    };
  } catch (error) {
    console.error('Database query failed (getAdminCouponsAndHistory):', error);
    throw new Error('Gagal memuat data kupon & riwayat Pro.', { cause: error });
  }
}

export async function superAdminCreateCoupon(
  actingAdminUid: string,
  actingAdminEmail: string,
  input: {
    code: string;
    description?: string;
    durationDays: number;
    maxUses: number;
    expiresAt?: string | null;
    isActive?: boolean;
  }
): Promise<PromoCouponDTO> {
  try {
    const cleanCode = (input.code || '')
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 32);
    if (cleanCode.length < 3) {
      throw new Error(
        'Kode kupon minimal 3 karakter (huruf kapital, angka, -, _).'
      );
    }

    const existing = await db
      .select({ id: promoCoupons.id })
      .from(promoCoupons)
      .where(eq(promoCoupons.code, cleanCode))
      .limit(1);
    if (existing[0]) {
      throw new Error(`Kode kupon "${cleanCode}" sudah ada.`);
    }

    const durationDays = Math.max(
      0,
      Math.min(3650, Math.round(Number(input.durationDays) || 0))
    );
    const maxUses = Math.max(
      1,
      Math.min(100000, Math.round(Number(input.maxUses) || 100))
    );
    const expiresAt = parseOptionalDate(input.expiresAt) ?? null;

    const inserted = await db
      .insert(promoCoupons)
      .values({
        code: cleanCode,
        description: (input.description || '').trim().slice(0, 200),
        durationDays,
        maxUses,
        usedCount: 0,
        isActive: input.isActive !== undefined ? Boolean(input.isActive) : true,
        expiresAt,
        createdBy: actingAdminEmail,
      })
      .returning();

    await recordAdminAuditLog({
      actingAdminUid,
      actingAdminEmail,
      action: 'CREATE_COUPON',
      details: `Membuat kupon "${cleanCode}" (${
        durationDays === 0 ? 'Pro Selamanya' : `${durationDays} hari`
      }, kuota ${maxUses}x)`,
    });

    return inserted[0];
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('Kode kupon') || error.message.includes('sudah ada'))
    ) {
      throw error;
    }
    console.error('Database query failed (superAdminCreateCoupon):', error);
    throw new Error('Gagal membuat kupon promo.', { cause: error });
  }
}

export async function superAdminUpdateCoupon(
  couponId: number,
  actingAdminUid: string,
  actingAdminEmail: string,
  patch: {
    isActive?: boolean;
    maxUses?: number;
    description?: string;
    expiresAt?: string | null;
  }
): Promise<PromoCouponDTO> {
  try {
    const existingRows = await db
      .select()
      .from(promoCoupons)
      .where(eq(promoCoupons.id, couponId))
      .limit(1);
    const coupon = existingRows[0];
    if (!coupon) throw new Error('Kupon tidak ditemukan.');

    const updateData: Record<string, unknown> = {};
    if (patch.isActive !== undefined) {
      updateData.isActive = Boolean(patch.isActive);
    }
    if (patch.maxUses !== undefined) {
      updateData.maxUses = Math.max(
        coupon.usedCount,
        Math.min(100000, Math.round(Number(patch.maxUses) || 1))
      );
    }
    if (patch.description !== undefined) {
      updateData.description = patch.description.trim().slice(0, 200);
    }
    if (patch.expiresAt !== undefined) {
      updateData.expiresAt = parseOptionalDate(patch.expiresAt) ?? null;
    }

    const updated = await db
      .update(promoCoupons)
      .set(updateData)
      .where(eq(promoCoupons.id, couponId))
      .returning();

    await recordAdminAuditLog({
      actingAdminUid,
      actingAdminEmail,
      action: 'UPDATE_COUPON',
      details: `Memperbarui kupon "${coupon.code}" (aktif: ${updated[0].isActive ? 'Ya' : 'Tidak'})`,
    });

    return updated[0];
  } catch (error) {
    if (error instanceof Error && error.message.includes('tidak ditemukan')) {
      throw error;
    }
    console.error('Database query failed (superAdminUpdateCoupon):', error);
    throw new Error('Gagal memperbarui kupon.', { cause: error });
  }
}

export async function superAdminDeleteCoupon(
  couponId: number,
  actingAdminUid: string,
  actingAdminEmail: string
) {
  try {
    const deleted = await db
      .delete(promoCoupons)
      .where(eq(promoCoupons.id, couponId))
      .returning();
    if (!deleted[0]) throw new Error('Kupon tidak ditemukan.');

    await recordAdminAuditLog({
      actingAdminUid,
      actingAdminEmail,
      action: 'DELETE_COUPON',
      details: `Menghapus kupon "${deleted[0].code}"`,
    });
  } catch (error) {
    console.error('Database query failed (superAdminDeleteCoupon):', error);
    throw new Error('Gagal menghapus kupon.', { cause: error });
  }
}

export async function redeemPromoCouponForUser(
  uid: string,
  rawCode: string
): Promise<{ user: UserRecord; couponCode: string; expiresAt: Date | null }> {
  try {
    const cleanCode = (rawCode || '')
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 32);
    if (!cleanCode) {
      throw new Error('Masukkan kode kupon yang valid.');
    }

    return await db.transaction(async (tx) => {
      const userRows = await tx
        .select()
        .from(users)
        .where(eq(users.uid, uid))
        .limit(1);
      const user = userRows[0];
      if (!user) throw new Error('Pengguna tidak ditemukan.');
      if (user.isSuspended) {
        throw new Error('Akun Anda sedang dinonaktifkan sementara.');
      }

      const couponRows = await tx
        .select()
        .from(promoCoupons)
        .where(eq(promoCoupons.code, cleanCode))
        .limit(1);
      const coupon = couponRows[0];
      if (!coupon || !coupon.isActive) {
        throw new Error('Kode kupon tidak ditemukan atau sudah tidak aktif.');
      }
      if (
        coupon.expiresAt &&
        new Date(coupon.expiresAt).getTime() <= Date.now()
      ) {
        throw new Error('Masa berlaku kode kupon ini telah berakhir.');
      }

      const priorRedemption = await tx
        .select({ id: proSubscriptionsLog.id })
        .from(proSubscriptionsLog)
        .where(
          and(
            eq(proSubscriptionsLog.userId, user.id),
            eq(proSubscriptionsLog.couponCode, cleanCode)
          )
        )
        .limit(1);
      if (priorRedemption[0]) {
        throw new Error('Anda sudah pernah menukarkan kode kupon ini.');
      }

      // Atomic conditional increment so concurrent redemptions cannot exceed maxUses
      const incremented = await tx
        .update(promoCoupons)
        .set({ usedCount: sql`${promoCoupons.usedCount} + 1` })
        .where(
          and(
            eq(promoCoupons.id, coupon.id),
            lt(promoCoupons.usedCount, coupon.maxUses)
          )
        )
        .returning();

      if (!incremented[0]) {
        throw new Error('Kuota penggunaan kode kupon ini sudah habis.');
      }

      let nextExpiresAt: Date | null = null;
      if (coupon.durationDays > 0) {
        const now = Date.now();
        const currentExpMs =
          user.planTier === 'pro' && user.planExpiresAt
            ? new Date(user.planExpiresAt).getTime()
            : 0;
        const baseMs = currentExpMs > now ? currentExpMs : now;
        nextExpiresAt = new Date(
          baseMs + coupon.durationDays * 24 * 60 * 60 * 1000
        );
      }

      const updatedUsers = await tx
        .update(users)
        .set({
          planTier: 'pro',
          planExpiresAt: nextExpiresAt,
          updatedAt: new Date(),
          lastActiveAt: new Date(),
        })
        .where(eq(users.id, user.id))
        .returning();

      await tx.insert(proSubscriptionsLog).values({
        userId: user.id,
        username: user.username,
        source: 'coupon',
        couponCode: cleanCode,
        planTier: 'pro',
        durationDays: coupon.durationDays,
        expiresAt: nextExpiresAt,
        actorEmail: user.email,
        note:
          coupon.durationDays === 0
            ? `Klaim kupon ${cleanCode} (Pro Selamanya)`
            : `Klaim kupon ${cleanCode} (+${coupon.durationDays} hari)`,
      });

      return {
        user: updatedUsers[0],
        couponCode: cleanCode,
        expiresAt: nextExpiresAt,
      };
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('kupon') ||
        error.message.includes('Kode') ||
        error.message.includes('Masa berlaku') ||
        error.message.includes('Kuota') ||
        error.message.includes('sudah pernah') ||
        error.message.includes('dinonaktifkan'))
    ) {
      throw error;
    }
    console.error('Database query failed (redeemPromoCouponForUser):', error);
    throw new Error('Gagal menukarkan kode kupon.', { cause: error });
  }
}

// --- Curated Global Theme Templates ---

function sanitizeCssValue(raw: string, fallback: string): string {
  const cleaned = (raw || '').trim().slice(0, 240);
  if (!cleaned) return fallback;
  if (/[;<>{}]|javascript:|expression\(|url\(/i.test(cleaned)) {
    return fallback;
  }
  return cleaned;
}

export async function getOrSeedThemeTemplates(
  onlyActive = false
): Promise<CuratedThemeTemplateDTO[]> {
  try {
    let rows = await db
      .select()
      .from(themeTemplates)
      .orderBy(asc(themeTemplates.sortOrder), asc(themeTemplates.id));

    if (rows.length === 0) {
      await db
        .insert(themeTemplates)
        .values(
          THEME_PRESETS.map((preset, idx) => ({
            slug: preset.id,
            name: preset.name,
            description: preset.description,
            bgType: preset.config.bgType,
            bgColor: preset.config.bgColor,
            bgGradient: preset.config.bgGradient,
            buttonColor: preset.config.buttonColor,
            buttonTextColor: preset.config.buttonTextColor,
            buttonShape: preset.config.buttonShape,
            textColor: preset.config.textColor,
            fontFamily: preset.config.fontFamily,
            isActive: true,
            isProOnly: false,
            sortOrder: idx + 1,
          }))
        )
        .onConflictDoNothing({ target: themeTemplates.slug });

      rows = await db
        .select()
        .from(themeTemplates)
        .orderBy(asc(themeTemplates.sortOrder), asc(themeTemplates.id));
    }

    return onlyActive ? rows.filter((r) => r.isActive) : rows;
  } catch (error) {
    console.error('Database query failed (getOrSeedThemeTemplates):', error);
    return THEME_PRESETS.map((p, idx) => ({
      id: idx + 1,
      slug: p.id,
      name: p.name,
      description: p.description,
      ...p.config,
      isActive: true,
      isProOnly: false,
      sortOrder: idx + 1,
    }));
  }
}

export async function superAdminCreateThemeTemplate(
  actingAdminUid: string,
  actingAdminEmail: string,
  input: {
    slug: string;
    name: string;
    description?: string;
    bgType: string;
    bgColor: string;
    bgGradient?: string;
    buttonColor: string;
    buttonTextColor: string;
    buttonShape: string;
    textColor: string;
    fontFamily: string;
    isActive?: boolean;
    isProOnly?: boolean;
    sortOrder?: number;
  }
): Promise<CuratedThemeTemplateDTO> {
  try {
    const cleanName = (input.name || '').trim().slice(0, 60);
    if (!cleanName) throw new Error('Nama tema wajib diisi.');
    const cleanSlug = sanitizeUsername(input.slug || cleanName).slice(0, 40);
    if (cleanSlug.length < 3) {
      throw new Error('Slug tema minimal 3 karakter.');
    }

    const conflict = await db
      .select({ id: themeTemplates.id })
      .from(themeTemplates)
      .where(eq(themeTemplates.slug, cleanSlug))
      .limit(1);
    if (conflict[0]) {
      throw new Error(`Slug tema "${cleanSlug}" sudah digunakan.`);
    }

    const inserted = await db
      .insert(themeTemplates)
      .values({
        slug: cleanSlug,
        name: cleanName,
        description: (input.description || '').trim().slice(0, 180),
        bgType: input.bgType === 'gradient' ? 'gradient' : 'solid',
        bgColor: sanitizeCssValue(input.bgColor, '#F6F5F1'),
        bgGradient: sanitizeCssValue(
          input.bgGradient || '',
          'linear-gradient(135deg, #F6F5F1 0%, #EAE7DF 100%)'
        ),
        buttonColor: sanitizeCssValue(input.buttonColor, '#141413'),
        buttonTextColor: sanitizeCssValue(input.buttonTextColor, '#FFFFFF'),
        buttonShape: ['square', 'rounded', 'pill'].includes(input.buttonShape)
          ? input.buttonShape
          : 'rounded',
        textColor: sanitizeCssValue(input.textColor, '#141413'),
        fontFamily: ['sans', 'serif', 'mono'].includes(input.fontFamily)
          ? input.fontFamily
          : 'sans',
        isActive: input.isActive !== undefined ? Boolean(input.isActive) : true,
        isProOnly: Boolean(input.isProOnly),
        sortOrder: Math.max(0, Number(input.sortOrder) || 10),
      })
      .returning();

    await recordAdminAuditLog({
      actingAdminUid,
      actingAdminEmail,
      action: 'CREATE_THEME',
      details: `Menambahkan template tema global "${cleanName}" (${cleanSlug}${
        input.isProOnly ? ', khusus Pro' : ''
      })`,
    });

    return inserted[0];
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('wajib') ||
        error.message.includes('Slug') ||
        error.message.includes('sudah digunakan'))
    ) {
      throw error;
    }
    console.error(
      'Database query failed (superAdminCreateThemeTemplate):',
      error
    );
    throw new Error('Gagal membuat template tema.', { cause: error });
  }
}

export async function superAdminUpdateThemeTemplate(
  themeId: number,
  actingAdminUid: string,
  actingAdminEmail: string,
  patch: Partial<{
    name: string;
    description: string;
    bgType: string;
    bgColor: string;
    bgGradient: string;
    buttonColor: string;
    buttonTextColor: string;
    buttonShape: string;
    textColor: string;
    fontFamily: string;
    isActive: boolean;
    isProOnly: boolean;
    sortOrder: number;
  }>
): Promise<CuratedThemeTemplateDTO> {
  try {
    const existingRows = await db
      .select()
      .from(themeTemplates)
      .where(eq(themeTemplates.id, themeId))
      .limit(1);
    const existing = existingRows[0];
    if (!existing) throw new Error('Template tema tidak ditemukan.');

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.name !== undefined) {
      const cleanName = patch.name.trim().slice(0, 60);
      if (!cleanName) throw new Error('Nama tema tidak boleh kosong.');
      updateData.name = cleanName;
    }
    if (patch.description !== undefined) {
      updateData.description = patch.description.trim().slice(0, 180);
    }
    if (patch.bgType !== undefined) {
      updateData.bgType = patch.bgType === 'gradient' ? 'gradient' : 'solid';
    }
    if (patch.bgColor !== undefined) {
      updateData.bgColor = sanitizeCssValue(patch.bgColor, existing.bgColor);
    }
    if (patch.bgGradient !== undefined) {
      updateData.bgGradient = sanitizeCssValue(
        patch.bgGradient,
        existing.bgGradient
      );
    }
    if (patch.buttonColor !== undefined) {
      updateData.buttonColor = sanitizeCssValue(
        patch.buttonColor,
        existing.buttonColor
      );
    }
    if (patch.buttonTextColor !== undefined) {
      updateData.buttonTextColor = sanitizeCssValue(
        patch.buttonTextColor,
        existing.buttonTextColor
      );
    }
    if (patch.buttonShape !== undefined) {
      updateData.buttonShape = ['square', 'rounded', 'pill'].includes(
        patch.buttonShape
      )
        ? patch.buttonShape
        : existing.buttonShape;
    }
    if (patch.textColor !== undefined) {
      updateData.textColor = sanitizeCssValue(
        patch.textColor,
        existing.textColor
      );
    }
    if (patch.fontFamily !== undefined) {
      updateData.fontFamily = ['sans', 'serif', 'mono'].includes(
        patch.fontFamily
      )
        ? patch.fontFamily
        : existing.fontFamily;
    }
    if (patch.isActive !== undefined) {
      updateData.isActive = Boolean(patch.isActive);
    }
    if (patch.isProOnly !== undefined) {
      updateData.isProOnly = Boolean(patch.isProOnly);
    }
    if (patch.sortOrder !== undefined) {
      updateData.sortOrder = Math.max(0, Number(patch.sortOrder) || 0);
    }

    const updated = await db
      .update(themeTemplates)
      .set(updateData)
      .where(eq(themeTemplates.id, themeId))
      .returning();

    await recordAdminAuditLog({
      actingAdminUid,
      actingAdminEmail,
      action: 'UPDATE_THEME',
      details: `Memperbarui template tema "${updated[0].name}" (${updated[0].slug})`,
    });

    return updated[0];
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('tidak ditemukan') ||
        error.message.includes('tidak boleh kosong'))
    ) {
      throw error;
    }
    console.error(
      'Database query failed (superAdminUpdateThemeTemplate):',
      error
    );
    throw new Error('Gagal memperbarui template tema.', { cause: error });
  }
}

export async function superAdminDeleteThemeTemplate(
  themeId: number,
  actingAdminUid: string,
  actingAdminEmail: string
) {
  try {
    const deleted = await db
      .delete(themeTemplates)
      .where(eq(themeTemplates.id, themeId))
      .returning();
    if (!deleted[0]) throw new Error('Template tema tidak ditemukan.');

    await recordAdminAuditLog({
      actingAdminUid,
      actingAdminEmail,
      action: 'DELETE_THEME',
      details: `Menghapus template tema "${deleted[0].name}" (${deleted[0].slug})`,
    });
  } catch (error) {
    console.error(
      'Database query failed (superAdminDeleteThemeTemplate):',
      error
    );
    throw new Error('Gagal menghapus template tema.', { cause: error });
  }
}

// --- Audit Log Export & Platform Config Backup/Restore ---

export function csvCellSafe(value: unknown): string {
  let str = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export async function getAuditLogsForExport(options?: {
  action?: string;
  search?: string;
}): Promise<AdminAuditLogDTO[]> {
  return getAdminAuditLogs({
    limit: 1000,
    action: options?.action,
    search: options?.search,
  });
}

export async function exportPlatformBackup(
  actingAdminUid: string,
  actingAdminEmail: string
): Promise<PlatformBackupDTO> {
  try {
    const [settings, themes, coupons, featuredUsers] = await Promise.all([
      getOrCreatePlatformSettings(),
      getOrSeedThemeTemplates(false),
      db.select().from(promoCoupons).orderBy(asc(promoCoupons.id)),
      db
        .select({
          username: users.username,
          featuredOrder: users.featuredOrder,
        })
        .from(users)
        .where(eq(users.isFeatured, true))
        .orderBy(asc(users.featuredOrder)),
    ]);

    await recordAdminAuditLog({
      actingAdminUid,
      actingAdminEmail,
      action: 'EXPORT_BACKUP',
      details: `Mengunduh arsip backup konfigurasi platform (${themes.length} tema, ${coupons.length} kupon)`,
    });

    return {
      version: 'lokabio-backup-v1',
      exportedAt: new Date().toISOString(),
      exportedBy: actingAdminEmail,
      settings,
      themes: themes.map((t) => ({
        slug: t.slug,
        name: t.name,
        description: t.description,
        bgType: t.bgType,
        bgColor: t.bgColor,
        bgGradient: t.bgGradient,
        buttonColor: t.buttonColor,
        buttonTextColor: t.buttonTextColor,
        buttonShape: t.buttonShape,
        textColor: t.textColor,
        fontFamily: t.fontFamily,
        isActive: t.isActive,
        isProOnly: t.isProOnly,
        sortOrder: t.sortOrder,
      })),
      coupons: coupons.map((c) => ({
        code: c.code,
        description: c.description,
        durationDays: c.durationDays,
        maxUses: c.maxUses,
        usedCount: c.usedCount,
        isActive: c.isActive,
        expiresAt: c.expiresAt,
        createdBy: c.createdBy,
      })),
      featuredCurations: featuredUsers,
    };
  } catch (error) {
    console.error('Database query failed (exportPlatformBackup):', error);
    throw new Error('Gagal membuat backup konfigurasi platform.', {
      cause: error,
    });
  }
}

export async function restorePlatformBackup(
  actingAdminUid: string,
  actingAdminEmail: string,
  payload: unknown
): Promise<{
  restoredSettings: boolean;
  restoredThemesCount: number;
  restoredCouponsCount: number;
}> {
  try {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Format file backup JSON tidak valid.');
    }
    const raw = payload as Record<string, unknown>;
    if (!raw.settings || typeof raw.settings !== 'object') {
      throw new Error(
        'File backup tidak berisi bagian "settings" yang valid.'
      );
    }

    const rawSettings = raw.settings as Record<string, unknown>;
    await superAdminUpdatePlatformSettings(actingAdminUid, actingAdminEmail, {
      announcementEnabled: Boolean(rawSettings.announcementEnabled),
      announcementTitle:
        typeof rawSettings.announcementTitle === 'string'
          ? rawSettings.announcementTitle
          : '',
      announcementMessage:
        typeof rawSettings.announcementMessage === 'string'
          ? rawSettings.announcementMessage
          : '',
      announcementType:
        typeof rawSettings.announcementType === 'string'
          ? rawSettings.announcementType
          : 'info',
      reservedUsernames: Array.isArray(rawSettings.reservedUsernames)
        ? rawSettings.reservedUsernames.map(String)
        : undefined,
      maintenanceMode: Boolean(rawSettings.maintenanceMode),
      maintenanceMessage:
        typeof rawSettings.maintenanceMessage === 'string'
          ? rawSettings.maintenanceMessage
          : undefined,
      registrationOpen:
        rawSettings.registrationOpen !== undefined
          ? Boolean(rawSettings.registrationOpen)
          : true,
      freeLinkLimit:
        typeof rawSettings.freeLinkLimit === 'number'
          ? rawSettings.freeLinkLimit
          : undefined,
      blockedDomains: Array.isArray(rawSettings.blockedDomains)
        ? rawSettings.blockedDomains.map(String)
        : undefined,
    });

    let restoredThemesCount = 0;
    if (Array.isArray(raw.themes)) {
      for (const item of raw.themes.slice(0, 50)) {
        if (!item || typeof item !== 'object') continue;
        const t = item as Record<string, unknown>;
        const slug = sanitizeUsername(String(t.slug || '')).slice(0, 40);
        const name = String(t.name || '').trim().slice(0, 60);
        if (slug.length < 3 || !name) continue;

        await db
          .insert(themeTemplates)
          .values({
            slug,
            name,
            description: String(t.description || '').trim().slice(0, 180),
            bgType: t.bgType === 'gradient' ? 'gradient' : 'solid',
            bgColor: sanitizeCssValue(String(t.bgColor || ''), '#F6F5F1'),
            bgGradient: sanitizeCssValue(String(t.bgGradient || ''), ''),
            buttonColor: sanitizeCssValue(
              String(t.buttonColor || ''),
              '#141413'
            ),
            buttonTextColor: sanitizeCssValue(
              String(t.buttonTextColor || ''),
              '#FFFFFF'
            ),
            buttonShape: ['square', 'rounded', 'pill'].includes(
              String(t.buttonShape)
            )
              ? String(t.buttonShape)
              : 'rounded',
            textColor: sanitizeCssValue(String(t.textColor || ''), '#141413'),
            fontFamily: ['sans', 'serif', 'mono'].includes(String(t.fontFamily))
              ? String(t.fontFamily)
              : 'sans',
            isActive: t.isActive !== undefined ? Boolean(t.isActive) : true,
            isProOnly: Boolean(t.isProOnly),
            sortOrder: Math.max(0, Number(t.sortOrder) || 0),
          })
          .onConflictDoUpdate({
            target: themeTemplates.slug,
            set: {
              name,
              description: String(t.description || '').trim().slice(0, 180),
              bgType: t.bgType === 'gradient' ? 'gradient' : 'solid',
              bgColor: sanitizeCssValue(String(t.bgColor || ''), '#F6F5F1'),
              bgGradient: sanitizeCssValue(String(t.bgGradient || ''), ''),
              buttonColor: sanitizeCssValue(
                String(t.buttonColor || ''),
                '#141413'
              ),
              buttonTextColor: sanitizeCssValue(
                String(t.buttonTextColor || ''),
                '#FFFFFF'
              ),
              buttonShape: ['square', 'rounded', 'pill'].includes(
                String(t.buttonShape)
              )
                ? String(t.buttonShape)
                : 'rounded',
              textColor: sanitizeCssValue(String(t.textColor || ''), '#141413'),
              fontFamily: ['sans', 'serif', 'mono'].includes(
                String(t.fontFamily)
              )
                ? String(t.fontFamily)
                : 'sans',
              isActive: t.isActive !== undefined ? Boolean(t.isActive) : true,
              isProOnly: Boolean(t.isProOnly),
              sortOrder: Math.max(0, Number(t.sortOrder) || 0),
              updatedAt: new Date(),
            },
          });
        restoredThemesCount += 1;
      }
    }

    let restoredCouponsCount = 0;
    if (Array.isArray(raw.coupons)) {
      for (const item of raw.coupons.slice(0, 100)) {
        if (!item || typeof item !== 'object') continue;
        const c = item as Record<string, unknown>;
        const code = String(c.code || '')
          .toUpperCase()
          .replace(/[^A-Z0-9_-]/g, '')
          .slice(0, 32);
        if (code.length < 3) continue;

        await db
          .insert(promoCoupons)
          .values({
            code,
            description: String(c.description || '').trim().slice(0, 200),
            durationDays: Math.max(
              0,
              Math.min(3650, Math.round(Number(c.durationDays) || 0))
            ),
            maxUses: Math.max(
              1,
              Math.min(100000, Math.round(Number(c.maxUses) || 100))
            ),
            usedCount: Math.max(0, Math.round(Number(c.usedCount) || 0)),
            isActive: c.isActive !== undefined ? Boolean(c.isActive) : true,
            expiresAt: parseOptionalDate(c.expiresAt) ?? null,
            createdBy:
              typeof c.createdBy === 'string' && c.createdBy
                ? c.createdBy
                : actingAdminEmail,
          })
          .onConflictDoNothing({ target: promoCoupons.code });
        restoredCouponsCount += 1;
      }
    }

    await recordAdminAuditLog({
      actingAdminUid,
      actingAdminEmail,
      action: 'RESTORE_BACKUP',
      details: `Memulihkan konfigurasi dari backup JSON (${restoredThemesCount} tema, ${restoredCouponsCount} kupon)`,
    });

    return {
      restoredSettings: true,
      restoredThemesCount,
      restoredCouponsCount,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('backup')) {
      throw error;
    }
    console.error('Database query failed (restorePlatformBackup):', error);
    throw new Error('Gagal memulihkan konfigurasi platform dari backup.', {
      cause: error,
    });
  }
}
