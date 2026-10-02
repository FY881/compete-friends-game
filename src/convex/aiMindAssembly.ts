import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🏛️ جولة التوسيع 9 — «مجالس الأحرار»: الديمقراطية الصامتة
 *
 * كل ست ساعات يُعقد مجلسان من مجالس الأحرار:
 *   · مجلس الأُفق: يقرأ أحكام المستكشفين (agentFrontiers) ويصوّت على
 *     «ماذا نفعل بالمجال الخامل؟»
 *   · مجلس الصيانة: يقرأ الأخطاء الحرّة والعناقيد غير المشخّصة ويصوّت
 *     على أولوية المعالجة.
 *
 * كل وكيل حرّ حيّ صوته موزون بعدد ملاحظاته (من راقب أكثر اشتدّ قوله)،
 * والقرار يُسجَّل بالأغلبية مع النصاب — بلا أي أمر من أحد.
 * ═══════════════════════════════════════════════════════════════════════
 */

const DAY = 86_400_000;

/** اختيار عشوائي حتمي من «صوت» الوكيل — نفس الوكيل يصوّت بنفس النمط. */
function voteOf(name: string, seed: string): "yes" | "no" | "abstain" {
  let h = 2166136261;
  const s = name + "::" + seed;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const r = (h >>> 0) % 100;
  if (r < 55) return "yes";
  if (r < 85) return "no";
  return "abstain";
}

/** عقد جلسة واحدة وتسجيلها. */
async function holdSession(
  ctx: MutationCtx,
  seat: string,
  topic: string,
  proposal: string,
  basis: string,
  now: number,
): Promise<void> {
  const voters = await ctx.db
    .query("freeAgents")
    .withIndex("by_active", (q) => q.eq("active", true))
    .take(220); // عيّنة عادلة من الأحياء

  let yes = 0;
  let no = 0;
  let abstain = 0;
  for (const a of voters) {
    const v = voteOf(a.name, seat + topic);
    const w = 1 + Math.min(4, Math.floor((a.observations ?? 0) / 5)); // وزن الخبرة 1-5
    if (v === "yes") yes += w;
    else if (v === "no") no += w;
    else abstain += w;
  }
  const quorum = Math.max(20, Math.floor(voters.length * 0.6));
  const total = yes + no + abstain;
  const reached = total >= quorum;
  const passed = reached ? yes > no : undefined;

  const resolution = !reached
    ? "لم يتحقق النصاب — أعيدت الجلسة إلى الأحرار بلا قرار."
    : passed
      ? `قرار المجلس بالأغلبية (${yes} مقابل ${no}): ${topic}`
      : `رفض المجلس الاقتراح (${no} مقابل ${yes}) — استمر الوضع كما هو.`;

  await ctx.db.insert("agentAssemblies", {
    topic,
    proposal,
    basis,
    yes,
    no,
    abstain,
    votersCount: voters.length,
    quorum,
    reached,
    resolution,
    passed,
    seatName: seat,
    createdAt: now,
  });
}

/** نبضة المجالس — كل 6 ساعات عبر aiCron. */
export const assemblyPulse = internalMutation({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    const now = Date.now();
    // جلسة واحدة لكل نبضة لكل مجلس — منع التكرار
    const recent = await ctx.db
      .query("agentAssemblies")
      .withIndex("by_created", (q) => q.gte("createdAt", now - 3 * 3600_000))
      .collect();
    const done = new Set(recent.map((r) => r.seatName));

    // ── مجلس الأُفق: ماذا نفعل بالمجال الخامل؟ ──
    if (!done.has("مجلس الأُفق")) {
      const frontiers = await ctx.db
        .query("agentFrontiers")
        .withIndex("by_created")
        .order("desc")
        .take(30);
      const dormant = frontiers.find((f) => f.verdict === "خامل");
      if (dormant) {
        await holdSession(
          ctx,
          "مجلس الأُفق",
          `إحياء المجال الخامل: ${dormant.domainLabel}`,
          `رصد المستكشفون خمولاً في ${dormant.domainLabel} (${dormant.signals} إشارة فقط). يقترح المجلس تكثيف الرصد فيه وزرع مستكشفين إضافيين.`,
          `أحدث رصد: ${dormant.insight}`,
          now,
        );
      } else if (frontiers.length > 0) {
        const top = frontiers[0];
        await holdSession(
          ctx,
          "مجلس الأُفق",
          `تثبيت التميّز في: ${top.domainLabel}`,
          `المجال الأكثر حيوية الآن (${top.signals} إشارة). يقترح المجلس اعتماده مرجعاً لقياس بقية المجالات.`,
          top.insight,
          now,
        );
      }
    }

    // ── مجلس الصيانة: أولوية معالجة الأخطاء ──
    if (!done.has("مجلس الصيانة")) {
      const criticals = await ctx.db
        .query("errorLogs")
        .withIndex("by_created", (q) => q.gte("createdAt", now - DAY))
        .take(200);
      const open = criticals.filter((e) => !e.resolved);
      const hot = open.filter((e) => e.severity === "high" || e.severity === "critical");
      if (hot.length > 0) {
        await holdSession(
          ctx,
          "مجلس الصيانة",
          `معالجة فورية لـ ${hot.length} خطأً حرّاً غير محلول`,
          "يقترح المجلس إعطاء الأخطاء الحرّة أولوية معالجة قصوى في النبضة القادمة.",
          `من أصل ${open.length} خطأ غير محلول آخر 24 ساعة.`,
          now,
        );
      } else {
        await holdSession(
          ctx,
          "مجلس الصيانة",
          "الإبقاء على الهدوء الصحي الحالي",
          "لا أخطاء حرّة غير محلولة. يقترح المجلس الاستمرار في الفحص الدوري دون تدخل إضافي.",
          `${open.length} خطأ غير محلول فقط آخر 24 ساعة — كلها غير حرّة.`,
          now,
        );
      }
    }

    // تنظيف: أرشيف 7 أيام فقط
    const old = await ctx.db
      .query("agentAssemblies")
      .withIndex("by_created", (q) => q.lt("createdAt", now - 7 * DAY))
      .take(40);
    for (const o of old) await ctx.db.delete(o._id);

    return null;
  },
});

/** سجل المداولات للعرض. */
export const getMindAssembly = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("agentAssemblies")
      .withIndex("by_created")
      .order("desc")
      .take(12);
    const stats = {
      sessions: rows.length,
      passed: rows.filter((r) => r.passed === true).length,
      rejected: rows.filter((r) => r.passed === false).length,
      noQuorum: rows.filter((r) => !r.reached).length,
    };
    return { rows, stats };
  },
});
