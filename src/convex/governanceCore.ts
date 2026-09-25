export type CourtVote = "approve" | "conditional" | "reject" | "abstain";
export type CourtVerdict = "approved" | "conditional" | "rejected";

export function deriveCourtVerdict(votes: CourtVote[], totalUnits: number): CourtVerdict {
  if (totalUnits < 3) throw new Error("المحكمة غير مكتملة");
  const approvals = votes.filter((vote) => vote === "approve").length;
  const conditionals = votes.filter((vote) => vote === "conditional").length;
  if (approvals < Math.ceil(totalUnits * 0.6)) return "rejected";
  return conditionals > 0 ? "conditional" : "approved";
}

/**
 * بوابة الغرفة السرية — إلزامية ودفاعية.
 * ترتيب التسلسل: المحكمة ← نائب المالك ← المالك ← الحاكم السيادي ← فتح الغرفة.
 * لا يمكن لأي أداة أو مسار تجاوز أي مرحلة، والفجوة في أي مرحلة تُغلق البوابة.
 */
export function chamberGate(proposal: {
  status: string;
  courtVerdict?: string;
  deputyApprovedAt?: number;
  ownerApprovedAt?: number;
  governorApprovedAt?: number;
  chamberOpenedAt?: number;
}): { allowed: boolean; reason: string } {
  if (proposal.courtVerdict !== "approved") return { allowed: false, reason: "قرار المحكمة غير مكتمل" };
  if (!proposal.deputyApprovedAt) return { allowed: false, reason: "موافقة نائب المالك مطلوبة" };
  if (!proposal.ownerApprovedAt) return { allowed: false, reason: "إذن المالك الصريح مطلوب قبل أي تنفيذ" };
  if (!proposal.governorApprovedAt) return { allowed: false, reason: "موافقة الحاكم السيادي مطلوبة" };
  if (!(["joint_approved", "executing"] as string[]).includes(proposal.status) || !proposal.chamberOpenedAt) return { allowed: false, reason: "الغرفة السرية غير مفتوحة" };
  return { allowed: true, reason: "اكتمل التسلسل كاملاً" };
}

export function instrumentGate(
  proposal: Parameters<typeof chamberGate>[0] & { status: string },
): { allowed: boolean; reason: string } {
  const chamber = chamberGate(proposal);
  if (!chamber.allowed) return chamber;
  if (proposal.status !== "executing") return { allowed: false, reason: "الأداة لم تُحجز لعملية موثوقة" };
  return { allowed: true, reason: "جميع الشروط مستوفاة" };
}

/**
 * بوابة الحاكم السيادي الخاصة: هل يستطيع سحب طلبه أو تعديله؟
 * تُستخدم لتمكينه من رفض طلبه أو تعديله قبل قرار المحكمة فقط، مع تسجيل السبب.
 */
export function deputySelfReviewGate(
  proposal: { proposerRole?: string; status?: string },
  action: "amend" | "withdraw",
): { allowed: boolean; reason: string } {
  if (proposal.proposerRole !== "deputy_owner") {
    return { allowed: false, reason: "هذا الإجراء متاح فقط لطلبات نائب المالك" };
  }
  const allowedStatuses = action === "amend" ? ["court_review"] : ["court_review", "court_conditional"];
  if (!allowedStatuses.includes(String(proposal.status))) {
    return { allowed: false, reason: "لا يمكن تعديل الطلب أو سحبه بعد بدء جلسة المحكمة" };
  }
  return { allowed: true, reason: "الإجراء مسموح قبل قرار المحكمة" };
}

export function governorSelfReviewGate(
  proposal: { proposerRole?: string; status?: string },
  action: "amend" | "withdraw",
): { allowed: boolean; reason: string } {
  if (proposal.proposerRole !== "sovereign_governor") {
    return { allowed: false, reason: "هذا الإجراء متاح فقط لطلبات الحاكم السيادي" };
  }
  const allowedStatuses = action === "amend" ? ["court_review"] : ["court_review", "court_conditional"];
  if (!allowedStatuses.includes(String(proposal.status))) {
    return { allowed: false, reason: "لا يمكن تعديل الطلب أو سحبه بعد بدء جلسة المحكمة" };
  }
  return { allowed: true, reason: "الإجراء مسموح قبل قرار المحكمة" };
}

/**
 * بوابة إذن المالك الخاصة بطلب الحاكم السيادي (الميزة الجديدة).
 * إذن صريح منفصل: لا تُشغَّل أداة الحاكم إلا بعد موافقة المالك على طلبه هو،
 * بعد قرار المحكمة وموافقة نائب المالك. الرفض يُوقف الطلب فوراً.
 */
export function governorOwnerGrantGate(proposal: {
  proposerRole?: string;
  status?: string;
  courtVerdict?: string;
  deputyApprovedAt?: number;
}): { allowed: boolean; reason: string } {
  if (proposal.proposerRole !== "sovereign_governor") {
    return { allowed: false, reason: "هذا القرار مخصص لطلبات الحاكم السيادي فقط" };
  }
  if (proposal.status !== "awaiting_owner") return { allowed: false, reason: "طلب الحاكم ليس في مرحلة إذن المالك" };
  if (proposal.courtVerdict !== "approved") return { allowed: false, reason: "قرار المحكمة غير مكتمل" };
  if (!proposal.deputyApprovedAt) return { allowed: false, reason: "موافقة نائب المالك مطلوبة قبل إذن المالك" };
  return { allowed: true, reason: "إذن المالك متاح لطلب الحاكم السيادي" };
}

/**
 * بوابة أداة الحاكم الواقعية: تُتحقق أن العملية تنطبق على وحدة runtime حقيقية.
 *  - modify/construct: الوحدة يجب أن تكون قائمة فعلاً.
 *  - create: الوحدة يجب ألا تكون موجودة.
 *  - delete: الوحدة يجب أن تكون قائمة.
 */
export function governorToolTargetGate(
  operation: "create" | "modify" | "delete" | "construct",
  moduleExists: boolean,
): { allowed: boolean; reason: string } {
  if (operation === "create" && moduleExists) return { allowed: false, reason: "مفتاح الوحدة مستخدم بالفعل — استخدم تعديل أو بناء" };
  if (operation !== "create" && !moduleExists) return { allowed: false, reason: "الوحدة المستهدفة غير موجودة في runtime" };
  return { allowed: true, reason: "العملية تنطبق على وحدة runtime حقيقية" };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🕊️ سلطة الحاكم السيادية الموسّعة: تفويض + تجميد + أهداف محمية
// ─────────────────────────────────────────────────────────────────────────────

export type MandateOperation = "create" | "modify" | "delete" | "construct";
export type MandateRisk = "low" | "medium" | "critical";

const RISK_ORDER: Record<MandateRisk, number> = { low: 0, medium: 1, critical: 2 };

/**
 * حدود مطلقة لا تتجاوزها سلطة الحاكم مهما كان التفويض:
 * الإنتاج، الكود، المفاتيح، قاعدة البيانات، النشر. هذه أهداف آمنة فقط للتخطيط
 * وليست قابلة للتنفيذ التلقائي أبداً.
 */
const PROTECTED_TARGET_MARKERS = [
  "production", "prod", "main", "env", "secret", "credential", "private_key",
  "apikey", "api_key", "token", "password", "database", "db_", "migration",
  "deploy", "git", "ci_", "ci-", "payment", "billing",
];

export function protectedTargetGate(targetKey: string): { allowed: boolean; reason: string } {
  const key = String(targetKey ?? "").trim().toLowerCase();
  if (key.length < 3) return { allowed: false, reason: "مفتاح الوحدة غير صالح" };
  const hit = PROTECTED_TARGET_MARKERS.find((marker) => key.includes(marker));
  if (hit) {
    return {
      allowed: false,
      reason: `الهدف محمي (يحتوي «${hit}») — الإنتاج والكود والمفاتيح وقاعدة البيانات تبقى خارج سلطة الحاكم`, };
  }
  return { allowed: true, reason: "هدف runtime مسموح بالتنفيذ" };
}

/** مفتاح التجميد الفوري: يوقف كل تنفيذ للحاكم، بما فيه الذي يمر بالغرفة السرية. */
export function governorFreezeGate(
  state?: { frozen?: boolean; frozenReason?: string } | null,
): { allowed: boolean; reason: string } {
  if (state?.frozen) {
    return { allowed: false, reason: `سلطة الحاكم مجمّدة${state.frozenReason ? `: ${state.frozenReason}` : ""}` };
  }
  return { allowed: true, reason: "سلطة الحاكم فعّالة" };
}

export type MandateRecord = {
  status?: string;
  operations?: string[];
  moduleAllowlist?: string[];
  maxRisk?: string;
  quota?: number;
  usedCount?: number;
  expiresAt?: number;
} | null | undefined;

/**
 * بوابة التفويض: هل يغطي تفويض المالك هذا الطلب تحديدُا؟
 * تفحص الحالة والانتهاء والعملية والقائمة البيضاء وسقف الخطر والرصيد المتبقي.
 */
export function mandateGate(
  mandate: MandateRecord,
  ask: { operation: string; targetKey: string; risk: string },
  now: number,
): { allowed: boolean; reason: string } {
  if (!mandate) return { allowed: false, reason: "لا يوجد تفويض سارٍ من المالك" };
  if (mandate.status !== "active") return { allowed: false, reason: "التفويض غير نشط" };
  if (typeof mandate.expiresAt === "number" && now >= mandate.expiresAt) return { allowed: false, reason: "انتهت مدة التفويض" };
  if (!(mandate.operations ?? []).includes(ask.operation)) return { allowed: false, reason: `العملية «${ask.operation}» غير مشمولة في التفويض` };
  const allowlist = mandate.moduleAllowlist ?? [];
  if (allowlist.length > 0 && !allowlist.includes(ask.targetKey)) return { allowed: false, reason: "الوحدة المستهدفة خارج القائمة البيضاء للتفويض" };
  const cap = RISK_ORDER[(mandate.maxRisk ?? "low") as MandateRisk] ?? 0;
  const wanted = RISK_ORDER[(ask.risk ?? "medium") as MandateRisk] ?? 1;
  if (wanted > cap) return { allowed: false, reason: "خطر الطلب أعلى من سقف التفويض — يلزم إذن المالك في الطلب نفسه" };
  if ((mandate.usedCount ?? 0) >= (mandate.quota ?? 0)) return { allowed: false, reason: "استُنفد رصيد التفويض" };
  return { allowed: true, reason: "الطلب داخل حدود تفويض المالك" };
}

/**
 * البوابة النهائية للتنفيذ: مساران فقط، ولا ثالث.
 *  1) مسار الغرفة السرية بالتسلسل الكامل (المحكمة ← نائب المالك ← المالك ← الحاكم).
 *  2) مسار التفويض السارٍ (بعد قرار المحكمة) مع إعادة تحقق حيّة عند لحظة التنفيذ.
 * وفي كل الحالات: الهدف المحمي والتجميد يمنعان التنفيذ.
 */
export function sovereignExecutionGate(input: {
  proposal: { status?: string; courtVerdict?: string; targetKey?: string; mandateId?: unknown } & Parameters<typeof chamberGate>[0];
  mandate?: MandateRecord;
  state?: { frozen?: boolean; frozenReason?: string } | null;
  now: number;
}): { allowed: boolean; reason: string; path: "mandate" | "chamber" | "none" } {
  const frozen = governorFreezeGate(input.state);
  if (!frozen.allowed) return { allowed: false, reason: frozen.reason, path: "none" };
  const target = protectedTargetGate(String(input.proposal.targetKey ?? ""));
  if (!target.allowed) return { allowed: false, reason: target.reason, path: "none" };
  if (input.proposal.status !== "executing") {
    return { allowed: false, reason: "الأداة لم تُحجز لعملية موثوقة", path: "none" };
  }
  if (input.proposal.mandateId) {
    if (input.proposal.courtVerdict !== "approved") return { allowed: false, reason: "التفويض لا يُغني عن قرار المحكمة", path: "none" };
    const mandate = mandateGate(input.mandate, {
      operation: String((input.proposal as { operation?: string }).operation ?? ""),
      targetKey: String(input.proposal.targetKey ?? ""),
      risk: String((input.proposal as { risk?: string }).risk ?? "medium"),
    }, input.now);
    if (!mandate.allowed) return { allowed: false, reason: mandate.reason, path: "none" };
    return { allowed: true, reason: "تنفيذ بموجب تفويض المالك السارٍ", path: "mandate" };
  }
  const chamber = chamberGate(input.proposal);
  if (!chamber.allowed) return { allowed: false, reason: chamber.reason, path: "none" };
  return { allowed: true, reason: chamber.reason, path: "chamber" };
}
