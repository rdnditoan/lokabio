import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { type AuthRequest, requireAuth, requireSuperAdmin } from './src/middleware/auth.ts';
import {
  createUserLink,
  deleteUserInquiry,
  deleteUserLink,
  deleteUserSubscriber,
  detectDeviceType,
  duplicateUserLink,
  getAdminAuditLogs,
  getAdminReports,
  getAdminUserDetail,
  getAdminVerificationRequests,
  getAdminWorkspaceByUid,
  getAllUsernamesForSitemap,
  getFeaturedProfiles,
  getOrCreatePlatformSettings,
  getOrCreateUser,
  getPlatformAdminOverview,
  getPlatformGlobalAnalytics,
  getPublicProfileByUsername,
  getUserAnalyticsSummary,
  getUserLatestVerificationRequest,
  incrementLinkClick,
  incrementProfileViews,
  isUsernameAvailable,
  markUserInquiryRead,
  reorderUserLinks,
  submitProfileInquiry,
  submitProfileReport,
  submitVerificationRequest,
  subscribeToProfile,
  superAdminDeleteLink,
  superAdminDeleteUser,
  superAdminModerateLink,
  superAdminReviewReport,
  superAdminReviewVerification,
  superAdminUpdateFeaturedOrder,
  superAdminUpdatePlatformSettings,
  superAdminUpdateUser,
  toPublicLinkDTO,
  unlockPinProtectedLink,
  updateUserLink,
  updateUserProfile,
} from './src/db/queries.ts';
import { isLinkScheduledActive } from './src/shared/themes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESERVED_PATHS = new Set([
  'dashboard',
  'admin',
  'login',
  'masuk',
  'register',
  'daftar',
  'api',
  'assets',
  'src',
  'sitemap.xml',
  'robots.txt',
  'favicon.ico',
]);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveBaseUrl(req: Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured && configured !== 'MY_APP_URL') {
    return configured.replace(/\/+$/, '');
  }
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host =
    req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

function resolveAbsoluteMediaUrl(baseUrl: string, maybeRelative: string): string {
  if (!maybeRelative) return '';
  if (maybeRelative.startsWith('http://') || maybeRelative.startsWith('https://')) {
    return maybeRelative;
  }
  if (maybeRelative.startsWith('data:')) {
    return '';
  }
  return `${baseUrl}${maybeRelative.startsWith('/') ? '' : '/'}${maybeRelative}`;
}

function injectProfileSeoIntoHtml(
  html: string,
  options: {
    title: string;
    description: string;
    imageUrl: string;
    canonicalUrl: string;
    displayName: string;
    username: string;
  }
): string {
  const title = escapeHtml(options.title);
  const description = escapeHtml(options.description);
  const canonicalUrl = escapeHtml(options.canonicalUrl);
  const imageUrl = escapeHtml(options.imageUrl);

  let next = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);

  next = next.replace(
    /<meta\s+name="description"\s+content="[\s\S]*?"\s*\/?>/i,
    `<meta name="description" content="${description}" />`
  );
  next = next.replace(
    /<meta\s+property="og:title"\s+content="[\s\S]*?"\s*\/?>/i,
    `<meta property="og:title" content="${title}" />`
  );
  next = next.replace(
    /<meta\s+property="og:description"\s+content="[\s\S]*?"\s*\/?>/i,
    `<meta property="og:description" content="${description}" />`
  );
  next = next.replace(
    /<meta\s+name="twitter:title"\s+content="[\s\S]*?"\s*\/?>/i,
    `<meta name="twitter:title" content="${title}" />`
  );
  next = next.replace(
    /<meta\s+name="twitter:description"\s+content="[\s\S]*?"\s*\/?>/i,
    `<meta name="twitter:description" content="${description}" />`
  );

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: options.displayName,
      alternateName: `@${options.username}`,
      description: options.description,
      url: options.canonicalUrl,
      ...(options.imageUrl ? { image: options.imageUrl } : {}),
    },
  }).replace(/</g, '\\u003c');

  const extraTags = [
    `<link rel="canonical" href="${canonicalUrl}" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    imageUrl ? `<meta property="og:image" content="${imageUrl}" />` : '',
    imageUrl ? `<meta name="twitter:image" content="${imageUrl}" />` : '',
    `<script type="application/ld+json">${jsonLd}</script>`,
  ]
    .filter(Boolean)
    .join('\n    ');

  return next.replace('</head>', `    ${extraTags}\n  </head>`);
}

function extractTrackingMeta(req: Request) {
  const clientRef =
    typeof req.body?.referrer === 'string'
      ? req.body.referrer
      : String(req.headers.referer || '');
  const device = detectDeviceType(String(req.headers['user-agent'] || ''));
  return { referrer: clientRef, device };
}

async function startServer() {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';
  const port = Number(process.env.PORT || 3000);

  app.set('trust proxy', true);
  app.use(express.json({ limit: '2mb' }));

  // --- Public BioLink API Routes ---

  app.get('/api/public/featured', async (_req: Request, res: Response) => {
    try {
      const profiles = await getFeaturedProfiles();
      const sanitized = profiles.map(({ uid: _uid, email: _email, ...pub }) => pub);
      res.json({ profiles: sanitized });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Gagal memuat profil.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/public/profiles/:username', async (req: Request, res: Response) => {
    try {
      const username = String(req.params.username || '');
      const profile = await getPublicProfileByUsername(username);
      if (!profile) {
        return res.status(404).json({ error: 'Profil tidak ditemukan.' });
      }
      if (profile.isSuspended) {
        return res.status(403).json({
          error: 'Halaman profil ini sedang dinonaktifkan sementara oleh administrator.',
        });
      }
      const now = new Date();
      const { uid: _uid, email: _email, ...publicFields } = profile;
      res.json({
        profile: {
          ...publicFields,
          links: profile.links
            .filter((link) => isLinkScheduledActive(link, now))
            .map(toPublicLinkDTO),
        },
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Gagal memuat profil.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/public/profiles/:username/view', async (req: Request, res: Response) => {
    try {
      const username = String(req.params.username || '');
      const views = await incrementProfileViews(username, extractTrackingMeta(req));
      res.json({ profileViews: views });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Gagal mencatat kunjungan.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/public/links/:id/click', async (req: Request, res: Response) => {
    try {
      const linkId = Number(req.params.id);
      if (!Number.isFinite(linkId) || linkId <= 0) {
        return res.status(400).json({ error: 'ID tautan tidak valid.' });
      }
      const updated = await incrementLinkClick(linkId, extractTrackingMeta(req));
      if (!updated) {
        return res.status(404).json({ error: 'Tautan tidak ditemukan.' });
      }
      res.json({ link: updated });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Gagal mencatat klik.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/public/links/:id/unlock', async (req: Request, res: Response) => {
    try {
      const linkId = Number(req.params.id);
      if (!Number.isFinite(linkId) || linkId <= 0) {
        return res.status(400).json({ error: 'ID tautan tidak valid.' });
      }
      const pin = String(req.body?.pin || '');
      const result = await unlockPinProtectedLink(
        linkId,
        pin,
        extractTrackingMeta(req)
      );
      if (!result.unlocked) {
        return res.status(403).json({ error: result.error || 'PIN salah.' });
      }
      res.json({ url: result.url });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Gagal membuka tautan.';
      res.status(500).json({ error: message });
    }
  });

  app.post(
    '/api/public/profiles/:username/subscribe',
    async (req: Request, res: Response) => {
      try {
        const username = String(req.params.username || '');
        const email = String(req.body?.email || '');
        const name = String(req.body?.name || '');
        const result = await subscribeToProfile(username, email, name);
        res.status(201).json(result);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Gagal berlangganan.';
        res.status(400).json({ error: message });
      }
    }
  );

  app.post(
    '/api/public/profiles/:username/inquiry',
    async (req: Request, res: Response) => {
      try {
        const username = String(req.params.username || '');
        const senderName = String(req.body?.senderName || '');
        const senderContact = String(req.body?.senderContact || '');
        const message = String(req.body?.message || '');
        const created = await submitProfileInquiry(
          username,
          senderName,
          senderContact,
          message
        );
        res.status(201).json({ inquiry: created });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Gagal mengirim pesan.';
        res.status(400).json({ error: message });
      }
    }
  );

  app.post(
    '/api/public/profiles/:username/report',
    async (req: Request, res: Response) => {
      try {
        const username = String(req.params.username || '');
        const reason = String(req.body?.reason || '');
        const details = String(req.body?.details || '');
        const reporterEmail = String(req.body?.reporterEmail || '');
        const report = await submitProfileReport(username, {
          reason,
          details,
          reporterEmail,
        });
        res.status(201).json({ report });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Gagal mengirim laporan.';
        res.status(400).json({ error: message });
      }
    }
  );

  app.get('/api/public/username-check', async (req: Request, res: Response) => {
    try {
      const username = String(req.query.username || '');
      const result = await isUsernameAvailable(username);
      res.json(result);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Gagal memeriksa username.';
      res.status(500).json({ error: message });
    }
  });

  // --- Authenticated Admin Studio API Routes ---

  app.get('/api/admin/workspace', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const decoded = req.user!;
      const preferredUsername =
        typeof req.query.username === 'string' ? req.query.username : undefined;
      const preferredDisplayName =
        typeof req.query.displayName === 'string' && req.query.displayName.trim()
          ? req.query.displayName.trim()
          : decoded.name;

      await getOrCreateUser(
        decoded.uid,
        decoded.email || '',
        preferredDisplayName,
        decoded.picture,
        preferredUsername
      );
      const workspace = await getAdminWorkspaceByUid(decoded.uid);
      if (!workspace) {
        return res.status(404).json({ error: 'Workspace tidak ditemukan.' });
      }
      const [settings, verificationRequest] = await Promise.all([
        getOrCreatePlatformSettings(),
        getUserLatestVerificationRequest(workspace.user.id),
      ]);
      res.json({
        ...workspace,
        platformNotice: {
          announcementEnabled: settings.announcementEnabled,
          announcementTitle: settings.announcementTitle,
          announcementMessage: settings.announcementMessage,
          announcementType: settings.announcementType,
        },
        verificationRequest,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Gagal memuat studio.';
      res.status(500).json({ error: message });
    }
  });

  app.post(
    '/api/admin/verification-request',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        const { category, proofUrl, note } = req.body || {};
        const created = await submitVerificationRequest(req.user!.uid, {
          category: String(category || ''),
          proofUrl: String(proofUrl || ''),
          note: String(note || ''),
        });
        res.status(201).json({ verificationRequest: created });
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Gagal mengirim pengajuan verifikasi.';
        res.status(400).json({ error: message });
      }
    }
  );

  app.get('/api/admin/analytics', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const days = Number(req.query.days) === 30 ? 30 : 7;
      const summary = await getUserAnalyticsSummary(req.user!.uid, days);
      res.json(summary);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Gagal memuat analitik.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/admin/username-check', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const username = String(req.query.username || '');
      const result = await isUsernameAvailable(username, req.user!.uid);
      res.json(result);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Gagal memeriksa username.';
      res.status(500).json({ error: message });
    }
  });

  app.put('/api/admin/profile', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const updated = await updateUserProfile(req.user!.uid, req.body);
      res.json({ user: updated });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Gagal memperbarui profil.';
      const status = message.includes('dinonaktifkan')
        ? 403
        : message.includes('Username') || message.includes('sudah digunakan')
        ? 400
        : 500;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/admin/links', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const {
        linkType,
        title,
        subtitle,
        url,
        icon,
        thumbnailUrl,
        priceText,
        badgeText,
        category,
        galleryUrls,
        pinCode,
        publishAt,
        expireAt,
        isActive,
      } = req.body || {};
      const resolvedType = String(linkType || 'standard');
      if (!title || !String(title).trim()) {
        return res.status(400).json({ error: 'Judul tautan wajib diisi.' });
      }
      if (
        resolvedType !== 'header' &&
        resolvedType !== 'gallery' &&
        (!url || !String(url).trim())
      ) {
        return res.status(400).json({ error: 'URL tautan wajib diisi.' });
      }
      const created = await createUserLink(req.user!.uid, {
        linkType: resolvedType,
        title: String(title),
        subtitle: subtitle ? String(subtitle) : '',
        url: url ? String(url) : '',
        icon: icon ? String(icon) : 'link',
        thumbnailUrl: thumbnailUrl ? String(thumbnailUrl) : '',
        priceText: priceText ? String(priceText) : '',
        badgeText: badgeText ? String(badgeText) : '',
        category: category ? String(category) : '',
        galleryUrls: Array.isArray(galleryUrls) ? galleryUrls : [],
        pinCode: pinCode ? String(pinCode) : '',
        publishAt: publishAt ?? null,
        expireAt: expireAt ?? null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      });
      res.status(201).json({ link: created });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Gagal menambah tautan.';
      res.status(500).json({ error: message });
    }
  });

  app.post(
    '/api/admin/links/:id/duplicate',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        const linkId = Number(req.params.id);
        if (!Number.isFinite(linkId) || linkId <= 0) {
          return res.status(400).json({ error: 'ID tautan tidak valid.' });
        }
        const cloned = await duplicateUserLink(req.user!.uid, linkId);
        res.status(201).json({ link: cloned });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Gagal menggandakan tautan.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.put('/api/admin/links/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const linkId = Number(req.params.id);
      if (!Number.isFinite(linkId) || linkId <= 0) {
        return res.status(400).json({ error: 'ID tautan tidak valid.' });
      }
      const updated = await updateUserLink(req.user!.uid, linkId, req.body || {});
      res.json({ link: updated });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Gagal memperbarui tautan.';
      res.status(500).json({ error: message });
    }
  });

  app.delete('/api/admin/links/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const linkId = Number(req.params.id);
      if (!Number.isFinite(linkId) || linkId <= 0) {
        return res.status(400).json({ error: 'ID tautan tidak valid.' });
      }
      const deleted = await deleteUserLink(req.user!.uid, linkId);
      res.json({ link: deleted });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Gagal menghapus tautan.';
      res.status(500).json({ error: message });
    }
  });

  app.patch('/api/admin/links/reorder', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const orderedIds = Array.isArray(req.body?.orderedIds)
        ? req.body.orderedIds
            .map((id: unknown) => Number(id))
            .filter((n: number) => Number.isFinite(n))
        : [];
      if (orderedIds.length === 0) {
        return res.status(400).json({ error: 'Daftar urutan tautan tidak valid.' });
      }
      const reordered = await reorderUserLinks(req.user!.uid, orderedIds);
      res.json({ links: reordered });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Gagal menyusun ulang tautan.';
      res.status(500).json({ error: message });
    }
  });

  app.delete(
    '/api/admin/subscribers/:id',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        const subId = Number(req.params.id);
        if (!Number.isFinite(subId) || subId <= 0) {
          return res.status(400).json({ error: 'ID subscriber tidak valid.' });
        }
        await deleteUserSubscriber(req.user!.uid, subId);
        res.json({ ok: true });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Gagal menghapus subscriber.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.patch(
    '/api/admin/inquiries/:id',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        const inquiryId = Number(req.params.id);
        if (!Number.isFinite(inquiryId) || inquiryId <= 0) {
          return res.status(400).json({ error: 'ID pesan tidak valid.' });
        }
        const updated = await markUserInquiryRead(
          req.user!.uid,
          inquiryId,
          Boolean(req.body?.isRead)
        );
        res.json({ inquiry: updated });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Gagal memperbarui pesan.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.delete(
    '/api/admin/inquiries/:id',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        const inquiryId = Number(req.params.id);
        if (!Number.isFinite(inquiryId) || inquiryId <= 0) {
          return res.status(400).json({ error: 'ID pesan tidak valid.' });
        }
        await deleteUserInquiry(req.user!.uid, inquiryId);
        res.json({ ok: true });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Gagal menghapus pesan.';
        res.status(500).json({ error: message });
      }
    }
  );

  // --- Super Admin Platform Management API Routes ---

  app.get(
    '/api/superadmin/overview',
    requireAuth,
    requireSuperAdmin,
    async (req: AuthRequest, res: Response) => {
      try {
        const search = typeof req.query.q === 'string' ? req.query.q : '';
        const overview = await getPlatformAdminOverview(search);
        res.json(overview);
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Gagal memuat panel Super Admin.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.get(
    '/api/superadmin/analytics',
    requireAuth,
    requireSuperAdmin,
    async (req: AuthRequest, res: Response) => {
      try {
        const days = Number(req.query.days) || 14;
        const analytics = await getPlatformGlobalAnalytics(days);
        res.json(analytics);
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Gagal memuat analitik platform.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.get(
    '/api/superadmin/users/:id/detail',
    requireAuth,
    requireSuperAdmin,
    async (req: AuthRequest, res: Response) => {
      try {
        const targetId = Number(req.params.id);
        if (!Number.isFinite(targetId) || targetId <= 0) {
          return res.status(400).json({ error: 'ID pengguna tidak valid.' });
        }
        const detail = await getAdminUserDetail(targetId);
        res.json(detail);
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Gagal memuat detail pengguna.';
        res.status(404).json({ error: message });
      }
    }
  );

  app.patch(
    '/api/superadmin/users/:id',
    requireAuth,
    requireSuperAdmin,
    async (req: AuthRequest, res: Response) => {
      try {
        const targetId = Number(req.params.id);
        if (!Number.isFinite(targetId) || targetId <= 0) {
          return res.status(400).json({ error: 'ID pengguna tidak valid.' });
        }
        const {
          role,
          isVerified,
          isSuspended,
          isFeatured,
          featuredOrder,
          newUsername,
        } = req.body || {};
        const updated = await superAdminUpdateUser(
          targetId,
          req.user!.uid,
          req.user!.email || '',
          {
            role,
            isVerified,
            isSuspended,
            isFeatured,
            featuredOrder,
            newUsername,
          }
        );
        res.json({ user: updated });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Gagal memperbarui pengguna.';
        const status =
          message.includes('tidak dapat') ||
          message.includes('Username') ||
          message.includes('sudah dipakai')
            ? 400
            : 500;
        res.status(status).json({ error: message });
      }
    }
  );

  app.delete(
    '/api/superadmin/users/:id',
    requireAuth,
    requireSuperAdmin,
    async (req: AuthRequest, res: Response) => {
      try {
        const targetId = Number(req.params.id);
        if (!Number.isFinite(targetId) || targetId <= 0) {
          return res.status(400).json({ error: 'ID pengguna tidak valid.' });
        }
        await superAdminDeleteUser(
          targetId,
          req.user!.uid,
          req.user!.email || ''
        );
        res.json({ ok: true });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Gagal menghapus pengguna.';
        const status = message.includes('tidak dapat') ? 400 : 500;
        res.status(status).json({ error: message });
      }
    }
  );

  app.patch(
    '/api/superadmin/links/:linkId',
    requireAuth,
    requireSuperAdmin,
    async (req: AuthRequest, res: Response) => {
      try {
        const linkId = Number(req.params.linkId);
        if (!Number.isFinite(linkId) || linkId <= 0) {
          return res.status(400).json({ error: 'ID tautan tidak valid.' });
        }
        const updated = await superAdminModerateLink(
          linkId,
          req.user!.uid,
          req.user!.email || '',
          Boolean(req.body?.isActive)
        );
        res.json({ link: updated });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Gagal memoderasi tautan.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.delete(
    '/api/superadmin/links/:linkId',
    requireAuth,
    requireSuperAdmin,
    async (req: AuthRequest, res: Response) => {
      try {
        const linkId = Number(req.params.linkId);
        if (!Number.isFinite(linkId) || linkId <= 0) {
          return res.status(400).json({ error: 'ID tautan tidak valid.' });
        }
        await superAdminDeleteLink(
          linkId,
          req.user!.uid,
          req.user!.email || ''
        );
        res.json({ ok: true });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Gagal menghapus tautan.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.patch(
    '/api/superadmin/featured-order',
    requireAuth,
    requireSuperAdmin,
    async (req: AuthRequest, res: Response) => {
      try {
        const orderedUserIds = Array.isArray(req.body?.orderedUserIds)
          ? req.body.orderedUserIds
              .map((n: unknown) => Number(n))
              .filter((n: number) => Number.isFinite(n) && n > 0)
          : [];
        await superAdminUpdateFeaturedOrder(
          orderedUserIds,
          req.user!.uid,
          req.user!.email || ''
        );
        res.json({ ok: true });
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Gagal menyimpan urutan pratinjau.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.get(
    '/api/superadmin/reports',
    requireAuth,
    requireSuperAdmin,
    async (_req: AuthRequest, res: Response) => {
      try {
        const reports = await getAdminReports();
        res.json({ reports });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Gagal memuat laporan.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.patch(
    '/api/superadmin/reports/:id',
    requireAuth,
    requireSuperAdmin,
    async (req: AuthRequest, res: Response) => {
      try {
        const reportId = Number(req.params.id);
        if (!Number.isFinite(reportId) || reportId <= 0) {
          return res.status(400).json({ error: 'ID laporan tidak valid.' });
        }
        const { status, reviewedNote, suspendUser } = req.body || {};
        const report = await superAdminReviewReport(
          reportId,
          req.user!.uid,
          req.user!.email || '',
          {
            status: status === 'dismissed' ? 'dismissed' : 'resolved',
            reviewedNote: reviewedNote ? String(reviewedNote) : '',
            suspendUser: Boolean(suspendUser),
          }
        );
        res.json({ report });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Gagal memproses laporan.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.get(
    '/api/superadmin/verifications',
    requireAuth,
    requireSuperAdmin,
    async (_req: AuthRequest, res: Response) => {
      try {
        const requests = await getAdminVerificationRequests();
        res.json({ requests });
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Gagal memuat antrean verifikasi.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.patch(
    '/api/superadmin/verifications/:id',
    requireAuth,
    requireSuperAdmin,
    async (req: AuthRequest, res: Response) => {
      try {
        const reqId = Number(req.params.id);
        if (!Number.isFinite(reqId) || reqId <= 0) {
          return res.status(400).json({ error: 'ID pengajuan tidak valid.' });
        }
        const { status, reviewedNote } = req.body || {};
        const updated = await superAdminReviewVerification(
          reqId,
          req.user!.uid,
          req.user!.email || '',
          {
            status: status === 'approved' ? 'approved' : 'rejected',
            reviewedNote: reviewedNote ? String(reviewedNote) : '',
          }
        );
        res.json({ request: updated });
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Gagal memproses verifikasi.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.get(
    '/api/superadmin/audit-logs',
    requireAuth,
    requireSuperAdmin,
    async (_req: AuthRequest, res: Response) => {
      try {
        const logs = await getAdminAuditLogs(100);
        res.json({ logs });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Gagal memuat audit log.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.put(
    '/api/superadmin/settings',
    requireAuth,
    requireSuperAdmin,
    async (req: AuthRequest, res: Response) => {
      try {
        const settings = await superAdminUpdatePlatformSettings(
          req.user!.uid,
          req.user!.email || '',
          req.body || {}
        );
        res.json({ settings });
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Gagal menyimpan pengaturan platform.';
        res.status(500).json({ error: message });
      }
    }
  );

  // --- Dynamic SEO: sitemap.xml & robots.txt ---

  app.get('/sitemap.xml', async (req: Request, res: Response) => {
    try {
      const baseUrl = resolveBaseUrl(req);
      const userEntries = await getAllUsernamesForSitemap();
      const nowIso = new Date().toISOString();

      const urlsXml = [
        `  <url>\n    <loc>${escapeHtml(baseUrl)}/</loc>\n    <lastmod>${nowIso}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
        ...userEntries.map((entry) => {
          const lastmod = entry.updatedAt
            ? new Date(entry.updatedAt).toISOString()
            : nowIso;
          return `  <url>\n    <loc>${escapeHtml(`${baseUrl}/${entry.username}`)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
        }),
      ].join('\n');

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>`;
      res.header('Content-Type', 'application/xml; charset=utf-8');
      res.send(xml);
    } catch (error) {
      console.error('Sitemap error:', error);
      res.status(500).send('Error generating sitemap');
    }
  });

  app.get('/robots.txt', (req: Request, res: Response) => {
    const baseUrl = resolveBaseUrl(req);
    const robots = [
      'User-agent: *',
      'Allow: /',
      'Disallow: /api/',
      'Disallow: /dashboard',
      'Disallow: /admin',
      '',
      `Sitemap: ${baseUrl}/sitemap.xml`,
    ].join('\n');
    res.header('Content-Type', 'text/plain; charset=utf-8');
    res.send(robots);
  });

  // --- Vite Middleware (Dev) or Static Assets (Prod) + Dynamic SEO HTML Injection ---

  let vite: Awaited<ReturnType<typeof createViteServer>> | null = null;

  if (!isProd) {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir, { index: false }));
  }

  app.get('*', async (req: Request, res: Response) => {
    try {
      const reqPath = req.path;
      const htmlPath = isProd
        ? path.resolve(__dirname, 'dist', 'index.html')
        : path.resolve(__dirname, 'index.html');

      let html = fs.readFileSync(htmlPath, 'utf-8');

      if (!isProd && vite) {
        html = await vite.transformIndexHtml(req.originalUrl, html);
      }

      const cleanSegment = reqPath.replace(/^\/+|\/+$/g, '');
      if (
        cleanSegment &&
        !cleanSegment.includes('/') &&
        !cleanSegment.includes('.') &&
        !RESERVED_PATHS.has(cleanSegment.toLowerCase())
      ) {
        const profile = await getPublicProfileByUsername(cleanSegment);
        if (profile) {
          const baseUrl = resolveBaseUrl(req);
          const title =
            profile.seoTitle?.trim() ||
            `${profile.displayName} (@${profile.username}) — LokaBio`;
          const description =
            profile.seoDescription?.trim() ||
            profile.bio?.trim() ||
            `Jelajahi tautan resmi dan media sosial dari ${profile.displayName}.`;
          const imageUrl = resolveAbsoluteMediaUrl(baseUrl, profile.avatarUrl);
          const canonicalUrl = `${baseUrl}/${profile.username}`;

          html = injectProfileSeoIntoHtml(html, {
            title,
            description,
            imageUrl,
            canonicalUrl,
            displayName: profile.displayName,
            username: profile.username,
          });
        }
      }

      res
        .status(200)
        .set({ 'Content-Type': 'text/html; charset=utf-8' })
        .end(html);
    } catch (error) {
      if (!isProd && vite && error instanceof Error) {
        vite.ssrFixStacktrace(error);
      }
      console.error('HTML render error:', error);
      res.status(500).end('Terjadi kesalahan memuat halaman.');
    }
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`LokaBio server running at http://0.0.0.0:${port}`);
  });
}

startServer();
