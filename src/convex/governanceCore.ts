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
