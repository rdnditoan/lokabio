import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export interface SocialLinkItem {
  platform: string;
  url: string;
}

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  bio: text('bio').notNull().default(''),
  avatarUrl: text('avatar_url').notNull().default(''),
  coverUrl: text('cover_url').notNull().default(''),
  role: text('role').notNull().default('user'), // 'user' | 'admin'
  planTier: text('plan_tier').notNull().default('free'), // 'free' | 'pro'
  planExpiresAt: timestamp('plan_expires_at'),
  hideBranding: boolean('hide_branding').notNull().default(false),
  adminWarning: text('admin_warning').notNull().default(''),
  adminWarningAt: timestamp('admin_warning_at'),
  lastActiveAt: timestamp('last_active_at').defaultNow().notNull(),
  isVerified: boolean('is_verified').notNull().default(false),
  isSuspended: boolean('is_suspended').notNull().default(false),
  isFeatured: boolean('is_featured').notNull().default(false),
  featuredOrder: integer('featured_order').notNull().default(0),
  profileViews: integer('profile_views').notNull().default(0),

  // Theme customization
  themePreset: text('theme_preset').notNull().default('minimalist-light'),
  bgType: text('bg_type').notNull().default('solid'), // 'solid' | 'gradient' | 'image'
  bgColor: text('bg_color').notNull().default('#F8FAFC'),
  bgGradient: text('bg_gradient')
    .notNull()
    .default('linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)'),
  bgImageUrl: text('bg_image_url').notNull().default(''),
  bgBlur: integer('bg_blur').notNull().default(0),
  bgOverlayOpacity: integer('bg_overlay_opacity').notNull().default(40),
  buttonColor: text('button_color').notNull().default('#0F172A'),
  buttonTextColor: text('button_text_color').notNull().default('#FFFFFF'),
  buttonShape: text('button_shape').notNull().default('rounded'),
  textColor: text('text_color').notNull().default('#0F172A'),
  fontFamily: text('font_family').notNull().default('sans'),

  // Social icon row
  socialPosition: text('social_position').notNull().default('top'),
  socialLinks: jsonb('social_links')
    .$type<SocialLinkItem[]>()
    .notNull()
    .default([]),

  // Announcement Bar
  announcementEnabled: boolean('announcement_enabled').notNull().default(false),
  announcementText: text('announcement_text').notNull().default(''),
  announcementUrl: text('announcement_url').notNull().default(''),

  // Quick Contact (WhatsApp & vCard)
  whatsappNumber: text('whatsapp_number').notNull().default(''),
  whatsappMessage: text('whatsapp_message')
    .notNull()
    .default('Halo, saya melihat profil Anda di LokaBio.'),
  contactEmail: text('contact_email').notNull().default(''),
  vcardEnabled: boolean('vcard_enabled').notNull().default(false),

  // QRIS / Tip Jar Modal
  qrisEnabled: boolean('qris_enabled').notNull().default(false),
  qrisTitle: text('qris_title')
    .notNull()
    .default('Dukung & Bayar via QRIS'),
  qrisImageUrl: text('qris_image_url').notNull().default(''),
  qrisNote: text('qris_note')
    .notNull()
    .default('Scan kode QRIS melalui aplikasi e-wallet atau mobile banking Anda.'),

  // Newsletter / Lead Capture Block
  newsletterEnabled: boolean('newsletter_enabled').notNull().default(false),
  newsletterHeading: text('newsletter_heading')
    .notNull()
    .default('Dapatkan Catatan & Karya Terbaru'),
  newsletterPlaceholder: text('newsletter_placeholder')
    .notNull()
    .default('Masukkan alamat email Anda...'),

  // Visitor Inquiry / Collaboration Form
  inquiryEnabled: boolean('inquiry_enabled').notNull().default(false),
  inquiryHeading: text('inquiry_heading')
    .notNull()
    .default('Kirim Pesan / Kerja Sama'),

  // Dynamic SEO & UTM
  seoTitle: text('seo_title').notNull().default(''),
  seoDescription: text('seo_description').notNull().default(''),
  utmEnabled: boolean('utm_enabled').notNull().default(false),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const links = pgTable('links', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  linkType: text('link_type').notNull().default('standard'), // 'standard' | 'header' | 'featured' | 'embed' | 'product' | 'gallery'
  title: text('title').notNull(),
  subtitle: text('subtitle').notNull().default(''),
  url: text('url').notNull().default(''),
  icon: text('icon').notNull().default('link'),
  thumbnailUrl: text('thumbnail_url').notNull().default(''),
  priceText: text('price_text').notNull().default(''),
  badgeText: text('badge_text').notNull().default(''),
  category: text('category').notNull().default(''),
  galleryUrls: jsonb('gallery_urls').$type<string[]>().notNull().default([]),
  pinCode: text('pin_code').notNull().default(''),
  publishAt: timestamp('publish_at'),
  expireAt: timestamp('expire_at'),
  position: integer('position').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  clicks: integer('clicks').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const clickEvents = pgTable('click_events', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  linkId: integer('link_id').references(() => links.id, {
    onDelete: 'cascade',
  }),
  eventType: text('event_type').notNull(), // 'view' | 'click'
  referrer: text('referrer').notNull().default('Direct'),
  device: text('device').notNull().default('Desktop'), // 'Mobile' | 'Desktop'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const subscribers = pgTable('subscribers', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  email: text('email').notNull(),
  name: text('name').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const inquiries = pgTable('inquiries', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  senderName: text('sender_name').notNull(),
  senderContact: text('sender_contact').notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: serial('id').primaryKey(),
  adminUserId: integer('admin_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  adminEmail: text('admin_email').notNull(),
  action: text('action').notNull(),
  targetUsername: text('target_username').notNull().default(''),
  details: text('details').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const profileReports = pgTable('profile_reports', {
  id: serial('id').primaryKey(),
  reportedUserId: integer('reported_user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  reportedUsername: text('reported_username').notNull(),
  reporterEmail: text('reporter_email').notNull().default(''),
  reason: text('reason').notNull(),
  details: text('details').notNull().default(''),
  status: text('status').notNull().default('pending'), // 'pending' | 'resolved' | 'dismissed'
  reviewedBy: text('reviewed_by').notNull().default(''),
  reviewedNote: text('reviewed_note').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at'),
});

export const verificationRequests = pgTable('verification_requests', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  username: text('username').notNull(),
  category: text('category').notNull(),
  proofUrl: text('proof_url').notNull(),
  note: text('note').notNull().default(''),
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  reviewedBy: text('reviewed_by').notNull().default(''),
  reviewedNote: text('reviewed_note').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at'),
});

export const platformSettings = pgTable('platform_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  announcementEnabled: boolean('announcement_enabled').notNull().default(false),
  announcementTitle: text('announcement_title').notNull().default(''),
  announcementMessage: text('announcement_message').notNull().default(''),
  announcementType: text('announcement_type').notNull().default('info'), // 'info' | 'warning' | 'success'
  reservedUsernames: jsonb('reserved_usernames')
    .$type<string[]>()
    .notNull()
    .default([]),
  maintenanceMode: boolean('maintenance_mode').notNull().default(false),
  maintenanceMessage: text('maintenance_message')
    .notNull()
    .default(
      'Platform sedang dalam pemeliharaan terjadwal. Silakan kembali beberapa saat lagi.'
    ),
  registrationOpen: boolean('registration_open').notNull().default(true),
  freeLinkLimit: integer('free_link_limit').notNull().default(8),
  blockedDomains: jsonb('blocked_domains')
    .$type<string[]>()
    .notNull()
    .default([]),
  updatedBy: text('updated_by').notNull().default(''),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  links: many(links),
  clickEvents: many(clickEvents),
  subscribers: many(subscribers),
  inquiries: many(inquiries),
  profileReports: many(profileReports),
  verificationRequests: many(verificationRequests),
}));

export const linksRelations = relations(links, ({ one, many }) => ({
  user: one(users, {
    fields: [links.userId],
    references: [users.id],
  }),
  clickEvents: many(clickEvents),
}));

export const clickEventsRelations = relations(clickEvents, ({ one }) => ({
  user: one(users, {
    fields: [clickEvents.userId],
    references: [users.id],
  }),
  link: one(links, {
    fields: [clickEvents.linkId],
    references: [links.id],
  }),
}));

export const subscribersRelations = relations(subscribers, ({ one }) => ({
  user: one(users, {
    fields: [subscribers.userId],
    references: [users.id],
  }),
}));

export const inquiriesRelations = relations(inquiries, ({ one }) => ({
  user: one(users, {
    fields: [inquiries.userId],
    references: [users.id],
  }),
}));

export const profileReportsRelations = relations(profileReports, ({ one }) => ({
  reportedUser: one(users, {
    fields: [profileReports.reportedUserId],
    references: [users.id],
  }),
}));

export const verificationRequestsRelations = relations(
  verificationRequests,
  ({ one }) => ({
    user: one(users, {
      fields: [verificationRequests.userId],
      references: [users.id],
    }),
  })
);

export type UserRecord = typeof users.$inferSelect;
export type NewUserRecord = typeof users.$inferInsert;
export type LinkRecord = typeof links.$inferSelect;
export type NewLinkRecord = typeof links.$inferInsert;
export type ClickEventRecord = typeof clickEvents.$inferSelect;
export type SubscriberRecord = typeof subscribers.$inferSelect;
export type InquiryRecord = typeof inquiries.$inferSelect;
export type AdminAuditLogRecord = typeof adminAuditLogs.$inferSelect;
export type ProfileReportRecord = typeof profileReports.$inferSelect;
export type VerificationRequestRecord = typeof verificationRequests.$inferSelect;
export type PlatformSettingsRecord = typeof platformSettings.$inferSelect;
