/**
 * 🧠 Master AI Dashboard — لوحة تحكم الذكاء الاصطناعي الرئيسي
 */
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const SEV: Record<string, string> = {
  info: "text-blue-400 bg-blue-500/10", warning: "text-amber-400 bg-amber-500/10",
  critical: "text-red-400 bg-red-500/10", action: "text-green-400 bg-green-500/10",
};
const SUB: Record<string, string> = {
  moderation: "الرقابة", matchmaking: "المطابقة", economy: "الاقتصاد",
  analytics: "التحليلات", reports: "التقارير", security: "الأمان", commands: "الأوامر",
};

export default function MasterAIDashboard() {
  const [tab, setTab] = useState<"overview" | "logs" | "players" | "economy" | "commands">("overview");
  const [cmd, setCmd] = useState("");
  const [cmdTarget, setCmdTarget] = useState("");
  const [cmdResult, setCmdResult] = useState<string | null>(null);

  const stats = useQuery(api.masterAI.getGameStats);
  const live = useQuery(api.masterAI.getLiveStatus);
  const economy = useQuery(api.masterAI.analyzeEconomy);
  const logs = useQuery(api.masterAI.getAILogs, { limit: 50 });
  const players = useQuery(api.masterAI.getPlayerAnalytics, { limit: 30 });
  const execCmd = useMutation(api.masterAI.executeCommand);
  const autoMod = useMutation(api.masterAI.autoModerate);

  const doCmd = async (c?: string) => {
    const command = c || cmd;
    if (!command.trim()) return;
    try { const r = await execCmd({ command, target: cmdTarget || undefined }); setCmdResult(r.result); setCmd(""); } catch (e: any) { setCmdResult(e.message); }
  };

  const doSweep = async () => {
    try { const r = await autoMod(); setCmdResult(`Sweep: ${r.actionsTaken} actions`); } catch (e: any) { setCmdResult(e.message); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-blue-500/10 text-2xl">🧠</span>
          <div className="flex-1">
            <h2 className="text-lg font-bold">الذكاء الاصطناعي الرئيسي</h2>
            <p className="text-xs text-muted-foreground">يتحكم في كل أنظمة اللعبة — مراقبة، رقابة، اقتصاد، تحليلات، أوامر</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${live?.server?.status === "healthy" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
            <span className="size-2 rounded-full bg-current animate-pulse" />
            {live?.server?.status === "healthy" ? "يعمل" : "خطأ"}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted/30 p-1">
        {([["overview","نظرة عامة","📊"],["logs","السجل","📋"],["players","اللاعبين","👥"],["economy","الاقتصاد","💰"],["commands","الأوامر","⚡"]] as const).map(([id,label,icon]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-bold transition-all ${tab===id?"bg-blue-500/10 text-blue-500":"text-muted-foreground hover:text-foreground"}`}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["إجمالي اللاعبين", stats?.users?.total ?? 0, "👥", "text-blue-500"],
              ["نشط اليوم", stats?.users?.activeToday ?? 0, "🔥", "text-orange-500"],
              ["ألعاب نشطة", stats?.games?.active ?? 0, "🎮", "text-green-500"],
              ["بلاغات مفتوحة", stats?.reports?.open ?? 0, "🚨", "text-red-500"],
              ["إجمالي XP", (stats?.xp?.total ?? 0).toLocaleString("ar"), "⭐", "text-yellow-500"],
              ["غرف دردشة", stats?.chat?.rooms ?? 0, "💬", "text-teal-500"],
              ["أخطاء حرجة", stats?.errors?.critical ?? 0, "🐛", "text-red-600"],
              ["إجراءات AI", (stats?.aiActivity ?? []).length, "🤖", "text-purple-500"],
            ].map(([l,v,icon,c]) => (
              <div key={l} className="rounded-lg border border-border/50 bg-card p-3">
                <span className="text-sm">{icon}</span>
                <p className={`mt-1 text-xl font-bold ${c}`}>{v}</p>
                <p className="text-[10px] text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
          {/* Live */}
          <div className="rounded-lg border border-border/50 bg-card p-3">
            <h3 className="mb-2 text-xs font-bold">⚡ لحظي</h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div><p className="text-lg font-bold text-green-500">{live?.games?.playing ?? 0}</p><p className="text-[9px] text-muted-foreground">يلعبون</p></div>
              <div><p className="text-lg font-bold text-amber-500">{live?.games?.lobby ?? 0}</p><p className="text-[9px] text-muted-foreground">لوبي</p></div>
              <div><p className="text-lg font-bold text-blue-500">{live?.server?.avgFps ?? 0}</p><p className="text-[9px] text-muted-foreground">FPS</p></div>
              <div><p className="text-lg font-bold text-purple-500">{live?.errors?.count ?? 0}</p><p className="text-[9px] text-muted-foreground">أخطاء 5د</p></div>
            </div>
          </div>
          {/* AI Feed */}
          <div className="rounded-lg border border-border/50 bg-card p-3">
            <h3 className="mb-2 text-xs font-bold">🤖 آخر الإجراءات</h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {(stats?.aiActivity ?? []).slice(0, 8).map((l: any, i: number) => (
                <div key={i} className="flex items-start gap-2 rounded bg-muted/20 p-2">
                  <span className={`mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] ${SEV[l.severity]||""}`}>●</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold truncate">{l.message}</p>
                    <p className="text-[9px] text-muted-foreground">{SUB[l.subsystem]||l.subsystem} • {new Date(l.timestamp).toLocaleTimeString("ar-SA")} {l.auto&&<span className="text-blue-400">تلقائي</span>}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Logs */}
      {tab === "logs" && (
        <div className="rounded-lg border border-border/50 bg-card p-3 space-y-2 max-h-[500px] overflow-y-auto">
          {(logs ?? []).map((l: any, i: number) => (
            <div key={i} className="flex items-start gap-2 border-b border-border/20 p-2 last:border-0">
              <span className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] ${SEV[l.severity]||""}`}>●</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold">{l.action}</span>
                  <span className="rounded bg-muted px-1 text-[9px] text-muted-foreground">{SUB[l.subsystem]||l.subsystem}</span>
                  {l.auto ? <span className="rounded bg-blue-500/10 px-1 text-[9px] text-blue-400">AI</span> : <span className="rounded bg-amber-500/10 px-1 text-[9px] text-amber-400">يدوي</span>}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{l.message}</p>
                <p className="text-[9px] text-muted-foreground/50">{new Date(l.timestamp).toLocaleString("ar-SA")}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Players */}
      {tab === "players" && (
        <div className="rounded-lg border border-border/50 bg-card p-3 overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead><tr className="border-b border-border/50 text-muted-foreground">
              <th className="p-1.5 text-start">الاسم</th><th className="p-1.5">المستوى</th><th className="p-1.5">XP</th><th className="p-1.5">ألعاب</th><th className="p-1.5">فوز%</th><th className="p-1.5">مخالفات</th><th className="p-1.5">خطر</th><th className="p-1.5">حالة</th>
            </tr></thead>
            <tbody>
              {(players ?? []).map((p: any) => (
                <tr key={p.id} className="border-b border-border/20">
                  <td className="p-1.5 font-bold">{p.name}</td>
                  <td className="p-1.5 text-center">{p.level}</td>
                  <td className="p-1.5 text-center tabular-nums">{p.xp.toLocaleString("ar")}</td>
                  <td className="p-1.5 text-center">{p.gamesPlayed}</td>
                  <td className="p-1.5 text-center">{p.winRate}%</td>
                  <td className="p-1.5 text-center">{p.cheatStrikes>0&&<span className="text-red-500">⚠{p.cheatStrikes}</span>} {p.warnings>0&&<span className="text-amber-500">⚠{p.warnings}</span>}</td>
                  <td className="p-1.5 text-center"><span className={`rounded px-1.5 text-[9px] font-bold ${p.riskScore>=50?"bg-red-500/10 text-red-500":p.riskScore>=20?"bg-amber-500/10 text-amber-500":"bg-green-500/10 text-green-500"}`}>{p.riskScore}%</span></td>
                  <td className="p-1.5 text-center">{p.banned?"🚫":p.muted?"🔇":"✅"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Economy */}
      {tab === "economy" && economy && (
        <div className="rounded-lg border border-border/50 bg-card p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["إجمالي XP", (economy.totalXP ?? 0).toLocaleString("ar"), "text-yellow-500"],["متوسط XP", (economy.avgXP ?? 0).toLocaleString("ar"), "text-blue-500"],["التفاعل", economy.engagementRate+"%", "text-green-500"],["متوسط الفوز", economy.avgWinRate+"%", "text-purple-500"]].map(([l,v,c])=>(
              <div key={l} className="text-center rounded bg-muted/20 p-2"><p className={`text-lg font-bold ${c}`}>{v}</p><p className="text-[9px] text-muted-foreground">{l}</p></div>
            ))}
          </div>
          <div className="rounded bg-muted/20 p-2"><p className="text-[11px] font-bold">📊 {economy.recommendation}</p></div>
        </div>
      )}

      {/* Commands */}
      {tab === "commands" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border/50 bg-card p-3 space-y-2">
            <h3 className="text-xs font-bold">⚡ أوامر الـ AI</h3>
            <input value={cmd} onChange={e=>setCmd(e.target.value)} placeholder="ban / unban / sweep / status" className="w-full rounded border border-border/50 bg-background px-2.5 py-1.5 text-xs" onKeyDown={e=>e.key==="Enter"&&doCmd()} />
            <input value={cmdTarget} onChange={e=>setCmdTarget(e.target.value)} placeholder="اسم اللاعب (اختياري)" className="w-full rounded border border-border/50 bg-background px-2.5 py-1.5 text-xs" />
            <div className="flex gap-2">
              <button onClick={()=>doCmd()} className="rounded bg-blue-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-600">تنفيذ</button>
              <button onClick={doSweep} className="rounded bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-amber-600">🔍 فحص شامل</button>
            </div>
            {cmdResult && <div className="rounded bg-green-500/10 p-2 text-[11px] text-green-500">{cmdResult}</div>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[["status","📊 حالة النظام"],["sweep","🔍 فحص شامل"]].map(([c,l])=>(
              <button key={c} onClick={()=>doCmd(c)} className="rounded border border-border/30 p-2.5 text-start hover:bg-muted/30 transition-colors">
                <p className="text-[11px] font-bold">{l}</p>
                <p className="text-[9px] text-muted-foreground">{c==="status"?"إحصائيات شاملة":"فحص وعقوبة"}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
