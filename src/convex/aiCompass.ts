import { v } from "convex/values";
import { internalMutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🧭 بوصلة العقول (Minds Compass) — الأداة 26 في حرب العقول
 * ═══════════════════════════════════════════════════════════════════════
 *
 * 25 أداة حربية صنعت مشكلة جديدة: «ماذا أفعل الآن؟». البوصلة تمسح
 * كل الأنظمة الحية لحظياً وتصطفّ **أهم 3 حركات لك الآن**:
 *
 *   🩸 عاجل: مبارزة شبح تتناثر، نزال يوشك على الحكم بلا إعلان،
 *           رهان قدر يوشك على ابتلاع ولائك، جيش حرب لم تطلق طلقة
 *   🌤️ مهم: خطة حرب تنتظر تدريب فئاتها، قطاع تحالف ينتظر تغطيتك،
 *           دعوى محكمة تنتظر تسريع حكمها
 *   🌟 فرصة: استدعاء شبح جديد، تسجيل التحالف في الكأس
 *
 * كل حركة بمبرر وهدف وموعد أقصى — وزر «توجّه الآن» يفتح الأداة
 * الصحيحة مباشرة. مسح دوري يُخزّن لقطة للاعبين النشطين، والقراءة
 * الحية تحسب فوراً إن كانت اللقطة أقدم من 10 دقائق.
 * ═══════════════════════════════════════════════════════════════════════
 */

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const CACHE_TTL = 10 * 60_000;

export type CompassMove = {
  rank: number;
  title: string;
  detail: string;
  reason: string;
  target: string; // معرف تبويب سطح الأنظمة
  emoji: string;
  urgency: "high" | "medium" | "low";
  deadline?: number;
};

type DbCtx = QueryCtx | MutationCtx;

const URGENCY_WEIGHT: Record<CompassMove["urgency"], number> = { high: 0, medium: 1, low: 2 };

// ═══════════════════════════════════════════════════════════════════════
// محرك المسح — يقرأ كل الأنظمة الحية من فهارسها
// ═══════════════════════════════════════════════════════════════════════

async function computeMoves(ctx: DbCtx, userId: Id<"users">): Promise<CompassMove[]> {
  const now = Date.now();
  const moves: CompassMove[] = [];
  const push = (m: Omit<CompassMove, "rank">) => moves.push(m as CompassMove);

  // 👻 مبارزة شبح حية توشك على التلاشي (15 دقيقة)
  const ghosts = await ctx.db
    .query("ghostDuels")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(5);
  const liveDuel = ghosts.find((d) => d.status === "active" && d.expiresAt > now);
  if (liveDuel) {
    push({
      title: "أكمل مبارزة الشبح",
      detail: `أجبت ${liveDuel.myAnswered} من ${liveDuel.questions.length} — الشبح يتلاشى قريباً`,
      reason: "مبارزة حية تضيع بلا إكمال، وغنيمتها تضيع معها",
      target: "ghostduel",
      emoji: "👻",
      urgency: "high",
      deadline: liveDuel.expiresAt,
    });
  }

  // 🗡️ نزالات نقيض تُحكم خلال أقل من يوم بلا إعلانك (بصفتيك المتحدّي أو النقيض)
  const dCh = await ctx.db
    .query("rivalryDuels")
    .withIndex("by_challenger_status", (q) => q.eq("challengerId", userId).eq("status", "open"))
    .take(3);
  const dFoe = await ctx.db
    .query("rivalryDuels")
    .withIndex("by_foe_status", (q) => q.eq("foeId", userId).eq("status", "open"))
    .take(3);
  for (const d of [...dCh, ...dFoe]) {
    const mine = String(d.challengerId) === String(userId) ? d.challengerDeclared : d.foeDeclared;
    if (mine || d.judgeAt - now >= DAY) continue;
    push({
      title: "أعلن بصمتك قبل حكم النزال",
      detail: `نزالك ضد «${String(d.challengerId) === String(userId) ? d.foeName : d.challengerName}» يُحكم قريباً — الغياب يسجل عليك`,
      reason: "الحكم الآلي يقترب وإعلانك هو درعك الوحيد",
      target: "duels",
      emoji: "🗡️",
      urgency: "high",
      deadline: d.judgeAt,
    });
  }

  // 🎲 رهان قدر يُحكم خلال أقل من يوم (الابتلاع يخسر الرهان)
  const bets = await ctx.db
    .query("fateBets")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(10);
  const riskyBet = bets.find((b) => b.status === "open" && b.judgeAt - now < DAY);
  if (riskyBet) {
    push({
      title: "رهانك يوشك على الحكم",
      detail: `إن لم يتحقق هدفه يبتلع البئر ${riskyBet.stake} ولاء`,
      reason: "نافذة الوفاء تضيق — كل جولة الآن قد تنقذ رهانك",
      target: "fate",
      emoji: "🎲",
      urgency: "high",
      deadline: riskyBet.judgeAt,
    });
  }

  // ⚔️ الحرب الكبرى: أنت مجند ولم تطلق طلقة
  const war = (
    await ctx.db
      .query("mindWars")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(1)
  )[0];
  if (war) {
    const mySoldiers = await ctx.db
      .query("warSoldiers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(10);
    const mine = mySoldiers.find((s) => s.warId === war._id);
    if (mine && mine.rounds + mine.bonusRounds === 0) {
      push({
        title: `جيشك ${mine.army === "A" ? war.armyAName : war.armyBName} ينتظر سلاحك`,
        detail: "لم تُطلق طلقة واحدة في الحرب الكبرى — جولة واحدة تُحسب ذخيرة",
        reason: "حرب كونية بلا مشاركتك = جبهة تنكسر بغيابك",
        target: "mindwar",
        emoji: "⚔️",
        urgency: "high",
        deadline: war.endsAt,
      });
    }
  }

  // 🪞 خطة حرب نشطة: تدرّب فئات الفجوة قبل الحكم
  const plans = await ctx.db
    .query("warPlans")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(5);
  const activePlan = plans.find((p) => p.status === "active");
  if (activePlan) {
    push({
      title: "درّب فجوة خطة الحرب",
      detail: `10 أسئلة من «${activePlan.gapCategories[0] ?? "عام"}» تحمي نصرتك أسبوعياً`,
      reason: "الحكم الأسبوعي يقيس تحسنك الفعلي — التدريب اليوم هو الفارق",
      target: "warmirror",
      emoji: "🪞",
      urgency: "medium",
      deadline: activePlan.judgeAt,
    });
  }

  // ⚜️ تحالف توأم نشط: غطِّ قطاع الدفاع
  const alliances = await ctx.db
    .query("twinAlliances")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .take(40);
  const myAlliance = alliances.find((a) => a.aId === userId || a.bId === userId);
  if (myAlliance) {
    push({
      title: "قطاع الدفاع ينتظر تغطيتك",
      detail: `«${myAlliance.defenseSector}» بأساس ${myAlliance.defenseBase}% — تغطيتك جزء من العقيدة`,
      reason: "التخلف عن التغطية يوثّق عليك ويُسقط مجد التحالف",
      target: "twincouncil",
      emoji: "⚜️",
      urgency: "medium",
      deadline: myAlliance.judgeAt,
    });
  }

  // 🧑‍⚖️ دعوى محكمة معلقة: سرّع حكمها
  const cases = await ctx.db
    .query("courtCases")
    .withIndex("by_plaintiff", (q) => q.eq("plaintiffId", userId))
    .take(5);
  const filedCase = cases.find((c) => c.status === "filed");
  if (filedCase) {
    push({
      title: "دعواك تنتظر في المحكمة",
      detail: `طعنك على ${filedCase.respondentName} يمكن حسمه الآن بأدلته`,
      reason: "القاضي الذكي جاهز — مهلة الحكم التلقائي تعني انتظاراً بلا داعٍ",
      target: "court",
      emoji: "🧑‍⚖️",
      urgency: "medium",
    });
  }

  // 🌟 فرص (بلا ضغط زمني)
  const mate = (
    await ctx.db
      .query("mindSoulmates")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(1)
  )[0];
  if (mate && !liveDuel) {
    const lastSettled = ghosts
      .filter((d) => d.status === "settled")
      .sort((a, b) => (b.settledAt ?? 0) - (a.settledAt ?? 0))[0];
    if (!lastSettled || now - (lastSettled.settledAt ?? 0) >= 3 * HOUR) {
      push({
        title: "استدعِ شبح نقيضك",
        detail: `شبح «${mate.nemesisName}» جاهز — 7 أسئلة وغنيمة حتى 60 ولاء`,
        reason: "تدريب فوري على عقل خصمك بالضبط، وفترة الراحة انتهت",
        target: "ghostduel",
        emoji: "👻",
        urgency: "low",
      });
    }
  }
  if (mate) {
    const season = Math.floor(now / (14 * DAY));
    const cupRows = await ctx.db
      .query("cupStandings")
      .withIndex("by_season", (q) => q.eq("season", season))
      .take(150);
    if (!cupRows.some((r) => r.members.includes(String(userId)))) {
      push({
        title: "سجّل تحالفك في كأس التحالفات",
        detail: "نقاط شرفك من النزالات والخطط والتغطيات تُحسب من لحظة التسجيل",
        reason: "كل يوم بلا تسجيل هو مجد لا يُحتسب",
        target: "alliancecup",
        emoji: "🏆",
        urgency: "low",
      });
    }
  }

  const sorted = moves.sort(
    (a, b) => URGENCY_WEIGHT[a.urgency] - URGENCY_WEIGHT[b.urgency] || (a.deadline ?? Infinity) - (b.deadline ?? Infinity),
  );
  return sorted.slice(0, 3).map((m, i) => ({ ...m, rank: i + 1 }));
}

// ═══════════════════════════════════════════════════════════════════════
// قراءة البوصلة (كاش 10 دقائق + حساب حي)
// ═══════════════════════════════════════════════════════════════════════

export const getMyCompass = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { moves: [], scannedAt: null, source: "anon" as const };

    const cache = (
      await ctx.db
        .query("compassHints")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(1)
    )[0];
    if (cache && Date.now() - cache.scannedAt < CACHE_TTL) {
      return {
        moves: JSON.parse(cache.moves) as CompassMove[],
        scannedAt: cache.scannedAt,
        source: "cache" as const,
      };
    }
    const moves = await computeMoves(ctx, userId);
    return { moves, scannedAt: Date.now(), source: "live" as const };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// المهمة الدورية: تحديث لقطات اللاعبين النشطين + تقليم القديم
// ═══════════════════════════════════════════════════════════════════════

export const compassSweeper = internalMutation({
  handler: async (ctx): Promise<{ refreshed: number; pruned: number }> => {
    const now = Date.now();

    // تقليم اللقطات الأقدم من أسبوع
    const old = await ctx.db.query("compassHints").take(300);
    let pruned = 0;
    for (const row of old) {
      if (now - row.scannedAt > 7 * DAY) {
        await ctx.db.delete(row._id);
        pruned += 1;
      }
    }

    // تحديث لقطات اللاعبين النشطين (أحدث الشبكة)
    const mates = await ctx.db.query("mindSoulmates").take(30);
    let refreshed = 0;
    for (const m of mates) {
      const existing = await ctx.db
        .query("compassHints")
        .withIndex("by_user", (q) => q.eq("userId", m.userId))
        .take(1);
      if (existing[0] && now - existing[0].scannedAt < CACHE_TTL) continue; // لقطة طازجة
      const moves = await computeMoves(ctx, m.userId);
      const payload = JSON.stringify(moves);
      if (existing[0]) {
        await ctx.db.patch(existing[0]._id, { moves: payload, scannedAt: now });
      } else {
        await ctx.db.insert("compassHints", { userId: m.userId, moves: payload, scannedAt: now });
      }
      refreshed += 1;
    }
    return { refreshed, pruned };
  },
});

export const compassJob = internalMutation({
  handler: async (ctx): Promise<unknown> => {
    return (await ctx.runMutation(internal.aiCompass.compassSweeper, {})) as unknown;
  },
});
