"use node";

import { createSign } from "node:crypto";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isOwnerUser } from "./owner";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`مفتاح GitHub المطلوب غير موجود: ${name}`);
  return value;
}

function appJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iat: now - 30, exp: now + 540, iss: required("GITHUB_APP_ID") })).toString("base64url");
  const signature = createSign("RSA-SHA256").update(`${header}.${payload}`).sign(required("GITHUB_PRIVATE_KEY"), "base64url");
  return `${header}.${payload}.${signature}`;
}

async function github(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${appJwt()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status}: ${body.slice(0, 500)}`);
  }
  return response;
}

async function installationToken(): Promise<string> {
  const response = await github(`/app/installations/${required("GITHUB_INSTALLATION_ID")}/access_tokens`, { method: "POST" });
  const body = await response.json() as { token?: string };
  if (!body.token) throw new Error("لم يُرجع GitHub installation token");
  return body.token;
}

async function installationRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${await installationToken()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status}: ${body.slice(0, 500)}`);
  }
  return response;
}

async function requireGovernanceAuthority(ctx: any, proposal: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("تسجيل الدخول مطلوب");
  const user = await ctx.db.get(userId);
  const deputy = await ctx.db.query("siteRoles").withIndex("by_user", (q: any) => q.eq("userId", userId)).first();
  if (!isOwnerUser(user) && !(deputy?.active && deputy.role === "deputy_owner")) throw new Error("غير مصرح");
  if (proposal.status !== "joint_approved" || proposal.courtVerdict !== "approved" || !proposal.deputyApprovedAt || !proposal.governorApprovedAt || !proposal.chamberOpenedAt) {
    throw new Error("الغرفة السرية غير مفتوحة أو مسار الموافقات غير مكتمل");
  }
}

export const createEvolutionPullRequest = action({
  args: { proposalId: v.id("evolutionProposals") },
  handler: async (ctx, { proposalId }): Promise<any> => {
    const proposal = await ctx.runQuery(internal.governanceStore.getProposal, { proposalId });
    if (!proposal) throw new Error("المقترح غير موجود");
    await requireGovernanceAuthority(ctx, proposal);
    const repository = required("GITHUB_REPOSITORY");
    const branch = `${required("GITHUB_SANDBOX_BRANCH")}/${proposalId}`;
    const base = await (await installationRequest(`/repos/${repository}`)).json() as { default_branch?: string };
    const baseBranch = base.default_branch ?? "main";
    const baseRef = await (await installationRequest(`/repos/${repository}/git/ref/heads/${encodeURIComponent(baseBranch)}`)).json() as { object?: { sha?: string } };
    if (!baseRef.object?.sha) throw new Error("تعذر تحديد commit الأساسي");
    await installationRequest(`/repos/${repository}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseRef.object.sha }) });
    const manifest = JSON.stringify({ proposalId, title: proposal.title, operation: proposal.operation, targetKey: proposal.targetKey, courtVerdict: proposal.courtVerdict, deputyApprovedAt: proposal.deputyApprovedAt, governorApprovedAt: proposal.governorApprovedAt, chamberOpenedAt: proposal.chamberOpenedAt, createdAt: new Date().toISOString() }, null, 2);
    const encoded = Buffer.from(`${manifest}\n`).toString("base64");
    const commit = await (await installationRequest(`/repos/${repository}/contents/.evolution/proposals/${proposalId}.json`, { method: "PUT", body: JSON.stringify({ message: `evolution: record approved proposal ${proposalId}`, content: encoded, branch }) })).json() as { content?: { sha?: string } };
    if (!commit.content?.sha) throw new Error("تعذر إنشاء commit الإقرار");
    const pr = await (await installationRequest(`/repos/${repository}/pulls`, { method: "POST", body: JSON.stringify({ title: `Evolution proposal: ${proposal.title}`, head: branch, base: baseBranch, body: `Automated evidence manifest only.\n\nProposal: ${proposalId}\nCourt: ${proposal.courtVerdict}\nDeputy approval: ${proposal.deputyApprovedAt}\nGovernor approval: ${proposal.governorApprovedAt}` }) })).json() as { html_url?: string; number?: number };
    return { branch, baseBranch, commitSha: commit.content.sha, pullRequestUrl: pr.html_url, pullRequestNumber: pr.number, sourceChanged: false };
  },
});
