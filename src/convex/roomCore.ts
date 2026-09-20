/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🏛️ v10.0 — نواة الغرف الخاصة (منطق نقي بلا اعتماديات)
 *
 * هذا الملف هو **العقد الواحد** بين: خادم الغرف، وواجهة اللاعب، ولوحة المالك،
 * والاختبارات. لا يستورد قاعدة بيانات ولا Convex — فيمكن اختباره وحده
 * واستخدامه في الواجهة والخادم معاً بلا تباعد بين نسختين.
 *
 * يحكم: أنواع الغرف · الأدوار · الصلاحيات · حدود العضوية · الدعوات ·
 *        الانضمام · الغرف المؤقتة · الوضع البطيء · الترتيب · صحة الغرفة.
 * ═══════════════════════════════════════════════════════════════════════
 */

// ───────────────────────────────────────────────────────────────────────
// ① الرتب داخل الغرفة
// ───────────────────────────────────────────────────────────────────────
export type RoomRole = "owner" | "admin" | "moderator" | "member" | "restricted";

export interface RoomRoleSpec {
  id: RoomRole;
  label: string;
  emoji: string;
  rank: number;
  note: string;
}

export const ROOM_ROLES: readonly RoomRoleSpec[] = [
  { id: "owner", label: "مالك الغرفة", emoji: "👑", rank: 50, note: "كل الصلاحيات — ولا يُقيَّد ولا يُطرد" },
  { id: "admin", label: "مشرف عام", emoji: "🛡️", rank: 40, note: "إدارة الأعضاء والإعدادات والدعوات" },
  { id: "moderator", label: "عريف", emoji: "⚖️", rank: 30, note: "تنظيم النقاش: تثبيت، تحذير، كتم" },
  { id: "member", label: "عضو", emoji: "👤", rank: 20, note: "يشارك وفق صلاحيات العضو الممنوحة" },
  { id: "restricted", label: "مقيَّد", emoji: "🔇", rank: 10, note: "داخل الغرفة لكن بلا حق الكتابة أو الدعوة" },
] as const;

export const ROOM_ROLE_RANK: Record<RoomRole, number> = {
  owner: 50,
  admin: 40,
  moderator: 30,
  member: 20,
  restricted: 10,
};

export function roleLabel(role: RoomRole): string {
  return ROOM_ROLES.find((r) => r.id === role)?.label ?? role;
}

// ───────────────────────────────────────────────────────────────────────
// ② الصلاحيات الدقيقة (قابلة للتخصيص لكل دور داخل كل غرفة)
// ───────────────────────────────────────────────────────────────────────
export type RoomPermission =
  | "speak"
  | "invite"
  | "pin"
  | "deleteMessages"
  | "manageRoles"
  | "manageSettings"
  | "mute"
  | "kick"
  | "topics"
  | "polls"
  | "challenges"
  | "announce"
  | "viewAudit";

export const ROOM_PERMISSIONS: readonly { id: RoomPermission; label: string; note: string }[] = [
  { id: "speak", label: "الكتابة", note: "إرسال رسائل في الغرفة" },
  { id: "invite", label: "الدعوة", note: "إنشاء روابط دعوة وإضافة أعضاء" },
  { id: "pin", label: "التثبيت", note: "تثبيت الرسائل المهمة" },
  { id: "deleteMessages", label: "حذف الرسائل", note: "حذف رسائل الأعضاء" },
  { id: "manageRoles", label: "إدارة الأدوار", note: "ترقية وتنزيل وتقييد الأعضاء" },
  { id: "manageSettings", label: "إدارة الإعدادات", note: "الاسم والوصف والقواعد والحدود" },
  { id: "mute", label: "الكتم", note: "كتم عضو مؤقتاً" },
  { id: "kick", label: "الطرد", note: "إخراج عضو من الغرفة" },
  { id: "topics", label: "المواضيع", note: "إنشاء مواضيع وإغلاقها" },
  { id: "polls", label: "الاستطلاعات", note: "إنشاء تصويتات داخل الغرفة" },
  { id: "challenges", label: "التحديات", note: "إطلاق تحدٍّ ذهني بمكافأة" },
  { id: "announce", label: "الإعلانات", note: "رسالة نظام مثبتة لكل الأعضاء" },
  { id: "viewAudit", label: "سجل الإجراءات", note: "قراءة سجل الغرفة الكامل" },
] as const;

export type RolePermMap = Partial<Record<RoomRole, RoomPermission[]>>;

/** الصلاحيات الافتراضية: عادلة ومقيّدة — المالك يستطيع توسيعها من اللوحة */
export const DEFAULT_ROLE_PERMS: Record<RoomRole, RoomPermission[]> = {
  owner: ROOM_PERMISSIONS.map((p) => p.id),
  admin: [
    "speak", "invite", "pin", "deleteMessages", "manageRoles",
    "manageSettings", "mute", "kick", "topics", "polls", "challenges",
    "announce", "viewAudit",
  ],
  moderator: ["speak", "pin", "deleteMessages", "mute", "topics", "polls", "announce"],
  member: ["speak", "polls"],
  restricted: [],
};

/** يدمج صلاحيات الدور: الافتراضي + تخصيص مالك الغرفة، مع فقدان آمن للمدخلات الفاسدة */
export function resolvePermissions(
  role: RoomRole,
  overrides: unknown,
): RoomPermission[] {
  const base = new Set<RoomPermission>(DEFAULT_ROLE_PERMS[role]);
  if (!overrides || typeof overrides !== "object") return [...base];
  const roleMap = (overrides as Record<string, unknown>)[role];
  if (!roleMap || typeof roleMap !== "object") return [...base];
  const valid = new Set<RoomPermission>(ROOM_PERMISSIONS.map((p) => p.id));
  for (const [perm, on] of Object.entries(roleMap as Record<string, unknown>)) {
    if (!valid.has(perm as RoomPermission)) continue;
    if (on === true) base.add(perm as RoomPermission);
    else if (on === false) base.delete(perm as RoomPermission);
  }
  // المالك لا يُسلب صلاحياته أبداً — قاعدة صلبة تمنع قفل الغرفة على نفسها
  if (role === "owner") return ROOM_PERMISSIONS.map((p) => p.id);
  return [...base];
}

// ───────────────────────────────────────────────────────────────────────
// ③ أنواع الغرف
// ───────────────────────────────────────────────────────────────────────
export type RoomKindId =
  | "open"
  | "private"
  | "group"
  | "membership"
  | "clan"
  | "event"
  | "temporary"
  | "duel";

export type RoomVisibility = "open" | "invite" | "membership" | "clan" | "event";

export interface RoomKindSpec {
  id: RoomKindId;
  label: string;
  emoji: string;
  desc: string;
  visibility: RoomVisibility;
  minTierRank: number;
  memberLimit: number; // 0 = بلا حد
  permanent: boolean;
  allowTopics: boolean;
  allowPolls: boolean;
  allowInvites: boolean;
  allowChallenges: boolean;
  canShowcase: boolean; // يجوز عرضها في الملتقى
  tone: string;
}

export const ROOM_KINDS: readonly RoomKindSpec[] = [
  {
    id: "open", label: "مفتوحة", emoji: "🌍",
    desc: "متاحة للجميع، يدخلها أي لاعب بلا دعوة",
    visibility: "open", minTierRank: 0, memberLimit: 0, permanent: true,
    allowTopics: true, allowPolls: true, allowInvites: false, allowChallenges: true,
    canShowcase: true, tone: "emerald",
  },
  {
    id: "private", label: "خاصة", emoji: "🔒",
    desc: "لا يدخلها إلا من يملك رابط دعوة صالح",
    visibility: "invite", minTierRank: 0, memberLimit: 60, permanent: true,
    allowTopics: true, allowPolls: true, allowInvites: true, allowChallenges: true,
    canShowcase: false, tone: "slate",
  },
  {
    id: "group", label: "جماعية محدودة", emoji: "👥",
    desc: "عدد أعضاء محدود بدقة — للأصدقاء والفرق الصغيرة",
    visibility: "invite", minTierRank: 0, memberLimit: 20, permanent: true,
    allowTopics: true, allowPolls: true, allowInvites: true, allowChallenges: true,
    canShowcase: false, tone: "sky",
  },
  {
    id: "membership", label: "حسب العضوية", emoji: "💎",
    desc: "دخولها مشروط برتبة عضوية محددة يختارها المنشئ",
    visibility: "membership", minTierRank: 1, memberLimit: 200, permanent: true,
    allowTopics: true, allowPolls: true, allowInvites: true, allowChallenges: true,
    canShowcase: true, tone: "violet",
  },
  {
    id: "clan", label: "غرفة عشيرة", emoji: "🛡️",
    desc: "مرتبطة بعشيرة فكرية — تُدار من قائدها وتُعرض ككيان العشيرة",
    visibility: "clan", minTierRank: 0, memberLimit: 120, permanent: true,
    allowTopics: true, allowPolls: true, allowInvites: true, allowChallenges: true,
    canShowcase: true, tone: "amber",
  },
  {
    id: "event", label: "غرفة حدث/مواجهة", emoji: "🏟️",
    desc: "تُفتح لحدث أو مواجهة ذهنية محددة بجدول زمني",
    visibility: "event", minTierRank: 0, memberLimit: 300, permanent: false,
    allowTopics: false, allowPolls: true, allowInvites: true, allowChallenges: true,
    canShowcase: true, tone: "rose",
  },
  {
    id: "temporary", label: "مؤقتة", emoji: "⏳",
    desc: "تُغلق تلقائياً بعد انتهاء مدتها ثم تُؤرشف",
    visibility: "invite", minTierRank: 0, memberLimit: 40, permanent: false,
    allowTopics: true, allowPolls: true, allowInvites: true, allowChallenges: true,
    canShowcase: false, tone: "teal",
  },
  {
    id: "duel", label: "مواجهة ثنائية", emoji: "⚔️",
    desc: "غرفة تحدي مباشر بين عقلين — للجمهور رؤية واللاعبان يتنافسان",
    visibility: "invite", minTierRank: 0, memberLimit: 12, permanent: false,
    allowTopics: false, allowPolls: false, allowInvites: true, allowChallenges: true,
    canShowcase: true, tone: "rose",
  },
] as const;

export function roomKind(id: string | undefined | null): RoomKindSpec {
  return ROOM_KINDS.find((k) => k.id === id) ?? ROOM_KINDS[1];
}

// ───────────────────────────────────────────────────────────────────────
// ④ رتب العضوية ↔ حدود الغرف (مطابق لامتيازات العضوية الحقيقية)
// ───────────────────────────────────────────────────────────────────────
export const TIER_ORDER = ["bronze", "silver", "gold", "platinum", "diamond", "legend"] as const;
export type TierId = (typeof TIER_ORDER)[number];

const TIER_LABEL: Record<string, string> = {
  bronze: "برونزي 🥉",
  silver: "فضي 🥈",
  gold: "ذهبي 🥇",
  platinum: "بلاتيني 💠",
  diamond: "ماسي 💎",
  legend: "أسطوري 🌟",
};

export function tierRank(tier: string | undefined | null): number {
  const idx = TIER_ORDER.indexOf((tier ?? "bronze") as TierId);
  return idx < 0 ? 0 : idx;
}

export function tierLabel(tier: string): string {
  return TIER_LABEL[tier] ?? tier;
}

export interface TierRoomQuota {
  maxRooms: number; // -1 = بلا حد
  memberLimit: number;
  canUseKinds: RoomKindId[];
}

/** حدود الغرف لكل رتبة عضوية — مشتقة من امتياز privateRooms الحقيقي */
export function tierRoomQuota(tier: string): TierRoomQuota {
  const rank = tierRank(tier);
  const quotas: TierRoomQuota[] = [
    // برونزي: غرفة مفتوحة واحدة (كما ينصّ امتياز public_only)
    { maxRooms: 1, memberLimit: 20, canUseKinds: ["open"] },
    // فضي: غرفة خاصة واحدة (privateRooms = 1)
    { maxRooms: 2, memberLimit: 40, canUseKinds: ["open", "private", "group", "temporary"] },
    // ذهبي: ٣ غرف خاصة
    { maxRooms: 4, memberLimit: 80, canUseKinds: ["open", "private", "group", "temporary", "membership", "duel"] },
    // بلاتيني: ٥ غرف خاصة + غرف العشائر والأحداث
    { maxRooms: 6, memberLimit: 150, canUseKinds: ["open", "private", "group", "temporary", "membership", "duel", "clan", "event"] },
    // ماسي وأسطوري: بلا حد
    { maxRooms: -1, memberLimit: 300, canUseKinds: ["open", "private", "group", "temporary", "membership", "duel", "clan", "event"] },
    { maxRooms: -1, memberLimit: 500, canUseKinds: ["open", "private", "group", "temporary", "membership", "duel", "clan", "event"] },
  ];
  return quotas[Math.min(rank, quotas.length - 1)];
}

export function canCreateKind(kindId: RoomKindId, tier: string): boolean {
  return tierRoomQuota(tier).canUseKinds.includes(kindId);
}

/** الحد الفعلي للأعضاء: نوع الغرفة + رتبة العضوية + حد المنشئ (الأدنى يفوز) */
export function effectiveMemberLimit(
  kindId: string,
  tier: string,
  requested: number,
): number {
  const kind = roomKind(kindId);
  const quota = tierRoomQuota(tier);
  const caps = [kind.memberLimit, quota.memberLimit, requested].filter((n) => n > 0);
  return caps.length === 0 ? 0 : Math.min(...caps);
}

// ───────────────────────────────────────────────────────────────────────
// ⑤ الأدوار الفعلية والصلاحيات
// ───────────────────────────────────────────────────────────────────────
export interface RoomProfileLike {
  kind?: string | null;
  visibility?: string | null;
  memberLimit?: number | null;
  requiresTier?: string | null;
  expiresAt?: number | null;
  permanent?: boolean | null;
  slowModeSec?: number | null;
  moderationState?: string | null;
  memberRoles?: unknown;
  rolePerms?: unknown;
  featured?: boolean | null;
  challengeReward?: number | null;
  clanId?: string | null;
  eventId?: string | null;
  rules?: string | null;
  welcomeMessage?: string | null;
}

/** الدور الفعلي للمستخدم داخل الغرفة (يقرأ الأدوار المخصصة ويسقط للافتراضي) */
export function resolveRole(
  profile: RoomProfileLike | null,
  roomOwnerId: string,
  admins: readonly string[],
  userId: string | null,
): RoomRole | null {
  if (!userId) return null;
  if (userId === roomOwnerId) return "owner";
  const roles = readMemberRoles(profile?.memberRoles);
  const explicit = roles[userId];
  if (explicit && isRole(explicit)) return explicit;
  if (admins.includes(userId)) return "admin";
  return "member";
}

export function readMemberRoles(raw: unknown): Record<string, RoomRole> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, RoomRole> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && isRole(v)) out[k] = v;
  }
  return out;
}

export function isRole(value: string): value is RoomRole {
  return value === "owner" || value === "admin" || value === "moderator" ||
    value === "member" || value === "restricted";
}

export function permissionsFor(
  profile: RoomProfileLike | null,
  role: RoomRole,
): RoomPermission[] {
  return resolvePermissions(role, profile?.rolePerms);
}

export function hasPermission(
  profile: RoomProfileLike | null,
  role: RoomRole | null,
  perm: RoomPermission,
): boolean {
  if (!role) return false;
  return permissionsFor(profile, role).includes(perm);
}

// ───────────────────────────────────────────────────────────────────────
// ⑥ حالة الغرفة (مؤقتة/مقفلة/مراقبة) وصلاحيتها للدخول
// ───────────────────────────────────────────────────────────────────────
export interface RoomStateInfo {
  expired: boolean;
  locked: boolean;
  watch: boolean;
  closed: boolean;
  joinable: boolean;
  reason: string;
  endsInMs: number;
}

export function roomState(profile: RoomProfileLike | null, now: number): RoomStateInfo {
  const state = profile?.moderationState ?? "normal";
  const expiresAt = profile?.expiresAt ?? 0;
  const expired = expiresAt > 0 && expiresAt <= now;
  const locked = state === "locked";
  const watch = state === "watch";
  const closed = state === "closed" || expired;
  const reason = expired
    ? "انتهت مدة الغرفة المؤقتة"
    : state === "closed"
      ? "أُغلقت الغرفة بقرار الإدارة"
      : state === "locked"
        ? "الغرفة مقفلة مؤقتاً — قراءة فقط"
        : state === "watch"
          ? "الغرفة تحت مراقبة الإدارة"
          : "";
  return {
    expired,
    locked,
    watch,
    closed,
    joinable: !closed && !locked,
    reason,
    endsInMs: expiresAt > 0 ? Math.max(0, expiresAt - now) : 0,
  };
}

export interface JoinCheckInput {
  profile: RoomProfileLike | null;
  roomOwnerId: string;
  members: readonly string[];
  memberCount: number;
  userId: string | null;
  tier: string;
  now: number;
  isOwner: boolean;
}

/** قرار حقيقي بمن يدخل الغرفة — بلا استثناءات غامضة */
export function canJoin(input: JoinCheckInput): { ok: boolean; reason: string } {
  if (!input.userId) return { ok: false, reason: "يجب تسجيل الدخول أولاً" };
  if (input.members.includes(input.userId)) return { ok: true, reason: "عضو بالفعل" };
  const state = roomState(input.profile, input.now);
  if (state.expired) return { ok: false, reason: "انتهت مدة هذه الغرفة" };
  if (state.closed) return { ok: false, reason: state.reason || "الغرفة مغلقة" };
  const kind = roomKind(input.profile?.kind);
  if (kind.visibility === "clan" && !input.isOwner) {
    return { ok: false, reason: "هذه غرفة عشيرة — الدخول لأعضائها عبر قائد العشيرة" };
  }
  const required = input.profile?.requiresTier ?? "bronze";
  if (tierRank(input.tier) < Math.max(tierRank(required), kind.minTierRank)) {
    return { ok: false, reason: `تحتاج عضوية ${tierLabel(required)} على الأقل` };
  }
  // المالك لا يُحجب بالحدود أبداً
  if (!input.isOwner && input.profile?.memberLimit && input.profile.memberLimit > 0) {
    if (input.memberCount >= input.profile.memberLimit) {
      return { ok: false, reason: "الغرفة وصلت حدّها الأقصى من الأعضاء" };
    }
  }
  return { ok: true, reason: "مسموح" };
}

// ───────────────────────────────────────────────────────────────────────
// ⑦ الدعوات
// ───────────────────────────────────────────────────────────────────────
export interface InviteLike {
  code: string;
  maxUses: number;
  uses: number;
  expiresAt: number;
  revoked: boolean;
}

export function validateInvite(
  invite: InviteLike | null | undefined,
  now: number,
): { ok: boolean; reason: string } {
  if (!invite) return { ok: false, reason: "رابط الدعوة غير صحيح" };
  if (invite.revoked) return { ok: false, reason: "أُلغيت هذه الدعوة" };
  if (invite.expiresAt > 0 && invite.expiresAt <= now) return { ok: false, reason: "انتهت صلاحية الدعوة" };
  if (invite.maxUses > 0 && invite.uses >= invite.maxUses) return { ok: false, reason: "استُهلكت كل استخدامات الدعوة" };
  return { ok: true, reason: "صالحة" };
}

export function inviteCodesEqual(a: string, b: string): boolean {
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

export function generateInviteCode(seed: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  let x = Math.abs(Math.floor(seed)) % 2147483647 || 12345;
  for (let i = 0; i < 8; i++) {
    x = (x * 48271) % 2147483647;
    out += alphabet[x % alphabet.length];
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────
// ⑧ الوضع البطيء + تنقية المدخلات
// ───────────────────────────────────────────────────────────────────────
export function slowModeRemaining(
  profile: RoomProfileLike | null,
  lastMessageAt: number,
  now: number,
): number {
  const slow = profile?.slowModeSec ?? 0;
  if (slow <= 0) return 0;
  const wait = slow * 1000 - (now - lastMessageAt);
  return wait > 0 ? Math.ceil(wait / 1000) : 0;
}

export function cleanText(raw: string, max: number): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, max);
}

export function normalizeTags(raw: readonly string[] | undefined): string[] {
  const out: string[] = [];
  for (const t of raw ?? []) {
    const tag = cleanText(String(t).replace(/^#/, ""), 18);
    if (tag.length < 2) continue;
    if (!out.includes(tag)) out.push(tag);
    if (out.length >= 6) break;
  }
  return out;
}

export function validateRoomName(name: string): { ok: boolean; reason: string } {
  const clean = cleanText(name, 40);
  if (clean.length < 3) return { ok: false, reason: "اسم الغرفة قصير جداً (٣ أحرف على الأقل)" };
  if (clean.length > 40) return { ok: false, reason: "اسم الغرفة طويل جداً" };
  return { ok: true, reason: clean };
}

// ───────────────────────────────────────────────────────────────────────
// ⑨ الترتيب والفلترة (يستخدمها اللاعب والمالك)
// ───────────────────────────────────────────────────────────────────────
export type RoomSortMode = "active" | "newest" | "largest" | "quietest";
export type RoomFilterMode = "all" | "mine" | "joined" | "open" | "featured" | "expiring" | "watched";

export interface RoomView {
  _id: string;
  name: string;
  kind: string;
  visibility: string;
  memberCount: number;
  messageCount: number;
  lastActivityAt: number;
  createdAt: number;
  expiresAt: number;
  featured: boolean;
  moderationState: string;
  isMember: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  myRole: RoomRole | null;
  tags: string[];
  ownerName?: string;
  avatar?: string;
  tone?: string;
}

export function sortRooms<T extends { lastActivityAt: number; createdAt: number; memberCount: number; messageCount: number }>(
  rooms: T[],
  mode: RoomSortMode,
): T[] {
  const copy = [...rooms];
  switch (mode) {
    case "newest":
      return copy.sort((a, b) => b.createdAt - a.createdAt);
    case "largest":
      return copy.sort((a, b) => b.memberCount - a.memberCount);
    case "quietest":
      return copy.sort((a, b) => a.lastActivityAt - b.lastActivityAt);
    case "active":
    default:
      return copy.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  }
}

export function filterRooms(
  rooms: RoomView[],
  filter: RoomFilterMode,
  query: string,
  now: number,
): RoomView[] {
  const q = query.trim();
  return rooms.filter((r) => {
    switch (filter) {
      case "mine":
        if (!r.isOwner) return false;
        break;
      case "joined":
        if (!r.isMember) return false;
        break;
      case "open":
        if (r.visibility !== "open") return false;
        break;
      case "featured":
        if (!r.featured) return false;
        break;
      case "expiring":
        if (!(r.expiresAt > 0) || r.expiresAt - now > 24 * 60 * 60 * 1000) return false;
        break;
      case "watched":
        if (r.moderationState !== "watch" && r.moderationState !== "locked") return false;
        break;
      case "all":
      default:
        break;
    }
    if (q.length > 0) {
      const haystack = `${r.name} ${r.tags.join(" ")} ${r.ownerName ?? ""} ${r.kind}`.toLowerCase();
      if (!haystack.includes(q.toLowerCase())) return false;
    }
    return true;
  });
}

// ───────────────────────────────────────────────────────────────────────
// ⑩ صحة الغرفة (لمراقبة المالك) + ملخص السجل
// ───────────────────────────────────────────────────────────────────────
export interface RoomHealthInput {
  profile: RoomProfileLike | null;
  memberCount: number;
  messages24h: number;
  reportsOpen: number;
  flagged24h: number;
}

export interface RoomHealth {
  score: number;
  verdict: string;
  tone: "emerald" | "amber" | "rose";
  reasons: string[];
}

export function roomHealth(input: RoomHealthInput, now: number): RoomHealth {
  let score = 70;
  const reasons: string[] = [];
  const state = roomState(input.profile, now);

  if (input.messages24h >= 40) {
    score += 20;
    reasons.push("نشاط مرتفع خلال ٢٤ ساعة");
  } else if (input.messages24h >= 8) {
    score += 10;
    reasons.push("نشاط صحي خلال ٢٤ ساعة");
  } else if (input.messages24h === 0) {
    score -= 20;
    reasons.push("لا نشاط خلال ٢٤ ساعة");
  }

  if (input.memberCount >= 12) score += 5;
  else if (input.memberCount <= 2) {
    score -= 10;
    reasons.push("عدد الأعضاء صغير جداً");
  }

  if (input.reportsOpen > 0) {
    score -= Math.min(30, input.reportsOpen * 8);
    reasons.push(`${input.reportsOpen} بلاغ مفتوح`);
  }
  if (input.flagged24h > 0) {
    score -= Math.min(20, input.flagged24h * 4);
    reasons.push(`${input.flagged24h} رسالة مخالفة خلال ٢٤ ساعة`);
  }
  if (state.expired) {
    score -= 15;
    reasons.push("مدة الغرفة منتهية وتنتظر الأرشفة");
  }
  if (state.watch) reasons.push("تحت مراقبة الإدارة");
  if (state.locked) {
    score -= 10;
    reasons.push("مقفلة بقرار الإدارة");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const tone: RoomHealth["tone"] = score >= 75 ? "emerald" : score >= 50 ? "amber" : "rose";
  const verdict = score >= 85 ? "ممتازة" : score >= 75 ? "جيدة" : score >= 50 ? "تحتاج انتباهاً" : "تحتاج تدخلاً";
  return { score, verdict, tone, reasons };
}

export function summarizeRoomAudit(
  rows: readonly { action: string }[],
): { total: number; top: { action: string; count: number }[] } {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.action, (counts.get(r.action) ?? 0) + 1);
  const top = [...counts.entries()]
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  return { total: rows.length, top };
}

export const ROOM_ACTION_LABEL: Record<string, string> = {
  room_created: "إنشاء الغرفة",
  room_updated: "تعديل الإعدادات",
  room_archived: "أرشفة الغرفة",
  ownership_transferred: "نقل الملكية",
  role_changed: "تغيير دور عضو",
  member_joined: "انضمام عضو",
  member_left: "مغادرة عضو",
  member_kicked: "طرد عضو",
  member_muted: "كتم عضو",
  member_restricted: "تقييد عضو",
  invite_created: "إنشاء دعوة",
  invite_revoked: "إلغاء دعوة",
  topic_created: "إنشاء موضوع",
  topic_closed: "إغلاق موضوع",
  topic_pinned: "تثبيت موضوع",
  message_pinned: "تثبيت رسالة",
  message_unpinned: "إلغاء تثبيت",
  rules_updated: "تحديث القوانين",
  welcome_updated: "تحديث رسالة الترحيب",
  slow_mode_set: "ضبط الوضع البطيء",
  room_reported: "بلاغ ضد الغرفة",
  owner_state_changed: "قرار الإدارة على الغرفة",
  owner_limit_changed: "تعديل حد الأعضاء",
  owner_deleted: "حذف الغرفة",
  challenge_started: "إطلاق تحدٍّ في الغرفة",
};

export function actionLabel(action: string): string {
  return ROOM_ACTION_LABEL[action] ?? action;
}
