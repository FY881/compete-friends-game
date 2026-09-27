import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ensureAiRuntime } from "./apiCore";
import { internal } from "./_generated/api";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🏆 كأس التحالفات (Alliance Cup) — الأداة 22 في حرب العقول
 * ═══════════════════════════════════════════════════════════════════════
 *
 * الطبقة التنافسية التي توحّد ثمار كل الأدوات: أبطال النزالات
 * (rivalryDuels)، محاربو الخطط (warPlans)، وحلفاء التغطية
 * (twinAlliances) — كلها تتحول **نقاط شرف** لتحالف يتصارع
 * في أربعة أقسام: ظل → فولاذ → ذهب → أسطورة.
 *
 *   1) 📜 نقاط الشرف تُحتسب من الأفعال الحقيقية فقط (لا ترقيم يدوي):
 *        نصر نزال نقيض = 25 · فوز خطة حرب = 20 · تغطية متبادلة كاملة = 30
 *        نصف تغطية (طرف واحد وفى) = 15
 *   2) 🪜 التدرج: نعم — تحالف الأسبوع الماضي يبدأ في القسم الأدنى
 *      للقسم الذي ينتمي إليه بمستواه: المجد يُعاد بناؤه موسماً بعد موسم.
 *   3) 🏅 التتويج: آخر موسم يُقفل بدخول البطل متزامناً «خارجة عن
 *      القانون» أولاً — لضمان سجلات حقيقية لا ترقيم رجعي.
 *   4) 📢 إعلان التتويج: يُنشر تلقائياً في announcements باسم التحالف
 *      وقسمه ونقاطه.
 * ═══════════════════════════════════════════════════════════════════════
 */

const DAY = 24 * 3600_000;
const SEASON_DAYS = 14;
const TITLE_REWARD = 110;
const RUNNER_REWARD = 55;

const DIVISIONS = ["ظل", "فولاذ", "ذهب", "أسطورة"] as const;
type Division = (typeof DIVISIONS)[number];

type CupPoints = { duels: number; plans: number; covers: number; halfCovers: number; total: number };

type HonorFacts = {
  season: number;
  seasonEndsAt: number;
  duelsWon: number;
  plansWon: number;
  coversFull: number;
  coversHalf: number;
  twinName: string | null;
  hasTwin: boolean;
};

type CupRow = {
  _id: unknown;
  season: number;
  name: string;
  members: string[];
  division: string;
  honorPoints: number;
  duelsWon: number;
  plansWon: number;
  coversFull: number;
  coversHalf: number;
  status: "open" | "crowned" | "closed";
  crownedAt?: number;
  lastFeatsAt: number;
  createdAt: number;
};

// ═══════════════════════════════════════════════════════════════════════
// 0) أدوات الموسم
// ═══════════════════════════════════════════════════════════════════════

function seasonKeyOf(now: number): number {
  return Math.floor(now / (SEASON_DAYS * DAY));
}

function seasonEndsAt(season: number): number {
  return (season + 1) * SEASON_DAYS * DAY;
}

function divisionFor(points: number): Division {
  if (points >= 240) return "أسطورة";
  if (points >= 140) return "ذهب";
  if (points >= 60) return "فولاذ";
  return "ظل";
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const CRESTS = ["⚜️", "🦅", "🐉", "⚔️", "🛡️", "🔥", "👑", "🦁", "🌙", "⚡"];

// ═══════════════════════════════════════════════════════════════════════
// 1) قارئ الشرف الداخلي — نقاط التحالف من أفعاله الحقيقية
// ═══════════════════════════════════════════════════════════════════════

export const honorFactsInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const season = seasonKeyOf(Date.now());
    const seasonStart = season * SEASON_DAYS * DAY;

    // نصرة النقيض: نزالات شارك فيها الطرفان وحُسمت
    const duels = await ctx.db
      .query("rivalryDuels")
      .withIndex("by_challenger_status", (q) => q.eq("challengerId", userId).eq("status", "settled"))
      .take(40);
    const duelsFoe = await ctx.db
      .query("rivalryDuels")
      .withIndex("by_foe_status", (q) => q.eq("foeId", userId).eq("status", "settled"))
      .take(40);
    const duelsWon = [...duels, ...duelsFoe].filter(
      (d) => (d.resolvedAt ?? 0) >= seasonStart && ((d.winner === "challenger" && d.challengerId === userId) || (d.winner === "foe" && d.foeId === userId)),
    ).length;

    // خطط الحرب: خطة فاز بها هذا الموسم
    const plans = await ctx.db
      .query("warPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(20);
    const plansWon = plans.filter((p) => p.status === "won" && (p.resolvedAt ?? 0) >= seasonStart).length;

    // تحالفات التوأم: حُكم عليها هذا الموسم (كامل/نصف)
    const alliances = await ctx.db.query("twinAlliances").take(120);
    const mine = alliances.filter(
      (a) => a.status === "settled" && (a.resolvedAt ?? 0) >= seasonStart && (a.aId === userId || a.bId === userId),
    );
    const coversFull = mine.filter((a) => a.coverScoreA >= 0.7 && a.coverScoreB >= 0.7).length;
    const coversHalf = mine.length - coversFull;

    // اسم توأمك (شرط التسجيل)
    const mate = (
      await ctx.db.query("mindSoulmates").withIndex("by_user", (q) => q.eq("userId", userId)).take(1)
    )[0];

    return {
      season,
      seasonEndsAt: seasonEndsAt(season),
      duelsWon,
      plansWon,
      coversFull,
      coversHalf,
      twinName: mate?.twinName ?? null,
      hasTwin: Boolean(mate),
    };
  },
});

/** حساب النقاط من الحقائق (منطق موحّد يُستخدم في القارئ والتسجيل) */
function pointsFrom(f: { duelsWon: number; plansWon: number; coversFull: number; coversHalf: number }): CupPoints {
  const duels = f.duelsWon * 25;
  const plans = f.plansWon * 20;
  const covers = f.coversFull * 30;
  const halfCovers = f.coversHalf * 15;
  return { duels, plans, covers, halfCovers, total: duels + plans + covers + halfCovers };
}

// ═══════════════════════════════════════════════════════════════════════
// 2) قراءات الواجهة
// ═══════════════════════════════════════════════════════════════════════

export const getMyHonor = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const f = (await ctx.runQuery(internal.aiCup.honorFactsInternal, { userId })) as {
      season: number;
      seasonEndsAt: number;
      duelsWon: number;
      plansWon: number;
      coversFull: number;
      coversHalf: number;
      twinName: string | null;
      hasTwin: boolean;
    };
    const pts = pointsFrom(f);
    const registered = await ctx.db
      .query("cupStandings")
      .withIndex("by_season", (q) => q.eq("season", f.season))
      .take(200);
    const mine = registered.find((r) => r.members.includes(String(userId)));
    return {
      season: f.season,
      seasonEndsAt: f.seasonEndsAt,
      twinName: f.twinName,
      hasTwin: f.hasTwin,
      pts,
      registered: mine
        ? { name: mine.name, division: mine.division, crest: mine.crest, honorPoints: mine.honorPoints }
        : null,
    };
  },
});

export const getStandings = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const season = seasonKeyOf(Date.now());
    const rows = await ctx.db
      .query("cupStandings")
      .withIndex("by_season", (q) => q.eq("season", season))
      .take(200);
    const sorted = rows.sort((a, b) => b.honorPoints - a.honorPoints);
    const byDiv: Record<string, typeof sorted> = { "أسطورة": [], "ذهب": [], "فولاذ": [], "ظل": [] };
    for (const r of sorted) (byDiv[r.division] ?? byDiv["ظل"]).push(r);
    return {
      season,
      endsAt: seasonEndsAt(season),
      divisions: byDiv,
      myRow: userId ? sorted.find((r) => r.members.includes(String(userId))) ?? null : null,
    };
  },
});

export const getSeasonHistory = query({
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("cupSeasons")
      .withIndex("by_season", (q) => q.gt("season", -1))
      .take(12);
    return rows.sort((a, b) => b.season - a.season);
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 3) تسجيل التحالف في الموسم
// ═══════════════════════════════════════════════════════════════════════

export const registerCup = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("غير مصرح");

    const f = (await ctx.runQuery(internal.aiCup.honorFactsInternal, { userId })) as unknown as HonorFacts;
    if (!f.hasTwin || !f.twinName) throw new Error("لا تحالف ممكن بدون توأم معلن — افتح بازار العقول أولاً.");

    const existing = await ctx.db
      .query("cupStandings")
      .withIndex("by_season", (q) => q.eq("season", f.season))
      .take(200);
    if (existing.some((r) => r.members.includes(String(userId)))) {
      throw new Error("تحالفك مسجل في الموسم الحالي بالفعل.");
    }
    if (existing.length >= 150) throw new Error("الموسم ممتلئ (150 تحالفاً كحد أقصى).");

    const pts = pointsFrom(f);
    const div = divisionFor(pts.total);
    const myName = me.name ?? "لاعب";
    const name = `${myName} × ${f.twinName}`;
    const crest = CRESTS[hashStr(name) % CRESTS.length];

    await ctx.db.insert("cupStandings", {
      season: f.season,
      name,
      members: [String(userId)],
      division: div,
      honorPoints: pts.total,
      duelsWon: f.duelsWon,
      plansWon: f.plansWon,
      coversFull: f.coversFull,
      coversHalf: f.coversHalf,
      status: "open" as const,
      lastFeatsAt: Date.now(),
      createdAt: Date.now(),
      crest,
    });
    await ctx.db.insert("aiDecisionLog", {
      system: "alliance_cup",
      actorName: "كأس التحالفات",
      action: "cup_registered",
      targetId: String(userId),
      targetName: myName,
      detail: `انضم بتحالف «${name}» ${crest} إلى قسم «${div}» بـ${pts.total} نقطة شرف (موسم ${f.season})`,
      severity: "low",
      createdAt: Date.now(),
    });
    return { ok: true as const, name, division: div, crest, points: pts.total };
  },
});

/** تحديث نقاط تحالف مسجل بعد كل إنجاز جديد (نداء يدوي + مهمة) */
export const refreshMyHonor = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const f = (await ctx.runQuery(internal.aiCup.honorFactsInternal, { userId })) as unknown as HonorFacts;
    const season = seasonKeyOf(Date.now());
    const rows = await ctx.db
      .query("cupStandings")
      .withIndex("by_season", (q) => q.eq("season", season))
      .take(200);
    const mine = rows.find((r) => r.members.includes(String(userId)));
    if (!mine) throw new Error("تحالفك غير مسجل في هذا الموسم — سجّل أولاً.");
    if (mine.status !== "open") throw new Error("موسمك أُقفل بالتتويج — انتظر الموسم القادم.");

    const pts = pointsFrom(f);
    const division = divisionFor(pts.total);
    const now = Date.now();
    await ctx.db.patch(mine._id, {
      honorPoints: pts.total,
      duelsWon: f.duelsWon,
      plansWon: f.plansWon,
      coversFull: f.coversFull,
      coversHalf: f.coversHalf,
      division,
      lastFeatsAt: now,
    });
    return { ok: true as const, points: pts.total, division, promoted: division !== mine.division };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 4) تتويج البطل وإغلاق الموسم (آلي)
// ═══════════════════════════════════════════════════════════════════════

async function crownSeason(ctx: MutationCtx, season: number): Promise<{ crowned: string | null }> {
  const now = Date.now();
  const rows = await ctx.db
    .query("cupStandings")
    .withIndex("by_season", (q) => q.eq("season", season))
    .take(200);
  if (rows.length === 0) {
    await ctx.db.insert("cupSeasons", {
      season,
      championName: "لا أبطال — موسم صامت",
      championCrest: "🌫️",
      championPoints: 0,
      championMembers: [],
      runnerPoints: 0,
      teamsCount: 0,
      crownedAt: now,
    });
    return { crowned: null };
  }
  const sorted = rows.sort((a, b) => b.honorPoints - a.honorPoints);
  const champ = sorted[0];
  const runner = sorted[1] ?? null;

  // مكافآت البطل ووصيفه (لكل أعضاء التحالف المسجلين)
  const payouts: Array<{ memberId: string; amount: number; label: string }> = [];
  for (const m of champ.members) {
    payouts.push({ memberId: m, amount: TITLE_REWARD, label: `تاج كأس التحالفات (موسم ${season})` });
  }
  if (runner) {
    for (const m of runner.members) {
      payouts.push({ memberId: m, amount: RUNNER_REWARD, label: `وصافة كأس التحالفات (موسم ${season})` });
    }
  }
  for (const p of payouts) {
    const wr = await ctx.db
      .query("loyaltyWallets")
      .withIndex("by_user", (q) => q.eq("userId", p.memberId as never))
      .take(1);
    if (wr[0]) {
      await ctx.db.patch(wr[0]._id, { points: wr[0].points + p.amount, updatedAt: now });
    } else {
      await ctx.db.insert("loyaltyWallets", {
        userId: p.memberId as never,
        points: p.amount,
        lifetimeEarned: p.amount,
        perks: [],
        updatedAt: now,
      });
    }
    await ctx.db.insert("loyaltyLedger", {
      userId: p.memberId as never,
      delta: p.amount,
      reason: p.label,
      at: now,
    });
  }

  // إعلان التتويج
  await ctx.db.insert("announcements", {
    title: `🏆 تاج كأس التحالفات: «${champ.name}» ${champ.crest ?? "⚜️"}`,
    body: `بعد موسم من النزالات والخطط والتغطيات، ارتقى تحالف «${champ.name}» بـ${champ.honorPoints} نقطة شرف (نزالات ${champ.duelsWon} · خطط ${champ.plansWon} · تغطيات ${champ.coversFull}) ليحمل تاج الموسم ${season}${runner ? `، وبلغ الوصيف «${runner.name}» ${runner.honorPoints} نقطة` : ""}.`,
    active: true,
    priority: "medium",
    createdAt: now,
  });

  // قفل الصفوف وترويج الفوارس
  for (const r of rows) {
    await ctx.db.patch(r._id, { status: "closed" as const });
  }
  await ctx.db.patch(champ._id, { status: "crowned" as const, crownedAt: now });

  await ctx.db.insert("cupSeasons", {
    season,
    championName: champ.name,
    championCrest: champ.crest ?? "⚜️",
    championPoints: champ.honorPoints,
    championMembers: champ.members,
    runnerName: runner?.name,
    runnerPoints: runner?.honorPoints ?? 0,
    teamsCount: rows.length,
    crownedAt: now,
  });
  await ctx.db.insert("aiDecisionLog", {
    system: "alliance_cup",
    actorName: "كأس التحالفات",
    action: "season_crowned",
    targetId: champ.members[0] ?? null,
    targetName: champ.name,
    detail: `توّج «${champ.name}» ${champ.crest ?? "⚜️"} بـ${champ.honorPoints} نقطة من ${rows.length} تحالفاً — دُفع ${TITLE_REWARD} ولاء لكل عضو بطل`,
    severity: "medium",
    createdAt: now,
  });
  return { crowned: champ.name };
}

export const cupJob = internalMutation({
  handler: async (ctx): Promise<unknown> => {
    const now = Date.now();
    const season = seasonKeyOf(now);
    let crowned: string | null = null;
    // أقفل المواسم المنتهية (من الماضي حتى الحالي إن حان وقته)
    const seasonsRow = await ctx.db
      .query("cupSeasons")
      .withIndex("by_season", (q) => q.gt("season", -1))
      .take(20);
    const settledSeasons = new Set(seasonsRow.map((s) => s.season));
    for (let s = season - 2; s < season; s++) {
      if (s >= 0 && !settledSeasons.has(s)) {
        const r = await crownSeason(ctx, s);
        if (r.crowned) crowned = r.crowned;
      }
    }
    // الموسم الحالي يُقفل فقط إذا تجاوز وقته فعلاً (وقت بدء الموسم التالي)
    if (!settledSeasons.has(season) && now >= seasonEndsAt(season)) {
      const r = await crownSeason(ctx, season);
      if (r.crowned) crowned = r.crowned;
    }
    return { crowned };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 5) نصر التتويج — نبأ البطولة بلسان المُعلن الذكي (اختياري)
// ═══════════════════════════════════════════════════════════════════════

export const crownHerald = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const season = seasonKeyOf(Date.now());
    const seasonsRow = await ctx.db
      .query("cupSeasons")
      .withIndex("by_season", (q) => q.gt("season", -1))
      .take(20);
    const latest = seasonsRow.sort((a, b) => b.season - a.season)[0];
    if (!latest) return { ok: false as const, note: "لم يُتوَّج موسم بعد — سجّل وابنِ مجدك أولاً." };

    try {
      await ensureAiRuntime(ctx);
      const { callLlm } = await import("./aiConfig");
      const raw = await callLlm(
        [
          {
            role: "system",
            content:
              "أنت مُعلن ملكي لتتويج بطولات في لعبة أسئلة عربية. اكتب نبأ التتويج في 3 أسطر مهيبة: اسم التحالف وشعاره، ملحمة نقاطه (نزالات وخطط وتغطيات)، وقسمة الأقسام الأربعة. بلا حشو وبلا مبالغة ساقطة.",
          },
          {
            role: "user",
            content: JSON.stringify({
              الموسم: latest.season,
              البطل: latest.championName,
              الشعار: latest.championCrest,
              النقاط: latest.championPoints,
              الوصيف: latest.runnerName,
              نقاط_الوصيف: latest.runnerPoints,
              عدد_التحالفات: latest.teamsCount,
            }),
          },
        ],
        240,
        0.8,
        "MindClash Alliance Cup Herald",
      );
      const clean = raw.trim().slice(0, 460);
      if (clean.length > 40) {
        await ctx.db.patch(latest._id, { chronicle: clean });
        return { ok: true as const, chronicle: clean, season: latest.season };
      }
      return { ok: false as const, note: "لم يُنتج المُعلن نصاً كافياً" };
    } catch (e) {
      return { ok: false as const, note: e instanceof Error ? e.message : "فشل المُعلن — سجل التتويج الرسمي يكفي" };
    }
  },
});
