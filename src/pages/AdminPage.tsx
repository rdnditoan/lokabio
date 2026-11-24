import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BadgeCheck,
  Ban,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crown,
  Database,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  KeyRound,
  LayoutDashboard,
  Link2,
  Lock,
  LogOut,
  Megaphone,
  Palette,
  Plus,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Star,
  Ticket,
  Trash2,
  Upload,
  User as UserIcon,
  UserPlus,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AuthPage } from './AuthPage';
import {
  AdminAuditLogDTO,
  AdminUserDetailDTO,
  AdminUserSummaryDTO,
  BulkUserAction,
  CuratedThemeTemplateDTO,
  LINK_ICON_OPTIONS,
  LINK_TYPE_OPTIONS,
  PlanTier,
  PlatformAnalyticsDTO,
  PlatformSettingsDTO,
  PlatformStatsDTO,
  ProSubscriptionLogDTO,
  ProfileReportDTO,
  PromoCouponDTO,
  VerificationRequestDTO,
  isUserProActive,
} from '../shared/themes';

interface AdminPageProps {
  onNavigate: (path: string) => void;
}

type AdminSectionTab =
  | 'users'
  | 'verifications'
  | 'reports'
  | 'commerce'
  | 'curation'
  | 'analytics';

type UserFilter =
  | 'all'
  | 'pro'
  | 'verified'
  | 'featured'
  | 'admin'
  | 'suspended';

type UserSort =
  | 'newest'
  | 'views'
  | 'clicks'
  | 'links'
  | 'oldest_active';

const USERS_PER_PAGE = 10;

export function AdminPage({ onNavigate }: AdminPageProps) {
  const { user, loading: authLoading, signOut, authFetch } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminSectionTab>('users');
  const [loading, setLoading] = useState(false);
  const [forbiddenMessage, setForbiddenMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [stats, setStats] = useState<PlatformStatsDTO | null>(null);
  const [usersList, setUsersList] = useState<AdminUserSummaryDTO[]>([]);
  const [settings, setSettings] = useState<PlatformSettingsDTO>({
    announcementEnabled: false,
    announcementTitle: '',
    announcementMessage: '',
    announcementType: 'info',
    reservedUsernames: [],
    maintenanceMode: false,
    maintenanceMessage: '',
    registrationOpen: true,
    freeLinkLimit: 8,
    blockedDomains: [],
  });

  // Sub-tab data
  const [reports, setReports] = useState<ProfileReportDTO[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [verifications, setVerifications] = useState<VerificationRequestDTO[]>(
    []
  );
  const [verificationsLoading, setVerificationsLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogDTO[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logActionFilter, setLogActionFilter] = useState('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [analyticsDays, setAnalyticsDays] = useState<7 | 14 | 30>(14);
  const [analytics, setAnalytics] = useState<PlatformAnalyticsDTO | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [confirmCleanupDays, setConfirmCleanupDays] = useState<number | null>(
    null
  );
  const [cleanupBusy, setCleanupBusy] = useState(false);

  // User list filters, sort, pagination & bulk actions
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [userSort, setUserSort] = useState<UserSort>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkUserAction | ''>('');
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [brokenAvatars, setBrokenAvatars] = useState<Record<number, boolean>>({});

  // Inspect & Edit User Modal
  const [inspectDetail, setInspectDetail] = useState<AdminUserDetailDTO | null>(
    null
  );
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectTab, setInspectTab] = useState<'profile' | 'plan' | 'links'>(
    'profile'
  );
  const [editProfileForm, setEditProfileForm] = useState({
    username: '',
    displayName: '',
    email: '',
    bio: '',
    avatarUrl: '',
    whatsappNumber: '',
    contactEmail: '',
    seoTitle: '',
    seoDescription: '',
    hideBranding: false,
  });
  const [planTierInput, setPlanTierInput] = useState<PlanTier>('free');
  const [planExpiresAtInput, setPlanExpiresAtInput] = useState('');
  const [warningInput, setWarningInput] = useState('');
  const [inspectSaving, setInspectSaving] = useState(false);

  // Direct link CRUD & password reset inside inspect modal
  const [resetLinkBusy, setResetLinkBusy] = useState(false);
  const [resetLinkResult, setResetLinkResult] = useState<{
    email: string;
    resetLink: string;
  } | null>(null);
  const [adminAddLinkOpen, setAdminAddLinkOpen] = useState(false);
  const [adminAddLinkForm, setAdminAddLinkForm] = useState({
    linkType: 'standard',
    title: '',
    subtitle: '',
    url: '',
    icon: 'link',
    priceText: '',
    badgeText: '',
  });
  const [adminEditLinkId, setAdminEditLinkId] = useState<number | null>(null);
  const [adminEditLinkForm, setAdminEditLinkForm] = useState({
    linkType: 'standard',
    title: '',
    subtitle: '',
    url: '',
    icon: 'link',
    priceText: '',
    badgeText: '',
    isActive: true,
  });

  // Promo Coupons, Pro Upgrade History & Curated Global Theme Templates
  const [coupons, setCoupons] = useState<PromoCouponDTO[]>([]);
  const [proHistory, setProHistory] = useState<ProSubscriptionLogDTO[]>([]);
  const [themesList, setThemesList] = useState<CuratedThemeTemplateDTO[]>([]);
  const [commerceLoading, setCommerceLoading] = useState(false);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponForm, setCouponForm] = useState({
    code: '',
    description: '',
    durationDays: 30,
    maxUses: 100,
    expiresAt: '',
  });
  const [themeBusy, setThemeBusy] = useState(false);
  const [editingThemeId, setEditingThemeId] = useState<number | null>(null);
  const [themeForm, setThemeForm] = useState({
    slug: '',
    name: '',
    description: '',
    bgType: 'solid',
    bgColor: '#F6F5F1',
    bgGradient: 'linear-gradient(155deg, #2A1624 0%, #7C2D3B 52%, #D97757 100%)',
    buttonColor: '#141413',
    buttonTextColor: '#FAF9F6',
    buttonShape: 'rounded',
    textColor: '#141413',
    fontFamily: 'sans',
    isProOnly: false,
    isActive: true,
    sortOrder: 10,
  });

  // Audit log export & backup/restore state
  const [exportingAudit, setExportingAudit] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);

  // Create User Modal
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createUserBusy, setCreateUserBusy] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    displayName: '',
    username: '',
    email: '',
    password: '',
    bio: '',
    avatarUrl: '',
    whatsappNumber: '',
    contactEmail: '',
    role: 'user' as 'user' | 'admin',
    planTier: 'free' as PlanTier,
    planExpiresAt: '',
    isVerified: false,
    isFeatured: false,
  });

  // Featured ordering & Settings drafts
  const [featuredDraftIds, setFeaturedDraftIds] = useState<number[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [newReservedWord, setNewReservedWord] = useState('');
  const [newBlockedDomain, setNewBlockedDomain] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Notes for reviewing reports / verifications
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [busyQueueId, setBusyQueueId] = useState<string | null>(null);

  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const showToast = (type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    setTimeout(() => {
      setToast((curr) => (curr?.text === text ? null : curr));
    }, 3400);
  };

  useEffect(() => {
    document.title = 'Panel Super Admin — LokaBio';
  }, []);

  const loadOverview = async () => {
    setLoading(true);
    setForbiddenMessage(null);
    setErrorMsg(null);
    try {
      const res = await authFetch('/api/superadmin/overview');
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setForbiddenMessage(
          data.error ||
            'Akun Anda tidak memiliki izin Super Admin. Gunakan akun Administrator untuk mengakses halaman ini.'
        );
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memuat data Super Admin.');
      }
      setStats(data.stats);
      const list: AdminUserSummaryDTO[] = Array.isArray(data.users)
        ? data.users
        : [];
      setUsersList(list);
      if (data.settings) {
        setSettings(data.settings);
      }
      const featuredSorted = list
        .filter((u) => u.isFeatured)
        .sort(
          (a, b) =>
            (a.featuredOrder || 0) - (b.featuredOrder || 0) ||
            b.profileViews - a.profileViews
        );
      setFeaturedDraftIds(featuredSorted.map((u) => u.id));
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memuat panel Super Admin.'
      );
    } finally {
      setLoading(false);
    }
  };

  const loadVerifications = async () => {
    setVerificationsLoading(true);
    try {
      const res = await authFetch('/api/superadmin/verifications');
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.requests)) {
        setVerifications(data.requests);
      }
    } finally {
      setVerificationsLoading(false);
    }
  };

  const loadReports = async () => {
    setReportsLoading(true);
    try {
      const res = await authFetch('/api/superadmin/reports');
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.reports)) {
        setReports(data.reports);
      }
    } finally {
      setReportsLoading(false);
    }
  };

  const loadAuditLogs = async (
    action = logActionFilter,
    q = logSearchQuery
  ) => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams();
      if (action && action !== 'ALL') params.set('action', action);
      if (q.trim()) params.set('q', q.trim());
      const queryStr = params.toString();
      const logRes = await authFetch(
        `/api/superadmin/audit-logs${queryStr ? `?${queryStr}` : ''}`
      );
      const logData = await logRes.json().catch(() => null);
      if (logRes.ok && Array.isArray(logData?.logs)) {
        setAuditLogs(logData.logs);
      }
    } finally {
      setLogsLoading(false);
    }
  };

  const loadAnalyticsAndLogs = async (days = analyticsDays) => {
    setAnalyticsLoading(true);
    setLogsLoading(true);
    try {
      const params = new URLSearchParams();
      if (logActionFilter && logActionFilter !== 'ALL') {
        params.set('action', logActionFilter);
      }
      if (logSearchQuery.trim()) params.set('q', logSearchQuery.trim());
      const queryStr = params.toString();

      const [anRes, logRes] = await Promise.all([
        authFetch(`/api/superadmin/analytics?days=${days}`),
        authFetch(
          `/api/superadmin/audit-logs${queryStr ? `?${queryStr}` : ''}`
        ),
      ]);
      const anData = await anRes.json().catch(() => null);
      const logData = await logRes.json().catch(() => null);
      if (anRes.ok && anData) setAnalytics(anData);
      if (logRes.ok && Array.isArray(logData?.logs)) setAuditLogs(logData.logs);
    } finally {
      setAnalyticsLoading(false);
      setLogsLoading(false);
    }
  };

  const loadCommerceData = async () => {
    setCommerceLoading(true);
    try {
      const [cRes, tRes] = await Promise.all([
        authFetch('/api/superadmin/coupons'),
        authFetch('/api/superadmin/themes'),
      ]);
      const cData = await cRes.json().catch(() => null);
      const tData = await tRes.json().catch(() => null);
      if (cRes.ok && cData) {
        if (Array.isArray(cData.coupons)) setCoupons(cData.coupons);
        if (Array.isArray(cData.history)) setProHistory(cData.history);
      }
      if (tRes.ok && Array.isArray(tData?.themes)) {
        setThemesList(tData.themes);
      }
    } finally {
      setCommerceLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setStats(null);
      setUsersList([]);
      setForbiddenMessage(null);
      return;
    }
    loadOverview();
  }, [user]);

  useEffect(() => {
    if (!user || forbiddenMessage) return;
    if (activeTab === 'verifications') loadVerifications();
    if (activeTab === 'reports') loadReports();
    if (activeTab === 'commerce') loadCommerceData();
    if (activeTab === 'analytics') loadAnalyticsAndLogs(analyticsDays);
  }, [activeTab, user, forbiddenMessage]);

  useEffect(() => {
    if (!user || forbiddenMessage || activeTab !== 'analytics') return;
    setAnalyticsLoading(true);
    authFetch(`/api/superadmin/analytics?days=${analyticsDays}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setAnalytics(data);
      })
      .finally(() => setAnalyticsLoading(false));
  }, [analyticsDays]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filter, userSort]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = usersList.filter((u) => {
      if (filter === 'pro' && !isUserProActive(u)) return false;
      if (filter === 'verified' && !u.isVerified) return false;
      if (filter === 'featured' && !u.isFeatured) return false;
      if (filter === 'admin' && u.role !== 'admin') return false;
      if (filter === 'suspended' && !u.isSuspended) return false;
      if (!q) return true;
      return (
        u.username.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    });

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (userSort) {
        case 'views':
          return b.profileViews - a.profileViews;
        case 'clicks':
          return b.totalClicks - a.totalClicks;
        case 'links':
          return b.linkCount - a.linkCount;
        case 'oldest_active':
          return (
            new Date(a.lastActiveAt || a.createdAt).getTime() -
            new Date(b.lastActiveAt || b.createdAt).getTime()
          );
        case 'newest':
        default:
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      }
    });
    return sorted;
  }, [usersList, searchQuery, filter, userSort]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedUsers = useMemo(() => {
    const start = (safePage - 1) * USERS_PER_PAGE;
    return filteredUsers.slice(start, start + USERS_PER_PAGE);
  }, [filteredUsers, safePage]);

  const featuredOrderedUsers = useMemo(() => {
    const map = new Map(usersList.map((u) => [u.id, u]));
    return featuredDraftIds
      .map((id) => map.get(id))
      .filter((u): u is AdminUserSummaryDTO => Boolean(u && u.isFeatured));
  }, [usersList, featuredDraftIds]);

  const handleUpdateUser = async (
    target: AdminUserSummaryDTO,
    patch: {
      role?: 'user' | 'admin';
      isVerified?: boolean;
      isSuspended?: boolean;
      isFeatured?: boolean;
      newUsername?: string;
    },
    successMsg: string
  ) => {
    setBusyUserId(target.id);
    try {
      const res = await authFetch(`/api/superadmin/users/${target.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memperbarui akun.');
      }
      const nextUsers = usersList.map((item) =>
        item.id === target.id
          ? {
              ...item,
              username: data.user.username,
              role: data.user.role,
              isVerified: data.user.isVerified,
              isSuspended: data.user.isSuspended,
              isFeatured: data.user.isFeatured,
              featuredOrder: data.user.featuredOrder ?? item.featuredOrder,
            }
          : item
      );
      setUsersList(nextUsers);
      if (patch.isFeatured !== undefined) {
        if (patch.isFeatured && !featuredDraftIds.includes(target.id)) {
          setFeaturedDraftIds((prev) => [...prev, target.id]);
        } else if (!patch.isFeatured) {
          setFeaturedDraftIds((prev) => prev.filter((id) => id !== target.id));
        }
      }
      setStats((prev) =>
        prev
          ? {
              ...prev,
              totalAdmins: nextUsers.filter((u) => u.role === 'admin').length,
              totalVerified: nextUsers.filter((u) => u.isVerified).length,
              totalSuspended: nextUsers.filter((u) => u.isSuspended).length,
            }
          : prev
      );
      showToast('ok', successMsg);
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal memperbarui akun.'
      );
    } finally {
      setBusyUserId(null);
    }
  };

  const handleDeleteUser = async (target: AdminUserSummaryDTO) => {
    setBusyUserId(target.id);
    try {
      const res = await authFetch(`/api/superadmin/users/${target.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menghapus akun.');
      }
      setUsersList((prev) => prev.filter((item) => item.id !== target.id));
      setConfirmDeleteId(null);
      showToast('ok', `Akun @${target.username} telah dihapus.`);
      loadOverview();
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal menghapus akun.'
      );
    } finally {
      setBusyUserId(null);
    }
  };

  const handleToggleSelectUser = (id: number) => {
    setConfirmBulkDelete(false);
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectPage = () => {
    setConfirmBulkDelete(false);
    const pageIds = paginatedUsers.map((u) => u.id);
    const allSelected =
      pageIds.length > 0 && pageIds.every((id) => selectedUserIds.includes(id));
    if (allSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedUserIds.length === 0) return;
    if (bulkAction === 'delete' && !confirmBulkDelete) {
      setConfirmBulkDelete(true);
      return;
    }
    setBulkBusy(true);
    try {
      const res = await authFetch('/api/superadmin/users/bulk', {
        method: 'POST',
        body: JSON.stringify({
          userIds: selectedUserIds,
          action: bulkAction,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menjalankan aksi massal.');
      }
      setSelectedUserIds([]);
      setBulkAction('');
      setConfirmBulkDelete(false);
      await loadOverview();
      showToast(
        'ok',
        `Aksi massal berhasil diterapkan ke ${data.affectedCount ?? 0} akun.`
      );
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal menjalankan aksi massal.'
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const openInspectModal = async (
    targetId: number,
    initialTab: 'profile' | 'plan' | 'links' = 'profile'
  ) => {
    setInspectLoading(true);
    setInspectDetail(null);
    setInspectTab(initialTab);
    setResetLinkResult(null);
    setAdminAddLinkOpen(false);
    setAdminEditLinkId(null);
    setAdminAddLinkForm({
      linkType: 'standard',
      title: '',
      subtitle: '',
      url: '',
      icon: 'link',
      priceText: '',
      badgeText: '',
    });
    try {
      const res = await authFetch(`/api/superadmin/users/${targetId}/detail`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memuat detail pengguna.');
      }
      setInspectDetail(data);
      setEditProfileForm({
        username: data.user.username || '',
        displayName: data.user.displayName || '',
        email: data.user.email || '',
        bio: data.user.bio || '',
        avatarUrl: data.user.avatarUrl || '',
        whatsappNumber: data.user.whatsappNumber || '',
        contactEmail: data.user.contactEmail || '',
        seoTitle: data.user.seoTitle || '',
        seoDescription: data.user.seoDescription || '',
        hideBranding: Boolean(data.user.hideBranding),
      });
      setPlanTierInput(data.user.planTier === 'pro' ? 'pro' : 'free');
      setPlanExpiresAtInput(
        data.user.planExpiresAt
          ? new Date(data.user.planExpiresAt).toISOString().slice(0, 10)
          : ''
      );
      setWarningInput(data.user.adminWarning || '');
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal membuka panel kelola user.'
      );
    } finally {
      setInspectLoading(false);
    }
  };

  const handleSaveInspectProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectDetail) return;
    setInspectSaving(true);
    try {
      const payload: Record<string, unknown> = {
        newUsername: editProfileForm.username.trim().toLowerCase(),
        displayName: editProfileForm.displayName.trim(),
        email: editProfileForm.email.trim().toLowerCase(),
        bio: editProfileForm.bio,
        avatarUrl: editProfileForm.avatarUrl.trim(),
        whatsappNumber: editProfileForm.whatsappNumber.trim(),
        contactEmail: editProfileForm.contactEmail.trim(),
        seoTitle: editProfileForm.seoTitle,
        seoDescription: editProfileForm.seoDescription,
        hideBranding: editProfileForm.hideBranding,
      };
      const res = await authFetch(
        `/api/superadmin/users/${inspectDetail.user.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan data pengguna.');
      }
      const u = data.user;
      setInspectDetail((prev) =>
        prev
          ? {
              ...prev,
              user: {
                ...prev.user,
                username: u.username,
                displayName: u.displayName,
                email: u.email,
                bio: u.bio,
                avatarUrl: u.avatarUrl,
                whatsappNumber: u.whatsappNumber,
                contactEmail: u.contactEmail,
                seoTitle: u.seoTitle,
                seoDescription: u.seoDescription,
                hideBranding: Boolean(u.hideBranding),
              },
            }
          : prev
      );
      setUsersList((prev) =>
        prev.map((item) =>
          item.id === inspectDetail.user.id
            ? {
                ...item,
                username: u.username,
                displayName: u.displayName,
                email: u.email,
                avatarUrl: u.avatarUrl,
                hideBranding: Boolean(u.hideBranding),
              }
            : item
        )
      );
      setEditProfileForm((prev) => ({
        ...prev,
        username: u.username,
        displayName: u.displayName,
        email: u.email,
      }));
      showToast('ok', `Data akun @${u.username} berhasil diperbarui.`);
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal menyimpan data pengguna.'
      );
    } finally {
      setInspectSaving(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateUserBusy(true);
    try {
      const expiresIso =
        createUserForm.planTier === 'pro' && createUserForm.planExpiresAt
          ? new Date(`${createUserForm.planExpiresAt}T23:59:59`).toISOString()
          : null;
      const res = await authFetch('/api/superadmin/users', {
        method: 'POST',
        body: JSON.stringify({
          ...createUserForm,
          planExpiresAt: expiresIso,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menambahkan akun pengguna.');
      }
      setCreateUserOpen(false);
      setCreateUserForm({
        displayName: '',
        username: '',
        email: '',
        password: '',
        bio: '',
        avatarUrl: '',
        whatsappNumber: '',
        contactEmail: '',
        role: 'user',
        planTier: 'free',
        planExpiresAt: '',
        isVerified: false,
        isFeatured: false,
      });
      await loadOverview();
      showToast(
        'ok',
        `Akun baru @${data.user?.username || ''} berhasil ditambahkan.`
      );
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal menambahkan pengguna.'
      );
    } finally {
      setCreateUserBusy(false);
    }
  };

  const handleSaveInspectPlan = async () => {
    if (!inspectDetail) return;
    setInspectSaving(true);
    try {
      const expiresIso =
        planTierInput === 'pro' && planExpiresAtInput
          ? new Date(`${planExpiresAtInput}T23:59:59`).toISOString()
          : null;
      const res = await authFetch(
        `/api/superadmin/users/${inspectDetail.user.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            planTier: planTierInput,
            planExpiresAt: expiresIso,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan paket.');

      const nextUsers = usersList.map((u) =>
        u.id === inspectDetail.user.id
          ? {
              ...u,
              planTier: data.user.planTier,
              planExpiresAt: data.user.planExpiresAt,
            }
          : u
      );
      setUsersList(nextUsers);
      setInspectDetail((prev) =>
        prev
          ? {
              ...prev,
              user: {
                ...prev.user,
                planTier: data.user.planTier,
                planExpiresAt: data.user.planExpiresAt,
              },
            }
          : prev
      );
      setStats((prev) =>
        prev
          ? {
              ...prev,
              totalProUsers: nextUsers.filter((u) => isUserProActive(u)).length,
            }
          : prev
      );
      showToast(
        'ok',
        `Paket @${inspectDetail.user.username} diperbarui ke ${
          data.user.planTier === 'pro' ? 'Pro' : 'Free'
        }.`
      );
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal memperbarui paket.'
      );
    } finally {
      setInspectSaving(false);
    }
  };

  const handleSaveInspectWarning = async (clear = false) => {
    if (!inspectDetail) return;
    setInspectSaving(true);
    try {
      const text = clear ? '' : warningInput.trim();
      const res = await authFetch(
        `/api/superadmin/users/${inspectDetail.user.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ adminWarning: text }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memperbarui peringatan.');
      }
      setWarningInput(data.user.adminWarning || '');
      setInspectDetail((prev) =>
        prev
          ? {
              ...prev,
              user: {
                ...prev.user,
                adminWarning: data.user.adminWarning,
                adminWarningAt: data.user.adminWarningAt,
              },
            }
          : prev
      );
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === inspectDetail.user.id
            ? {
                ...u,
                adminWarning: data.user.adminWarning,
                adminWarningAt: data.user.adminWarningAt,
              }
            : u
        )
      );
      showToast(
        'ok',
        clear
          ? `Peringatan untuk @${inspectDetail.user.username} dihapus.`
          : `Peringatan dikirim ke Studio @${inspectDetail.user.username}.`
      );
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal memperbarui peringatan.'
      );
    } finally {
      setInspectSaving(false);
    }
  };

  const handleCleanupClickEvents = async (olderThanDays: number) => {
    setCleanupBusy(true);
    try {
      const res = await authFetch(
        '/api/superadmin/maintenance/cleanup-events',
        {
          method: 'POST',
          body: JSON.stringify({ olderThanDays }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Gagal membersihkan log event.');
      }
      setConfirmCleanupDays(null);
      showToast(
        'ok',
        `Berhasil menghapus ${Number(data.deletedCount || 0).toLocaleString(
          'id-ID'
        )} baris log event lama (> ${olderThanDays} hari).`
      );
      await loadAnalyticsAndLogs(analyticsDays);
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal membersihkan log event.'
      );
    } finally {
      setCleanupBusy(false);
    }
  };

  const handleModerateLink = async (linkId: number, nextActive: boolean) => {
    if (!inspectDetail) return;
    setInspectSaving(true);
    try {
      const res = await authFetch(`/api/superadmin/links/${linkId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal memoderasi tautan.');
      setInspectDetail((prev) =>
        prev
          ? {
              ...prev,
              links: prev.links.map((l) =>
                l.id === linkId ? { ...l, isActive: nextActive } : l
              ),
            }
          : prev
      );
      showToast(
        'ok',
        nextActive
          ? 'Tautan diaktifkan kembali.'
          : 'Tautan dinonaktifkan oleh Admin.'
      );
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal memoderasi tautan.'
      );
    } finally {
      setInspectSaving(false);
    }
  };

  const handleDeleteUserLink = async (linkId: number) => {
    if (!inspectDetail) return;
    setInspectSaving(true);
    try {
      const res = await authFetch(`/api/superadmin/links/${linkId}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus tautan.');
      setInspectDetail((prev) =>
        prev
          ? {
              ...prev,
              links: prev.links.filter((l) => l.id !== linkId),
            }
          : prev
      );
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === inspectDetail.user.id
            ? { ...u, linkCount: Math.max(0, u.linkCount - 1) }
            : u
        )
      );
      showToast('ok', 'Tautan melanggar telah dihapus.');
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal menghapus tautan.'
      );
    } finally {
      setInspectSaving(false);
    }
  };

  const handleGenerateResetLink = async () => {
    if (!inspectDetail) return;
    setResetLinkBusy(true);
    try {
      const res = await authFetch(
        `/api/superadmin/users/${inspectDetail.user.id}/reset-password`,
        { method: 'POST' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Gagal membuat tautan reset password.');
      }
      setResetLinkResult({
        email: data.email || inspectDetail.user.email,
        resetLink: data.resetLink,
      });
      showToast('ok', 'Tautan reset password berhasil dibuat.');
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error
          ? err.message
          : 'Gagal membuat tautan reset password.'
      );
    } finally {
      setResetLinkBusy(false);
    }
  };

  const handleCopyResetLink = async () => {
    if (!resetLinkResult?.resetLink) return;
    try {
      await navigator.clipboard.writeText(resetLinkResult.resetLink);
      showToast('ok', 'Tautan reset password disalin ke clipboard.');
    } catch {
      showToast('err', 'Gagal menyalin otomatis. Salin secara manual.');
    }
  };

  const handleAdminCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectDetail) return;
    setInspectSaving(true);
    try {
      const res = await authFetch(
        `/api/superadmin/users/${inspectDetail.user.id}/links`,
        {
          method: 'POST',
          body: JSON.stringify(adminAddLinkForm),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menambahkan tautan pengguna.');
      }
      const created = data.link;
      setInspectDetail((prev) =>
        prev
          ? {
              ...prev,
              links: [
                ...prev.links,
                {
                  id: created.id,
                  linkType: created.linkType,
                  title: created.title,
                  subtitle: created.subtitle || '',
                  url: created.url || '',
                  icon: created.icon || 'link',
                  isActive: Boolean(created.isActive),
                  clicks: created.clicks || 0,
                  position: created.position || 0,
                  priceText: created.priceText || '',
                  badgeText: created.badgeText || '',
                },
              ],
            }
          : prev
      );
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === inspectDetail.user.id
            ? { ...u, linkCount: u.linkCount + 1 }
            : u
        )
      );
      setAdminAddLinkForm({
        linkType: 'standard',
        title: '',
        subtitle: '',
        url: '',
        icon: 'link',
        priceText: '',
        badgeText: '',
      });
      setAdminAddLinkOpen(false);
      showToast('ok', `Tautan baru ditambahkan ke @${inspectDetail.user.username}.`);
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal menambahkan tautan.'
      );
    } finally {
      setInspectSaving(false);
    }
  };

  const startAdminEditLink = (
    linkItem: AdminUserDetailDTO['links'][number]
  ) => {
    setAdminEditLinkId(linkItem.id);
    setAdminEditLinkForm({
      linkType: linkItem.linkType || 'standard',
      title: linkItem.title || '',
      subtitle: linkItem.subtitle || '',
      url: linkItem.url || '',
      icon: linkItem.icon || 'link',
      priceText: linkItem.priceText || '',
      badgeText: linkItem.badgeText || '',
      isActive: linkItem.isActive,
    });
  };

  const handleAdminUpdateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectDetail || !adminEditLinkId) return;
    setInspectSaving(true);
    try {
      const res = await authFetch(`/api/superadmin/links/${adminEditLinkId}`, {
        method: 'PUT',
        body: JSON.stringify(adminEditLinkForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memperbarui tautan.');
      }
      const updated = data.link;
      setInspectDetail((prev) =>
        prev
          ? {
              ...prev,
              links: prev.links.map((item) =>
                item.id === adminEditLinkId
                  ? {
                      ...item,
                      linkType: updated.linkType,
                      title: updated.title,
                      subtitle: updated.subtitle || '',
                      url: updated.url || '',
                      icon: updated.icon || 'link',
                      priceText: updated.priceText || '',
                      badgeText: updated.badgeText || '',
                      isActive: Boolean(updated.isActive),
                    }
                  : item
              ),
            }
          : prev
      );
      setAdminEditLinkId(null);
      showToast('ok', 'Perubahan tautan berhasil disimpan.');
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal memperbarui tautan.'
      );
    } finally {
      setInspectSaving(false);
    }
  };

  const handleReviewVerification = async (
    reqItem: VerificationRequestDTO,
    status: 'approved' | 'rejected'
  ) => {
    const key = `ver-${reqItem.id}`;
    setBusyQueueId(key);
    try {
      const res = await authFetch(
        `/api/superadmin/verifications/${reqItem.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status,
            reviewedNote: reviewNotes[key] || '',
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses pengajuan.');
      }
      setVerifications((prev) =>
        prev.map((v) =>
          v.id === reqItem.id
            ? {
                ...v,
                status,
                reviewedNote: reviewNotes[key] || '',
                reviewedBy: user?.email || 'admin',
              }
            : v
        )
      );
      if (status === 'approved') {
        setUsersList((prev) =>
          prev.map((u) =>
            u.id === reqItem.userId ? { ...u, isVerified: true } : u
          )
        );
      }
      setStats((prev) =>
        prev
          ? {
              ...prev,
              pendingVerifications: Math.max(0, prev.pendingVerifications - 1),
              totalVerified:
                status === 'approved'
                  ? prev.totalVerified + 1
                  : prev.totalVerified,
            }
          : prev
      );
      showToast(
        'ok',
        status === 'approved'
          ? `@${reqItem.username} resmi diverifikasi.`
          : `Pengajuan @${reqItem.username} ditolak.`
      );
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal memproses pengajuan.'
      );
    } finally {
      setBusyQueueId(null);
    }
  };

  const handleReviewReport = async (
    report: ProfileReportDTO,
    status: 'resolved' | 'dismissed',
    suspendUser = false
  ) => {
    const key = `rep-${report.id}`;
    setBusyQueueId(key);
    try {
      const res = await authFetch(`/api/superadmin/reports/${report.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          reviewedNote: reviewNotes[key] || '',
          suspendUser,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal memproses laporan.');
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id
            ? {
                ...r,
                status,
                reviewedNote: reviewNotes[key] || '',
                reviewedBy: user?.email || 'admin',
              }
            : r
        )
      );
      if (suspendUser) {
        setUsersList((prev) =>
          prev.map((u) =>
            u.id === report.reportedUserId ? { ...u, isSuspended: true } : u
          )
        );
      }
      setStats((prev) =>
        prev
          ? {
              ...prev,
              pendingReports: Math.max(0, prev.pendingReports - 1),
              totalSuspended: suspendUser
                ? prev.totalSuspended + 1
                : prev.totalSuspended,
            }
          : prev
      );
      showToast(
        'ok',
        suspendUser
          ? `Laporan diselesaikan dan @${report.reportedUsername} dinonaktifkan.`
          : `Laporan #${report.id} ditandai ${
              status === 'resolved' ? 'selesai' : 'diabaikan'
            }.`
      );
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal memproses laporan.'
      );
    } finally {
      setBusyQueueId(null);
    }
  };

  const moveFeaturedUser = (idx: number, direction: -1 | 1) => {
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= featuredDraftIds.length) return;
    const copy = [...featuredDraftIds];
    const [item] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, item);
    setFeaturedDraftIds(copy);
  };

  const handleSaveFeaturedOrder = async () => {
    setSavingOrder(true);
    try {
      const res = await authFetch('/api/superadmin/featured-order', {
        method: 'PATCH',
        body: JSON.stringify({ orderedUserIds: featuredDraftIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan urutan.');
      showToast('ok', 'Urutan pratinjau beranda berhasil disimpan.');
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal menyimpan urutan.'
      );
    } finally {
      setSavingOrder(false);
    }
  };

  const handleSavePlatformSettings = async (
    nextSettings: PlatformSettingsDTO = settings
  ) => {
    setSavingSettings(true);
    try {
      const res = await authFetch('/api/superadmin/settings', {
        method: 'PUT',
        body: JSON.stringify(nextSettings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan pengaturan.');
      setSettings(data.settings);
      showToast('ok', 'Pengaturan platform & pengumuman global disimpan.');
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.'
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handleExportUsersCsv = () => {
    const header = [
      'ID',
      'Username',
      'Nama',
      'Email',
      'Peran',
      'Paket',
      'Terverifikasi',
      'PratinjauBeranda',
      'Dinonaktifkan',
      'Tautan',
      'Kunjungan',
      'Klik',
      'Subscriber',
      'Pesan',
      'TerakhirAktif',
      'TanggalGabung',
    ];
    const rows = usersList.map((u) => [
      u.id,
      u.username,
      `"${(u.displayName || '').replace(/"/g, '""')}"`,
      u.email,
      u.role,
      isUserProActive(u) ? 'Pro' : 'Free',
      u.isVerified ? 'Ya' : 'Tidak',
      u.isFeatured ? 'Ya' : 'Tidak',
      u.isSuspended ? 'Ya' : 'Tidak',
      u.linkCount,
      u.profileViews,
      u.totalClicks,
      u.subscriberCount,
      u.inquiryCount,
      new Date(u.lastActiveAt || u.createdAt).toISOString(),
      new Date(u.createdAt).toISOString(),
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lokabio-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('ok', 'Data pengguna diekspor ke CSV.');
  };

  // --- Promo Coupons Handlers ---
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponBusy(true);
    try {
      const res = await authFetch('/api/superadmin/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: couponForm.code,
          description: couponForm.description,
          durationDays: Number(couponForm.durationDays) || 0,
          maxUses: Number(couponForm.maxUses) || 100,
          expiresAt: couponForm.expiresAt
            ? new Date(`${couponForm.expiresAt}T23:59:59`).toISOString()
            : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal membuat kupon.');
      setCoupons((prev) => [data.coupon, ...prev]);
      setCouponForm({
        code: '',
        description: '',
        durationDays: 30,
        maxUses: 100,
        expiresAt: '',
      });
      showToast('ok', `Kupon "${data.coupon.code}" berhasil dibuat.`);
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal membuat kupon.'
      );
    } finally {
      setCouponBusy(false);
    }
  };

  const handleToggleCouponActive = async (coupon: PromoCouponDTO) => {
    setCouponBusy(true);
    try {
      const res = await authFetch(`/api/superadmin/coupons/${coupon.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !coupon.isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui kupon.');
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? data.coupon : c))
      );
      showToast(
        'ok',
        `Kupon ${coupon.code} ${data.coupon.isActive ? 'diaktifkan' : 'dinonaktifkan'}.`
      );
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal memperbarui kupon.'
      );
    } finally {
      setCouponBusy(false);
    }
  };

  const handleDeleteCoupon = async (coupon: PromoCouponDTO) => {
    setCouponBusy(true);
    try {
      const res = await authFetch(`/api/superadmin/coupons/${coupon.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus kupon.');
      setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
      showToast('ok', `Kupon ${coupon.code} dihapus.`);
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal menghapus kupon.'
      );
    } finally {
      setCouponBusy(false);
    }
  };

  // --- Curated Theme Templates Handlers ---
  const resetThemeForm = () => {
    setEditingThemeId(null);
    setThemeForm({
      slug: '',
      name: '',
      description: '',
      bgType: 'solid',
      bgColor: '#F6F5F1',
      bgGradient:
        'linear-gradient(155deg, #2A1624 0%, #7C2D3B 52%, #D97757 100%)',
      buttonColor: '#141413',
      buttonTextColor: '#FAF9F6',
      buttonShape: 'rounded',
      textColor: '#141413',
      fontFamily: 'sans',
      isProOnly: false,
      isActive: true,
      sortOrder: themesList.length + 1,
    });
  };

  const startEditTheme = (t: CuratedThemeTemplateDTO) => {
    setEditingThemeId(t.id);
    setThemeForm({
      slug: t.slug,
      name: t.name,
      description: t.description || '',
      bgType: t.bgType === 'gradient' ? 'gradient' : 'solid',
      bgColor: t.bgColor || '#F6F5F1',
      bgGradient:
        t.bgGradient ||
        'linear-gradient(155deg, #2A1624 0%, #7C2D3B 52%, #D97757 100%)',
      buttonColor: t.buttonColor || '#141413',
      buttonTextColor: t.buttonTextColor || '#FAF9F6',
      buttonShape: t.buttonShape || 'rounded',
      textColor: t.textColor || '#141413',
      fontFamily: t.fontFamily || 'sans',
      isProOnly: Boolean(t.isProOnly),
      isActive: Boolean(t.isActive),
      sortOrder: Number(t.sortOrder) || 10,
    });
  };

  const handleSaveTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    setThemeBusy(true);
    try {
      const isEditing = editingThemeId !== null;
      const url = isEditing
        ? `/api/superadmin/themes/${editingThemeId}`
        : '/api/superadmin/themes';
      const res = await authFetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify(themeForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan tema.');
      if (isEditing) {
        setThemesList((prev) =>
          prev
            .map((t) => (t.id === editingThemeId ? data.theme : t))
            .sort((a, b) => a.sortOrder - b.sortOrder)
        );
        showToast('ok', `Template tema "${data.theme.name}" diperbarui.`);
      } else {
        setThemesList((prev) =>
          [...prev, data.theme].sort((a, b) => a.sortOrder - b.sortOrder)
        );
        showToast('ok', `Template tema baru "${data.theme.name}" ditambahkan.`);
      }
      resetThemeForm();
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal menyimpan template tema.'
      );
    } finally {
      setThemeBusy(false);
    }
  };

  const handleToggleThemeFlag = async (
    t: CuratedThemeTemplateDTO,
    patch: { isActive?: boolean; isProOnly?: boolean }
  ) => {
    setThemeBusy(true);
    try {
      const res = await authFetch(`/api/superadmin/themes/${t.id}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui tema.');
      setThemesList((prev) =>
        prev.map((item) => (item.id === t.id ? data.theme : item))
      );
      showToast('ok', `Status tema "${t.name}" diperbarui.`);
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal memperbarui tema.'
      );
    } finally {
      setThemeBusy(false);
    }
  };

  const handleDeleteTheme = async (t: CuratedThemeTemplateDTO) => {
    setThemeBusy(true);
    try {
      const res = await authFetch(`/api/superadmin/themes/${t.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus tema.');
      setThemesList((prev) => prev.filter((item) => item.id !== t.id));
      if (editingThemeId === t.id) resetThemeForm();
      showToast('ok', `Template tema "${t.name}" dihapus.`);
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal menghapus tema.'
      );
    } finally {
      setThemeBusy(false);
    }
  };

  // --- Audit Log Export & Platform Backup / Restore Handlers ---
  const handleExportAuditLogs = async (format: 'csv' | 'json') => {
    setExportingAudit(true);
    try {
      const params = new URLSearchParams({ format });
      if (logActionFilter && logActionFilter !== 'ALL') {
        params.set('action', logActionFilter);
      }
      if (logSearchQuery.trim()) {
        params.set('q', logSearchQuery.trim());
      }
      const res = await authFetch(
        `/api/superadmin/audit-logs/export?${params.toString()}`
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Gagal mengekspor audit log.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lokabio-audit-logs-${new Date()
        .toISOString()
        .slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('ok', `Audit log diekspor ke format ${format.toUpperCase()}.`);
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal mengekspor audit log.'
      );
    } finally {
      setExportingAudit(false);
    }
  };

  const handleDownloadBackup = async () => {
    setBackupBusy(true);
    try {
      const res = await authFetch('/api/superadmin/backup');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Gagal mengunduh backup.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lokabio-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('ok', 'Backup konfigurasi platform (JSON) berhasil diunduh.');
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error ? err.message : 'Gagal mengunduh backup.'
      );
    } finally {
      setBackupBusy(false);
    }
  };

  const handleRestoreBackupFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setRestoreBusy(true);
    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText);
      const res = await authFetch('/api/superadmin/backup/restore', {
        method: 'POST',
        body: JSON.stringify(parsed),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memulihkan backup konfigurasi.');
      }
      await Promise.all([loadOverview(), loadCommerceData()]);
      showToast(
        'ok',
        `Konfigurasi dipulihkan (${data.restoredThemesCount ?? 0} tema, ${
          data.restoredCouponsCount ?? 0
        } kupon).`
      );
    } catch (err: unknown) {
      showToast(
        'err',
        err instanceof Error
          ? err.message
          : 'File JSON tidak valid atau gagal dipulihkan.'
      );
    } finally {
      setRestoreBusy(false);
    }
  };

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

  if (loading && !stats && !forbiddenMessage) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] flex flex-col items-center justify-center gap-3 text-stone-600">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-[#141413] rounded-full animate-spin" />
        <span className="text-sm font-medium">Memuat Panel Super Admin...</span>
      </div>
    );
  }

  if (forbiddenMessage) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] text-[#141413] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-stone-200 rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-display text-lg font-bold">
              Akses Khusus Super Admin
            </h1>
            <p className="text-sm text-stone-600 leading-relaxed">
              {forbiddenMessage}
            </p>
            <p className="text-xs text-stone-500 pt-1">
              Masuk sebagai: <span className="font-medium">{user.email}</span>{' '}
              (Peran: User)
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('/dashboard')}
              className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-[#141413] text-white text-xs sm:text-sm font-medium hover:bg-stone-800 transition-colors"
            >
              Ke Studio Saya
            </button>
            <button
              type="button"
              onClick={signOut}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-stone-200 bg-white text-xs sm:text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
            >
              Ganti Akun
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#F6F5F1] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white border border-stone-200 rounded-2xl p-6 text-center space-y-4">
          <p className="text-sm text-red-700">{errorMsg}</p>
          <button
            type="button"
            onClick={loadOverview}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#141413] text-white text-sm font-medium"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  const filterButtons: { id: UserFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Semua', count: usersList.length },
    {
      id: 'pro',
      label: 'Paket Pro',
      count: usersList.filter((u) => isUserProActive(u)).length,
    },
    {
      id: 'verified',
      label: 'Terverifikasi',
      count: usersList.filter((u) => u.isVerified).length,
    },
    {
      id: 'featured',
      label: 'Pratinjau',
      count: usersList.filter((u) => u.isFeatured).length,
    },
    {
      id: 'admin',
      label: 'Admin',
      count: usersList.filter((u) => u.role === 'admin').length,
    },
    {
      id: 'suspended',
      label: 'Dinonaktifkan',
      count: usersList.filter((u) => u.isSuspended).length,
    },
  ];

  const mainTabs: {
    id: AdminSectionTab;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }[] = [
    {
      id: 'users',
      label: 'Pengguna & Moderasi',
      icon: <Users className="w-3.5 h-3.5" />,
      count: usersList.length,
    },
    {
      id: 'verifications',
      label: 'Antrean Verifikasi',
      icon: <BadgeCheck className="w-3.5 h-3.5" />,
      count: stats?.pendingVerifications || 0,
    },
    {
      id: 'reports',
      label: 'Laporan Masuk',
      icon: <Flag className="w-3.5 h-3.5" />,
      count: stats?.pendingReports || 0,
    },
    {
      id: 'commerce',
      label: 'Kupon & Tema',
      icon: <Ticket className="w-3.5 h-3.5" />,
    },
    {
      id: 'curation',
      label: 'Pratinjau & Pengaturan',
      icon: <Settings className="w-3.5 h-3.5" />,
    },
    {
      id: 'analytics',
      label: 'Analitik & Audit Log',
      icon: <BarChart3 className="w-3.5 h-3.5" />,
    },
  ];

  const maxChartValue = analytics
    ? Math.max(
        1,
        ...analytics.dailySeries.map((d) => Math.max(d.views, d.clicks))
      )
    : 1;

  return (
    <div className="min-h-screen bg-[#F6F5F1] text-[#141413] pb-16">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="p-2 -ml-2 rounded-xl text-stone-600 hover:bg-stone-100 hover:text-[#141413] transition-colors"
              aria-label="Kembali ke beranda"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <Shield className="w-4 h-4 text-[#D97757] shrink-0" />
              <span className="font-display text-base sm:text-lg font-bold tracking-tight truncate">
                LokaBio Super Admin
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('/dashboard')}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-medium hover:bg-stone-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Studio Saya</span>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        {/* Intro & Platform Summary */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-stone-500">
              Administrator: {user.email}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight mt-0.5">
              Pusat Kendali Platform LokaBio
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setCreateUserOpen(true)}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#D97757] text-white text-xs font-semibold hover:bg-[#c56647] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Tambah User</span>
            </button>
            <button
              type="button"
              onClick={handleExportUsersCsv}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-medium hover:bg-stone-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor CSV</span>
            </button>
            <button
              type="button"
              onClick={() => {
                loadOverview();
                if (activeTab === 'verifications') loadVerifications();
                if (activeTab === 'reports') loadReports();
                if (activeTab === 'commerce') loadCommerceData();
                if (activeTab === 'analytics') loadAnalyticsAndLogs();
              }}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-medium hover:bg-stone-50 transition-colors whitespace-nowrap"
            >
              Muat Ulang Data
            </button>
          </div>
        </div>

        {/* Active Operational Status Banner */}
        {(settings.maintenanceMode || !settings.registrationOpen) && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900">
            <div className="flex items-center gap-2.5">
              <Wrench className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Status Operasional:{' '}
                {settings.maintenanceMode && (
                  <strong className="font-semibold">
                    Mode Pemeliharaan Aktif
                  </strong>
                )}
                {settings.maintenanceMode && !settings.registrationOpen
                  ? ' · '
                  : ''}
                {!settings.registrationOpen && (
                  <strong className="font-semibold">
                    Pendaftaran Baru Ditutup
                  </strong>
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('curation')}
              className="px-3 py-1 rounded-lg bg-amber-900/10 hover:bg-amber-900/15 font-semibold text-amber-950 transition-colors"
            >
              Kelola Pengaturan
            </button>
          </div>
        )}

        {/* KPI Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span>Total Akun</span>
                <Users className="w-4 h-4 text-stone-400" />
              </div>
              <p className="font-display text-2xl sm:text-3xl font-bold tabular-nums mt-1.5">
                {stats.totalUsers.toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-stone-500 mt-1 tabular-nums">
                {stats.totalProUsers} Pro · {stats.totalVerified} terverifikasi
              </p>
            </div>

            <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5">
              <p className="text-xs text-stone-500">Tautan &amp; Status</p>
              <p className="font-display text-2xl sm:text-3xl font-bold tabular-nums mt-1.5">
                {stats.totalLinks.toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-stone-500 mt-1 tabular-nums">
                {stats.totalSuspended} nonaktif · {stats.dormantUsers} dormant
              </p>
            </div>

            <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5">
              <p className="text-xs text-stone-500">Kunjungan &amp; Klik</p>
              <p className="font-display text-2xl sm:text-3xl font-bold tabular-nums mt-1.5">
                {stats.totalViews.toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-stone-500 mt-1 tabular-nums">
                {stats.totalClicks.toLocaleString('id-ID')} total klik tautan
              </p>
            </div>

            <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5">
              <p className="text-xs text-stone-500">Antrean Tugas Admin</p>
              <p className="font-display text-2xl sm:text-3xl font-bold tabular-nums mt-1.5">
                {(
                  stats.pendingVerifications + stats.pendingReports
                ).toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-stone-500 mt-1 tabular-nums">
                {stats.pendingVerifications} verifikasi · {stats.pendingReports}{' '}
                laporan
              </p>
            </div>
          </div>
        )}

        {/* Section Tabs */}
        <div className="flex items-center gap-1.5 p-1.5 bg-stone-200/70 rounded-2xl overflow-x-auto">
          {mainTabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors tabular-nums ${
                  active
                    ? 'bg-white text-[#141413] shadow-xs'
                    : 'text-stone-600 hover:text-[#141413]'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[11px] font-semibold ${
                      tab.count > 0 &&
                      (tab.id === 'verifications' || tab.id === 'reports')
                        ? 'text-[#D97757]'
                        : 'text-stone-400'
                    }`}
                  >
                    ({tab.count})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: PENGGUNA & MODERASI */}
        {activeTab === 'users' && (
          <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-2.5 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama, @username, atau email..."
                    className="w-full min-h-[42px] pl-10 pr-4 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-[#141413]"
                  />
                </div>
                <select
                  aria-label="Urutkan pengguna"
                  value={userSort}
                  onChange={(e) => setUserSort(e.target.value as UserSort)}
                  className="min-h-[42px] px-3 rounded-xl border border-stone-200 bg-white text-xs font-medium text-stone-700 focus:outline-none focus:border-[#141413]"
                >
                  <option value="newest">Urut: Terbaru</option>
                  <option value="views">Urut: Views Terbanyak</option>
                  <option value="clicks">Urut: Klik Terbanyak</option>
                  <option value="links">Urut: Tautan Terbanyak</option>
                  <option value="oldest_active">
                    Urut: Terlama Tidak Aktif
                  </option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {filterButtons.map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => setFilter(btn.id)}
                    className={`min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap tabular-nums ${
                      filter === btn.id
                        ? 'bg-[#141413] text-white border-[#141413]'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {btn.label} ({btn.count})
                  </button>
                ))}
              </div>
            </div>

            {/* Bulk Selection & Actions Bar */}
            {filteredUsers.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200">
                <label className="inline-flex items-center gap-2.5 text-xs font-medium text-stone-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={
                      paginatedUsers.length > 0 &&
                      paginatedUsers.every((u) =>
                        selectedUserIds.includes(u.id)
                      )
                    }
                    onChange={handleToggleSelectPage}
                    className="w-4 h-4 rounded border-stone-300 accent-[#141413]"
                  />
                  <span>
                    Pilih semua di halaman ini ({paginatedUsers.length})
                  </span>
                  {selectedUserIds.length > 0 && (
                    <span className="text-[#D97757] font-semibold tabular-nums">
                      · {selectedUserIds.length} dipilih
                    </span>
                  )}
                </label>

                {selectedUserIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={bulkAction}
                      onChange={(e) => {
                        setBulkAction(e.target.value as BulkUserAction | '');
                        setConfirmBulkDelete(false);
                      }}
                      className="min-h-[36px] px-3 rounded-lg border border-stone-200 bg-white text-xs focus:outline-none focus:border-[#141413]"
                    >
                      <option value="">-- Pilih Aksi Massal --</option>
                      <option value="set_pro">Naikkan ke Paket Pro</option>
                      <option value="set_free">Turunkan ke Paket Free</option>
                      <option value="verify">Beri Centang Verifikasi</option>
                      <option value="unverify">Cabut Verifikasi</option>
                      <option value="feature">Tampilkan di Pratinjau</option>
                      <option value="unfeature">Sembunyikan Pratinjau</option>
                      <option value="suspend">Nonaktifkan Akun</option>
                      <option value="unsuspend">Aktifkan Akun</option>
                      <option value="delete">Hapus Akun Permanen</option>
                    </select>
                    <button
                      type="button"
                      disabled={!bulkAction || bulkBusy}
                      onClick={handleBulkAction}
                      className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-45 whitespace-nowrap ${
                        confirmBulkDelete
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-[#141413] text-white hover:bg-stone-800'
                      }`}
                    >
                      {bulkBusy
                        ? 'Memproses...'
                        : confirmBulkDelete
                        ? `Konfirmasi Hapus (${selectedUserIds.length})`
                        : 'Terapkan'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUserIds([]);
                        setConfirmBulkDelete(false);
                      }}
                      className="min-h-[36px] px-2.5 py-1 rounded-lg border border-stone-200 bg-white text-xs text-stone-600 hover:bg-stone-100"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>
            )}

            {filteredUsers.length === 0 ? (
              <div className="py-10 text-center text-sm text-stone-500">
                Tidak ada pengguna yang cocok dengan filter atau pencarian ini.
              </div>
            ) : (
              <>
                <div className="divide-y divide-stone-100">
                  {paginatedUsers.map((u) => {
                    const isSelf = u.uid === user.uid;
                    const isBusy = busyUserId === u.id;
                    const isPro = isUserProActive(u);
                    const isSelected = selectedUserIds.includes(u.id);
                    const avatarBroken = brokenAvatars[u.id] || !u.avatarUrl;
                    return (
                      <div
                        key={u.id}
                        className={`py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 ${
                          u.isSuspended ? 'opacity-65' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectUser(u.id)}
                            aria-label={`Pilih @${u.username}`}
                            className="mt-3 w-4 h-4 rounded border-stone-300 accent-[#141413] shrink-0"
                          />
                          <div className="w-11 h-11 rounded-full overflow-hidden border border-stone-200 bg-stone-100 shrink-0 flex items-center justify-center">
                            {!avatarBroken ? (
                              <img
                                src={u.avatarUrl}
                                alt={u.displayName}
                                referrerPolicy="no-referrer"
                                onError={() =>
                                  setBrokenAvatars((prev) => ({
                                    ...prev,
                                    [u.id]: true,
                                  }))
                                }
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <UserIcon className="w-5 h-5 text-stone-400" />
                            )}
                          </div>

                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-semibold text-[#141413] truncate">
                                {u.displayName}
                              </span>
                              {u.isVerified && (
                                <BadgeCheck
                                  className="w-4 h-4 text-sky-500 shrink-0"
                                  aria-label="Terverifikasi"
                                />
                              )}
                              <span
                                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                                  isPro
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-stone-100 text-stone-600 border border-stone-200'
                                }`}
                              >
                                {isPro ? 'Pro' : 'Free'}
                              </span>
                              <span className="text-xs font-medium text-stone-500">
                                · {u.role === 'admin' ? 'Super Admin' : 'User'}
                              </span>
                              {isSelf && (
                                <span className="text-xs font-medium text-[#D97757]">
                                  · Akun Anda
                                </span>
                              )}
                              {u.isSuspended && (
                                <span className="text-xs font-semibold text-red-600">
                                  · Dinonaktifkan
                                </span>
                              )}
                              {u.adminWarning && (
                                <span
                                  title={u.adminWarning}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-50 border border-red-200 text-[10px] font-semibold text-red-700"
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  Peringatan Aktif
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-stone-500">
                              <button
                                type="button"
                                onClick={() => onNavigate(`/${u.username}`)}
                                className="font-mono text-[#141413] hover:underline inline-flex items-center gap-1"
                              >
                                <span>@{u.username}</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                              <span aria-hidden="true">·</span>
                              <span className="truncate max-w-[220px]">
                                {u.email}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-stone-500 tabular-nums">
                              <span>{u.linkCount} tautan</span>
                              <span>
                                {u.profileViews.toLocaleString('id-ID')} kunj
                              </span>
                              <span>
                                {u.totalClicks.toLocaleString('id-ID')} klik
                              </span>
                              <span>{u.subscriberCount} email</span>
                              <span>{u.inquiryCount} pesan</span>
                              <span>
                                Aktif{' '}
                                {new Date(
                                  u.lastActiveAt || u.createdAt
                                ).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0 pl-7 xl:pl-0">
                          <button
                            type="button"
                            onClick={() => openInspectModal(u.id, 'profile')}
                            className="min-h-[36px] px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs font-medium text-[#141413] hover:bg-stone-100 inline-flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Ubah &amp; Kelola</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onNavigate(`/dashboard?previewUserId=${u.id}`)
                            }
                            className="min-h-[36px] px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                            title="Buka Studio user dalam mode pratinjau read-only"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Pratinjau Studio</span>
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              handleUpdateUser(
                                u,
                                { isVerified: !u.isVerified },
                                u.isVerified
                                  ? `Centang biru @${u.username} dicabut.`
                                  : `@${u.username} berhasil diverifikasi.`
                              )
                            }
                            className={`min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap ${
                              u.isVerified
                                ? 'bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100'
                                : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                            }`}
                          >
                            <BadgeCheck className="w-3.5 h-3.5" />
                            <span>
                              {u.isVerified ? 'Terverifikasi' : 'Verifikasi'}
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              handleUpdateUser(
                                u,
                                { isFeatured: !u.isFeatured },
                                u.isFeatured
                                  ? `@${u.username} disembunyikan dari pratinjau beranda.`
                                  : `@${u.username} ditampilkan di pratinjau beranda.`
                              )
                            }
                            className={`min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap ${
                              u.isFeatured
                                ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                                : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                            }`}
                          >
                            <Star className="w-3.5 h-3.5" />
                            <span>
                              {u.isFeatured
                                ? 'Tampil di Pratinjau'
                                : 'Tampilkan di Pratinjau'}
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={isBusy || isSelf}
                            onClick={() =>
                              handleUpdateUser(
                                u,
                                { role: u.role === 'admin' ? 'user' : 'admin' },
                                u.role === 'admin'
                                  ? `@${u.username} diubah menjadi User.`
                                  : `@${u.username} diangkat menjadi Super Admin.`
                              )
                            }
                            className={`min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-45 whitespace-nowrap ${
                              u.role === 'admin'
                                ? 'bg-[#141413] border-[#141413] text-white hover:bg-stone-800'
                                : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                            }`}
                          >
                            <Shield className="w-3.5 h-3.5" />
                            <span>
                              {u.role === 'admin'
                                ? 'Super Admin'
                                : 'Jadikan Admin'}
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={isBusy || isSelf}
                            onClick={() =>
                              handleUpdateUser(
                                u,
                                { isSuspended: !u.isSuspended },
                                u.isSuspended
                                  ? `Akun @${u.username} diaktifkan kembali.`
                                  : `Akun @${u.username} dinonaktifkan sementara.`
                              )
                            }
                            className={`min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-45 whitespace-nowrap ${
                              u.isSuspended
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                                : 'bg-white border-stone-200 text-stone-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
                            }`}
                          >
                            {u.isSuspended ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <Ban className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {u.isSuspended ? 'Aktifkan' : 'Nonaktifkan'}
                            </span>
                          </button>

                          {!isSelf &&
                            (confirmDeleteId === u.id ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleDeleteUser(u)}
                                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
                                >
                                  Ya, Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="min-h-[36px] px-2.5 py-1.5 rounded-xl border border-stone-200 text-xs text-stone-600 hover:bg-stone-50"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(u.id)}
                                aria-label={`Hapus akun @${u.username}`}
                                className="min-h-[36px] px-2.5 py-1.5 rounded-xl border border-stone-200 text-stone-500 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination Bar */}
                {totalPages > 1 && (
                  <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-stone-600">
                    <span className="tabular-nums">
                      Menampilkan {(safePage - 1) * USERS_PER_PAGE + 1}–
                      {Math.min(
                        safePage * USERS_PER_PAGE,
                        filteredUsers.length
                      )}{' '}
                      dari {filteredUsers.length} akun
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safePage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="min-h-[34px] px-3 py-1 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 inline-flex items-center gap-1"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Sebelumnya</span>
                      </button>
                      <span className="px-2.5 font-medium tabular-nums">
                        Hal {safePage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={safePage >= totalPages}
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        className="min-h-[34px] px-3 py-1 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 inline-flex items-center gap-1"
                      >
                        <span>Berikutnya</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 2: ANTREAN VERIFIKASI */}
        {activeTab === 'verifications' && (
          <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold">
                  Antrean Pengajuan Centang Biru
                </h2>
                <p className="text-xs text-stone-500">
                  Tinjau bukti tautan resmi kreator sebelum menyetujui lencana verifikasi.
                </p>
              </div>
            </div>

            {verificationsLoading ? (
              <div className="py-10 text-center text-sm text-stone-500">
                Memuat antrean verifikasi...
              </div>
            ) : verifications.length === 0 ? (
              <div className="py-12 text-center text-sm text-stone-500">
                Belum ada pengajuan verifikasi dari pengguna.
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {verifications.map((item) => {
                  const key = `ver-${item.id}`;
                  const isPending = item.status === 'pending';
                  return (
                    <div
                      key={item.id}
                      className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-semibold text-[#141413]">
                            {item.displayName || item.username}
                          </span>
                          <button
                            type="button"
                            onClick={() => onNavigate(`/${item.username}`)}
                            className="font-mono text-xs text-stone-600 hover:underline inline-flex items-center gap-1"
                          >
                            @{item.username}
                            <ExternalLink className="w-3 h-3" />
                          </button>
                          <span className="text-xs text-stone-500">
                            · {item.category}
                          </span>
                          <span
                            className={`text-xs font-semibold ${
                              item.status === 'approved'
                                ? 'text-emerald-700'
                                : item.status === 'rejected'
                                ? 'text-red-600'
                                : 'text-amber-700'
                            }`}
                          >
                            ·{' '}
                            {item.status === 'approved'
                              ? 'Disetujui'
                              : item.status === 'rejected'
                              ? 'Ditolak'
                              : 'Menunggu Review'}
                          </span>
                        </div>
                        <div className="text-xs text-stone-600 break-all">
                          Bukti:{' '}
                          <a
                            href={item.proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#D97757] hover:underline font-medium"
                          >
                            {item.proofUrl}
                          </a>
                        </div>
                        {item.note && (
                          <p className="text-xs text-stone-500">
                            Catatan pemohon: {item.note}
                          </p>
                        )}
                        {item.reviewedNote && (
                          <p className="text-xs text-stone-500">
                            Catatan admin ({item.reviewedBy}):{' '}
                            {item.reviewedNote}
                          </p>
                        )}
                      </div>

                      {isPending && (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                          <input
                            type="text"
                            value={reviewNotes[key] || ''}
                            onChange={(e) =>
                              setReviewNotes((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                            placeholder="Catatan opsional..."
                            className="min-h-[38px] px-3 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#141413]"
                          />
                          <button
                            type="button"
                            disabled={busyQueueId === key}
                            onClick={() =>
                              handleReviewVerification(item, 'approved')
                            }
                            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#141413] text-white text-xs font-semibold hover:bg-stone-800 disabled:opacity-50 whitespace-nowrap"
                          >
                            Setujui (+ Centang)
                          </button>
                          <button
                            type="button"
                            disabled={busyQueueId === key}
                            onClick={() =>
                              handleReviewVerification(item, 'rejected')
                            }
                            className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-red-200 text-red-700 text-xs font-medium hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
                          >
                            Tolak
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: LAPORAN MASUK */}
        {activeTab === 'reports' && (
          <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 space-y-4">
            <div>
              <h2 className="font-display text-lg font-bold">
                Laporan Keamanan &amp; Moderasi Profil
              </h2>
              <p className="text-xs text-stone-500">
                Laporan yang dikirim pengunjung dari halaman bio publik.
              </p>
            </div>

            {reportsLoading ? (
              <div className="py-10 text-center text-sm text-stone-500">
                Memuat daftar laporan...
              </div>
            ) : reports.length === 0 ? (
              <div className="py-12 text-center text-sm text-stone-500">
                Belum ada laporan pelanggaran yang masuk.
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {reports.map((rep) => {
                  const key = `rep-${rep.id}`;
                  const isPending = rep.status === 'pending';
                  return (
                    <div
                      key={rep.id}
                      className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-semibold text-[#141413]">
                            {rep.reason}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onNavigate(`/${rep.reportedUsername}`)
                            }
                            className="font-mono text-xs text-stone-600 hover:underline inline-flex items-center gap-1"
                          >
                            @{rep.reportedUsername}
                            <ExternalLink className="w-3 h-3" />
                          </button>
                          <span
                            className={`text-xs font-semibold ${
                              rep.status === 'resolved'
                                ? 'text-emerald-700'
                                : rep.status === 'dismissed'
                                ? 'text-stone-500'
                                : 'text-red-600'
                            }`}
                          >
                            ·{' '}
                            {rep.status === 'resolved'
                              ? 'Ditindaklanjuti'
                              : rep.status === 'dismissed'
                              ? 'Diabaikan'
                              : 'Menunggu Review'}
                          </span>
                        </div>
                        {rep.details && (
                          <p className="text-xs text-stone-600 leading-relaxed">
                            {rep.details}
                          </p>
                        )}
                        <p className="text-[11px] text-stone-500 tabular-nums">
                          Pelapor: {rep.reporterEmail || 'Anonim'} ·{' '}
                          {new Date(rep.createdAt).toLocaleString('id-ID')}
                        </p>
                        {rep.reviewedNote && (
                          <p className="text-xs text-stone-500">
                            Catatan ({rep.reviewedBy}): {rep.reviewedNote}
                          </p>
                        )}
                      </div>

                      {isPending && (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                          <input
                            type="text"
                            value={reviewNotes[key] || ''}
                            onChange={(e) =>
                              setReviewNotes((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                            placeholder="Catatan tindakan..."
                            className="min-h-[38px] px-3 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#141413]"
                          />
                          <button
                            type="button"
                            disabled={busyQueueId === key}
                            onClick={() =>
                              handleReviewReport(rep, 'resolved', true)
                            }
                            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
                          >
                            Nonaktifkan Akun
                          </button>
                          <button
                            type="button"
                            disabled={busyQueueId === key}
                            onClick={() =>
                              handleReviewReport(rep, 'resolved', false)
                            }
                            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#141413] text-white text-xs font-medium hover:bg-stone-800 disabled:opacity-50 whitespace-nowrap"
                          >
                            Selesai
                          </button>
                          <button
                            type="button"
                            disabled={busyQueueId === key}
                            onClick={() =>
                              handleReviewReport(rep, 'dismissed', false)
                            }
                            className="min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-200 text-stone-600 text-xs font-medium hover:bg-stone-50 disabled:opacity-50 whitespace-nowrap"
                          >
                            Abaikan
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3B: KUPON PROMO, RIWAYAT PRO & KURASI TEMA GLOBAL */}
        {activeTab === 'commerce' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Manajemen Kupon Promo */}
              <div className="lg:col-span-6 bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-[#D97757]" />
                  <div>
                    <h2 className="font-display text-base font-bold">
                      Manajemen Kupon Promo Pro
                    </h2>
                    <p className="text-xs text-stone-500">
                      Buat kode promo yang dapat ditukar kreator langsung di Studio (SEO &amp; QR) untuk upgrade Pro.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={handleCreateCoupon}
                  className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-stone-600 mb-1">
                        Kode Kupon *
                      </label>
                      <input
                        type="text"
                        required
                        value={couponForm.code}
                        onChange={(e) =>
                          setCouponForm((prev) => ({
                            ...prev,
                            code: e.target.value
                              .toUpperCase()
                              .replace(/[^A-Z0-9_-]/g, ''),
                          }))
                        }
                        placeholder="LOKABIOPRO30"
                        className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 bg-white text-xs font-mono focus:outline-none focus:border-[#141413]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-stone-600 mb-1">
                        Keterangan Singkat
                      </label>
                      <input
                        type="text"
                        value={couponForm.description}
                        onChange={(e) =>
                          setCouponForm((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Promo launching UMKM"
                        className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 bg-white text-xs focus:outline-none focus:border-[#141413]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-stone-600 mb-1">
                        Durasi Hari (0 = Selamanya)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={3650}
                        value={couponForm.durationDays}
                        onChange={(e) =>
                          setCouponForm((prev) => ({
                            ...prev,
                            durationDays: Math.max(
                              0,
                              Number(e.target.value) || 0
                            ),
                          }))
                        }
                        className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 bg-white text-xs tabular-nums focus:outline-none focus:border-[#141413]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-stone-600 mb-1">
                        Maks Pemakaian
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100000}
                        value={couponForm.maxUses}
                        onChange={(e) =>
                          setCouponForm((prev) => ({
                            ...prev,
                            maxUses: Math.max(
                              1,
                              Number(e.target.value) || 1
                            ),
                          }))
                        }
                        className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 bg-white text-xs tabular-nums focus:outline-none focus:border-[#141413]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-stone-600 mb-1">
                        Batas Klaim (Opsional)
                      </label>
                      <input
                        type="date"
                        value={couponForm.expiresAt}
                        onChange={(e) =>
                          setCouponForm((prev) => ({
                            ...prev,
                            expiresAt: e.target.value,
                          }))
                        }
                        className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 bg-white text-xs focus:outline-none focus:border-[#141413]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={couponBusy || !couponForm.code.trim()}
                      className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#D97757] text-white text-xs font-semibold hover:bg-[#c56647] disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{couponBusy ? 'Menyimpan...' : 'Buat Kupon'}</span>
                    </button>
                  </div>
                </form>

                {commerceLoading ? (
                  <p className="text-xs text-stone-500 py-6 text-center">
                    Memuat daftar kupon...
                  </p>
                ) : coupons.length === 0 ? (
                  <p className="text-xs text-stone-500 py-6 text-center">
                    Belum ada kupon promo yang dibuat.
                  </p>
                ) : (
                  <div className="divide-y divide-stone-100">
                    {coupons.map((c) => (
                      <div
                        key={c.id}
                        className={`py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                          !c.isActive ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-stone-100 border border-stone-200 text-[#141413]">
                              {c.code}
                            </span>
                            <span className="text-xs font-semibold text-amber-800">
                              {c.durationDays === 0
                                ? 'Pro Selamanya'
                                : `+${c.durationDays} hari`}
                            </span>
                            <span className="text-[11px] text-stone-500 tabular-nums">
                              · Terpakai {c.usedCount}/{c.maxUses}
                            </span>
                          </div>
                          {c.description && (
                            <p className="text-xs text-stone-600">
                              {c.description}
                            </p>
                          )}
                          <p className="text-[11px] text-stone-400">
                            {c.expiresAt
                              ? `Berlaku s/d ${new Date(
                                  c.expiresAt
                                ).toLocaleDateString('id-ID')}`
                              : 'Tanpa batas tanggal klaim'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={couponBusy}
                            onClick={() => handleToggleCouponActive(c)}
                            className={`min-h-[32px] px-2.5 py-1 rounded-lg border text-xs font-medium ${
                              c.isActive
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-stone-200 bg-white text-stone-600'
                            }`}
                          >
                            {c.isActive ? 'Aktif' : 'Nonaktif'}
                          </button>
                          <button
                            type="button"
                            disabled={couponBusy}
                            onClick={() => handleDeleteCoupon(c)}
                            aria-label={`Hapus kupon ${c.code}`}
                            className="min-h-[32px] px-2 py-1 rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Riwayat Upgrade Pro */}
              <div className="lg:col-span-6 bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-600" />
                  <div>
                    <h2 className="font-display text-base font-bold">
                      Riwayat Perubahan &amp; Klaim Paket Pro
                    </h2>
                    <p className="text-xs text-stone-500">
                      Jejak upgrade manual admin, aksi massal, dan penukaran kode kupon kreator.
                    </p>
                  </div>
                </div>

                {commerceLoading ? (
                  <p className="text-xs text-stone-500 py-6 text-center">
                    Memuat riwayat upgrade...
                  </p>
                ) : proHistory.length === 0 ? (
                  <p className="text-xs text-stone-500 py-8 text-center">
                    Belum ada riwayat perubahan paket Pro.
                  </p>
                ) : (
                  <div className="divide-y divide-stone-100 max-h-[460px] overflow-y-auto pr-1">
                    {proHistory.map((item) => (
                      <div
                        key={item.id}
                        className="py-2.5 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono font-semibold text-[#141413]">
                              @{item.username}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                item.planTier === 'pro'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-stone-100 text-stone-600'
                              }`}
                            >
                              {item.planTier}
                            </span>
                            {item.couponCode && (
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800">
                                {item.couponCode}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-stone-600">
                            {item.note || item.source}
                          </p>
                          <p className="text-[10px] text-stone-400">
                            Oleh {item.actorEmail} · Sumber: {item.source}
                          </p>
                        </div>
                        <span className="text-[11px] text-stone-400 tabular-nums shrink-0">
                          {new Date(item.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Kurasi Template Tema Global Resmi */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[#D97757]" />
                  <div>
                    <h2 className="font-display text-base font-bold">
                      Kurasi Template Tema Global Resmi
                    </h2>
                    <p className="text-xs text-stone-500">
                      Tambahkan atau atur preset tema yang muncul di tab Tema Studio seluruh kreator (dapat dikunci khusus Paket Pro).
                    </p>
                  </div>
                </div>
                {editingThemeId !== null && (
                  <button
                    type="button"
                    onClick={resetThemeForm}
                    className="min-h-[34px] px-3 py-1 rounded-xl border border-stone-200 text-xs font-medium text-stone-600 hover:bg-stone-50"
                  >
                    Batal Edit
                  </button>
                )}
              </div>

              <form
                onSubmit={handleSaveTheme}
                className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3.5"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  {/* Live mini swatch preview */}
                  <div className="lg:col-span-3">
                    <p className="text-[11px] font-medium text-stone-600 mb-1.5">
                      Pratinjau Swatch
                    </p>
                    <div
                      className="rounded-2xl border border-stone-200 p-4 flex flex-col items-center gap-2.5 text-center"
                      style={{
                        backgroundColor: themeForm.bgColor,
                        backgroundImage:
                          themeForm.bgType === 'gradient'
                            ? themeForm.bgGradient
                            : undefined,
                        color: themeForm.textColor,
                      }}
                    >
                      <div className="w-8 h-8 rounded-full bg-white/30 border border-white/40" />
                      <p className="text-xs font-bold truncate max-w-full">
                        {themeForm.name || 'Nama Tema'}
                      </p>
                      <div
                        className={`w-full py-1.5 px-3 text-[11px] font-semibold ${
                          themeForm.buttonShape === 'square'
                            ? 'rounded-none'
                            : themeForm.buttonShape === 'pill'
                            ? 'rounded-full'
                            : 'rounded-xl'
                        }`}
                        style={{
                          backgroundColor: themeForm.buttonColor,
                          color: themeForm.buttonTextColor,
                        }}
                      >
                        Contoh Tombol
                      </div>
                    </div>
                  </div>

                  {/* Theme fields */}
                  <div className="lg:col-span-9 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 mb-1">
                          Nama Tema *
                        </label>
                        <input
                          type="text"
                          required
                          value={themeForm.name}
                          onChange={(e) =>
                            setThemeForm((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          placeholder="Matcha Cream"
                          className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 bg-white text-xs focus:outline-none focus:border-[#141413]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 mb-1">
                          Slug ID *
                        </label>
                        <input
                          type="text"
                          required
                          disabled={editingThemeId !== null}
                          value={themeForm.slug}
                          onChange={(e) =>
                            setThemeForm((prev) => ({
                              ...prev,
                              slug: e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9_-]/g, ''),
                            }))
                          }
                          placeholder="matcha-cream"
                          className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 bg-white text-xs font-mono disabled:bg-stone-100 focus:outline-none focus:border-[#141413]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 mb-1">
                          Urutan Tampil
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={themeForm.sortOrder}
                          onChange={(e) =>
                            setThemeForm((prev) => ({
                              ...prev,
                              sortOrder: Math.max(
                                0,
                                Number(e.target.value) || 0
                              ),
                            }))
                          }
                          className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 bg-white text-xs tabular-nums focus:outline-none focus:border-[#141413]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-stone-600 mb-1">
                        Deskripsi Singkat
                      </label>
                      <input
                        type="text"
                        value={themeForm.description}
                        onChange={(e) =>
                          setThemeForm((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Nuansa hijau tenang untuk brand kuliner & wellness."
                        className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 bg-white text-xs focus:outline-none focus:border-[#141413]"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 mb-1">
                          Tipe Latar
                        </label>
                        <select
                          value={themeForm.bgType}
                          onChange={(e) =>
                            setThemeForm((prev) => ({
                              ...prev,
                              bgType: e.target.value,
                            }))
                          }
                          className="w-full min-h-[38px] px-2.5 rounded-xl border border-stone-200 bg-white text-xs"
                        >
                          <option value="solid">Solid</option>
                          <option value="gradient">Gradasi</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 mb-1">
                          Bentuk Tombol
                        </label>
                        <select
                          value={themeForm.buttonShape}
                          onChange={(e) =>
                            setThemeForm((prev) => ({
                              ...prev,
                              buttonShape: e.target.value,
                            }))
                          }
                          className="w-full min-h-[38px] px-2.5 rounded-xl border border-stone-200 bg-white text-xs"
                        >
                          <option value="rounded">Rounded</option>
                          <option value="pill">Pill</option>
                          <option value="square">Square</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 mb-1">
                          Font
                        </label>
                        <select
                          value={themeForm.fontFamily}
                          onChange={(e) =>
                            setThemeForm((prev) => ({
                              ...prev,
                              fontFamily: e.target.value,
                            }))
                          }
                          className="w-full min-h-[38px] px-2.5 rounded-xl border border-stone-200 bg-white text-xs"
                        >
                          <option value="sans">Sans</option>
                          <option value="serif">Serif</option>
                          <option value="mono">Mono</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 mb-1">
                          Warna Latar
                        </label>
                        <input
                          type="text"
                          value={themeForm.bgColor}
                          onChange={(e) =>
                            setThemeForm((prev) => ({
                              ...prev,
                              bgColor: e.target.value,
                            }))
                          }
                          className="w-full min-h-[38px] px-2.5 rounded-xl border border-stone-200 bg-white text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 mb-1">
                          Warna Teks Profil
                        </label>
                        <input
                          type="text"
                          value={themeForm.textColor}
                          onChange={(e) =>
                            setThemeForm((prev) => ({
                              ...prev,
                              textColor: e.target.value,
                            }))
                          }
                          className="w-full min-h-[38px] px-2.5 rounded-xl border border-stone-200 bg-white text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 mb-1">
                          Warna Tombol
                        </label>
                        <input
                          type="text"
                          value={themeForm.buttonColor}
                          onChange={(e) =>
                            setThemeForm((prev) => ({
                              ...prev,
                              buttonColor: e.target.value,
                            }))
                          }
                          className="w-full min-h-[38px] px-2.5 rounded-xl border border-stone-200 bg-white text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 mb-1">
                          Warna Teks Tombol
                        </label>
                        <input
                          type="text"
                          value={themeForm.buttonTextColor}
                          onChange={(e) =>
                            setThemeForm((prev) => ({
                              ...prev,
                              buttonTextColor: e.target.value,
                            }))
                          }
                          className="w-full min-h-[38px] px-2.5 rounded-xl border border-stone-200 bg-white text-xs font-mono"
                        />
                      </div>
                    </div>

                    {themeForm.bgType === 'gradient' && (
                      <div>
                        <label className="block text-[11px] font-medium text-stone-600 mb-1">
                          CSS Linear Gradient
                        </label>
                        <input
                          type="text"
                          value={themeForm.bgGradient}
                          onChange={(e) =>
                            setThemeForm((prev) => ({
                              ...prev,
                              bgGradient: e.target.value,
                            }))
                          }
                          className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 bg-white text-xs font-mono"
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="inline-flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={themeForm.isActive}
                            onChange={(e) =>
                              setThemeForm((prev) => ({
                                ...prev,
                                isActive: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-stone-300 accent-[#141413]"
                          />
                          <span>Tampilkan di Studio</span>
                        </label>
                        <label className="inline-flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={themeForm.isProOnly}
                            onChange={(e) =>
                              setThemeForm((prev) => ({
                                ...prev,
                                isProOnly: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded border-stone-300 accent-[#141413]"
                          />
                          <span>Khusus Paket Pro</span>
                        </label>
                      </div>
                      <button
                        type="submit"
                        disabled={themeBusy}
                        className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#141413] text-white text-xs font-semibold hover:bg-stone-800 disabled:opacity-50"
                      >
                        {themeBusy
                          ? 'Menyimpan...'
                          : editingThemeId !== null
                          ? 'Simpan Perubahan Tema'
                          : 'Tambah Template Tema'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {themesList.map((t) => (
                  <div
                    key={t.id}
                    className={`rounded-2xl border border-stone-200 p-4 space-y-3 ${
                      !t.isActive ? 'opacity-60 bg-stone-50' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl border border-stone-200 shrink-0 flex items-center justify-center"
                          style={{
                            backgroundColor: t.bgColor,
                            backgroundImage:
                              t.bgType === 'gradient'
                                ? t.bgGradient
                                : undefined,
                          }}
                        >
                          <span
                            className="w-4 h-2 rounded-full"
                            style={{ backgroundColor: t.buttonColor }}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-[#141413] truncate">
                              {t.name}
                            </p>
                            {t.isProOnly && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold uppercase">
                                PRO
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-stone-400 font-mono truncate">
                            {t.slug} · #{t.sortOrder}
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-stone-500 line-clamp-2 min-h-[2rem]">
                      {t.description || 'Tanpa deskripsi.'}
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-stone-100">
                      <button
                        type="button"
                        disabled={themeBusy}
                        onClick={() => startEditTheme(t)}
                        className="min-h-[30px] px-2.5 py-1 rounded-lg border border-stone-200 text-[11px] font-medium hover:bg-stone-50 inline-flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        disabled={themeBusy}
                        onClick={() =>
                          handleToggleThemeFlag(t, { isActive: !t.isActive })
                        }
                        className={`min-h-[30px] px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
                          t.isActive
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-stone-200 bg-white text-stone-600'
                        }`}
                      >
                        {t.isActive ? 'Aktif' : 'Nonaktif'}
                      </button>
                      <button
                        type="button"
                        disabled={themeBusy}
                        onClick={() =>
                          handleToggleThemeFlag(t, { isProOnly: !t.isProOnly })
                        }
                        className={`min-h-[30px] px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
                          t.isProOnly
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-stone-200 bg-white text-stone-600'
                        }`}
                      >
                        {t.isProOnly ? 'Pro Only' : 'Gratis'}
                      </button>
                      <button
                        type="button"
                        disabled={themeBusy}
                        onClick={() => handleDeleteTheme(t)}
                        aria-label={`Hapus tema ${t.name}`}
                        className="ml-auto min-h-[30px] px-2 py-1 rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PRATINJAU & PENGATURAN PLATFORM */}
        {activeTab === 'curation' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Urutan Pratinjau Beranda */}
            <div className="lg:col-span-6 bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-bold">
                    Urutan Pratinjau Profil Beranda
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Atur urutan akun yang tampil di bagian Pratinjau Profil Aktif pada halaman utama.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={savingOrder || featuredOrderedUsers.length === 0}
                  onClick={handleSaveFeaturedOrder}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#141413] text-white text-xs font-semibold hover:bg-stone-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {savingOrder ? 'Menyimpan...' : 'Simpan Urutan'}
                </button>
              </div>

              {featuredOrderedUsers.length === 0 ? (
                <p className="text-xs text-stone-500 py-6 text-center">
                  Belum ada akun yang dipilih tampil di pratinjau. Aktifkan melalui tab Pengguna &amp; Moderasi.
                </p>
              ) : (
                <div className="divide-y divide-stone-100">
                  {featuredOrderedUsers.map((u, idx) => (
                    <div
                      key={u.id}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {idx + 1}. {u.displayName}
                        </p>
                        <p className="text-xs text-stone-500 font-mono">
                          @{u.username}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveFeaturedUser(idx, -1)}
                          className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50 disabled:opacity-35"
                          aria-label="Geser naik"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === featuredOrderedUsers.length - 1}
                          onClick={() => moveFeaturedUser(idx, 1)}
                          className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50 disabled:opacity-35"
                          aria-label="Geser turun"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateUser(
                              u,
                              { isFeatured: false },
                              `@${u.username} disembunyikan dari pratinjau beranda.`
                            )
                          }
                          className="min-h-[34px] px-2.5 py-1 rounded-lg border border-stone-200 text-xs text-stone-600 hover:bg-red-50 hover:text-red-700"
                        >
                          Lepas
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pengumuman Global & Reserved Usernames */}
            <div className="lg:col-span-6 space-y-6">
              <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-[#D97757]" />
                    <h2 className="font-display text-base font-bold">
                      Pengumuman Global Studio
                    </h2>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.announcementEnabled}
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        announcementEnabled: !prev.announcementEnabled,
                      }))
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      settings.announcementEnabled
                        ? 'bg-[#141413]'
                        : 'bg-stone-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                        settings.announcementEnabled
                          ? 'translate-x-5'
                          : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-stone-600 mb-1">
                        Judul Pengumuman
                      </label>
                      <input
                        type="text"
                        value={settings.announcementTitle}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            announcementTitle: e.target.value,
                          }))
                        }
                        placeholder="Contoh: Pemeliharaan Terjadwal atau Fitur Baru"
                        className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#141413]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">
                        Tipe Banner
                      </label>
                      <select
                        value={settings.announcementType}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            announcementType: e.target.value,
                          }))
                        }
                        className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200 text-xs bg-white focus:outline-none focus:border-[#141413]"
                      >
                        <option value="info">Informasi</option>
                        <option value="warning">Peringatan</option>
                        <option value="success">Pembaruan</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Isi Pesan (tampil di Studio seluruh pengguna)
                    </label>
                    <textarea
                      rows={2}
                      value={settings.announcementMessage}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          announcementMessage: e.target.value,
                        }))
                      }
                      placeholder="Tulis informasi penting untuk semua kreator LokaBio..."
                      className="w-full p-3 rounded-xl border border-stone-200 text-xs resize-none focus:outline-none focus:border-[#141413]"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-100 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">
                      Daftar Username Terlarang (Reserved)
                    </h3>
                    <p className="text-xs text-stone-500">
                      Handle di bawah ini tidak dapat diklaim oleh pendaftar baru.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newReservedWord}
                      onChange={(e) =>
                        setNewReservedWord(
                          e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')
                        )
                      }
                      placeholder="Tambah kata terlarang (misal: cs_resmi)"
                      className="flex-1 min-h-[40px] px-3 rounded-xl border border-stone-200 text-xs font-mono focus:outline-none focus:border-[#141413]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const clean = newReservedWord.trim();
                        if (clean.length < 2) return;
                        if (!settings.reservedUsernames.includes(clean)) {
                          setSettings((prev) => ({
                            ...prev,
                            reservedUsernames: [...prev.reservedUsernames, clean],
                          }));
                        }
                        setNewReservedWord('');
                      }}
                      className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs font-medium hover:bg-stone-100 inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {settings.reservedUsernames.map((word) => (
                      <button
                        key={word}
                        type="button"
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            reservedUsernames: prev.reservedUsernames.filter(
                              (w) => w !== word
                            ),
                          }))
                        }
                        title="Klik untuk menghapus dari daftar terlarang"
                        className="px-2.5 py-1 rounded-lg border border-stone-200 bg-stone-50 text-xs font-mono text-stone-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200 inline-flex items-center gap-1.5"
                      >
                        <span>{word}</span>
                        <X className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    disabled={savingSettings}
                    onClick={() => handleSavePlatformSettings()}
                    className="min-h-[40px] px-5 py-2 rounded-xl bg-[#D97757] text-white text-xs font-semibold hover:bg-[#c56647] disabled:opacity-50"
                  >
                    {savingSettings
                      ? 'Menyimpan...'
                      : 'Simpan Pengaturan Platform'}
                  </button>
                </div>
              </div>

              {/* Kontrol Operasional Darurat & Kuota */}
              <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-[#D97757]" />
                  <div>
                    <h2 className="font-display text-base font-bold">
                      Kontrol Operasional &amp; Kuota Paket Free
                    </h2>
                    <p className="text-xs text-stone-500">
                      Kelola mode pemeliharaan darurat, izin pendaftaran baru, dan batas tautan kreator Free.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                    <div>
                      <p className="text-xs font-semibold text-[#141413]">
                        Mode Pemeliharaan (Maintenance Mode)
                      </p>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Jika aktif, halaman publik (`/:username`) &amp; beranda menampilkan layar pemeliharaan. Super Admin tetap dapat masuk.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.maintenanceMode}
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          maintenanceMode: !prev.maintenanceMode,
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        settings.maintenanceMode
                          ? 'bg-red-600'
                          : 'bg-stone-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                          settings.maintenanceMode
                            ? 'translate-x-5'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Pesan Layar Pemeliharaan
                    </label>
                    <textarea
                      rows={2}
                      value={settings.maintenanceMessage}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          maintenanceMessage: e.target.value,
                        }))
                      }
                      placeholder="Contoh: LokaBio sedang menjalani pemeliharaan sistem terjadwal. Kami akan segera kembali."
                      className="w-full p-3 rounded-xl border border-stone-200 text-xs resize-none focus:outline-none focus:border-[#141413]"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200">
                    <div>
                      <p className="text-xs font-semibold text-[#141413]">
                        Buka Pendaftaran Akun Baru
                      </p>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Jika dimatikan, hanya akun yang sudah terdaftar atau Super Admin yang dapat login ke Studio.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.registrationOpen}
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          registrationOpen: !prev.registrationOpen,
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        settings.registrationOpen
                          ? 'bg-[#141413]'
                          : 'bg-stone-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                          settings.registrationOpen
                            ? 'translate-x-5'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Maksimal Blok Tautan untuk Paket Free (1–100)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={settings.freeLinkLimit}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          freeLinkLimit: Math.max(
                            1,
                            Math.min(100, Number(e.target.value) || 8)
                          ),
                        }))
                      }
                      className="w-32 min-h-[40px] px-3 rounded-xl border border-stone-200 text-xs font-semibold tabular-nums focus:outline-none focus:border-[#141413]"
                    />
                  </div>
                </div>

                {/* SafeLink Domain Blocklist */}
                <div className="pt-3 border-t border-stone-100 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#D97757]" />
                    <div>
                      <h3 className="text-sm font-semibold">
                        Keamanan Tautan (Domain Blocklist)
                      </h3>
                      <p className="text-xs text-stone-500">
                        Domain atau pola URL terlarang (phishing, judi online, scam). Diblokir otomatis saat kreator menambah/mengubah tautan.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newBlockedDomain}
                      onChange={(e) =>
                        setNewBlockedDomain(e.target.value.toLowerCase().trim())
                      }
                      placeholder="Contoh: bit.ly/scam atau judol.com"
                      className="flex-1 min-h-[40px] px-3 rounded-xl border border-stone-200 text-xs font-mono focus:outline-none focus:border-[#141413]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const clean = newBlockedDomain
                          .trim()
                          .toLowerCase()
                          .replace(/^https?:\/\//, '')
                          .replace(/\/+$/, '');
                        if (clean.length < 3) return;
                        if (!settings.blockedDomains.includes(clean)) {
                          setSettings((prev) => ({
                            ...prev,
                            blockedDomains: [...prev.blockedDomains, clean],
                          }));
                        }
                        setNewBlockedDomain('');
                      }}
                      className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs font-medium hover:bg-stone-100 inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah</span>
                    </button>
                  </div>
                  {settings.blockedDomains.length === 0 ? (
                    <p className="text-xs text-stone-400">
                      Belum ada domain yang diblokir.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {settings.blockedDomains.map((dom) => (
                        <button
                          key={dom}
                          type="button"
                          onClick={() =>
                            setSettings((prev) => ({
                              ...prev,
                              blockedDomains: prev.blockedDomains.filter(
                                (d) => d !== dom
                              ),
                            }))
                          }
                          title="Klik untuk menghapus dari blocklist"
                          className="px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 text-xs font-mono text-red-700 hover:bg-red-100 inline-flex items-center gap-1.5"
                        >
                          <Lock className="w-3 h-3" />
                          <span>{dom}</span>
                          <X className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    disabled={savingSettings}
                    onClick={() => handleSavePlatformSettings()}
                    className="min-h-[40px] px-5 py-2 rounded-xl bg-[#D97757] text-white text-xs font-semibold hover:bg-[#c56647] disabled:opacity-50"
                  >
                    {savingSettings
                      ? 'Menyimpan...'
                      : 'Simpan Pengaturan Platform'}
                  </button>
                </div>
              </div>

              {/* Backup & Restore Konfigurasi Platform (JSON) */}
              <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#D97757]" />
                  <div>
                    <h2 className="font-display text-base font-bold">
                      Backup &amp; Restore Konfigurasi Platform
                    </h2>
                    <p className="text-xs text-stone-500">
                      Ekspor pengaturan global, blocklist, preset tema resmi, dan daftar kupon ke satu file JSON, atau pulihkan kembali kapan saja.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={backupBusy}
                    onClick={handleDownloadBackup}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#141413] text-white text-xs font-semibold hover:bg-stone-800 disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      {backupBusy ? 'Menyiapkan...' : 'Unduh Backup JSON'}
                    </span>
                  </button>

                  <label
                    className={`min-h-[40px] px-4 py-2 rounded-xl border border-stone-200 bg-stone-50 text-xs font-medium text-[#141413] hover:bg-stone-100 inline-flex items-center gap-1.5 cursor-pointer ${
                      restoreBusy ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {restoreBusy
                        ? 'Memulihkan...'
                        : 'Pulihkan dari File JSON'}
                    </span>
                    <input
                      type="file"
                      accept="application/json,.json"
                      disabled={restoreBusy}
                      onChange={handleRestoreBackupFile}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: ANALITIK GLOBAL & AUDIT LOG */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Platform-Wide Trend Chart */}
              <div className="lg:col-span-8 bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-bold">
                      Tren Kunjungan &amp; Klik Global
                    </h2>
                    <p className="text-xs text-stone-500">
                      Agregat aktivitas seluruh halaman publik LokaBio
                    </p>
                  </div>
                  <div className="inline-flex p-1 bg-stone-100 rounded-xl gap-1">
                    {([7, 14, 30] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setAnalyticsDays(d)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors tabular-nums ${
                          analyticsDays === d
                            ? 'bg-white text-[#141413] shadow-xs'
                            : 'text-stone-600 hover:text-[#141413]'
                        }`}
                      >
                        {d} Hari
                      </button>
                    ))}
                  </div>
                </div>

                {analyticsLoading || !analytics ? (
                  <div className="h-48 flex items-center justify-center text-xs text-stone-500">
                    Memuat grafik tren...
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="h-48 flex items-end gap-1.5 pt-4 border-b border-stone-100">
                      {analytics.dailySeries.map((day) => {
                        const vHeight = Math.max(
                          4,
                          Math.round((day.views / maxChartValue) * 140)
                        );
                        const cHeight = Math.max(
                          4,
                          Math.round((day.clicks / maxChartValue) * 140)
                        );
                        return (
                          <div
                            key={day.date}
                            title={`${day.date}: ${day.views} kunjungan, ${day.clicks} klik`}
                            className="flex-1 flex flex-col items-center gap-1 min-w-0"
                          >
                            <div className="w-full flex items-end justify-center gap-0.5 h-36">
                              <div
                                className="w-2.5 rounded-t bg-[#141413] transition-all"
                                style={{ height: `${vHeight}px` }}
                              />
                              <div
                                className="w-2.5 rounded-t bg-[#D97757] transition-all"
                                style={{ height: `${cHeight}px` }}
                              />
                            </div>
                            <span className="text-[10px] text-stone-400 tabular-nums truncate w-full text-center">
                              {day.date.slice(5)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-5 text-xs text-stone-600">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-[#141413]" />
                        Kunjungan Profil
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-xs bg-[#D97757]" />
                        Klik Tautan
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Top Creators Leaderboard */}
              <div className="lg:col-span-4 bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4">
                <h2 className="font-display text-base font-bold">
                  Kreator Paling Aktif
                </h2>
                {!analytics || analytics.topCreators.length === 0 ? (
                  <p className="text-xs text-stone-500">Belum ada data.</p>
                ) : (
                  <div className="divide-y divide-stone-100">
                    {analytics.topCreators.map((c, idx) => (
                      <div
                        key={c.id}
                        className="py-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate flex items-center gap-1">
                            <span className="text-stone-400 tabular-nums">
                              {idx + 1}.
                            </span>
                            <span className="truncate">{c.displayName}</span>
                            {c.isVerified && (
                              <BadgeCheck className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                            )}
                          </p>
                          <p className="text-[11px] text-stone-500 font-mono">
                            @{c.username}
                          </p>
                        </div>
                        <div className="text-right text-[11px] text-stone-600 tabular-nums shrink-0">
                          <p className="font-semibold">
                            {c.profileViews.toLocaleString('id-ID')} kunj
                          </p>
                          <p className="text-stone-400">
                            {c.totalClicks.toLocaleString('id-ID')} klik
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Akun Dormant & Pemeliharaan Database */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4">
                <div>
                  <h2 className="font-display text-base font-bold">
                    Kreator Tidak Aktif (&gt; 30 Hari)
                  </h2>
                  <p className="text-xs text-stone-500">
                    Daftar akun yang belum melakukan login atau pembaruan lebih dari 30 hari terakhir.
                  </p>
                </div>

                {!analytics || analytics.dormantCreators.length === 0 ? (
                  <p className="text-xs text-stone-500 py-4">
                    Tidak ada akun tidak aktif dalam 30 hari terakhir.
                  </p>
                ) : (
                  <div className="divide-y divide-stone-100">
                    {analytics.dormantCreators.map((dc) => (
                      <div
                        key={dc.id}
                        className="py-2.5 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-[#141413] truncate">
                            {dc.displayName}{' '}
                            <span className="font-mono font-normal text-stone-500">
                              @{dc.username}
                            </span>
                          </p>
                          <p className="text-[11px] text-stone-500 tabular-nums">
                            Terakhir aktif{' '}
                            {new Date(dc.lastActiveAt).toLocaleDateString(
                              'id-ID'
                            )}{' '}
                            · {dc.linkCount} tautan ·{' '}
                            {dc.profileViews.toLocaleString('id-ID')} kunj
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openInspectModal(dc.id)}
                          className="min-h-[32px] px-2.5 py-1 rounded-lg border border-stone-200 bg-stone-50 text-xs font-medium hover:bg-stone-100 shrink-0"
                        >
                          Inspeksi
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#D97757]" />
                  <div>
                    <h2 className="font-display text-base font-bold">
                      Pemeliharaan Database Event
                    </h2>
                    <p className="text-xs text-stone-500">
                      Pangkas baris log klik/kunjungan lama agar kueri tetap ringan.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                  <p className="text-xs text-stone-500">
                    Total Baris Log Event Tersimpan
                  </p>
                  <p className="font-display text-2xl font-bold tabular-nums mt-1">
                    {(analytics?.totalClickEvents || 0).toLocaleString('id-ID')}{' '}
                    baris
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-stone-600">
                    Hapus log klik &amp; kunjungan yang lebih lama dari:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[30, 90, 180].map((d) =>
                      confirmCleanupDays === d ? (
                        <div key={d} className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={cleanupBusy}
                            onClick={() => handleCleanupClickEvents(d)}
                            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
                          >
                            {cleanupBusy
                              ? 'Menghapus...'
                              : `Ya, Hapus > ${d} Hari`}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmCleanupDays(null)}
                            className="min-h-[36px] px-2.5 py-1.5 rounded-xl border border-stone-200 text-xs text-stone-600 hover:bg-stone-50"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          key={d}
                          type="button"
                          disabled={cleanupBusy}
                          onClick={() => setConfirmCleanupDays(d)}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-medium text-stone-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors"
                        >
                          &gt; {d} Hari
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Audit Log Aktivitas Admin */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#D97757]" />
                  <div>
                    <h2 className="font-display text-base font-bold">
                      Audit Log Aktivitas Admin
                    </h2>
                    <p className="text-xs text-stone-500">
                      Rekam jejak kronologis setiap tindakan moderasi dan perubahan pengaturan platform.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Filter tipe aksi audit log"
                    value={logActionFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLogActionFilter(val);
                      loadAuditLogs(val, logSearchQuery);
                    }}
                    className="min-h-[38px] px-3 rounded-xl border border-stone-200 bg-white text-xs focus:outline-none focus:border-[#141413]"
                  >
                    <option value="ALL">Semua Aksi</option>
                    <option value="CREATE_USER">CREATE_USER</option>
                    <option value="UPDATE_USER">UPDATE_USER</option>
                    <option value="BULK_USER_ACTION">BULK_USER_ACTION</option>
                    <option value="DELETE_USER">DELETE_USER</option>
                    <option value="ADMIN_CREATE_LINK">ADMIN_CREATE_LINK</option>
                    <option value="ADMIN_UPDATE_LINK">ADMIN_UPDATE_LINK</option>
                    <option value="MODERATE_LINK">MODERATE_LINK</option>
                    <option value="DELETE_LINK">DELETE_LINK</option>
                    <option value="GENERATE_PASSWORD_RESET">
                      GENERATE_PASSWORD_RESET
                    </option>
                    <option value="SUPPORT_PREVIEW">SUPPORT_PREVIEW</option>
                    <option value="CREATE_COUPON">CREATE_COUPON</option>
                    <option value="UPDATE_COUPON">UPDATE_COUPON</option>
                    <option value="DELETE_COUPON">DELETE_COUPON</option>
                    <option value="CREATE_THEME">CREATE_THEME</option>
                    <option value="UPDATE_THEME">UPDATE_THEME</option>
                    <option value="DELETE_THEME">DELETE_THEME</option>
                    <option value="REVIEW_VERIFICATION">
                      REVIEW_VERIFICATION
                    </option>
                    <option value="REVIEW_REPORT">REVIEW_REPORT</option>
                    <option value="REORDER_FEATURED">REORDER_FEATURED</option>
                    <option value="UPDATE_PLATFORM_SETTINGS">
                      UPDATE_PLATFORM_SETTINGS
                    </option>
                    <option value="CLEANUP_CLICK_EVENTS">
                      CLEANUP_CLICK_EVENTS
                    </option>
                    <option value="EXPORT_BACKUP">EXPORT_BACKUP</option>
                    <option value="RESTORE_BACKUP">RESTORE_BACKUP</option>
                  </select>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={logSearchQuery}
                      onChange={(e) => setLogSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          loadAuditLogs(logActionFilter, logSearchQuery);
                        }
                      }}
                      placeholder="Cari @username / detail..."
                      className="min-h-[38px] px-3 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#141413]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        loadAuditLogs(logActionFilter, logSearchQuery)
                      }
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#141413] text-white text-xs font-medium hover:bg-stone-800 whitespace-nowrap"
                    >
                      Filter
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={exportingAudit}
                    onClick={() => handleExportAuditLogs('csv')}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Ekspor CSV</span>
                  </button>
                  <button
                    type="button"
                    disabled={exportingAudit}
                    onClick={() => handleExportAuditLogs('json')}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Ekspor JSON</span>
                  </button>
                </div>
              </div>

              {logsLoading ? (
                <div className="py-8 text-center text-xs text-stone-500">
                  Memuat riwayat aktivitas...
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-500">
                  Tidak ada catatan aktivitas admin yang sesuai filter.
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-medium text-[#141413]">
                          {log.details}
                        </p>
                        <p className="text-[11px] text-stone-500">
                          Oleh {log.adminEmail}
                          {log.targetUsername
                            ? ` · Target @${log.targetUsername}`
                            : ''}
                          {' · '}
                          <span className="font-mono">{log.action}</span>
                        </p>
                      </div>
                      <span className="text-[11px] text-stone-400 tabular-nums shrink-0">
                        {new Date(log.createdAt).toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* User Inspection, Edit Data & Link Moderation Modal */}
      <AnimatePresence>
        {(inspectLoading || inspectDetail) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-white rounded-2xl border border-stone-200 p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold">
                    {inspectDetail
                      ? `Kelola & Ubah Data @${inspectDetail.user.username}`
                      : 'Memuat Detail Akun...'}
                  </h2>
                  {inspectDetail && (
                    <p className="text-xs text-stone-500">
                      {inspectDetail.user.displayName} ·{' '}
                      {inspectDetail.user.email}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {inspectDetail && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = inspectDetail.user.id;
                        setInspectDetail(null);
                        onNavigate(`/dashboard?previewUserId=${targetId}`);
                      }}
                      className="min-h-[34px] px-3 py-1 rounded-xl border border-stone-200 bg-stone-50 text-xs font-medium text-[#141413] hover:bg-stone-100 inline-flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Pratinjau Studio</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setInspectDetail(null)}
                    className="p-2 rounded-lg hover:bg-stone-100 text-stone-500"
                    aria-label="Tutup panel kelola"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {inspectLoading || !inspectDetail ? (
                <div className="py-10 text-center text-sm text-stone-500">
                  Memuat tautan dan profil pengguna...
                </div>
              ) : (
                <>
                  {/* Modal Sub-Tabs */}
                  <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setInspectTab('profile')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                        inspectTab === 'profile'
                          ? 'bg-white text-[#141413] shadow-xs'
                          : 'text-stone-600 hover:text-[#141413]'
                      }`}
                    >
                      Ubah Data Profil
                    </button>
                    <button
                      type="button"
                      onClick={() => setInspectTab('plan')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                        inspectTab === 'plan'
                          ? 'bg-white text-[#141413] shadow-xs'
                          : 'text-stone-600 hover:text-[#141413]'
                      }`}
                    >
                      Paket &amp; Peringatan
                    </button>
                    <button
                      type="button"
                      onClick={() => setInspectTab('links')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors tabular-nums ${
                        inspectTab === 'links'
                          ? 'bg-white text-[#141413] shadow-xs'
                          : 'text-stone-600 hover:text-[#141413]'
                      }`}
                    >
                      Moderasi Tautan ({inspectDetail.links.length})
                    </button>
                  </div>

                  {inspectTab === 'profile' && (
                    <form
                      onSubmit={handleSaveInspectProfile}
                      className="space-y-3.5"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            Username / Handle *
                          </label>
                          <input
                            type="text"
                            required
                            value={editProfileForm.username}
                            onChange={(e) =>
                              setEditProfileForm((prev) => ({
                                ...prev,
                                username: e.target.value
                                  .toLowerCase()
                                  .replace(/[^a-z0-9_-]/g, ''),
                              }))
                            }
                            className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 text-xs font-mono focus:outline-none focus:border-[#141413]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            Nama Tampilan *
                          </label>
                          <input
                            type="text"
                            required
                            value={editProfileForm.displayName}
                            onChange={(e) =>
                              setEditProfileForm((prev) => ({
                                ...prev,
                                displayName: e.target.value,
                              }))
                            }
                            className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#141413]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            Email Akun *
                          </label>
                          <input
                            type="email"
                            required
                            value={editProfileForm.email}
                            onChange={(e) =>
                              setEditProfileForm((prev) => ({
                                ...prev,
                                email: e.target.value,
                              }))
                            }
                            className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#141413]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            URL Foto Profil (Avatar)
                          </label>
                          <input
                            type="text"
                            value={editProfileForm.avatarUrl}
                            onChange={(e) =>
                              setEditProfileForm((prev) => ({
                                ...prev,
                                avatarUrl: e.target.value,
                              }))
                            }
                            placeholder="https://..."
                            className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#141413]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">
                          Bio Profil
                        </label>
                        <textarea
                          rows={2}
                          value={editProfileForm.bio}
                          onChange={(e) =>
                            setEditProfileForm((prev) => ({
                              ...prev,
                              bio: e.target.value,
                            }))
                          }
                          className="w-full p-2.5 rounded-xl border border-stone-200 text-xs resize-none focus:outline-none focus:border-[#141413]"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            Nomor WhatsApp
                          </label>
                          <input
                            type="text"
                            value={editProfileForm.whatsappNumber}
                            onChange={(e) =>
                              setEditProfileForm((prev) => ({
                                ...prev,
                                whatsappNumber: e.target.value,
                              }))
                            }
                            placeholder="6281234567890"
                            className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#141413]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            Email Kontak Publik
                          </label>
                          <input
                            type="email"
                            value={editProfileForm.contactEmail}
                            onChange={(e) =>
                              setEditProfileForm((prev) => ({
                                ...prev,
                                contactEmail: e.target.value,
                              }))
                            }
                            placeholder="kontak@domain.com"
                            className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#141413]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-stone-100">
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            SEO Title Kustom
                          </label>
                          <input
                            type="text"
                            value={editProfileForm.seoTitle}
                            onChange={(e) =>
                              setEditProfileForm((prev) => ({
                                ...prev,
                                seoTitle: e.target.value,
                              }))
                            }
                            className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#141413]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            SEO Description Kustom
                          </label>
                          <input
                            type="text"
                            value={editProfileForm.seoDescription}
                            onChange={(e) =>
                              setEditProfileForm((prev) => ({
                                ...prev,
                                seoDescription: e.target.value,
                              }))
                            }
                            className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#141413]"
                          />
                        </div>
                      </div>

                      <label className="inline-flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editProfileForm.hideBranding}
                          onChange={(e) =>
                            setEditProfileForm((prev) => ({
                              ...prev,
                              hideBranding: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 rounded border-stone-300 accent-[#141413]"
                        />
                        <span>
                          Sembunyikan branding &quot;Dibuat dengan LokaBio&quot; (aktif bila paket Pro)
                        </span>
                      </label>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100">
                        <button
                          type="button"
                          disabled={resetLinkBusy}
                          onClick={handleGenerateResetLink}
                          className="min-h-[40px] px-3.5 py-2 rounded-xl border border-stone-200 bg-stone-50 text-xs font-medium text-[#141413] hover:bg-stone-100 disabled:opacity-50 inline-flex items-center gap-1.5"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-[#D97757]" />
                          <span>
                            {resetLinkBusy
                              ? 'Membuat tautan...'
                              : 'Buat Link Reset Password'}
                          </span>
                        </button>

                        <button
                          type="submit"
                          disabled={inspectSaving}
                          className="min-h-[40px] px-5 py-2 rounded-xl bg-[#D97757] text-white text-xs font-semibold hover:bg-[#c56647] disabled:opacity-50"
                        >
                          {inspectSaving
                            ? 'Menyimpan...'
                            : 'Simpan Perubahan Data User'}
                        </button>
                      </div>

                      {resetLinkResult && (
                        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-amber-900">
                              Tautan Reset Password ({resetLinkResult.email})
                            </p>
                            <button
                              type="button"
                              onClick={handleCopyResetLink}
                              className="min-h-[28px] px-2.5 py-1 rounded-lg bg-[#141413] text-white text-[11px] font-medium hover:bg-stone-800 inline-flex items-center gap-1"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Salin</span>
                            </button>
                          </div>
                          <input
                            type="text"
                            readOnly
                            value={resetLinkResult.resetLink}
                            onFocus={(e) => e.currentTarget.select()}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white text-[11px] font-mono text-stone-700"
                          />
                        </div>
                      )}
                    </form>
                  )}

                  {inspectTab === 'plan' && (
                    <div className="space-y-4">
                      {/* Paket & Kuota Kreator */}
                      <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3">
                        <div className="flex items-center gap-2">
                          <Crown className="w-4 h-4 text-amber-700" />
                          <label className="text-xs font-semibold text-[#141413]">
                            Paket &amp; Masa Aktif Langganan
                          </label>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <select
                            value={planTierInput}
                            onChange={(e) =>
                              setPlanTierInput(e.target.value as PlanTier)
                            }
                            className="min-h-[38px] px-3 rounded-xl border border-stone-200 bg-white text-xs font-medium focus:outline-none focus:border-[#141413]"
                          >
                            <option value="free">
                              Paket Free (Maks {settings.freeLinkLimit} tautan)
                            </option>
                            <option value="pro">
                              Paket Pro (Tautan tak terbatas + Hapus Branding)
                            </option>
                          </select>
                          {planTierInput === 'pro' && (
                            <input
                              type="date"
                              value={planExpiresAtInput}
                              onChange={(e) =>
                                setPlanExpiresAtInput(e.target.value)
                              }
                              title="Kosongkan untuk Pro permanen"
                              className="min-h-[38px] px-3 rounded-xl border border-stone-200 bg-white text-xs focus:outline-none focus:border-[#141413]"
                            />
                          )}
                          <button
                            type="button"
                            disabled={inspectSaving}
                            onClick={handleSaveInspectPlan}
                            className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#141413] text-white text-xs font-medium hover:bg-stone-800 disabled:opacity-45 whitespace-nowrap"
                          >
                            Simpan Paket
                          </button>
                        </div>
                        {planTierInput === 'pro' && (
                          <p className="text-[11px] text-stone-500">
                            Kosongkan tanggal kedaluwarsa jika ingin memberikan paket Pro tanpa batas waktu.
                          </p>
                        )}
                      </div>

                      {/* Peringatan Khusus Akun */}
                      <div className="p-4 rounded-xl bg-red-50/60 border border-red-200 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                            <label className="text-xs font-semibold text-[#141413]">
                              Peringatan / Notifikasi Khusus ke Studio Pengguna
                            </label>
                          </div>
                          {inspectDetail.user.adminWarning && (
                            <button
                              type="button"
                              disabled={inspectSaving}
                              onClick={() => handleSaveInspectWarning(true)}
                              className="text-[11px] font-semibold text-red-700 hover:underline"
                            >
                              Hapus Peringatan
                            </button>
                          )}
                        </div>
                        <textarea
                          rows={2}
                          value={warningInput}
                          onChange={(e) => setWarningInput(e.target.value)}
                          placeholder="Tulis teguran atau pemberitahuan resmi yang hanya muncul di Studio milik kreator ini..."
                          className="w-full p-2.5 rounded-xl border border-stone-200 bg-white text-xs resize-none focus:outline-none focus:border-[#141413]"
                        />
                        <div className="flex justify-end">
                          <button
                            type="button"
                            disabled={inspectSaving || !warningInput.trim()}
                            onClick={() => handleSaveInspectWarning(false)}
                            className="min-h-[34px] px-3.5 py-1 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-45"
                          >
                            Kirim Peringatan
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {inspectTab === 'links' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">
                          Daftar Tautan &amp; Produk ({inspectDetail.links.length})
                        </h3>
                        <button
                          type="button"
                          onClick={() => setAdminAddLinkOpen((v) => !v)}
                          className="min-h-[34px] px-3 py-1 rounded-xl bg-[#141413] text-white text-xs font-medium hover:bg-stone-800 inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>
                            {adminAddLinkOpen ? 'Tutup Form' : 'Tambah Tautan'}
                          </span>
                        </button>
                      </div>

                      {adminAddLinkOpen && (
                        <form
                          onSubmit={handleAdminCreateLink}
                          className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2.5"
                        >
                          <p className="text-xs font-semibold text-[#141413]">
                            Tambah Tautan Langsung untuk @{inspectDetail.user.username}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] text-stone-600 mb-1">
                                Tipe Blok
                              </label>
                              <select
                                value={adminAddLinkForm.linkType}
                                onChange={(e) =>
                                  setAdminAddLinkForm((prev) => ({
                                    ...prev,
                                    linkType: e.target.value,
                                  }))
                                }
                                className="w-full min-h-[36px] px-2.5 rounded-xl border border-stone-200 bg-white text-xs"
                              >
                                {LINK_TYPE_OPTIONS.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] text-stone-600 mb-1">
                                Ikon
                              </label>
                              <select
                                value={adminAddLinkForm.icon}
                                onChange={(e) =>
                                  setAdminAddLinkForm((prev) => ({
                                    ...prev,
                                    icon: e.target.value,
                                  }))
                                }
                                className="w-full min-h-[36px] px-2.5 rounded-xl border border-stone-200 bg-white text-xs"
                              >
                                {LINK_ICON_OPTIONS.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] text-stone-600 mb-1">
                                Judul Tautan *
                              </label>
                              <input
                                type="text"
                                required
                                value={adminAddLinkForm.title}
                                onChange={(e) =>
                                  setAdminAddLinkForm((prev) => ({
                                    ...prev,
                                    title: e.target.value,
                                  }))
                                }
                                placeholder="Contoh: Katalog Shopee Resmi"
                                className="w-full min-h-[36px] px-3 rounded-xl border border-stone-200 bg-white text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-stone-600 mb-1">
                                URL Tujuan
                              </label>
                              <input
                                type="text"
                                value={adminAddLinkForm.url}
                                onChange={(e) =>
                                  setAdminAddLinkForm((prev) => ({
                                    ...prev,
                                    url: e.target.value,
                                  }))
                                }
                                placeholder="https://..."
                                className="w-full min-h-[36px] px-3 rounded-xl border border-stone-200 bg-white text-xs"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div>
                              <label className="block text-[11px] text-stone-600 mb-1">
                                Subjudul (Opsional)
                              </label>
                              <input
                                type="text"
                                value={adminAddLinkForm.subtitle}
                                onChange={(e) =>
                                  setAdminAddLinkForm((prev) => ({
                                    ...prev,
                                    subtitle: e.target.value,
                                  }))
                                }
                                className="w-full min-h-[36px] px-3 rounded-xl border border-stone-200 bg-white text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-stone-600 mb-1">
                                Harga Produk
                              </label>
                              <input
                                type="text"
                                value={adminAddLinkForm.priceText}
                                onChange={(e) =>
                                  setAdminAddLinkForm((prev) => ({
                                    ...prev,
                                    priceText: e.target.value,
                                  }))
                                }
                                placeholder="Rp 49.000"
                                className="w-full min-h-[36px] px-3 rounded-xl border border-stone-200 bg-white text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-stone-600 mb-1">
                                Badge
                              </label>
                              <input
                                type="text"
                                value={adminAddLinkForm.badgeText}
                                onChange={(e) =>
                                  setAdminAddLinkForm((prev) => ({
                                    ...prev,
                                    badgeText: e.target.value,
                                  }))
                                }
                                placeholder="Promo"
                                className="w-full min-h-[36px] px-3 rounded-xl border border-stone-200 bg-white text-xs"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end pt-1">
                            <button
                              type="submit"
                              disabled={inspectSaving}
                              className="min-h-[36px] px-4 py-1.5 rounded-xl bg-[#D97757] text-white text-xs font-semibold hover:bg-[#c56647] disabled:opacity-50"
                            >
                              {inspectSaving
                                ? 'Menyimpan...'
                                : 'Simpan Tautan Baru'}
                            </button>
                          </div>
                        </form>
                      )}

                      {inspectDetail.links.length === 0 ? (
                        <p className="text-xs text-stone-500 py-4">
                          Pengguna ini belum memiliki tautan.
                        </p>
                      ) : (
                        <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl px-4">
                          {inspectDetail.links.map((l) => {
                            const isEditingThis = adminEditLinkId === l.id;
                            return (
                              <div key={l.id} className="py-3 space-y-2.5">
                                <div
                                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                                    !l.isActive ? 'opacity-55' : ''
                                  }`}
                                >
                                  <div className="min-w-0 space-y-0.5">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <p className="text-xs font-semibold text-[#141413] truncate">
                                        {l.title}{' '}
                                        <span className="font-normal text-stone-400">
                                          ({l.linkType})
                                        </span>
                                      </p>
                                      {l.flaggedReason && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-50 border border-red-200 text-[10px] font-semibold text-red-700">
                                          <ShieldAlert className="w-3 h-3" />
                                          {l.flaggedReason}
                                        </span>
                                      )}
                                    </div>
                                    {l.url && (
                                      <a
                                        href={l.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[11px] text-[#D97757] hover:underline break-all block"
                                      >
                                        {l.url}
                                      </a>
                                    )}
                                    <p className="text-[11px] text-stone-500 tabular-nums">
                                      {l.clicks} klik ·{' '}
                                      {l.isActive
                                        ? 'Aktif'
                                        : 'Dinonaktifkan Admin'}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      disabled={inspectSaving}
                                      onClick={() =>
                                        isEditingThis
                                          ? setAdminEditLinkId(null)
                                          : startAdminEditLink(l)
                                      }
                                      className="min-h-[34px] px-2.5 py-1 rounded-lg border border-stone-200 bg-white text-xs font-medium hover:bg-stone-50 inline-flex items-center gap-1 whitespace-nowrap"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                      <span>
                                        {isEditingThis ? 'Tutup' : 'Edit'}
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={inspectSaving}
                                      onClick={() =>
                                        handleModerateLink(l.id, !l.isActive)
                                      }
                                      className="min-h-[34px] px-2.5 py-1 rounded-lg border border-stone-200 bg-white text-xs font-medium hover:bg-stone-50 inline-flex items-center gap-1 whitespace-nowrap"
                                    >
                                      {l.isActive ? (
                                        <>
                                          <EyeOff className="w-3.5 h-3.5" />
                                          <span>Nonaktifkan</span>
                                        </>
                                      ) : (
                                        <>
                                          <Eye className="w-3.5 h-3.5" />
                                          <span>Aktifkan</span>
                                        </>
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={inspectSaving}
                                      onClick={() => handleDeleteUserLink(l.id)}
                                      className="min-h-[34px] px-2.5 py-1 rounded-lg border border-red-200 bg-white text-xs font-medium text-red-700 hover:bg-red-50 inline-flex items-center gap-1"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>Hapus</span>
                                    </button>
                                  </div>
                                </div>

                                {isEditingThis && (
                                  <form
                                    onSubmit={handleAdminUpdateLink}
                                    className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2"
                                  >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      <input
                                        type="text"
                                        required
                                        value={adminEditLinkForm.title}
                                        onChange={(e) =>
                                          setAdminEditLinkForm((prev) => ({
                                            ...prev,
                                            title: e.target.value,
                                          }))
                                        }
                                        placeholder="Judul tautan"
                                        className="min-h-[34px] px-2.5 rounded-lg border border-stone-200 bg-white text-xs"
                                      />
                                      <input
                                        type="text"
                                        value={adminEditLinkForm.url}
                                        onChange={(e) =>
                                          setAdminEditLinkForm((prev) => ({
                                            ...prev,
                                            url: e.target.value,
                                          }))
                                        }
                                        placeholder="URL tujuan"
                                        className="min-h-[34px] px-2.5 rounded-lg border border-stone-200 bg-white text-xs"
                                      />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                      <input
                                        type="text"
                                        value={adminEditLinkForm.subtitle}
                                        onChange={(e) =>
                                          setAdminEditLinkForm((prev) => ({
                                            ...prev,
                                            subtitle: e.target.value,
                                          }))
                                        }
                                        placeholder="Subjudul"
                                        className="min-h-[34px] px-2.5 rounded-lg border border-stone-200 bg-white text-xs"
                                      />
                                      <input
                                        type="text"
                                        value={adminEditLinkForm.priceText}
                                        onChange={(e) =>
                                          setAdminEditLinkForm((prev) => ({
                                            ...prev,
                                            priceText: e.target.value,
                                          }))
                                        }
                                        placeholder="Harga (opsional)"
                                        className="min-h-[34px] px-2.5 rounded-lg border border-stone-200 bg-white text-xs"
                                      />
                                      <input
                                        type="text"
                                        value={adminEditLinkForm.badgeText}
                                        onChange={(e) =>
                                          setAdminEditLinkForm((prev) => ({
                                            ...prev,
                                            badgeText: e.target.value,
                                          }))
                                        }
                                        placeholder="Badge (opsional)"
                                        className="min-h-[34px] px-2.5 rounded-lg border border-stone-200 bg-white text-xs"
                                      />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setAdminEditLinkId(null)}
                                        className="min-h-[32px] px-3 rounded-lg border border-stone-200 bg-white text-xs text-stone-600"
                                      >
                                        Batal
                                      </button>
                                      <button
                                        type="submit"
                                        disabled={inspectSaving}
                                        className="min-h-[32px] px-3.5 rounded-lg bg-[#141413] text-white text-xs font-semibold hover:bg-stone-800 disabled:opacity-50"
                                      >
                                        Simpan
                                      </button>
                                    </div>
                                  </form>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tambah Akun User Baru Modal */}
      <AnimatePresence>
        {createUserOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="w-full max-w-xl max-h-[88vh] overflow-y-auto bg-white rounded-2xl border border-stone-200 p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#D97757]/10 text-[#D97757] flex items-center justify-center shrink-0">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold">
                      Tambah Akun User Baru
                    </h2>
                    <p className="text-xs text-stone-500">
                      Buat profil pengguna baru langsung dari panel Super Admin.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateUserOpen(false)}
                  className="p-2 rounded-lg hover:bg-stone-100 text-stone-500"
                  aria-label="Tutup form tambah user"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Nama Tampilan *
                    </label>
                    <input
                      type="text"
                      required
                      value={createUserForm.displayName}
                      onChange={(e) =>
                        setCreateUserForm((prev) => ({
                          ...prev,
                          displayName: e.target.value,
                        }))
                      }
                      placeholder="Contoh: Kopi Nusantara"
                      className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#141413]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Username / Handle *
                    </label>
                    <input
                      type="text"
                      required
                      value={createUserForm.username}
                      onChange={(e) =>
                        setCreateUserForm((prev) => ({
                          ...prev,
                          username: e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9_-]/g, ''),
                        }))
                      }
                      placeholder="kopinusantara"
                      className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 text-xs font-mono focus:outline-none focus:border-[#141413]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={createUserForm.email}
                      onChange={(e) =>
                        setCreateUserForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      placeholder="kreator@domain.com"
                      className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#141413]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Password Awal (Opsional)
                    </label>
                    <input
                      type="password"
                      minLength={6}
                      value={createUserForm.password}
                      onChange={(e) =>
                        setCreateUserForm((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      placeholder="Min. 6 karakter / kosongkan"
                      className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#141413]"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-stone-500 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2">
                  Kosongkan password untuk membuat profil pra-registrasi (otomatis terhubung saat user login Google atau mendaftar dengan email tersebut). Isi password bila server terhubung dengan Firebase Admin Service Account.
                </p>

                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    Bio Singkat
                  </label>
                  <textarea
                    rows={2}
                    value={createUserForm.bio}
                    onChange={(e) =>
                      setCreateUserForm((prev) => ({
                        ...prev,
                        bio: e.target.value,
                      }))
                    }
                    placeholder="Deskripsi singkat profil kreator/UMKM..."
                    className="w-full p-2.5 rounded-xl border border-stone-200 text-xs resize-none focus:outline-none focus:border-[#141413]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Peran Akun
                    </label>
                    <select
                      value={createUserForm.role}
                      onChange={(e) =>
                        setCreateUserForm((prev) => ({
                          ...prev,
                          role: e.target.value === 'admin' ? 'admin' : 'user',
                        }))
                      }
                      className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 bg-white text-xs focus:outline-none focus:border-[#141413]"
                    >
                      <option value="user">User (Kreator)</option>
                      <option value="admin">Super Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Paket Awal
                    </label>
                    <select
                      value={createUserForm.planTier}
                      onChange={(e) =>
                        setCreateUserForm((prev) => ({
                          ...prev,
                          planTier: e.target.value === 'pro' ? 'pro' : 'free',
                        }))
                      }
                      className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200 bg-white text-xs focus:outline-none focus:border-[#141413]"
                    >
                      <option value="free">Paket Free</option>
                      <option value="pro">Paket Pro</option>
                    </select>
                  </div>
                </div>

                {createUserForm.planTier === 'pro' && (
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">
                      Masa Aktif Pro (Opsional)
                    </label>
                    <input
                      type="date"
                      value={createUserForm.planExpiresAt}
                      onChange={(e) =>
                        setCreateUserForm((prev) => ({
                          ...prev,
                          planExpiresAt: e.target.value,
                        }))
                      }
                      className="w-full sm:w-56 min-h-[38px] px-3 rounded-xl border border-stone-200 text-xs focus:outline-none focus:border-[#141413]"
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="inline-flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createUserForm.isVerified}
                      onChange={(e) =>
                        setCreateUserForm((prev) => ({
                          ...prev,
                          isVerified: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 rounded border-stone-300 accent-[#141413]"
                    />
                    <span>Beri Centang Verifikasi</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createUserForm.isFeatured}
                      onChange={(e) =>
                        setCreateUserForm((prev) => ({
                          ...prev,
                          isFeatured: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 rounded border-stone-300 accent-[#141413]"
                    />
                    <span>Tampilkan di Pratinjau Beranda</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setCreateUserOpen(false)}
                    className="min-h-[40px] px-4 py-2 rounded-xl border border-stone-200 text-xs font-medium text-stone-600 hover:bg-stone-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={createUserBusy}
                    className="min-h-[40px] px-5 py-2 rounded-xl bg-[#141413] text-white text-xs font-semibold hover:bg-stone-800 disabled:opacity-50"
                  >
                    {createUserBusy ? 'Menyimpan...' : 'Buat Akun User'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
