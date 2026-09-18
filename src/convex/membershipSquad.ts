import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { DAY, TIER_META, TIER_ORDER, tierIndex, type Tier } from "./tiers";
import { entitlementsOf, resolveMembership } from "./entitlements";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🛡 فرق العضوية — مقاعد حقيقية بترقيات حقيقية
 * ═══════════════════════════════════════════════════════════════════════
 *
 * العضو المميّز (ذهبي فأعلى) يفتح «فرقة» بكود، ويُمنح كل عضو فيها مستوى
 * مشتقاً من مستواه — **درجة واحدة دون مستواه** — كترقية مؤقتة حقيقية
 * مسجّلة في `membershipBoosts` (نفس مصدر الترقيات في كل اللعبة).
 *
 * لماذا درجة واحدة دون القائد؟ حتى تبقى للقائد ميزة حقيقية على فرقته،
 * ويبقى للترقية معنى — فلا تصبح الفرقة طريقة مجانية لمستوى أسطوري.
 *
 * ⚠️ لا يوجد أي cron هنا: انتهاء عضوية القائد أو انتهاء مدة المقعد تُنهي
 * المنح تلقائياً عند أول قراءة (لأن لكل ترقية `expiresAt` صريحاً).
 */

const OWNER_EMAIL = "omw70op@gmail.com";
/** سقف عملي لمقاعد الفرقة — يمنع «فرقة بلا نهاية» تُثقّل الحسابات. */
const HARD_SEAT_CAP = 50;
const SEAT_GRANT_DAYS = 30;

async function requireOwner(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("يجب تسجيل الدخول.");
  const me = (await ctx.db.get(userId)) as { role?: string; email?: string; name?: string } | null;
  if (!me || (me.role !== "admin" && me.email !== OWNER_EMAIL)) {
    throw new Error("غرفة المالك فقط.");
  }
  return me;
}

async function logEvent(ctx: any, args: Record<string, unknown>) {
  await ctx.db.insert("membershipEvents", { ...args, at: Date.now() });
}

/** المستوى الذي يُمنح لأعضاء فرقة قائد مستواه `leader` — درجة واحدة أدنى. */
export function seatTierFor(leader: Tier): Tier {
  const i = tierIndex(leader);
  return i <= 1 ? "silver" : TIER_ORDER[i - 1];
}

/** سقف المقاعد الفعلي من الامتياز (‎-1 = بلا حد → السقف العملي). */
function seatCapFor(tier: Tier): number {
  const slots = entitlementsOf(tier).squadSlots;
  if (slots === -1 || slots > HARD_SEAT_CAP) return HARD_SEAT_CAP;
  return Math.max(0, slots);
}

function randomCode(): string {
  const alphabet = "ACDEFGHJKLMNPQRTUVWXY3456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function uniqueCode(ctx: any): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = randomCode();
    const clash = await ctx.db
      .query("memberSquads")
      .withIndex("by_code", (q: any) => q.eq("code", code))
      .first();
    if (!clash) return code;
  }
  return `S${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

/** يُلغي منحة المقعد فوراً (بإبطال الترقية المؤقتة المرتبطة). */
async function revokeSeatBoost(ctx: any, seat: any) {
  if (!seat?.boostId) return;
  const boost = await ctx.db.get(seat.boostId);
  if (boost) await ctx.db.patch(seat.boostId, { expiresAt: Date.now() });
}

/** ينشئ الترقية المؤقتة الحقيقية للمقعد ويعيد معرّفها. */
async function grantSeatBoost(
  ctx: any,
  args: { userId: any; userName: string; tier: Tier; expiresAt: number; squadName: string },
) {
  const now = Date.now();
  const expiry = Math.max(now + DAY, Math.min(args.expiresAt, now + SEAT_GRANT_DAYS * DAY));
  return await ctx.db.insert("membershipBoosts", {
    userId: args.userId,
    tier: args.tier,
    source: "squad",
    label: `مقعد في فرقة «${args.squadName}»`,
    startedAt: now,
    expiresAt: expiry,
    note: `منحة عضوية جماعية — ${TIER_META[args.tier].name}`,
  });
}

/** تاريخ انتهاء منحة المقعد = الأقرب بين انتهاء عضوية القائد و30 يوماً. */
function seatExpiry(leaderExpiresAt: number | null): number {
  const cap = Date.now() + SEAT_GRANT_DAYS * DAY;
  return leaderExpiresAt ? Math.min(leaderExpiresAt, cap) : cap;
}

// ═══════════════════════════════════════════════════════════════════════
// 📊 القراءة: فرقتي / مقعدي / الفرق المفتوحة
// ═══════════════════════════════════════════════════════════════════════

export interface SquadSeatRow {
  id: string;
  userName: string;
  role: string;
  status: string;
  joinedAt: number | null;
  expiresAt: number | null;
  remainingHours: number | null;
  note: string | null;
}
export interface OpenSquadRow {
  id: string;
  code: string;
  name: string;
  emoji: string;
  leaderName: string;
  seatTier: Tier;
  seatTierName: string;
  seatsTotal: number;
  seatsTaken: number;
  open: boolean;
  autoAccept: boolean;
}
export interface MySquadResult {
  isSignedIn: boolean;
  tier: Tier;
  canCreate: boolean;
  seatCap: number;
  seatTier: Tier | null;
  squad: {
    id: string;
    name: string;
    emoji: string;
    code: string;
    seatTier: Tier;
    seatsTotal: number;
    open: boolean;
    autoAccept: boolean;
    note: string | null;
    createdAt: number;
    activeSeats: number;
    pending: SquadSeatRow[];
    seats: SquadSeatRow[];
  } | null;
  mySeat: {
    squadId: string;
    squadName: string;
    leaderName: string;
    tier: Tier;
    status: string;
    expiresAt: number | null;
    remainingHours: number | null;
  } | null;
  openSquads: OpenSquadRow[];
}

export const getMySquad = query({
  args: {},
  handler: async (ctx): Promise<MySquadResult> => {
    const userId = await getAuthUserId(ctx);
    const openSquadsRaw = await ctx.db
      .query("memberSquads")
      .withIndex("by_code")
      .take(30);

    const openSquads: OpenSquadRow[] = [];
    for (const s of openSquadsRaw) {
      if (!s.open || s.disbandedAt) continue;
      const active = await ctx.db
        .query("squadSeats")
        .withIndex("by_squad", (q) => q.eq("squadId", s._id).eq("status", "active"))
        .take(60);
      if (active.length >= s.seatsTotal) continue;
      openSquads.push({
        id: String(s._id),
        code: s.code,
        name: s.name,
        emoji: s.emoji,
        leaderName: s.ownerName,
        seatTier: s.seatTier as Tier,
        seatTierName: TIER_META[s.seatTier as Tier].name,
        seatsTotal: s.seatsTotal,
        seatsTaken: active.length,
        open: s.open,
        autoAccept: s.autoAccept,
      });
      if (openSquads.length >= 8) break;
    }

    if (userId === null) {
      return {
        isSignedIn: false,
        tier: "bronze",
        canCreate: false,
        seatCap: 0,
        seatTier: null,
        squad: null,
        mySeat: null,
        openSquads,
      };
    }

    const resolved = await resolveMembership(ctx, userId);
    const ent = entitlementsOf(resolved.tier);
    const now = Date.now();

    // (١) هل أنا قائد فرقة؟
    const mine = await ctx.db
      .query("memberSquads")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .first();
    const active =
      mine && !mine.disbandedAt
        ? mine
        : null;

    let squad: MySquadResult["squad"] = null;
    if (active) {
      const rows = await ctx.db
        .query("squadSeats")
        .withIndex("by_squad", (q) => q.eq("squadId", active._id))
        .take(60);
      const map = (row: any): SquadSeatRow => ({
        id: String(row._id),
        userName: row.userName,
        role: row.role,
        status: row.status,
        joinedAt: row.joinedAt ?? null,
        expiresAt: row.expiresAt ?? null,
        remainingHours:
          row.expiresAt && row.expiresAt > now
            ? Math.max(1, Math.ceil((row.expiresAt - now) / (60 * 60 * 1000)))
            : null,
        note: row.note ?? null,
      });
      const seats = rows.filter((r) => r.status === "active").map(map);
      const pending = rows.filter((r) => r.status === "pending").map(map);
      squad = {
        id: String(active._id),
        name: active.name,
        emoji: active.emoji,
        code: active.code,
        seatTier: active.seatTier as Tier,
        seatsTotal: active.seatsTotal,
        open: active.open,
        autoAccept: active.autoAccept,
        note: active.note ?? null,
        createdAt: active.createdAt,
        activeSeats: seats.length,
        pending,
        seats,
      };
    }

    // (٢) هل أنا عضو في فرقة؟
    const mySeats = await ctx.db
      .query("squadSeats")
      .withIndex("by_user", (q) => q.eq("userId", userId).eq("status", "active"))
      .take(3);
    let mySeat: MySquadResult["mySeat"] = null;
    for (const s of mySeats) {
      const parent = await ctx.db.get(s.squadId);
      if (!parent || parent.disbandedAt) continue;
      mySeat = {
        squadId: String(parent._id),
        squadName: parent.name,
        leaderName: parent.ownerName,
        tier: s.squadId ? parent.seatTier as Tier : "silver",
        status: s.status,
        expiresAt: s.expiresAt ?? null,
        remainingHours:
          s.expiresAt && s.expiresAt > now
            ? Math.max(1, Math.ceil((s.expiresAt - now) / (60 * 60 * 1000)))
            : null,
      };
      break;
    }

    return {
      isSignedIn: true,
      tier: resolved.tier,
      canCreate: ent.squadCreate && seatCapFor(resolved.tier) > 0 && !active,
      seatCap: seatCapFor(resolved.tier),
      seatTier: ent.squadCreate ? seatTierFor(resolved.paidTier) : null,
      squad,
      mySeat,
      openSquads,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// ✍️ الكتابة: إنشاء · انضمام · قبول · طرد · خروج · إعدادات
// ═══════════════════════════════════════════════════════════════════════

/** إنشاء فرقة — يتطلب امتياز `squadCreate` (ذهبي فأعلى)، وفرقة واحدة لكل قائد. */
export const createSquad = mutation({
  args: {
    name: v.string(),
    emoji: v.optional(v.string()),
    open: v.optional(v.boolean()),
    autoAccept: v.optional(v.boolean()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول.");

    const resolved = await resolveMembership(ctx, userId);
    const ent = entitlementsOf(resolved.tier);
    if (!ent.squadCreate) {
      throw new Error("إنشاء الفرق متاح من المستوى الذهبي فأعلى.");
    }
    const cap = seatCapFor(resolved.tier);
    if (cap <= 0) throw new Error("مستواك لا يمنح مقاعد فرقة.");

    const existing = await ctx.db
      .query("memberSquads")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .first();
    if (existing && !existing.disbandedAt) throw new Error("لديك فرقة قائمة بالفعل.");

    const me = (await ctx.db.get(userId)) as { name?: string } | null;
    const ownerName = me?.name ?? "لاعب";
    const name = args.name.trim().slice(0, 32) || `فرقة ${ownerName}`;
    const code = await uniqueCode(ctx);
    const now = Date.now();

    const squadId = await ctx.db.insert("memberSquads", {
      ownerId: userId,
      ownerName,
      name,
      emoji: (args.emoji ?? "🛡").slice(0, 4),
      code,
      seatTier: seatTierFor(resolved.paidTier),
      seatsTotal: cap,
      open: args.open ?? true,
      autoAccept: args.autoAccept ?? true,
      note: args.note?.slice(0, 120),
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("squadSeats", {
      squadId,
      userId,
      userName: ownerName,
      role: "leader",
      status: "active",
      requestedAt: now,
      joinedAt: now,
      note: "قائد الفرقة",
    });

    await logEvent(ctx, {
      userId,
      actorName: ownerName,
      kind: "squad",
      tier: resolved.paidTier,
      detail: `أنشأ فرقة «${name}» بكود ${code} — ${cap} مقعداً`,
    });

    return { ok: true, squadId, code, seatsTotal: cap, seatTier: seatTierFor(resolved.paidTier) };
  },
});

/** انضمام بكود — فوري إن كانت مفتوحة بالقبول التلقائي، وإلا يبقى طلباً. */
export const joinByCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول.");
    const code = args.code.trim().toUpperCase();
    if (code.length < 4) throw new Error("كود الفرقة غير صحيح.");

    const squad = await ctx.db
      .query("memberSquads")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!squad || squad.disbandedAt) throw new Error("لا توجد فرقة بهذا الكود.");
    if (squad.ownerId === userId) throw new Error("أنت قائد هذه الفرقة بالفعل.");

    return await joinSquad(ctx, squad, userId);
  },
});

/** انضمام بمعرّف الفرقة — من قائمة الفرق المفتوحة. */
export const requestJoin = mutation({
  args: { squadId: v.id("memberSquads") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول.");
    const squad = await ctx.db.get(args.squadId);
    if (!squad || squad.disbandedAt) throw new Error("لا توجد فرقة بهذا المعرّف.");
    if (squad.ownerId === userId) throw new Error("أنت قائد هذه الفرقة بالفعل.");
    return await joinSquad(ctx, squad, userId);
  },
});

async function joinSquad(ctx: any, squad: any, userId: any) {
  const already = await ctx.db
    .query("squadSeats")
    .withIndex("by_user_squad", (q: any) => q.eq("userId", userId).eq("squadId", squad._id))
    .first();
  if (already && (already.status === "active" || already.status === "pending")) {
    throw new Error("لديك مقعد أو طلب قائم في هذه الفرقة.");
  }

  const elsewhere = await ctx.db
    .query("squadSeats")
    .withIndex("by_user", (q: any) => q.eq("userId", userId).eq("status", "active"))
    .take(3);
  for (const s of elsewhere) {
    const parent = await ctx.db.get(s.squadId);
    if (parent && !parent.disbandedAt && s.role !== "leader") {
      throw new Error("أنت عضو في فرقة أخرى — اخرج منها أولاً.");
    }
  }

  const active = await ctx.db
    .query("squadSeats")
    .withIndex("by_squad", (q: any) => q.eq("squadId", squad._id).eq("status", "active"))
    .take(squad.seatsTotal + 1);
  const full = active.length >= squad.seatsTotal;

  const me = (await ctx.db.get(userId)) as { name?: string } | null;
  const userName = me?.name ?? "لاعب";
  const now = Date.now();

  if (full || !squad.open || !squad.autoAccept) {
    await ctx.db.insert("squadSeats", {
      squadId: squad._id,
      userId,
      userName,
      role: "member",
      status: "pending",
      requestedAt: now,
      note: full ? "الفرقة ممتلئة — طلب بالانتظار" : "طلب بالانتظار",
    });
    return {
      ok: true,
      joined: false,
      reason: full ? "الفرقة ممتلئة — طلبك في قائمة الانتظار." : "أُرسل طلبك لقائد الفرقة.",
    };
  }

  const leader = await resolveMembership(ctx, squad.ownerId);
  const expiry = seatExpiry(leader.expiresAt);
  const boostId = await grantSeatBoost(ctx, {
    userId,
    userName,
    tier: squad.seatTier as Tier,
    expiresAt: expiry,
    squadName: squad.name,
  });

  await ctx.db.insert("squadSeats", {
    squadId: squad._id,
    userId,
    userName,
    role: "member",
    status: "active",
    requestedAt: now,
    joinedAt: now,
    expiresAt: expiry,
    boostId,
  });

  await ctx.db.patch(squad._id, { updatedAt: now });
  await logEvent(ctx, {
    userId,
    actorName: userName,
    kind: "squad",
    tier: squad.seatTier,
    detail: `انضم إلى فرقة «${squad.name}» — مقعد ${TIER_META[squad.seatTier as Tier].name}`,
    expiresAt: expiry,
  });

  return { ok: true, joined: true, tier: squad.seatTier, expiresAt: expiry };
}

/** قبول طلب أو رفضه — قائد الفرقة فقط. القبول ينشئ الترقية الحقيقية. */
export const respondRequest = mutation({
  args: { seatId: v.id("squadSeats"), accept: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول.");
    const seat = await ctx.db.get(args.seatId);
    if (!seat) throw new Error("الطلب غير موجود.");
    const squad = await ctx.db.get(seat.squadId);
    if (!squad) throw new Error("الفرقة غير موجودة.");
    if (squad.ownerId !== userId) throw new Error("قائد الفرقة فقط يقبل الطلبات.");
    if (seat.status !== "pending") throw new Error("هذا الطلب لم يعد معلّقاً.");

    const now = Date.now();
    if (!args.accept) {
      await ctx.db.patch(seat._id, { status: "declined", note: "رُفض الطلب" });
      return { ok: true, accepted: false };
    }

    const active = await ctx.db
      .query("squadSeats")
      .withIndex("by_squad", (q) => q.eq("squadId", squad._id).eq("status", "active"))
      .take(squad.seatsTotal + 1);
    if (active.length >= squad.seatsTotal) {
      throw new Error("لا توجد مقاعد شاغرة — ارفع سقف المقاعد أو أزل عضواً.");
    }

    const leader = await resolveMembership(ctx, userId);
    const expiry = seatExpiry(leader.expiresAt);
    const boostId = await grantSeatBoost(ctx, {
      userId: seat.userId,
      userName: seat.userName,
      tier: squad.seatTier as Tier,
      expiresAt: expiry,
      squadName: squad.name,
    });
    await ctx.db.patch(seat._id, { status: "active", joinedAt: now, expiresAt: expiry, boostId });
    await logEvent(ctx, {
      userId: seat.userId,
      actorName: seat.userName,
      kind: "squad",
      tier: squad.seatTier,
      detail: `قُبل في فرقة «${squad.name}» — مقعد ${TIER_META[squad.seatTier as Tier].name}`,
      expiresAt: expiry,
    });
    return { ok: true, accepted: true, tier: squad.seatTier, expiresAt: expiry };
  },
});

/** طرد عضو — القائد، ويُلغى منحه فوراً. */
export const kickMember = mutation({
  args: { seatId: v.id("squadSeats"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول.");
    const seat = await ctx.db.get(args.seatId);
    if (!seat) throw new Error("العضو غير موجود.");
    const squad = await ctx.db.get(seat.squadId);
    if (!squad) throw new Error("الفرقة غير موجودة.");
    if (squad.ownerId !== userId) throw new Error("قائد الفرقة فقط يطرد الأعضاء.");
    if (seat.role === "leader") throw new Error("لا يمكن طرد قائد الفرقة.");

    await revokeSeatBoost(ctx, seat);
    await ctx.db.patch(seat._id, {
      status: "kicked",
      boostId: undefined,
      note: args.reason?.slice(0, 80) ?? "أُزيل من الفرقة",
    });
    await logEvent(ctx, {
      userId: seat.userId,
      actorName: squad.ownerName,
      kind: "squad",
      detail: `أُزيل من فرقة «${squad.name}» — انتهت منحة المقعد`,
    });
    return { ok: true };
  },
});

/** خروج عضو من الفرقة — يُنهي منحته فوراً. */
export const leaveSquad = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول.");
    const seats = await ctx.db
      .query("squadSeats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(5);
    const seat = seats.find((s) => s.status === "active" || s.status === "pending");
    if (!seat) throw new Error("لا يوجد مقعد نشط لك.");
    if (seat.role === "leader") throw new Error("القائد لا يخرج — يمكنه حلّ الفرقة.");

    await revokeSeatBoost(ctx, seat);
    await ctx.db.patch(seat._id, { status: "left", boostId: undefined, note: "خرج بنفسه" });
    return { ok: true };
  },
});

/** تعديل إعدادات الفرقة — القائد، مع إعادة مزامنة سقف المقاعد مع الامتياز. */
export const updateSquad = mutation({
  args: {
    name: v.optional(v.string()),
    emoji: v.optional(v.string()),
    open: v.optional(v.boolean()),
    autoAccept: v.optional(v.boolean()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول.");
    const squad = await ctx.db
      .query("memberSquads")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .first();
    if (!squad || squad.disbandedAt) throw new Error("لا تملك فرقة قائمة.");

    const resolved = await resolveMembership(ctx, userId);
    const cap = seatCapFor(resolved.tier);
    const seatsTotal = Math.max(cap, squad.seatsTotal > cap ? squad.seatsTotal : cap);

    const seatTier = seatTierFor(resolved.paidTier);
    await ctx.db.patch(squad._id, {
      name: args.name?.trim().slice(0, 32) ?? squad.name,
      emoji: args.emoji?.slice(0, 4) ?? squad.emoji,
      open: args.open ?? squad.open,
      autoAccept: args.autoAccept ?? squad.autoAccept,
      note: args.note === undefined ? squad.note : args.note.slice(0, 120),
      seatTier,
      seatsTotal,
      updatedAt: Date.now(),
    });

    // إن ارتفع مستوى القائد، تُرفع منح الأعضاء النشطين فوراً للمستوى الجديد.
    if (tierIndex(seatTier) > tierIndex(squad.seatTier as Tier)) {
      const active = await ctx.db
        .query("squadSeats")
        .withIndex("by_squad", (q) => q.eq("squadId", squad._id).eq("status", "active"))
        .take(60);
      for (const seat of active) {
        if (seat.role === "leader") continue;
        await revokeSeatBoost(ctx, seat);
        const boostId = await grantSeatBoost(ctx, {
          userId: seat.userId,
          userName: seat.userName,
          tier: seatTier,
          expiresAt: seatExpiry(resolved.expiresAt),
          squadName: squad.name,
        });
        await ctx.db.patch(seat._id, { boostId, expiresAt: seatExpiry(resolved.expiresAt) });
      }
    }

    return { ok: true, seatsTotal, seatTier };
  },
});

/** حلّ الفرقة — القائد. كل المنح تُلغى فوراً. */
export const disbandSquad = mutation({
  args: { confirm: v.literal("disband") },
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول.");
    const squad = await ctx.db
      .query("memberSquads")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .first();
    if (!squad || squad.disbandedAt) throw new Error("لا تملك فرقة قائمة.");

    const seats = await ctx.db
      .query("squadSeats")
      .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
      .take(60);
    for (const seat of seats) {
      await revokeSeatBoost(ctx, seat);
      if (seat.role !== "leader") {
        await ctx.db.patch(seat._id, { status: "left", boostId: undefined, note: "حُلّت الفرقة" });
      }
    }
    await ctx.db.patch(squad._id, { disbandedAt: Date.now(), open: false, updatedAt: Date.now() });
    await logEvent(ctx, {
      userId,
      actorName: squad.ownerName,
      kind: "squad",
      detail: `حلّ فرقة «${squad.name}» وأُلغيت كل منح المقاعد`,
    });
    return { ok: true };
  },
});

/** ترتيب الفرق — بقراءة محدودة (أعلى 10 فقط). */
export const getSquadLeaderboard = query({
  args: {},
  handler: async (ctx) => {
    const squads = await ctx.db.query("memberSquads").withIndex("by_code").take(40);
    const rows: {
      id: string;
      name: string;
      emoji: string;
      leaderName: string;
      seatTier: Tier;
      seats: number;
      seatsTotal: number;
      open: boolean;
    }[] = [];
    for (const s of squads) {
      if (s.disbandedAt) continue;
      const active = await ctx.db
        .query("squadSeats")
        .withIndex("by_squad", (q) => q.eq("squadId", s._id).eq("status", "active"))
        .take(60);
      rows.push({
        id: String(s._id),
        name: s.name,
        emoji: s.emoji,
        leaderName: s.ownerName,
        seatTier: s.seatTier as Tier,
        seats: active.length,
        seatsTotal: s.seatsTotal,
        open: s.open,
      });
    }
    rows.sort((a, b) => b.seats - a.seats);
    return { squads: rows.slice(0, 10) };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 👑 تحكم المالك
// ═══════════════════════════════════════════════════════════════════════

/** رفع سقف مقاعد فرقة معيّنة — المالك فقط (لا يقيّده امتياز المستوى). */
export const ownerGrantSeats = mutation({
  args: { squadId: v.id("memberSquads"), seatsTotal: v.number() },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const squad = await ctx.db.get(args.squadId);
    if (!squad) throw new Error("الفرقة غير موجودة.");
    const seats = Math.max(1, Math.min(HARD_SEAT_CAP, Math.round(args.seatsTotal)));
    await ctx.db.patch(squad._id, { seatsTotal: seats, updatedAt: Date.now() });
    await logEvent(ctx, {
      userId: undefined,
      actorName: owner.name ?? "المالك",
      kind: "squad",
      detail: `رفع مقاعد فرقة «${squad.name}» إلى ${seats}`,
    });
    return { ok: true, seatsTotal: seats };
  },
});

/** حلّ أي فرقة — المالك فقط. */
export const ownerDisbandSquad = mutation({
  args: { squadId: v.id("memberSquads") },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const squad = await ctx.db.get(args.squadId);
    if (!squad) throw new Error("الفرقة غير موجودة.");
    const seats = await ctx.db
      .query("squadSeats")
      .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
      .take(60);
    for (const seat of seats) {
      await revokeSeatBoost(ctx, seat);
      await ctx.db.patch(seat._id, { status: "left", boostId: undefined, note: "حلّها المالك" });
    }
    await ctx.db.patch(squad._id, { disbandedAt: Date.now(), open: false, updatedAt: Date.now() });
    await logEvent(ctx, {
      userId: undefined,
      actorName: owner.name ?? "المالك",
      kind: "squad",
      detail: `حلّ فرقة «${squad.name}» إدارياً`,
    });
    return { ok: true };
  },
});
