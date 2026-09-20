import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROLE_PERMS,
  ROOM_KINDS,
  canCreateKind,
  canJoin,
  effectiveMemberLimit,
  filterRooms,
  generateInviteCode,
  hasPermission,
  normalizeTags,
  permissionsFor,
  resolvePermissions,
  resolveRole,
  roomHealth,
  roomKind,
  roomState,
  slowModeRemaining,
  sortRooms,
  summarizeRoomAudit,
  tierRank,
  tierRoomQuota,
  validateInvite,
  validateRoomName,
  type RoomView,
} from "../convex/roomCore";

const now = Date.now();
const HOUR = 60 * 60 * 1000;

function view(over: Partial<RoomView>): RoomView {
  return {
    _id: "r1",
    name: "غرفة",
    kind: "private",
    visibility: "invite",
    memberCount: 3,
    messageCount: 10,
    lastActivityAt: now,
    createdAt: now,
    expiresAt: 0,
    featured: false,
    moderationState: "normal",
    isMember: true,
    isOwner: false,
    isAdmin: false,
    myRole: "member",
    tags: [],
    ownerName: "مالك",
    ...over,
  };
}

describe("الأدوار والصلاحيات", () => {
  it("المالك يملك كل الصلاحيات، والمقيَّد لا يملك شيئاً", () => {
    expect(DEFAULT_ROLE_PERMS.owner.length).toBeGreaterThan(10);
    expect(DEFAULT_ROLE_PERMS.restricted).toHaveLength(0);
    expect(DEFAULT_ROLE_PERMS.member).not.toContain("deleteMessages");
    expect(DEFAULT_ROLE_PERMS.moderator).toContain("mute");
  });

  it("تخصيص مالك الغرفة يضيف ويسلب صلاحيات الدور فعلياً", () => {
    const overrides = { member: { speak: false, polls: false, invite: true } };
    const perms = resolvePermissions("member", overrides);
    expect(perms).not.toContain("speak");
    expect(perms).not.toContain("polls");
    expect(perms).toContain("invite");
  });

  it("المالك لا تُسلب صلاحياته أبداً حتى لو حاول التخصيص", () => {
    const perms = resolvePermissions("owner", { owner: { kick: false, speak: false } });
    expect(perms).toContain("speak");
    expect(perms).toContain("kick");
    expect(perms).toContain("manageSettings");
  });

  it("المدخلات الفاسدة تُتجاهل بأمان", () => {
    expect(resolvePermissions("moderator", "ليس كائناً")).toEqual(DEFAULT_ROLE_PERMS.moderator);
    expect(resolvePermissions("member", { member: { صلاحيةوهمية: true } })).toEqual(DEFAULT_ROLE_PERMS.member);
  });

  it("resolveRole تحدد الدور الصحيح وتعطي null لغير المسجَّل", () => {
    expect(resolveRole(null, "u1", [], "u1")).toBe("owner");
    expect(resolveRole(null, "u1", ["u2"], "u2")).toBe("admin");
    expect(resolveRole(null, "u1", [], "u3")).toBe("member");
    expect(resolveRole({ memberRoles: { u3: "moderator" } }, "u1", [], "u3")).toBe("moderator");
    expect(resolveRole(null, "u1", [], null)).toBeNull();
  });

  it("hasPermission يربط الدور بالصلاحية الفعلية", () => {
    expect(hasPermission(null, "moderator", "pin")).toBe(true);
    expect(hasPermission(null, "member", "pin")).toBe(false);
    expect(hasPermission(null, null, "speak")).toBe(false);
  });
});

describe("أنواع الغرف وحدود العضوية", () => {
  it("كل الأنواع معرّفة بمعرّفات فريدة", () => {
    const ids = ROOM_KINDS.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(roomKind("غير-موجود").id).toBe(ROOM_KINDS[1].id);
  });

  it("حدود العضوية تُحترم فعلياً", () => {
    expect(tierRoomQuota("bronze").canUseKinds).toEqual(["open"]);
    expect(canCreateKind("private", "bronze")).toBe(false);
    expect(canCreateKind("private", "silver")).toBe(true);
    expect(canCreateKind("clan", "gold")).toBe(false);
    expect(canCreateKind("clan", "platinum")).toBe(true);
    expect(tierRoomQuota("diamond").maxRooms).toBe(-1);
    expect(tierRank("diamond")).toBeGreaterThan(tierRank("silver"));
  });

  it("الحد الفعلي للأعضاء = الأدنى بين النوع والرتبة والطلب", () => {
    expect(effectiveMemberLimit("group", "gold", 50)).toBe(20); // نوع المجموعة ٢٠
    expect(effectiveMemberLimit("private", "silver", 5)).toBe(5); // طلب المنشئ أقل
    expect(effectiveMemberLimit("open", "bronze", 0)).toBe(20); // حد الرتبة
  });
});

describe("الانضمام والحالات والدعوات", () => {
  const base = {
    roomOwnerId: "owner1",
    members: ["owner1"],
    memberCount: 1,
    userId: "u2",
    tier: "silver",
    now,
    isOwner: false,
  };

  it("الغرفة المنتهية والمغلقة تمنع الانضمام بسباب واضح", () => {
    const expired = canJoin({ ...base, profile: { expiresAt: now - 1000, permanent: false }, });
    expect(expired.ok).toBe(false);
    expect(expired.reason).toContain("انتهت");

    const closed = canJoin({ ...base, profile: { moderationState: "closed" } });
    expect(closed.ok).toBe(false);
  });

  it("العضوية المطلوبة تُفرض، والحد الأقصى يُحترم، والمالك لا يُحجب", () => {
    const tierBlocked = canJoin({ ...base, profile: { requiresTier: "gold" } });
    expect(tierBlocked.ok).toBe(false);
    expect(tierBlocked.reason).toContain("ذهبي");

    const full = canJoin({ ...base, profile: { memberLimit: 1 }, memberCount: 1 });
    expect(full.ok).toBe(false);
    expect(full.reason).toContain("حدّها");

    const owner = canJoin({ ...base, profile: { memberLimit: 1 }, memberCount: 5, isOwner: true });
    expect(owner.ok).toBe(true);
  });

  it("العضو الموجود مسبقاً يُعرف كعضو", () => {
    const res = canJoin({ ...base, members: ["owner1", "u2"], profile: {} });
    expect(res.ok).toBe(true);
    expect(res.reason).toContain("عضو");
  });

  it("حالات الغرفة تُشتق بدقة", () => {
    expect(roomState({ expiresAt: now + HOUR }, now).expired).toBe(false);
    expect(roomState({ expiresAt: now - 1 }, now).expired).toBe(true);
    expect(roomState({ moderationState: "locked" }, now).locked).toBe(true);
    expect(roomState({ moderationState: "watch" }, now).watch).toBe(true);
    expect(roomState({}, now).joinable).toBe(true);
  });

  it("الدعوات: مُلغاة/منتهية/مستهلكة تُرفض، والصالحة تُقبل", () => {
    expect(validateInvite(null, now).ok).toBe(false);
    expect(validateInvite({ code: "A", maxUses: 0, uses: 0, expiresAt: 0, revoked: true }, now).reason).toContain("أُلغيت");
    expect(validateInvite({ code: "A", maxUses: 0, uses: 0, expiresAt: now - 1, revoked: false }, now).reason).toContain("انتهت");
    expect(validateInvite({ code: "A", maxUses: 2, uses: 2, expiresAt: 0, revoked: false }, now).reason).toContain("استُهلكت");
    expect(validateInvite({ code: "A", maxUses: 3, uses: 1, expiresAt: now + HOUR, revoked: false }, now).ok).toBe(true);
  });

  it("مولّد الأكواد يعطي ٨ أحرف فريدة وقابلة للتكرار لنفس البذرة", () => {
    const a = generateInviteCode(12345);
    const b = generateInviteCode(12345);
    const c = generateInviteCode(98765);
    expect(a).toHaveLength(8);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[A-Z2-9]+$/);
  });
});

describe("الوضع البطيء والتنقية", () => {
  it("الوضع البطيء يحسب الثواني المتبقية فقط", () => {
    expect(slowModeRemaining({ slowModeSec: 10 }, now - 3000, now)).toBe(7);
    expect(slowModeRemaining({ slowModeSec: 10 }, now - 20000, now)).toBe(0);
    expect(slowModeRemaining({ slowModeSec: 0 }, now, now)).toBe(0);
  });

  it("الوسوم تُنظَّف وتُحدّ بستة وتُزال المكررة والقصيرة", () => {
    const tags = normalizeTags(["#منطق", " منطق ", "ر", "رياضيات", "علوم", "فلسفة", "فن", "تاريخ"]);
    expect(tags).toEqual(["منطق", "رياضيات", "علوم", "فلسفة", "فن", "تاريخ"]);
  });

  it("اسم الغرفة يُتحقّق طولاً", () => {
    expect(validateRoomName("اب").ok).toBe(false);
    expect(validateRoomName("حلقة المنطق").ok).toBe(true);
  });
});

describe("الترتيب والفلترة وصحة الغرفة", () => {
  const rooms = [
    view({ _id: "a", name: "حلقة النقاش", memberCount: 5, lastActivityAt: now - 1000, isOwner: true, featured: true }),
    view({ _id: "b", name: "غرفة الرياضيات", memberCount: 2, lastActivityAt: now - 50000, visibility: "open", tags: ["رياضيات"] }),
    view({ _id: "c", name: "غرفة منتهية", memberCount: 9, lastActivityAt: now - 200000, expiresAt: now + HOUR, moderationState: "watch" }),
  ];

  it("كل أنماط الترتيب تعمل", () => {
    expect(sortRooms(rooms, "active")[0]._id).toBe("a");
    expect(sortRooms(rooms, "largest")[0]._id).toBe("c");
    expect(sortRooms(rooms, "quietest")[0]._id).toBe("c");
    expect(sortRooms(rooms, "newest").length).toBe(3);
  });

  it("الفلاتر تُطبَّق فعلياً مع البحث", () => {
    expect(filterRooms(rooms, "mine", "", now).map((r) => r._id)).toEqual(["a"]);
    expect(filterRooms(rooms, "open", "", now).map((r) => r._id)).toEqual(["b"]);
    expect(filterRooms(rooms, "featured", "", now).map((r) => r._id)).toEqual(["a"]);
    expect(filterRooms(rooms, "expiring", "", now).map((r) => r._id)).toEqual(["c"]);
    expect(filterRooms(rooms, "watched", "", now).map((r) => r._id)).toEqual(["c"]);
    expect(filterRooms(rooms, "all", "رياضيات", now).map((r) => r._id)).toEqual(["b"]);
  });

  it("صحة الغرفة تتراجع مع البلاغات والجمود وتتحسن بالنشاط", () => {
    const healthy = roomHealth({ profile: {}, memberCount: 15, messages24h: 50, reportsOpen: 0, flagged24h: 0 }, now);
    const worn = roomHealth({ profile: { moderationState: "watch" }, memberCount: 2, messages24h: 0, reportsOpen: 3, flagged24h: 4 }, now);
    expect(healthy.score).toBeGreaterThan(85);
    expect(worn.score).toBeLessThan(50);
    expect(worn.reasons.join(" ")).toContain("بلاغ");
  });

  it("ملخص السجل يرتّب الإجراءات الأكثر تكراراً", () => {
    const summary = summarizeRoomAudit([{ action: "member_joined" }, { action: "member_joined" }, { action: "room_updated" }]);
    expect(summary.total).toBe(3);
    expect(summary.top[0]).toEqual({ action: "member_joined", count: 2 });
  });
});
