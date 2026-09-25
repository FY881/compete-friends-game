import { describe, expect, it } from "vitest";
import { chamberGate, deputySelfReviewGate, deriveCourtVerdict, governorFreezeGate, governorOwnerGrantGate, governorSelfReviewGate, governorToolTargetGate, instrumentGate, mandateGate, protectedTargetGate, sovereignExecutionGate } from "../convex/governanceCore";

const complete = {
  status: "executing",
  courtVerdict: "approved" as const,
  deputyApprovedAt: 1,
  ownerApprovedAt: 2,
  governorApprovedAt: 3,
  chamberOpenedAt: 4,
};

describe("Court threshold", () => {
  it("rejects when less than 60 percent approve", () => {
    expect(deriveCourtVerdict(["reject", "reject", "reject", "approve"], 4)).toBe("rejected");
  });

  it("returns conditional when enough approve but conditions remain", () => {
    expect(deriveCourtVerdict(["approve", "approve", "approve", "conditional"], 4)).toBe("conditional");
  });

  it("approves only a clear supermajority", () => {
    expect(deriveCourtVerdict(["approve", "approve", "approve", "reject"], 4)).toBe("approved");
  });
});

describe("Secret chamber gate", () => {
  it("rejects every incomplete approval path", () => {
    expect(chamberGate({ ...complete, courtVerdict: undefined }).allowed).toBe(false);
    expect(chamberGate({ ...complete, deputyApprovedAt: undefined }).allowed).toBe(false);
    expect(chamberGate({ ...complete, ownerApprovedAt: undefined }).allowed).toBe(false);
    expect(chamberGate({ ...complete, governorApprovedAt: undefined }).allowed).toBe(false);
    expect(chamberGate({ ...complete, chamberOpenedAt: undefined }).allowed).toBe(false);
  });

  it("opens only after Court, Deputy, Owner and Governor approval", () => {
    expect(chamberGate({ ...complete, status: "joint_approved" }).allowed).toBe(true);
  });
});

describe("Sovereign mandate gate", () => {
  const mandate = { status: "active", operations: ["modify", "construct"], moduleAllowlist: [], maxRisk: "medium", quota: 3, usedCount: 0, expiresAt: 1_000 };
  const ask = { operation: "modify", targetKey: "arena_rules", risk: "low" };

  it("allows a request inside the mandate boundary", () => {
    expect(mandateGate(mandate, ask, 500).allowed).toBe(true);
  });

  it("blocks a missing, expired or revoked mandate", () => {
    expect(mandateGate(null, ask, 500).allowed).toBe(false);
    expect(mandateGate(mandate, ask, 2_000).allowed).toBe(false);
    expect(mandateGate({ ...mandate, status: "revoked" }, ask, 500).allowed).toBe(false);
  });

  it("blocks operations, targets and risk levels beyond the grant", () => {
    expect(mandateGate(mandate, { ...ask, operation: "delete" }, 500).allowed).toBe(false);
    expect(mandateGate({ ...mandate, moduleAllowlist: ["other_key"] }, ask, 500).allowed).toBe(false);
    expect(mandateGate(mandate, { ...ask, risk: "critical" }, 500).allowed).toBe(false);
  });

  it("blocks once the execution quota is exhausted", () => {
    expect(mandateGate({ ...mandate, usedCount: 3 }, ask, 500).allowed).toBe(false);
  });
});

describe("Absolute governor boundaries", () => {
  it("keeps production, code, keys and database targets out of reach", () => {
    for (const key of ["production_flags", "main_branch_rules", "api_keys_pool", "database_schema", "deploy_pipeline", "env_secrets"]) {
      expect(protectedTargetGate(key).allowed).toBe(false);
    }
    expect(protectedTargetGate("arena_rules").allowed).toBe(true);
  });

  it("stops every path while the governor is frozen", () => {
    expect(governorFreezeGate({ frozen: true, frozenReason: "مراجعة" }).allowed).toBe(false);
    expect(governorFreezeGate({ frozen: false }).allowed).toBe(true);
    expect(governorFreezeGate(null).allowed).toBe(true);
  });
});

describe("Sovereign execution gate", () => {
  const proposal = { status: "executing", courtVerdict: "approved", targetKey: "arena_rules", operation: "modify", risk: "low", mandateId: "m1" };
  const mandate = { status: "active", operations: ["modify"], moduleAllowlist: [], maxRisk: "medium", quota: 2, usedCount: 0, expiresAt: 5_000 };

  it("uses the mandate path only with court approval and a live mandate", () => {
    expect(sovereignExecutionGate({ proposal, mandate, state: null, now: 1_000 }).path).toBe("mandate");
    expect(sovereignExecutionGate({ proposal: { ...proposal, courtVerdict: "conditional" }, mandate, state: null, now: 1_000 }).allowed).toBe(false);
    expect(sovereignExecutionGate({ proposal, mandate: null, state: null, now: 1_000 }).allowed).toBe(false);
  });

  it("denies everything while frozen or aimed at a protected target", () => {
    expect(sovereignExecutionGate({ proposal, mandate, state: { frozen: true, frozenReason: "طوارئ" }, now: 1_000 }).allowed).toBe(false);
    expect(sovereignExecutionGate({ proposal: { ...proposal, targetKey: "production_flags" }, mandate, state: null, now: 1_000 }).allowed).toBe(false);
  });

  it("still requires the full chamber chain when there is no mandate", () => {
    const chamberProposal = { status: "executing", courtVerdict: "approved", targetKey: "arena_rules", deputyApprovedAt: 1, ownerApprovedAt: 2, governorApprovedAt: 3, chamberOpenedAt: 4 };
    expect(sovereignExecutionGate({ proposal: chamberProposal, mandate: null, state: null, now: 1_000 }).path).toBe("chamber");
    expect(sovereignExecutionGate({ proposal: { ...chamberProposal, ownerApprovedAt: undefined }, mandate: null, state: null, now: 1_000 }).allowed).toBe(false);
  });
});

describe("Governor self review gate", () => {
  it("allows the sovereign governor to amend only before the court session", () => {
    expect(governorSelfReviewGate({ proposerRole: "sovereign_governor", status: "court_review" }, "amend").allowed).toBe(true);
    expect(governorSelfReviewGate({ proposerRole: "sovereign_governor", status: "court_deliberating" }, "amend").allowed).toBe(false);
  });

  it("allows the sovereign governor to withdraw before or during conditional review only", () => {
    expect(governorSelfReviewGate({ proposerRole: "sovereign_governor", status: "court_conditional" }, "withdraw").allowed).toBe(true);
    expect(governorSelfReviewGate({ proposerRole: "sovereign_governor", status: "awaiting_deputy" }, "withdraw").allowed).toBe(false);
  });

  it("refuses self review for deputy proposals", () => {
    expect(governorSelfReviewGate({ proposerRole: "deputy_owner", status: "court_review" }, "amend").allowed).toBe(false);
  });
});

describe("Deputy owner self review gate", () => {
  it("allows the deputy owner to amend only before the court session", () => {
    expect(deputySelfReviewGate({ proposerRole: "deputy_owner", status: "court_review" }, "amend").allowed).toBe(true);
    expect(deputySelfReviewGate({ proposerRole: "deputy_owner", status: "court_deliberating" }, "amend").allowed).toBe(false);
  });

  it("allows the deputy owner to withdraw only before the verdict is final", () => {
    expect(deputySelfReviewGate({ proposerRole: "deputy_owner", status: "court_conditional" }, "withdraw").allowed).toBe(true);
    expect(deputySelfReviewGate({ proposerRole: "deputy_owner", status: "awaiting_owner" }, "withdraw").allowed).toBe(false);
  });

  it("refuses self review for governor proposals", () => {
    expect(deputySelfReviewGate({ proposerRole: "sovereign_governor", status: "court_review" }, "amend").allowed).toBe(false);
  });
});

describe("Owner grant gate for governor requests", () => {
  const base = { proposerRole: "sovereign_governor", status: "awaiting_owner", courtVerdict: "approved", deputyApprovedAt: 1 };

  it("allows the owner verdict only for governor requests past the full chain", () => {
    expect(governorOwnerGrantGate(base).allowed).toBe(true);
  });

  it("refuses deputy requests and incomplete chains", () => {
    expect(governorOwnerGrantGate({ ...base, proposerRole: "deputy_owner" }).allowed).toBe(false);
    expect(governorOwnerGrantGate({ ...base, status: "awaiting_deputy" }).allowed).toBe(false);
    expect(governorOwnerGrantGate({ ...base, courtVerdict: "conditional" }).allowed).toBe(false);
    expect(governorOwnerGrantGate({ ...base, deputyApprovedAt: undefined }).allowed).toBe(false);
  });
});

describe("Governor real tool target gate", () => {
  it("requires a real existing module for modify, construct and delete", () => {
    expect(governorToolTargetGate("modify", true).allowed).toBe(true);
    expect(governorToolTargetGate("modify", false).allowed).toBe(false);
    expect(governorToolTargetGate("delete", false).allowed).toBe(false);
    expect(governorToolTargetGate("construct", false).allowed).toBe(false);
  });

  it("requires a free key for create", () => {
    expect(governorToolTargetGate("create", false).allowed).toBe(true);
    expect(governorToolTargetGate("create", true).allowed).toBe(false);
  });
});

describe("Instrument gate", () => {
  it("cannot run before the chamber session is atomically claimed", () => {
    expect(instrumentGate({ ...complete, status: "joint_approved" }).allowed).toBe(false);
  });

  it("runs only with the complete approval chain", () => {
    expect(instrumentGate(complete).allowed).toBe(true);
  });
});
