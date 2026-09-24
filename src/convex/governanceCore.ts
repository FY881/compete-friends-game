export type CourtVote = "approve" | "conditional" | "reject" | "abstain";
export type CourtVerdict = "approved" | "conditional" | "rejected";

export function deriveCourtVerdict(votes: CourtVote[], totalUnits: number): CourtVerdict {
  if (totalUnits < 3) throw new Error("المحكمة غير مكتملة");
  const approvals = votes.filter((vote) => vote === "approve").length;
  const conditionals = votes.filter((vote) => vote === "conditional").length;
  if (approvals < Math.ceil(totalUnits * 0.6)) return "rejected";
  return conditionals > 0 ? "conditional" : "approved";
}

export function chamberGate(proposal: {
  status: string;
  courtVerdict?: string;
  deputyApprovedAt?: number;
  governorApprovedAt?: number;
  chamberOpenedAt?: number;
}): { allowed: boolean; reason: string } {
  if (proposal.courtVerdict !== "approved") return { allowed: false, reason: "قرار المحكمة غير مكتمل" };
  if (!proposal.deputyApprovedAt) return { allowed: false, reason: "موافقة نائب المالك مطلوبة" };
  if (!proposal.governorApprovedAt) return { allowed: false, reason: "موافقة الحاكم السيادي مطلوبة" };
  if (!(["joint_approved", "executing"] as string[]).includes(proposal.status) || !proposal.chamberOpenedAt) return { allowed: false, reason: "الغرفة السرية غير مفتوحة" };
  return { allowed: true, reason: "اكتمل التسلسل" };
}

export function instrumentGate(proposal: Parameters<typeof chamberGate>[0] & { status: string }): { allowed: boolean; reason: string } {
  const chamber = chamberGate(proposal);
  if (!chamber.allowed) return chamber;
  if (proposal.status !== "executing") return { allowed: false, reason: "الأداة لم تُحجز لعملية موثوقة" };
  return { allowed: true, reason: "جميع الشروط مستوفاة" };
}
