import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Users,
  Search,
  Crown,
  Shield,
  Ban,
  AlertTriangle,
  MicOff,
  Loader2,
  Gavel,
  RotateCcw,
  UserCog,
  Eraser,
  BarChart3,
  TrendingUp,
  Eye,
  ChevronDown,
  ChevronUp,
  Target,
  Zap,
  Activity,
} from "lucide-react";

// ─── Risk Assessment Badge ────────────────────────────────────
function RiskBadge({ level }: { level: "low" | "medium" | "high" | "critical" }) {
  const config = {
    low: { label: "منخفض", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
    medium: { label: "متوسط", color: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
    high: { label: "عالي", color: "bg-orange-500/10 text-orange-700 border-orange-500/30" },
    critical: { label: "حرج", color: "bg-rose-500/10 text-rose-700 border-rose-500/30" },
  }[level];
  return (
    <Badge variant="outline" className={cn("gap-1 rounded-full text-[10px] border", config.color)}>
      <Target className="size-2.5" />
      {config.label}
    </Badge>
  );
}

// ─── Player Risk Score ────────────────────────────────────────
function getRiskScore(user: {
  warnings: number;
  cheatStrikes: number;
  bannedPermanent: boolean;
  bannedUntil: number | null;
  mutedUntil: number | null;
  gamesPlayed: number;
  gamesWon: number;
}): { score: number; level: "low" | "medium" | "high" | "critical"; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (user.bannedPermanent) return { score: 100, level: "critical", reasons: ["حظر دائم نشط"] };
  if (user.warnings > 0) { score += user.warnings * 15; reasons.push(`${user.warnings} تحذير`); }
  if (user.cheatStrikes > 0) { score += user.cheatStrikes * 25; reasons.push(`${user.cheatStrikes} مخالفة غش`); }
  if (user.bannedUntil != null && user.bannedUntil > Date.now()) { score += 30; reasons.push("محظور حالياً"); }
  if (user.mutedUntil != null && user.mutedUntil > Date.now()) { score += 10; reasons.push("مكتوم حالياً"); }
  if (user.gamesPlayed > 10 && user.gamesWon === 0) { score += 5; reasons.push("لم يحقق أي فوز بعد"); }

  const level = score >= 70 ? "critical" : score >= 40 ? "high" : score >= 15 ? "medium" : "low";
  return { score: Math.min(score, 100), level, reasons };
}

// ─── Win Rate Bar ─────────────────────────────────────────────
function WinRateBar({ won, total }: { won: number; total: number }) {
  const pct = total > 0 ? Math.round((won / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-bold text-muted-foreground w-8 text-end">{pct}%</span>
    </div>
  );
}

// ─── Player Profile Timeline ──────────────────────────────────
function PlayerTimeline({ user }: { user: { gamesPlayed: number; gamesWon: number; xp: number; level: number; warnings: number; cheatStrikes: number } }) {
  const events = [
    { icon: Users, label: "إنشاء الحساب", color: "text-primary" },
    ...(user.gamesPlayed > 0 ? [{ icon: Gamepad2, label: `أول جولة (${user.gamesPlayed} جولة إجمالاً)`, color: "text-emerald-600" }] : []),
    ...(user.gamesWon > 0 ? [{ icon: TrendingUp, label: `أول فوز (${user.gamesWon} فوز)`, color: "text-emerald-600" }] : []),
    ...(user.level > 1 ? [{ icon: Zap, label: `وصول المستوى ${user.level}`, color: "text-amber-600" }] : []),
    ...(user.warnings > 0 ? [{ icon: AlertTriangle, label: `${user.warnings} تحذير`, color: "text-amber-600" }] : []),
    ...(user.cheatStrikes > 0 ? [{ icon: Eraser, label: `${user.cheatStrikes} مخالفة غش`, color: "text-rose-600" }] : []),
  ];

  return (
    <div className="space-y-2">
      {events.map((ev, i) => (
        <div key={i} className="flex items-center gap-2">
          <ev.icon className={cn("size-3.5 shrink-0", ev.color)} />
          <span className="text-[11px] text-muted-foreground">{ev.label}</span>
        </div>
      ))}
    </div>
  );
}

const Gamepad2 = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" x2="10" y1="12" y2="12" />
    <line x1="8" x2="8" y1="10" y2="14" />
    <line x1="15" x2="15.01" y1="13" y2="13" />
    <line x1="18" x2="18.01" y1="11" y2="11" />
    <rect width="20" height="12" x="2" y="6" rx="2" />
  </svg>
);

// ─── Advanced Players Tab ─────────────────────────────────────
export function AdvancedPlayersTab({ isOwner }: { isOwner: boolean }) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "level" | "risk" | "xp">("risk");
  const [filterStatus, setFilterStatus] = useState<"all" | "banned" | "muted" | "warned" | "clean">("all");
  const users = useQuery(api.owner.listUsers, { search });
  const setRole = useMutation(api.owner.setRole);
  const pardonUser = useMutation(api.owner.pardonUser);
  const applyPunishment = useMutation(api.owner.applyPunishment);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [punishDialog, setPunishDialog] = useState<{ user: any; mode: "warn" | "mute" | "ban" } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyAction, setBusyAction] = useState(false);

  // Calculate risk scores
  const usersWithRisk = useMemo(() => {
    if (!users) return [];
    return users.map((u) => ({
      ...u,
      risk: getRiskScore(u),
    }));
  }, [users]);

  // Filter and sort
  const filteredUsers = useMemo(() => {
    let result = usersWithRisk;
    if (filterStatus !== "all") {
      result = result.filter((u) => {
        if (filterStatus === "banned") return u.bannedPermanent || (u.bannedUntil != null && u.bannedUntil > Date.now());
        if (filterStatus === "muted") return u.mutedUntil != null && u.mutedUntil > Date.now();
        if (filterStatus === "warned") return u.warnings > 0;
        if (filterStatus === "clean") return u.risk.level === "low";
        return true;
      });
    }
    return result.sort((a, b) => {
      if (sortBy === "risk") return b.risk.score - a.risk.score;
      if (sortBy === "level") return b.level - a.level;
      if (sortBy === "xp") return b.xp - a.xp;
      return a.name.localeCompare(b.name);
    });
  }, [usersWithRisk, sortBy, filterStatus]);

  // Bulk actions
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredUsers.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredUsers.map((u) => u.id)));
    }
  };

  const bulkPunish = useMutation(api.owner.bulkPunish);

  const handleBulk = async (action: "warn" | "mute" | "pardon") => {
    if (selected.size === 0) return;
    setBusyAction(true);
    try {
      const result = await bulkPunish({
        userIds: [...selected] as never[],
        action,
        reason: action === "warn" ? "تحذير جماعي من الإدارة" : action === "mute" ? "كتم جماعي — سلوك مزعج" : "عفو جماعي",
        durationMs: action === "mute" ? 60 * 60 * 1000 : undefined,
      });
      const label = action === "warn" ? "تحذير" : action === "mute" ? "كتم" : "عفو";
      toast.success(`تم ${label} ${result.done} لاعب${result.skipped ? ` (تجاوز ${result.skipped})` : ""}.`);
      setSelected(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر تنفيذ الإجراء الجماعي.");
    } finally {
      setBusyAction(false);
    }
  };

  const handlePardon = async (user: any) => {
    try {
      await pardonUser({ userId: user.id as never, reason: "عفو إداري" });
      toast.success(`تم رفع العقوبات عن ${user.name}.`);
    } catch (e) {
      toast.error("تعذّر رفع العقوبات.");
    }
  };

  const hasPunishment = (u: any) =>
    u.warnings > 0 || u.mutedUntil != null || u.bannedUntil != null || u.bannedPermanent;

  const filterCounts = useMemo(() => {
    if (!usersWithRisk) return { all: 0, banned: 0, muted: 0, warned: 0, clean: 0 };
    return {
      all: usersWithRisk.length,
      banned: usersWithRisk.filter((u) => u.bannedPermanent || (u.bannedUntil != null && u.bannedUntil > Date.now())).length,
      muted: usersWithRisk.filter((u) => u.mutedUntil != null && u.mutedUntil > Date.now()).length,
      warned: usersWithRisk.filter((u) => u.warnings > 0).length,
      clean: usersWithRisk.filter((u) => u.risk.level === "low").length,
    };
  }, [usersWithRisk]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Users className="size-4 text-primary" />
            إدارة اللاعبين المتقدمة
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            بحث ذكي + تقييم مخاطر + ملفات شاملة + إجراءات جماعية
          </p>
        </div>
        <div className="relative">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو البريد…"
            className="h-10 w-64 rounded-xl ps-9"
          />
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-5 gap-2">
        {([
          { key: "all", label: "الكل", count: filterCounts.all, color: "bg-primary/10 text-primary" },
          { key: "clean", label: "نظيفون", count: filterCounts.clean, color: "bg-emerald-500/10 text-emerald-700" },
          { key: "warned", label: "محذرون", count: filterCounts.warned, color: "bg-amber-500/10 text-amber-700" },
          { key: "muted", label: "مكتومون", count: filterCounts.muted, color: "bg-orange-500/10 text-orange-700" },
          { key: "banned", label: "محظورون", count: filterCounts.banned, color: "bg-rose-500/10 text-rose-700" },
        ] as const).map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilterStatus(f.key)}
            className={cn(
              "rounded-xl border p-2.5 text-center transition-all",
              filterStatus === f.key
                ? "border-primary/30 bg-primary/5 shadow-sm"
                : "border-border/50 bg-card/50 hover:bg-muted/30",
            )}
          >
            <p className={cn("text-lg font-bold", f.color.split(" ")[1])}>{f.count}</p>
            <p className="text-[10px] text-muted-foreground">{f.label}</p>
          </button>
        ))}
      </div>

      {/* Sort & Bulk */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSelectAll}
            className="gap-1.5 text-xs"
          >
            <input
              type="checkbox"
              checked={selected.size === filteredUsers.length && filteredUsers.length > 0}
              onChange={toggleSelectAll}
              className="size-3.5 rounded"
            />
            تحديد الكل
          </Button>
          {selected.size > 0 && (
            <Badge className="rounded-full bg-primary/10 text-[10px] text-primary">
              {selected.size} محدد
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && isOwner && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs text-amber-600"
                onClick={() => handleBulk("warn")}
                disabled={busyAction}
              >
                {busyAction ? <Loader2 className="size-3 animate-spin" /> : <Gavel className="size-3" />}
                تحذير جماعي
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs text-orange-600"
                onClick={() => handleBulk("mute")}
                disabled={busyAction}
              >
                كتم ساعة
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs text-emerald-600"
                onClick={() => handleBulk("pardon")}
                disabled={busyAction}
              >
                عفو جماعي
              </Button>
            </>
          )}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs"
          >
            <option value="risk">ترتيب حسب الخطورة</option>
            <option value="level">ترتيب حسب المستوى</option>
            <option value="xp">ترتيب حسب الخبرة</option>
            <option value="name">ترتيب أبجدي</option>
          </select>
        </div>
      </div>

      {/* Players List */}
      {users == null ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
          لا يوجد لاعبون مطابقون.
        </p>
      ) : (
        <div className="space-y-2">
          {filteredUsers.map((user) => (
            <Card
              key={user.id}
              className={cn(
                "border-border/50 bg-card/80 transition-all duration-200 hover:border-border hover:shadow-md",
                selected.has(user.id) && "border-primary/30 bg-primary/5",
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selected.has(user.id)}
                    onChange={() => toggleSelect(user.id)}
                    className="size-4 shrink-0 rounded"
                  />

                  {/* Avatar */}
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                      user.risk.level === "critical"
                        ? "bg-rose-500/15 text-rose-600"
                        : user.risk.level === "high"
                          ? "bg-orange-500/15 text-orange-600"
                          : "bg-primary/10 text-primary",
                    )}
                  >
                    {user.name?.slice(0, 1) ?? "?"}
                  </span>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-bold text-sm">{user.name || "لاعب مجهول"}</p>
                      {user.isOwner && (
                        <Badge className="gap-1 rounded-full bg-primary/10 text-primary text-[10px]">
                          <Crown className="size-2.5" /> مالك
                        </Badge>
                      )}
                      {user.role === "admin" && (
                        <Badge variant="outline" className="gap-1 rounded-full text-primary text-[10px]">
                          <Shield className="size-2.5" /> مشرف
                        </Badge>
                      )}
                      <RiskBadge level={user.risk.level} />
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                      {user.email || "ضيف"} · Lv.{user.level} · {user.gamesPlayed} جولة · {user.gamesWon} فوز
                    </p>
                    <div className="mt-1.5 max-w-xs">
                      <WinRateBar won={user.gamesWon} total={user.gamesPlayed} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpanded(expanded === user.id ? null : user.id)}
                      className="gap-1 text-xs"
                    >
                      {expanded === user.id ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      ملف
                    </Button>
                    {isOwner && !user.isOwner && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => setRole({ userId: user.id as never, role: user.role === "admin" ? "user" : "admin" })}
                      >
                        <UserCog className="size-3" />
                        {user.role === "admin" ? " سحب" : " مشرف"}
                      </Button>
                    )}
                    {!user.isOwner && (
                      <>
                        <Button variant="outline" size="sm" className="gap-1 text-xs text-amber-600" onClick={() => setPunishDialog({ user, mode: "warn" })}>
                          <Gavel className="size-3" />
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1 text-xs text-orange-600" onClick={() => setPunishDialog({ user, mode: "mute" })}>
                          <MicOff className="size-3" />
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1 text-xs text-rose-600" onClick={() => setPunishDialog({ user, mode: "ban" })}>
                          <Ban className="size-3" />
                        </Button>
                        {hasPunishment(user) && (
                          <Button variant="ghost" size="sm" className="gap-1 text-xs text-emerald-600" onClick={() => handlePardon(user)}>
                            <RotateCcw className="size-3" /> عفو
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded Profile */}
                {expanded === user.id && (
                  <div className="mt-4 rounded-xl border border-border/50 bg-muted/20 p-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      {/* Stats */}
                      <div className="space-y-2">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                          <BarChart3 className="size-3.5" /> الإحصائيات
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="rounded-lg bg-card/80 p-2">
                            <p className="text-lg font-bold text-primary">{user.level}</p>
                            <p className="text-[9px] text-muted-foreground">مستوى</p>
                          </div>
                          <div className="rounded-lg bg-card/80 p-2">
                            <p className="text-lg font-bold text-emerald-600">{user.xp}</p>
                            <p className="text-[9px] text-muted-foreground">خبرة</p>
                          </div>
                          <div className="rounded-lg bg-card/80 p-2">
                            <p className="text-lg font-bold text-blue-600">{user.gamesWon}</p>
                            <p className="text-[9px] text-muted-foreground">فوز</p>
                          </div>
                          <div className="rounded-lg bg-card/80 p-2">
                            <p className="text-lg font-bold text-amber-600">{user.badgeCount}</p>
                            <p className="text-[9px] text-muted-foreground">شارة</p>
                          </div>
                        </div>
                      </div>

                      {/* Risk */}
                      <div className="space-y-2">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                          <Target className="size-3.5" /> تقييم الخطورة
                        </p>
                        <div className="rounded-lg bg-card/80 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-2xl font-bold">{user.risk.score}</span>
                            <RiskBadge level={user.risk.level} />
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                user.risk.level === "critical" ? "bg-rose-500" :
                                user.risk.level === "high" ? "bg-orange-500" :
                                user.risk.level === "medium" ? "bg-amber-500" : "bg-emerald-500",
                              )}
                              style={{ width: `${user.risk.score}%` }}
                            />
                          </div>
                          {user.risk.reasons.length > 0 && (
                            <div className="mt-2 space-y-0.5">
                              {user.risk.reasons.map((r, i) => (
                                <p key={i} className="text-[10px] text-muted-foreground">• {r}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Timeline */}
                      <div className="space-y-2">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                          <Activity className="size-3.5" /> النشاط
                        </p>
                        <PlayerTimeline user={user} />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Punishment Dialog */}
      {punishDialog && (
        <Dialog open onOpenChange={(open) => !open && setPunishDialog(null)}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {punishDialog.mode === "warn" && <><Gavel className="size-4 text-amber-500" /> تحذير لاعب</>}
                {punishDialog.mode === "mute" && <><MicOff className="size-4 text-orange-500" /> كتم لاعب</>}
                {punishDialog.mode === "ban" && <><Ban className="size-4 text-rose-500" /> حظر لاعب</>}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm font-bold">{punishDialog.user.name}</p>
              <PunishFormInline
                mode={punishDialog.mode}
                onSubmit={async (reason, duration) => {
                  try {
                    await applyPunishment({
                      userId: punishDialog.user.id as never,
                      type: punishDialog.mode === "warn" ? "warn" : punishDialog.mode === "mute" ? "mute" : "ban",
                      durationMs: duration,
                      reason,
                    });
                    toast.success("تم تطبيق العقوبة.");
                    setPunishDialog(null);
                  } catch (e) {
                    toast.error("تعذّر تطبيق العقوبة.");
                  }
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Inline Punishment Form ───────────────────────────────────
function PunishFormInline({
  mode,
  onSubmit,
}: {
  mode: "warn" | "mute" | "ban";
  onSubmit: (reason: string, durationMs?: number) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("60");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    const ms = mode !== "warn" ? Number(duration) * 60_000 : undefined;
    await onSubmit(reason.trim(), ms);
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="سبب العقوبة…"
        rows={2}
        className="rounded-xl"
      />
      {mode !== "warn" && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">المدة (دقائق):</label>
          <Input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="h-8 w-24 rounded-lg text-xs"
            min="1"
          />
        </div>
      )}
      <Button onClick={handleSubmit} disabled={!reason.trim() || busy} className="w-full gap-1.5 rounded-xl">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Gavel className="size-4" />}
        تأكيد العقوبة
      </Button>
    </div>
  );
}
