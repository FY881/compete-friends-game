import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Activity,
  BadgeCheck,
  Ban,
  Crown,
  Gavel,
  Loader2,
  MessageSquareOff,
  ScrollText,
  Search,
  ShieldCheck,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { GovernanceConsole } from "@/components/GovernanceConsole";

/**
 * 👑 مركز قيادة نائب المالك (الإصدار 3.0)
 * تحليلات حية + بحث اللاعبين + حظر لعب/كتم دردشة + رفع العقوبات
 * + تعديل النقاط والخبرة + سجل تدقيق غير قابل للتغيير.
 */
export function DeputyCommandCenter() {
  const myRole = useQuery(api.siteRoles.getMySiteRole);
  const dashboard = useQuery(api.siteRoles.getDeputyDashboard);
  const audit = useQuery(api.siteRoles.getAuditLog, { limit: 40 });

  const searchPlayers = useQuery(
    api.siteRoles.searchPlayers,
    myRole?.isOwner || myRole?.isDeputy ? { term: "" } : "skip",
  );

  const [term, setTerm] = useState("");
  const [checkedTerm, setCheckedTerm] = useState("");
  const [busy, setBusy] = useState(false);

  const status = useQuery(
    api.siteRoles.getPlayerStatus,
    checkedTerm.length >= 2 ? { term: checkedTerm } : "skip",
  );

  const issueBan = useMutation(api.siteRoles.issueBan);
  const liftBan = useMutation(api.siteRoles.liftBan);
  const adjustStats = useMutation(api.siteRoles.adjustPlayerStats);
  const canAct = !!myRole && (myRole.isOwner || myRole.isDeputy);
  if (!canAct) return null;

  const findPlayer = () => setCheckedTerm(term.trim());

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التنفيذ");
    } finally {
      setBusy(false);
    }
  };

  const stats = [
    { label: "إجمالي اللاعبين", value: dashboard?.totalPlayers ?? "—", icon: Users, color: "text-sky-600" },
    { label: "جولات اليوم", value: dashboard?.gamesToday ?? "—", icon: Activity, color: "text-emerald-600" },
    { label: "إجمالي الجولات", value: dashboard?.totalGames ?? "—", icon: BadgeCheck, color: "text-violet-600" },
    { label: "عقوبات نشطة", value: dashboard?.bannedNow ?? "—", icon: Gavel, color: "text-rose-600" },
  ];

  return (
    <div dir="rtl" className="mx-auto w-full max-w-4xl space-y-5 p-4">
      {/* Header */}
      <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-gradient-to-l from-amber-500/10 via-card to-amber-500/10 p-4">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/15 text-2xl">👑</span>
        <div className="flex-1">
          <p className="text-base font-black">
            مركز قيادة {myRole?.isOwner ? "المالك" : "نائب المالك"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            السيطرة الكاملة على الموقع — كل فعل يُسجَّل في سجل التدقيق غير القابل للتغيير
          </p>
        </div>
      </div>

      {/* Live stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border/60 bg-card p-4">
            <s.icon className={cn("size-5", s.color)} />
            <p className="mt-2 text-2xl font-black">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Player management */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <p className="flex items-center gap-2 text-sm font-black">
          <Search className="size-4 text-violet-600" />
          إدارة اللاعبين
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && findPlayer()}
            placeholder="ابحث بالاسم أو البريد…"
            className="flex-1 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-violet-400"
          />
          <button
            type="button"
            onClick={findPlayer}
            disabled={busy || term.trim().length < 2}
            className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white transition hover:bg-violet-700 disabled:opacity-50"
          >
            بحث
          </button>
        </div>

        {status && (
          <div className="mt-4 space-y-3 rounded-xl border border-violet-500/25 bg-violet-500/5 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black">{status.name}</p>
                <p className="text-[10px] text-muted-foreground">{status.email}</p>
              </div>
              <div className="text-end text-[11px] font-bold">
                <p className="text-violet-700">⭐ {status.points} نقطة</p>
                <p className="text-sky-700">✨ {status.xp} خبرة</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {status.playBanned ? (
                <button
                  type="button"
                  onClick={() => run(() => liftBan({ userId: status.userId, kind: "play_ban" }), "رُفع حظر اللعب")}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                >
                  <UserCheckIcon /> رفع حظر اللعب
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => run(() => issueBan({ userId: status.userId, kind: "play_ban", reason: "قرار إداري من مركز القيادة" }), "حُظر اللعب")}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-rose-700"
                >
                  <Ban className="size-3.5" /> حظر اللعب
                </button>
              )}
              {status.chatMuted ? (
                <button
                  type="button"
                  onClick={() => run(() => liftBan({ userId: status.userId, kind: "chat_mute" }), "رُفع الكتم")}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                >
                  <MessageSquareOff className="size-3.5" /> رفع الكتم
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => run(() => issueBan({ userId: status.userId, kind: "chat_mute", reason: "قرار إداري من مركز القيادة" }), "كُتِمت الدردشة")}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-amber-700"
                >
                  <MessageSquareOff className="size-3.5" /> كتم الدردشة
                </button>
              )}
              <button
                type="button"
                onClick={() => run(() => adjustStats({ userId: status.userId, pointsDelta: 100, reason: "مكافأة إدارية" }), "+100 نقطة")}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-sky-700"
              >
                <UserPlus className="size-3.5" /> +100 نقطة
              </button>
              <button
                type="button"
                onClick={() => run(() => adjustStats({ userId: status.userId, pointsDelta: -100, reason: "خصم إداري" }), "-100 نقطة")}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted/70"
              >
                <UserMinus className="size-3.5" /> -100 نقطة
              </button>
            </div>
          </div>
        )}

        {checkedTerm.length >= 2 && !status && (
          <p className="mt-3 text-center text-xs text-muted-foreground">لا نتائج لهذا البحث</p>
        )}
      </div>

      {/* Audit log */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <p className="flex items-center gap-2 text-sm font-black">
          <ScrollText className="size-4 text-amber-600" />
          سجل التدقيق — كل الأفعال الإدارية
        </p>
        <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto">
          {(audit ?? []).length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">لا أفعال مسجلة بعد</p>
          ) : (
            (audit ?? []).map((a) => (
              <div key={a._id} className="flex items-start gap-2 rounded-lg bg-muted/20 px-3 py-2">
                <span
                  className={cn(
                    "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black",
                    a.actorRole === "owner"
                      ? "bg-amber-500/15 text-amber-700"
                      : "bg-sky-500/15 text-sky-700",
                  )}
                >
                  {a.actorRole === "owner" ? "👑 مالك" : "👤 نائب"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold">{a.action}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{a.detail}</p>
                </div>
                <span className="shrink-0 text-[9px] text-muted-foreground">
                  {new Date(a.at).toLocaleString("ar", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric" })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Deputies (owner only) */}
      {myRole?.isOwner && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="flex items-center gap-2 text-sm font-black">
            <Crown className="size-4 text-amber-600" />
            تعيين نائب المالك — المالك فقط
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            النائب يسيطر على كل شيء ما عدا نقل الملكية وتعيين النواب.
          </p>
          <DeputyManager />
        </div>
      )}

      {/* حاكمة التطور — المحكمة ← نائب المالك ← إذن المالك ← الحاكم السيادي + الأداة الحقيقية */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-slate-100">
        <p className="flex items-center gap-2 text-sm font-black">
          <Gavel className="size-4 text-amber-400" />
          حاكمة التطور — تعديل حقيقي للعبة
        </p>
        <p className="mt-1 mb-4 text-[10px] text-slate-400">
          أداة نائب المالك تحوّل تكليفك الحر إلى طلب منضبط يمر بالمحكمة، ثم يُطلب إذن المالك الصريح، ثم ينفّذ الحاكم
          التعديل على وحدة runtime حقيقية. لا تنفيذ على الإنتاج أو main.
        </p>
        <GovernanceConsole />
      </div>
    </div>
  );
}

function UserCheckIcon() {
  return <ShieldCheck className="size-3.5" />;
}

/** إدارة النواب — قائمة + تعيين من قائمة اللاعبين */
function DeputyManager() {
  const deputies = useQuery(api.siteRoles.listDeputies);
  const players = useQuery(api.siteRoles.listPlayers, {});
  const appoint = useMutation(api.siteRoles.appointDeputy);
  const revoke = useMutation(api.siteRoles.revokeDeputy);
  const [busy, setBusy] = useState(false);

  const appointById = async (userId: string) => {
    setBusy(true);
    try {
      await appoint({ userId: userId as never });
      toast.success("عُيِّن نائب المالك 👑");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التعيين");
    } finally {
      setBusy(false);
    }
  };

  const revokeById = async (userId: string) => {
    setBusy(true);
    try {
      await revoke({ userId: userId as never });
      toast.success("عُزِل نائب المالك");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل العزل");
    } finally {
      setBusy(false);
    }
  };

  const activeDeputyIds = new Set((deputies ?? []).filter((d) => d.active).map((d) => d.userId));

  return (
    <div className="mt-3 space-y-2">
      {(deputies ?? []).filter((d) => d.active).length > 0 && (
        <div className="space-y-1">
          {(deputies ?? [])
            .filter((d) => d.active)
            .map((d) => (
              <div key={d._id} className="flex items-center justify-between rounded-lg bg-amber-500/10 px-3 py-2">
                <p className="text-xs font-black">👑 {d.name}</p>
                <button
                  type="button"
                  onClick={() => revokeById(d.userId)}
                  disabled={busy}
                  className="rounded-lg bg-rose-600 px-3 py-1 text-[10px] font-bold text-white hover:bg-rose-700"
                >
                  <Loader2 className={cn("inline", busy && "animate-spin")} /> عزل
                </button>
              </div>
            ))}
        </div>
      )}
      <div className="max-h-40 space-y-1 overflow-y-auto">
        {(players ?? [])
          .filter((p) => !activeDeputyIds.has(p.userId))
          .slice(0, 12)
          .map((p) => (
            <div key={p.userId} className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-1.5">
              <p className="truncate text-[11px]">{p.name}</p>
              <button
                type="button"
                onClick={() => appointById(p.userId)}
                disabled={busy}
                className="rounded-lg bg-amber-600 px-3 py-1 text-[10px] font-bold text-white hover:bg-amber-700"
              >
                تعيين
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
