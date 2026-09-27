import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { callLlm, getOpenRouterKey } from "./aiConfig";
import { internal } from "./_generated/api";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * ⚔️ الحرب الكبرى (Mind War) — الأداة 23 في حرب العقول
 * ═══════════════════════════════════════════════════════════════════════
 *
 * أول تجربة جماعية متزامنة تشمل المجتمع كله: كل بصمات العقول تُجنَّد
 * آلياً في جيشين كونيين وفق **طبيعة عقلكم العميقة**:
 *
 *   ⚡ عقول البرق — من يفكّر بسرعة البرق (وسط زمن إجابته < 6 ثوانٍ)
 *   🛡️ عقول العزائم — المتقنون المتروّون (وسط زمن إجابته 6 ثوانٍ+)
 *
 *   1) 🪖 التجنيد الآلي: من الإجابات الحقيقية في gamePlayers يُحسب
 *      الوسيط الزمني لكل عقل، وتُقسم الجيوش بلا استثناء ولا محاباة.
 *   2) 🔫 الذخيرة الحية: كل إجابة صحيحة لأي مجند أثناء الحرب = طلقة
 *      لجيشه، وكل جولة مكسورة = قذيفة مزدوجة. الجبهة تتحرك بأرقام
 *      حية — لا تصويت، لا رأي، أثرُ لعبكم هو الحرب نفسها.
 *   3) 📡 تقارير المراسل: بث يومي مراسَل بالذكاء يصف حالة الجبهة
 *      (وبديل محلي من الأرقام نفسها).
 *   4) 🏆 التسوية: بعد 3 أيام يفوز الجيش الأكثر ذخيرة — غنيمة 80 ولاء
 *      لكل مجند منتصر، +30 لثلة أفضل عقول الجيش، وإعلان نصر للجميع.
 * ═══════════════════════════════════════════════════════════════════════
 */

const DAY = 24 * 3600_000;
const WAR_DAYS = 3;
const COOLDOWN_DAYS = 2;
const WIN_SPOILS = 80;
const MVP_SPOILS = 30;
const MIN_SAMPLE = 8; // إجابات كافية لتحديد طبيعة العقل
const MIN_PER_ARMY = 2;
const REPORT_INTERVAL = 20 * 3600_000;
const SWEEP_HISTORY = 800;

const ARMY_A = { name: "عقول البرق", emoji: "⚡" };
const ARMY_B = { name: "عقول العزائم", emoji: "🛡️" };

type WarDoc = Doc<"mindWars">;
type SoldierDoc = Doc<"warSoldiers">;

// ═══════════════════════════════════════════════════════════════════════
// 0) أدوات مساندة
// ═══════════════════════════════════════════════════════════════════════

function medianOf(nums: number[]): number {
  if (nums.length === 0) return 8000;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function armyOf(medianMs: number): "A" | "B" {
  return medianMs < 6000 ? "A" : "B";
}

function clampFront(totalA: number, totalB: number): number {
  return Math.max(-100, Math.min(100, Math.round(((totalA - totalB) / Math.max(1, totalA + totalB)) * 200)));
}

async function grantLoyalty(ctx: MutationCtx, userId: Id<"users">, amount: number, reason: string): Promise<void> {
  const now = Date.now();
  const wr = await ctx.db
    .query("loyaltyWallets")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(1);
  if (wr[0]) {
    await ctx.db.patch(wr[0]._id, { points: wr[0].points + amount, updatedAt: now });
  } else {
    await ctx.db.insert("loyaltyWallets", {
      userId,
      points: amount,
      lifetimeEarned: amount,
      perks: [],
      updatedAt: now,
    });
  }
  await ctx.db.insert("loyaltyLedger", { userId, delta: amount, reason, at: now });
}

// ═══════════════════════════════════════════════════════════════════════
// 1) قراءة الحرب (الواجهة): الحرب الحية + موقعك + أفضل العقول + التاريخ
// ═══════════════════════════════════════════════════════════════════════

export type WarView = {
  war: WarDoc | null;
  mySoldier: SoldierDoc | null;
  top: Array<{ _id: string; name: string; army: string; rounds: number; bonusRounds: number; mvp?: boolean }>;
  past: WarDoc[];
};

export const getWar = query({
  handler: async (ctx): Promise<WarView> => {
    const userId = await getAuthUserId(ctx);
    const active = await ctx.db
      .query("mindWars")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(1);
    const war = active[0] ?? null;

    let mySoldier: SoldierDoc | null = null;
    if (userId && war) {
      const mine = await ctx.db
        .query("warSoldiers")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(10);
      mySoldier = mine.find((s) => s.warId === war._id) ?? null;
    }

    const top: WarView["top"] = war
      ? (await ctx.db
          .query("warSoldiers")
          .withIndex("by_war", (q) => q.eq("warId", war._id))
          .take(500))
          .sort((a, b) => b.rounds + b.bonusRounds - (a.rounds + a.bonusRounds))
          .slice(0, 8)
          .map((s) => ({
            _id: String(s._id),
            name: s.name,
            army: s.army,
            rounds: s.rounds,
            bonusRounds: s.bonusRounds,
            mvp: s.mvp,
          }))
      : [];

    const past = war
      ? []
      : (await ctx.db
          .query("mindWars")
          .withIndex("by_status", (q) => q.eq("status", "settled"))
          .order("desc")
          .take(5));

    return { war, mySoldier, top, past };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 2) التجنيد وإعلان الحرب
// ═══════════════════════════════════════════════════════════════════════

export const enlistWar = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    const me = await ctx.db.get(userId);
    if (!me) throw new Error("غير مصرح");

    const active = await ctx.db
      .query("mindWars")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(1);
    if (active[0]) throw new Error("الحرب الكبرى مشتعلة بالفعل — انظر الجبهة!");

    // فترة راحة بين الحروب
    const recent = await ctx.db
      .query("mindWars")
      .withIndex("by_status", (q) => q.eq("status", "settled"))
      .order("desc")
      .take(3);
    const lastSettled = recent.find((w) => w.settledAt);
    if (lastSettled?.settledAt && Date.now() - lastSettled.settledAt < COOLDOWN_DAYS * DAY) {
      throw new Error("الجيوش ترتاح بعد الحرب الأخيرة — عُد بعد انتهاء فترة الراحة.");
    }

    // بناء بصمات السرعة من الإجابات الحقيقية
    const rows = await ctx.db.query("gamePlayers").take(4000);
    type Acc = { name: string; times: number[] };
    const byUser = new Map<string, Acc>();
    for (const row of rows) {
      const answers = (row.answers ?? []).filter((a): a is NonNullable<typeof a> => a !== null);
      if (answers.length < 3) continue;
      let acc = byUser.get(String(row.userId));
      if (!acc) {
        acc = { name: row.name ?? "لاعب", times: [] };
        byUser.set(String(row.userId), acc);
      }
      for (const a of answers) if (a.elapsedMs > 0) acc.times.push(a.elapsedMs);
    }

    type Conscript = { userId: Id<"users">; name: string; medianMs: number; army: "A" | "B" };
    const armyA: Conscript[] = [];
    const armyB: Conscript[] = [];
    for (const [uid, acc] of byUser) {
      if (acc.times.length < MIN_SAMPLE) continue;
      const medianMs = medianOf(acc.times);
      const entry: Conscript = {
        userId: uid as Id<"users">,
        name: acc.name,
        medianMs: Math.round(medianMs),
        army: armyOf(medianMs),
      };
      (entry.army === "A" ? armyA : armyB).push(entry);
    }
    if (armyA.length < MIN_PER_ARMY || armyB.length < MIN_PER_ARMY) {
      throw new Error("الجيوش غير متكافئة بعد — يحتاج المجتمع عقولاً من الطرفين (8+ إجابات لكل مجند).");
    }

    const now = Date.now();
    const warId = await ctx.db.insert("mindWars", {
      armyAName: ARMY_A.name,
      armyAEmoji: ARMY_A.emoji,
      armyBName: ARMY_B.name,
      armyBEmoji: ARMY_B.emoji,
      soldierCount: armyA.length + armyB.length,
      front: 0,
      totalRoundsA: 0,
      totalRoundsB: 0,
      reports: [],
      status: "active" as const,
      startedAt: now,
      endsAt: now + WAR_DAYS * DAY,
    });

    for (const c of [...armyA, ...armyB]) {
      await ctx.db.insert("warSoldiers", {
        warId,
        userId: c.userId,
        name: c.name,
        army: c.army,
        medianMs: c.medianMs,
        rounds: 0,
        bonusRounds: 0,
      });
    }

    await ctx.db.insert("aiDecisionLog", {
      system: "mind_war",
      actorName: "الحرب الكبرى",
      action: "war_declared",
      targetId: String(userId),
      targetName: me.name ?? "لاعب",
      detail: `أُعلنت الحرب: ${armyA.length} عقل برق ⚡ مقابل ${armyB.length} عقل عزائم 🛡️ — الحسم بعد ${WAR_DAYS} أيام`,
      severity: "medium",
      createdAt: now,
    });

    const myMedian =
      [...armyA, ...armyB].find((c) => String(c.userId) === String(userId))?.medianMs ?? null;
    return {
      ok: true as const,
      armyA: armyA.length,
      armyB: armyB.length,
      myArmy: myMedian === null ? null : armyOf(myMedian),
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 3) مسح الذخيرة الحية + تقارير المراسل
// ═══════════════════════════════════════════════════════════════════════

function localReport(war: WarDoc, topName: string | null): string {
  const lead =
    war.front > 15
      ? `${war.armyAEmoji} ${war.armyAName} تزحف على الجبهة`
      : war.front < -15
        ? `${war.armyBEmoji} ${war.armyBName} تزحف على الجبهة`
        : "الجبهة شبه متوازنة — من يتراجع الآن يخسر الساحة";
  return (
    `📡 ${lead} (${war.front > 0 ? "+" : ""}${war.front}). ` +
    `ذخيرة البرق ${war.totalRoundsA} مقابل ذخيرة العزائم ${war.totalRoundsB}. ` +
    (topName ? `أشرس عقول الجبهة حالياً: «${topName}». ` : "") +
    `الحسم بعد ${Math.max(0, Math.ceil((war.endsAt - Date.now()) / DAY))} يوم.`
  );
}

export const sweepNow = internalMutation({
  handler: async (ctx): Promise<{ swept: number; reported: boolean }> => {
    const now = Date.now();
    const active = await ctx.db
      .query("mindWars")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(1);
    const war = active[0];
    if (!war) return { swept: 0, reported: false };

    const soldiers = await ctx.db
      .query("warSoldiers")
      .withIndex("by_war", (q) => q.eq("warId", war._id))
      .take(500);
    const byUser = new Map(soldiers.map((s) => [String(s.userId), s]));

    // الذخيرة الحية: إجابات حقيقية منذ بدء الحرب
    const history = await ctx.db
      .query("gameHistory")
      .withIndex("by_played", (q) => q.gt("playedAt", war.startedAt))
      .order("desc")
      .take(SWEEP_HISTORY);

    type Delta = { rounds: number; bonus: number };
    const deltas = new Map<string, Delta>();
    let addA = 0;
    let addB = 0;
    let swept = 0;
    for (const h of history) {
      const soldier = byUser.get(String(h.userId));
      if (!soldier) continue;
      const key = String(soldier._id);
      const d = deltas.get(key) ?? { rounds: 0, bonus: 0 };
      const correct = h.correctCount ?? 0;
      d.rounds += correct;
      if (h.won) d.bonus += 2;
      deltas.set(key, d);
      if (soldier.army === "A") addA += correct + (h.won ? 2 : 0);
      else addB += correct + (h.won ? 2 : 0);
      swept += 1;
    }

    for (const [key, d] of deltas) {
      const sid = key as Id<"warSoldiers">;
      const soldier = soldiers.find((s) => String(s._id) === key);
      if (!soldier) continue;
      await ctx.db.patch(sid, {
        rounds: soldier.rounds + d.rounds,
        bonusRounds: soldier.bonusRounds + d.bonus,
      });
    }

    const totalRoundsA = war.totalRoundsA + addA;
    const totalRoundsB = war.totalRoundsB + addB;
    const front = clampFront(totalRoundsA, totalRoundsB);

    // تقارير المراسل — كل 20 ساعة
    let reports = war.reports;
    let reported = false;
    const lastReport = reports[reports.length - 1];
    if (!lastReport || now - lastReport.at >= REPORT_INTERVAL) {
      const top = [...soldiers].sort(
        (a, b) =>
          b.rounds + b.bonusRounds + (deltas.get(String(b._id))?.rounds ?? 0) + (deltas.get(String(b._id))?.bonus ?? 0) -
          (a.rounds + a.bonusRounds + (deltas.get(String(a._id))?.rounds ?? 0) + (deltas.get(String(a._id))?.bonus ?? 0)),
      )[0];
      const warLike: WarDoc = { ...war, totalRoundsA, totalRoundsB, front };
      let text = localReport(warLike, top?.name ?? null);
      let engine = "local";
      if (getOpenRouterKey()) {
        try {
          const raw = await callLlm(
            [
              {
                role: "system",
                content:
                  "أنت مراسل حربي ميداني في لعبة أسئلة عربية. اكتب بثاً إذاعياً من 3 أسطر: حالة الجبهة بالأرقام، إشادة بأشرس عقول اليوم، ونداء للحسم. حيوي وموجز بلا مبالغة ساقطة.",
              },
              {
                role: "user",
                content: JSON.stringify({
                  جيش_برق: war.armyAName,
                  جيش_عزائم: war.armyBName,
                  الجبهة: front,
                  ذخيرة_برق: totalRoundsA,
                  ذخيرة_عزائم: totalRoundsB,
                  أشرس_عقل: top?.name ?? "—",
                  أيام_للحسم: Math.max(0, Math.ceil((war.endsAt - now) / DAY)),
                }),
              },
            ],
            220,
            0.85,
            "MindClash War Correspondent",
          );
          const clean = raw.trim().slice(0, 420);
          if (clean.length > 40) {
            text = clean;
            engine = "llm";
          }
        } catch {
          /* البديل المحلي يكفي */
        }
      }
      reports = [...reports, { at: now, text, engine }].slice(-10);
      reported = true;
    }

    await ctx.db.patch(war._id, { totalRoundsA, totalRoundsB, front, reports });
    return { swept, reported };
  },
});

/** تحديث فوري من زر الواجهة (يدخل عبر internal) */
export const refreshNow = mutation({
  handler: async (ctx): Promise<{ swept: number; reported: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("غير مصرح");
    return (await ctx.runMutation(internal.aiWar.sweepNow, {})) as unknown as { swept: number; reported: boolean };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// 4) التسوية والغنائم
// ═══════════════════════════════════════════════════════════════════════

export const settleDue = internalMutation({
  handler: async (ctx): Promise<{ settled: number; winner: string | null }> => {
    const now = Date.now();
    const active = await ctx.db
      .query("mindWars")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(5);
    const due = active.filter((w) => w.endsAt <= now);
    let winner: string | null = null;

    for (const war of due) {
      const soldiers = await ctx.db
        .query("warSoldiers")
        .withIndex("by_war", (q) => q.eq("warId", war._id))
        .take(500);
      const totalA = war.totalRoundsA;
      const totalB = war.totalRoundsB;
      const result: "A" | "B" | "draw" = totalA === totalB ? "draw" : totalA > totalB ? "A" : "B";

      if (result !== "draw") {
        const winners = soldiers.filter((s) => s.army === result);
        for (const s of winners) {
          await grantLoyalty(ctx, s.userId, WIN_SPOILS, `غنيمة انتصار الحرب الكبرى (${result === "A" ? war.armyAName : war.armyBName})`);
        }
        // ثلة أفضل العقول: أفضل 3 في جيش المنتصر
        const mvpIds = new Set(
          [...winners]
            .sort((a, b) => b.rounds + b.bonusRounds - (a.rounds + a.bonusRounds))
            .slice(0, 3)
            .map((s) => String(s._id)),
        );
        for (const s of winners) {
          if (!mvpIds.has(String(s._id))) continue;
          await grantLoyalty(ctx, s.userId, MVP_SPOILS, "ثلة أفضل عقول الحرب الكبرى");
          await ctx.db.patch(s._id, { mvp: true });
        }
        winner = result === "A" ? war.armyAName : war.armyBName;
      } else {
        winner = "تعادل كوني";
      }

      const winName = result === "A" ? war.armyAName : result === "B" ? war.armyBName : "لا أحد";
      const winEmoji = result === "A" ? war.armyAEmoji : result === "B" ? war.armyBEmoji : "🌫️";
      await ctx.db.insert("announcements", {
        title: `⚔️ انتهت الحرب الكبرى: نصر ${winName} ${winEmoji}`,
        body: `بعد ${WAR_DAYS} أيام من القصف المعرفي، حسمت الذخيرة الحية المعركة: ${war.armyAName} ${war.totalRoundsA} مقابل ${war.armyBName} ${war.totalRoundsB}. ${result === "draw" ? "التعادل كوني — لا غنائم ولا خسارة." : `غنيمة ${WIN_SPOILS} ولاء لكل مجند منتصر، و${MVP_SPOILS} إضافية لأفضل ثلاثة عقول.`}`,
        active: true,
        priority: "medium",
        createdAt: now,
      });

      for (const s of soldiers) {
        if (s.mvp) continue;
        await ctx.db.patch(s._id, {});
      }

      await ctx.db.patch(war._id, {
        status: "settled" as const,
        winner: result,
        settledAt: now,
      });

      await ctx.db.insert("aiDecisionLog", {
        system: "mind_war",
        actorName: "الحرب الكبرى",
        action: "war_settled",
        targetName: winName,
        detail: `${winEmoji} ${winName} حسمت الحرب — ذخيرة ${war.totalRoundsA}:${war.totalRoundsB} من ${war.soldierCount} مجند`,
        severity: "medium",
        createdAt: now,
      });
    }
    return { settled: due.length, winner };
  },
});

export const warJob = internalMutation({
  handler: async (ctx): Promise<unknown> => {
    const sweep = (await ctx.runMutation(internal.aiWar.sweepNow, {})) as unknown;
    const settle = (await ctx.runMutation(internal.aiWar.settleDue, {})) as unknown;
    return { sweep, settle };
  },
});
