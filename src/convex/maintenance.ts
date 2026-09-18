import { internalMutation, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
// eslint-disable-next-line no-restricted-imports

/**
 * 🧹 نظام AI للصيانة الذاتية — يعمل كل 24 ساعة
 * يحذف السجلات القديمة والمتنامية من كل الجداول الكبيرة
 * للحفاظ على التخزين وسرعة الاستعلامات وتقليل استهلاك crons.
 *
 * مدة الاحتفاظ: 7 أيام للسجلات التشغيلية، 30 يوماً للأخطاء.
 * كل حذف يُقتطع بحد أقصى لكل جدول حتى لا تتجاوز الدورة حدود الخطة.
 */

const OPS_RETENTION_DAYS = 7; // سجلات تشغيلية (قرارات، أنشطة، بلاغات)
const ERR_RETENTION_DAYS = 14; // أخطاء العميل
const BATCH = 400; // سقف حذف لكل جدول في الدورة الواحدة

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🎯 مدد الاحتفاظ لجداول **النمو** — العلاج الجذري لاستهلاك Database I/O
 * ═══════════════════════════════════════════════════════════════════════
 *
 * الحقيقة المقيسة من لوحة Convex: المتجاوز لم يكن استدعاءات الدوال
 * (٨٥ ألف من مليون = ٨٫٥٪) بل **Database I/O: ٣٫٥٥GB من ١GB**.
 *
 * وسببه بنيوي: جدول `games` (وكل غرفة تُنشأ تبقى فيه للأبد) كان يُقرأ
 * كاملاً في ٤٠ استعلاماً، وبعده `gamePlayers` و`chatMessages`. ومعنى
 * «استعلام» هنا اشتراك تفاعلي: يُعاد تشغيله عند **كل كتابة** على الجدول،
 * لكل لاعب مشترك. فكل غرفة قديمة منتهية تُكلّف قراءة متكررة للأبد.
 *
 * الحل: الاحتفاظ بما له قيمة (تاريخ اللاعب في gameHistory محفوظ) وحذف
 * الغرف المنتهية والرسائل القديمة — فتنكمش كل عمليات المسح تلقائياً.
 */
const GAME_RETENTION_DAYS = 3; // الغرف المنتهية
const LOBBY_RETENTION_DAYS = 1; // غرف لم تبدأ أصلاً (مهجورة)
const CHAT_RETENTION_DAYS = 14;
const ADMIN_REPORT_RETENTION_DAYS = 30;
const MEMBERSHIP_EVENT_RETENTION_DAYS = 90;
const BOOST_RETENTION_DAYS = 30; // ترقيات منتهية
const LEDGER_RETENTION_DAYS = 120; // سجل الولاء القديم فقط

function cutoff(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

/** يحذف دفعة واحدة من جدول بمؤشر زمني ويعيد عدد المحذوف */
async function pruneByIndex(
  ctx: any,
  table: string,
  index: string,
  field: string,
  before: number,
): Promise<number> {
  const docs = await ctx.db
    .query(table as never)
    .withIndex(index as never, (q: any) => q.lt(field, before))
    .take(BATCH);
  for (const d of docs) await ctx.db.delete(d._id);
  return docs.length;
}

/**
 * يحذف حتى `max` صفاً على دفعات متتالية — لتفريغ الجداول ذات التراكم
 * الكبير (مثل مقاييس الأداء التي كان كل تبويب مفتوح يكتب فيها).
 */
async function pruneDeep(
  ctx: any,
  table: string,
  index: string,
  field: string,
  before: number,
  max: number,
): Promise<number> {
  let deleted = 0;
  while (deleted < max) {
    const n = await pruneByIndex(ctx, table, index, field, before);
    deleted += n;
    if (n < BATCH) break; // الجدول لم يعد يحوي صفوفاً قديمة
  }
  return deleted;
}

/**
 * 🎮 حذف الغرف المنتهية/المهجورة مع صفوف لاعبيها.
 * قراءة **مفهرسة محدودة** (by_status_created) — لا مسح للجدول.
 */
async function pruneGames(
  ctx: any,
  status: "finished" | "waiting",
  before: number,
  max: number,
): Promise<{ games: number; players: number }> {
  let games = 0;
  let players = 0;
  while (games < max) {
    const rows = await ctx.db
      .query("games")
      .withIndex("by_status_created", (q: any) =>
        q.eq("status", status).lt("createdAt", before),
      )
      .take(60);
    if (rows.length === 0) break;

    for (const game of rows) {
      const seats = await ctx.db
        .query("gamePlayers")
        .withIndex("by_game", (q: any) => q.eq("gameId", game._id))
        .take(24);
      for (const seat of seats) {
        await ctx.db.delete(seat._id);
        players += 1;
      }
      await ctx.db.delete(game._id);
      games += 1;
    }
    if (rows.length < 60) break;
  }
  return { games, players };
}

/**
 * يحذف الرسائل القديمة غير المثبّتة فقط.
 * إن كانت كلها مثبّتة يتوقّف فوراً — فلا حلقة لا نهائية ولا حذف مهم.
 */
async function pruneChatMessages(ctx: any, before: number, max: number): Promise<number> {
  let deleted = 0;
  while (deleted < max) {
    const rows = await ctx.db
      .query("chatMessages")
      .withIndex("by_created", (q: any) => q.lt("createdAt", before))
      .take(200);
    if (rows.length === 0) break;
    let removedHere = 0;
    for (const m of rows) {
      if (m.pinned) continue;
      await ctx.db.delete(m._id);
      deleted += 1;
      removedHere += 1;
    }
    if (removedHere === 0 || rows.length < 200) break;
  }
  return deleted;
}

export const pruneAll = internalMutation({
  handler: async (ctx) => await pruneBody(ctx),
});

/**
 * 👑 تشغيل التنظيف يدوياً من غرفة المالك — بلا انتظار الدورة اليومية.
 * مفيد بعد موجة ضخمة من الغرف أو الرسائل: يقلص الجداول فوراً فتقل قراءات
 * كل الاستعلامات التفاعلية تبعاً لذلك (العلاقة مباشرة مع Database I/O).
 */
export const pruneNowByOwner = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("يجب تسجيل الدخول.");
    const me = (await ctx.db.get(userId)) as { role?: string; email?: string } | null;
    if (!me || (me.role !== "admin" && me.email !== "omw70op@gmail.com")) {
      throw new Error("غرفة المالك فقط.");
    }
    return await pruneBody(ctx);
  },
});

async function pruneBody(ctx: any) {
  {
    const opsBefore = cutoff(OPS_RETENTION_DAYS);
    const errBefore = cutoff(ERR_RETENTION_DAYS);
    const stats: Record<string, number> = {};

    // ── سجلات تشغيلية (أقدم من 7 أيام) ──
    stats.aiDecisionLog = await pruneByIndex(ctx, "aiDecisionLog", "by_created", "createdAt", opsBefore);
    stats.aiLogs = await pruneByIndex(ctx, "aiLogs", "by_timestamp", "timestamp", opsBefore);
    stats.moderationLogs = await pruneByIndex(ctx, "moderationLogs", "by_created", "createdAt", opsBefore);
    stats.auditLog = await pruneByIndex(ctx, "auditLog", "by_created", "at", opsBefore);
    stats.fairPlayLog = await pruneByIndex(ctx, "fairPlayLog", "by_at", "at", opsBefore);
    stats.mindHonorLog = await pruneByIndex(ctx, "mindHonorLog", "by_created", "createdAt", opsBefore);
    stats.membershipLogs = await pruneByIndex(ctx, "membershipLogs", "by_created", "at", opsBefore);
    stats.assistantLogs = await pruneByIndex(ctx, "assistantLogs", "by_created", "at", opsBefore);
    stats.apiCallLogs = await pruneByIndex(ctx, "apiCallLogs", "by_created", "createdAt", opsBefore);

    // ── مقاييس الأداء (أقدم من 24 ساعة) — تفريغ عميق ──
    // أكبر جدول حقيقي متنامٍ: كل تبويب مفتوح كان يكتب فيه كل ٣٠ ثانية.
    // التنظيف هنا (مرة واحدة يومياً) بدلاً من داخل كل كتابة — يوفّر
    // آلاف عمليات قاعدة البيانات يومياً ويحفظ التخزين والحصة.
    stats.performanceMetrics = await pruneDeep(
      ctx,
      "performanceMetrics",
      "by_time",
      "recordedAt",
      cutoff(1),
      4000,
    );

    // ═══════════════════════════════════════════════════════════════════
    // 🎯 العلاج الجذري لـ Database I/O: جداول النمو المتنامية
    // ═══════════════════════════════════════════════════════════════════

    // ── الغرف: المنتهية (٣ أيام) والمهجورة بلا بدء (يوم) ──
    const finished = await pruneGames(ctx, "finished", cutoff(GAME_RETENTION_DAYS), 300);
    const abandoned = await pruneGames(ctx, "waiting", cutoff(LOBBY_RETENTION_DAYS), 120);
    stats.finishedGames = finished.games;
    stats.abandonedLobbies = abandoned.games;
    stats.gamePlayers = finished.players + abandoned.players;

    // ── رسائل الدردشة القديمة (غير المثبّتة) ──
    stats.chatMessages = await pruneChatMessages(ctx, cutoff(CHAT_RETENTION_DAYS), 800);

    // ── تقارير الإدارة القديمة ──
    stats.adminReports = await pruneByIndex(
      ctx,
      "adminReports",
      "by_created",
      "createdAt",
      cutoff(ADMIN_REPORT_RETENTION_DAYS),
    );

    // ── سجل أحداث العضوية (كان ينمو بلا حدّ) ──
    stats.membershipEvents = await pruneByIndex(
      ctx,
      "membershipEvents",
      "by_at",
      "at",
      cutoff(MEMBERSHIP_EVENT_RETENTION_DAYS),
    );

    // ── الترقيات المؤقتة المنتهية والعروض المستهلكة ──
    stats.membershipBoosts = await pruneByIndex(
      ctx,
      "membershipBoosts",
      "by_expiry",
      "expiresAt",
      cutoff(BOOST_RETENTION_DAYS),
    );
    stats.renewalOffers = await pruneByIndex(
      ctx,
      "renewalOffers",
      "by_expiry",
      "expiresAt",
      cutoff(BOOST_RETENTION_DAYS),
    );

    // ── سجل الولاء القديم (يبقى ٤ أشهر كاملة للشفافية) ──
    stats.loyaltyLedger = await pruneByIndex(ctx, "loyaltyLedger", "by_at", "at", cutoff(LEDGER_RETENTION_DAYS));

    // ── أخطاء العميل ──
    stats.clientErrors = await pruneByIndex(ctx, "clientErrors", "by_last", "lastSeen", errBefore);
    stats.errorLogs = await pruneByIndex(ctx, "errorLogs", "by_created", "createdAt", errBefore);

    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    return { deleted: total, stats, opsBefore, errBefore };
  }
}

// حافظ على الدالة القديمة للتوافق
export const pruneOldLogs = pruneAll;

/** تشغيل التنظيف الآن عبر CLI: bunx convex run maintenance:runPrune */
export const runPrune = action({
  args: {},
  handler: async (ctx): Promise<{ deleted: number; stats: Record<string, number> }> => {
    const res: { deleted: number; stats: Record<string, number> } = await ctx.runMutation(
      internal.maintenance.pruneAll as never,
      {},
    ) as never;
    console.log("🧹 pruneAll:", JSON.stringify(res));
    return res;
  },
});
