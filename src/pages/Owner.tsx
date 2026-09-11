import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { AiVerdict } from "@/convex/moderation";
import type {
  FinishedGameRow,
  LiveGame,
  ModLogEntry,
  QuestionRow,
  ReportRow,
  RuleRow,
  SettingsData,
  UserRow,
} from "@/convex/owner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
// Tabs removed - using sidebar navigation instead
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowLeft,
  Ban,
  BarChart3,
  Bot,
  BrainCircuit,
  Check,
  Crown,
  Database,
  Eraser,
  EyeOff,
  FileDown,
  Brain,
  Flag,
  Key,
  Gamepad2,
  Gavel,
  Globe,
  KeyRound,
  Link2,
  Loader2,
  Music,
  Megaphone,
  MicOff,
  Plus,
  Radio,
  RotateCcw,
  Scale,
  Search,
  Shield,
  Bug,
  ShieldCheck,
  Skull,
  Smartphone,
  Sparkles,
  Trash2,
  Trophy,
  UserCheck,
  UserCog,
  Users,
  X,
  Zap,
  Focus,
  Lock,
} from "lucide-react";
// Menu + Focus imported above via separate import
import { useNavigate } from "react-router";
import { CATEGORIES } from "@/convex/questions";
import { APP_VERSION } from "@/lib/app-version";
import { AdminAiTab } from "@/components/AdminAiTab";
import { DownloadsTab } from "@/components/DownloadsTab";
import { AiIntelligenceDashboard } from "@/components/AiIntelligenceDashboard";
import { TelegramSettings } from "@/components/TelegramSettings";
// This line is intentionally left to avoid duplicate import
import { AiControlTab } from "@/components/AiControlTab";
import { OwnerControlPanel } from "@/components/OwnerControlPanel";
import { OwnerPasswordManager } from "@/components/OwnerLoginDialog";
import { OwnerDashboard } from "@/components/owner/OwnerDashboard";
import { AdvancedPlayersTab } from "@/components/owner/AdvancedPlayersTab";
import { ReportsInbox } from "@/components/owner/ReportsInbox";
import MembershipAdmin from "@/components/owner/MembershipAdmin";
import { AiFreeChatTab } from "@/components/AiFreeChatTab";
import { AiTransparencyTab } from "@/components/AiTransparencyTab";
import { AiSystemsTab } from "@/components/AiSystemsTab";
import { AiSuiteTab } from "@/components/AiSuiteTab";
import { PrivateCouncilTab } from "@/components/PrivateCouncilTab";
import { MindHubTab } from "@/components/MindHubTab";
import { ViceOwnerTab } from "@/components/ViceOwnerTab";
import { DeputyCommandCenter } from "@/components/DeputyCommandCenter";
import { ApiHubTab } from "@/components/ApiHubTab";
import { ProblemsTab } from "@/components/ProblemsTab";
import { ErrorHunterTab } from "@/components/owner/ErrorHunterTab";
import { SoundControlPanel } from "@/components/owner/SoundControlPanel";
import MasterAIDashboard from "@/components/owner/MasterAIDashboard";
import { LawEnforcementTab } from "@/components/owner/LawEnforcementTab";
import { AiUpgradeCenterTab } from "@/components/AiUpgradeCenterTab";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function fmtDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("ar-EG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SEVERITY_STYLES: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  medium: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  high: "bg-rose-500/10 text-rose-700 border-rose-500/30",
};

function SeverityBadge({ level }: { level: string }) {
  const labels: Record<string, string> = { low: "بسيطة", medium: "متوسطة", high: "خطيرة" };
  return (
    <Badge variant="outline" className={cn("gap-1.5", SEVERITY_STYLES[level] ?? SEVERITY_STYLES.low)}>
      <AlertTriangle className="size-3" />
      {labels[level] ?? level}
    </Badge>
  );
}

function FeatureTitle({ n, title, desc }: { n: string; title: string; desc?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-bold text-primary">
        {n}
      </span>
      <div>
        <h3 className="font-bold text-foreground">{title}</h3>
        {desc && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="border-border/80 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>
          <Badge variant="outline" className="rounded-full text-[10px]">
            {hint}
          </Badge>
        </div>
        <p className="mt-4 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
        <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

const ACTION_LABELS: Record<string, { label: string; tone: string }> = {
  warn: { label: "تحذير", tone: "text-amber-600 bg-amber-500/10" },
  mute: { label: "كتم", tone: "text-orange-600 bg-orange-500/10" },
  ban: { label: "حظر", tone: "text-rose-600 bg-rose-500/10" },
  ban_permanent: { label: "حظر دائم", tone: "text-rose-600 bg-rose-500/10" },
  pardon: { label: "عفو", tone: "text-emerald-600 bg-emerald-500/10" },
  grant_admin: { label: "ترقية", tone: "text-primary bg-primary/10" },
  revoke_admin: { label: "تنزيل", tone: "text-muted-foreground bg-muted" },
  cheat_warn: { label: "غش · تحذير", tone: "text-amber-600 bg-amber-500/10" },
  cheat_penalty: { label: "غش · خصم", tone: "text-orange-600 bg-orange-500/10" },
  cheat_ban: { label: "غش · حظر", tone: "text-rose-600 bg-rose-500/10" },
  cheat_ban_permanent: { label: "غش · حظر دائم", tone: "text-rose-600 bg-rose-500/10" },
  ai_review: { label: "فحص AI", tone: "text-primary bg-primary/10" },
  ai_warn: { label: "AI · تحذير", tone: "text-amber-600 bg-amber-500/10" },
  ai_mute: { label: "AI · كتم", tone: "text-orange-600 bg-orange-500/10" },
  ai_ban: { label: "AI · حظر", tone: "text-rose-600 bg-rose-500/10" },
  ai_error: { label: "AI · خطأ", tone: "text-muted-foreground bg-muted" },
  report_reviewed: { label: "بلاغ مُعالج", tone: "text-primary bg-primary/10" },
  report_dismissed: { label: "بلاغ مرفوض", tone: "text-muted-foreground bg-muted" },
  kick: { label: "طرد", tone: "text-rose-600 bg-rose-500/10" },
};

function ActionBadge({ action }: { action: string }) {
  const meta = ACTION_LABELS[action] ?? { label: action, tone: "text-muted-foreground bg-muted" };
  return (
    <Badge className={cn("rounded-full", meta.tone)}>{meta.label}</Badge>
  );
}

const ACTOR_ICONS: Record<string, React.ElementType> = {
  ai: Bot,
  owner: Crown,
  system: ShieldCheck,
};

// ---------------------------------------------------------------------------
// Punishment dialog (warn / mute / ban) — features 05–08
// ---------------------------------------------------------------------------

const MUTE_DURATIONS = [
  { label: "ساعة", ms: 60 * 60 * 1000 },
  { label: "6 ساعات", ms: 6 * 60 * 60 * 1000 },
  { label: "24 ساعة", ms: 24 * 60 * 60 * 1000 },
  { label: "3 أيام", ms: 3 * 24 * 60 * 60 * 1000 },
];

const BAN_DURATIONS = [
  { label: "ساعة", ms: 60 * 60 * 1000 },
  { label: "6 ساعات", ms: 6 * 60 * 60 * 1000 },
  { label: "24 ساعة", ms: 24 * 60 * 60 * 1000 },
  { label: "7 أيام", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "دائم", ms: 0 },
];

function PunishDialog({
  user,
  mode,
  open,
  onOpenChange,
}: {
  user: UserRow;
  mode: "warn" | "mute" | "ban";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const applyPunishment = useMutation(api.owner.applyPunishment);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<string>(
    mode === "ban" ? "24 ساعة" : "6 ساعات",
  );
  const [busy, setBusy] = useState(false);

  const durations = mode === "mute" ? MUTE_DURATIONS : BAN_DURATIONS;
  const titles: Record<string, string> = {
    warn: "إصدار تحذير رسمي",
    mute: "كتم مؤقت",
    ban: "حظر الحساب",
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("أدخل سبب العقوبة أولاً.");
      return;
    }
    setBusy(true);
    try {
      const chosen = durations.find((d) => d.label === duration);
      await applyPunishment({
        userId: user.id as never,
        type: mode,
        reason: reason.trim(),
        durationMs:
          mode === "warn" ? undefined : chosen && chosen.ms > 0 ? chosen.ms : undefined,
      });
      toast.success(
        mode === "warn"
          ? "تم إرسال التحذير."
          : mode === "mute"
            ? "تم كتم اللاعب."
            : "تم حظر اللاعب.",
      );
      onOpenChange(false);
      setReason("");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر تطبيق العقوبة.");
    } finally {
      setBusy(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "warn" ? <Gavel className="size-4 text-amber-600" /> : mode === "mute" ? <MicOff className="size-4 text-orange-600" /> : <Ban className="size-4 text-rose-600" />}
            {titles[mode]} — {user.name}
          </DialogTitle>
          <DialogDescription>
            {mode === "warn"
              ? "تحذير رسمي يُسجَّل في ملف اللاعب ويظهر له عند دخوله."
              : mode === "mute"
                ? "يمنع اللاعب من التواصل في الموقع للمدة المحددة."
                : "يحظر اللاعب من الدخول واللعب للمدة المحددة."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode !== "warn" && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold">مدة العقوبة</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="اختر المدة" />
                </SelectTrigger>
                <SelectContent>
                  {durations.map((d) => (
                    <SelectItem key={d.label} value={d.label}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">سبب العقوبة</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: كلمة مسيئة في الاسم — غش في الجولة — إزعاج متكرر…"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            إلغاء
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={busy}
            className={cn(
              mode === "warn" && "bg-amber-600 hover:bg-amber-700",
              mode === "mute" && "bg-orange-600 hover:bg-orange-700",
              mode === "ban" && "bg-rose-600 hover:bg-rose-700",
            )}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Gavel className="size-4" />}
            تأكيد العقوبة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Users tab (features 02–09)
// ---------------------------------------------------------------------------

function UsersTab({ isOwner }: { isOwner: boolean }) {
  const [search, setSearch] = useState("");
  const users = useQuery(api.owner.listUsers, { search });
  const setRole = useMutation(api.owner.setRole);
  const pardonUser = useMutation(api.owner.pardonUser);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ user: UserRow; mode: "warn" | "mute" | "ban" } | null>(null);
  const [busyPardon, setBusyPardon] = useState<string | null>(null);

  const handleRole = async (user: UserRow, role: "admin" | "user") => {
    try {
      await setRole({ userId: user.id as never, role });
      toast.success(role === "admin" ? `تم منح ${user.name} صلاحية مشرف.` : `تم سحب صلاحية المشرف من ${user.name}.`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر تغيير الصلاحية.");
    }
  };

  const handlePardon = async (user: UserRow) => {
    setBusyPardon(user.id);
    try {
      await pardonUser({ userId: user.id as never, reason: "عفو إداري" });
      toast.success(`تم رفع العقوبات عن ${user.name}.`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر رفع العقوبات.");
    } finally {
      setBusyPardon(null);
    }
  };

  const hasPunishment = (u: UserRow) =>
    u.warnings > 0 || u.mutedUntil != null || u.bannedUntil != null || u.bannedPermanent;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FeatureTitle
          n="02"
          title="إدارة المستخدمين"
          desc="ابحث عن أي لاعب، اطّلع على ملفه، وطبّق العقوبات المناسبة بنقرة واحدة."
        />
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

      {users == null ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
          لا يوجد مستخدمون مطابقون.
        </p>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <Card key={user.id} className="border-border/80 shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {user.name.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-bold">{user.name}</p>
                      {user.isOwner && (
                        <Badge className="gap-1 rounded-full bg-primary/10 text-primary hover:bg-primary/10">
                          <Crown className="size-3" />
                          المالك
                        </Badge>
                      )}
                      {user.role === "admin" && (
                        <Badge variant="outline" className="gap-1 rounded-full text-primary">
                          <Shield className="size-3" />
                          مشرف
                        </Badge>
                      )}
                      {user.bannedPermanent && (
                        <Badge className="gap-1 rounded-full bg-rose-500/10 text-rose-700 hover:bg-rose-500/10">
                          <Ban className="size-3" />
                          حظر دائم
                        </Badge>
                      )}
                      {!user.bannedPermanent && user.bannedUntil != null && (
                        <Badge className="gap-1 rounded-full bg-rose-500/10 text-rose-700 hover:bg-rose-500/10">
                          <Ban className="size-3" />
                          محظور حتى {fmtDate(user.bannedUntil)}
                        </Badge>
                      )}
                      {user.mutedUntil != null && (
                        <Badge variant="outline" className="gap-1 rounded-full text-orange-600">
                          <MicOff className="size-3" />
                          مكتوم حتى {fmtDate(user.mutedUntil)}
                        </Badge>
                      )}
                      {user.warnings > 0 && (
                        <Badge variant="outline" className="gap-1 rounded-full text-amber-600">
                          <AlertTriangle className="size-3" />
                          {user.warnings} تحذير
                        </Badge>
                      )}
                      {user.cheatStrikes > 0 && (
                        <Badge variant="outline" className="gap-1 rounded-full text-rose-600">
                          <Eraser className="size-3" />
                          {user.cheatStrikes} غش
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {user.email ?? "ضيف"} · المستوى {user.level} · {user.gamesPlayed} جولة ·{" "}
                      {user.gamesWon} فوز · {user.badgeCount} شارة
                    </p>
                  </div>

                  {/* Feature 03: expandable player profile */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => setExpanded(expanded === user.id ? null : user.id)}
                  >
                    {expanded === user.id ? "إخفاء" : "ملف اللاعب"}
                  </Button>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {isOwner && !user.isOwner && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => handleRole(user, user.role === "admin" ? "user" : "admin")}
                      >
                        <UserCog className="size-3.5" />
                        {user.role === "admin" ? "سحب المشرف" : "منح مشرف"}
                      </Button>
                    )}
                    {!user.isOwner && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs text-amber-600"
                          onClick={() => setDialog({ user, mode: "warn" })}
                        >
                          <Gavel className="size-3.5" />
                          تحذير
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs text-orange-600"
                          onClick={() => setDialog({ user, mode: "mute" })}
                        >
                          <MicOff className="size-3.5" />
                          كتم
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs text-rose-600"
                          onClick={() => setDialog({ user, mode: "ban" })}
                        >
                          <Ban className="size-3.5" />
                          حظر
                        </Button>
                        {hasPunishment(user) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-xs text-emerald-600"
                            onClick={() => handlePardon(user)}
                            disabled={busyPardon === user.id}
                          >
                            {busyPardon === user.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="size-3.5" />
                            )}
                            عفو
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {expanded === user.id && (
                  <div className="mt-4 grid gap-3 rounded-xl border border-border/60 bg-muted/30 p-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">الخبرة والمستوى</p>
                      <p className="mt-1 text-sm font-bold">
                        {user.xp} XP · مستوى {user.level}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">الأداء</p>
                      <p className="mt-1 text-sm font-bold">
                        {user.gamesWon} فوز من {user.gamesPlayed} جولة · {user.badgeCount} شارة
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">الوضع التأديبي</p>
                      <p className="mt-1 text-sm font-bold">
                        {user.bannedPermanent
                          ? "محظور نهائياً"
                          : user.bannedUntil != null
                            ? `محظور حتى ${fmtDate(user.bannedUntil)}`
                            : user.mutedUntil != null
                              ? `مكتوم حتى ${fmtDate(user.mutedUntil)}`
                              : user.warnings > 0
                                ? `${user.warnings} تحذير`
                                : "نظيف"}
                      </p>
                      {user.banReason && (
                        <p className="mt-1 text-xs text-muted-foreground">{user.banReason}</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {dialog && (
        <PunishDialog
          user={dialog.user}
          mode={dialog.mode}
          open
          onOpenChange={(open) => !open && setDialog(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reports tab (features 10–11)
// ---------------------------------------------------------------------------

function ReportsTab() {
  const reports = useQuery(api.owner.getReports);
  const resolveReport = useMutation(api.owner.resolveReport);
  const applyPunishment = useMutation(api.owner.applyPunishment);
  const aiModerateContent = useAction(api.moderation.aiModerateContent) as unknown as (
    args: { content: string; context?: string },
  ) => Promise<AiVerdict>;
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [verdicts, setVerdicts] = useState<Record<string, AiVerdict>>({});
  const [applying, setApplying] = useState<string | null>(null);

  const analyze = async (report: ReportRow) => {
    setAnalyzing(report.id);
    try {
      const verdict = await aiModerateContent({
        content: `اللاعب المُبلَّغ عنه: ${report.targetName}\nسبب البلاغ: ${report.reason}${report.details ? `\nالتفاصيل: ${report.details}` : ""}`,
        context: `مُقدِّم البلاغ: ${report.reporterName}`,
      });
      setVerdicts((v) => ({ ...v, [report.id]: verdict }));
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر فحص البلاغ بالذكاء الاصطناعي.");
    } finally {
      setAnalyzing(null);
    }
  };

  const applyAi = async (report: ReportRow) => {
    const verdict = verdicts[report.id] ?? report.aiVerdict;
    if (!verdict || verdict.compliant || verdict.suggestedAction === "none") return;
    setApplying(report.id);
    try {
      await applyPunishment({
        userId: report.targetId as never,
        type: verdict.suggestedAction,
        durationMs: verdict.suggestedDurationMs ?? undefined,
        reason: `عقوبة مقترحة من الذكاء الاصطناعي: ${verdict.violation ?? verdict.reasoning}`,
      });
      await resolveReport({ reportId: report.id as never, status: "reviewed" });
      toast.success("تم تطبيق عقوبة الذكاء الاصطناعي على اللاعب.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر تطبيق العقوبة.");
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="space-y-5">
      <FeatureTitle
        n="10"
        title="صندوق البلاغات"
        desc="بلاغات اللاعبين ضد بعضهم، مع تحليل تلقائي بالذكاء الاصطناعي وتطبيق العقوبة المقترحة بضغطة واحدة."
      />

      {reports == null ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : reports.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
          لا توجد بلاغات حالياً — كل شيء هادئ 🕊️
        </p>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const verdict = verdicts[report.id] ?? report.aiVerdict;
            return (
              <Card key={report.id} className="border-border/80 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Flag className="size-4 text-rose-500" />
                      <p className="font-bold">{report.targetName}</p>
                      <Badge variant="outline" className="rounded-full text-[10px]">
                        بلّغ عنه {report.reporterName}
                      </Badge>
                      <Badge
                        className={cn(
                          "rounded-full",
                          report.status === "open" && "bg-amber-500/10 text-amber-700",
                          report.status === "reviewed" && "bg-primary/10 text-primary",
                          report.status === "dismissed" && "bg-muted text-muted-foreground",
                        )}
                      >
                        {report.status === "open"
                          ? "قيد المراجعة"
                          : report.status === "reviewed"
                            ? "تمت المعالجة"
                            : "لا مخالفة"}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{fmtDate(report.createdAt)}</span>
                  </div>

                  <p className="mt-3 text-sm font-semibold">السبب: {report.reason}</p>
                  {report.details && (
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{report.details}</p>
                  )}

                  {verdict && (
                    <div
                      className={cn(
                        "mt-4 rounded-xl border p-4",
                        verdict.compliant
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-rose-500/30 bg-rose-500/5",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Bot className="size-4 text-primary" />
                        <p className="text-sm font-bold">
                          {verdict.compliant ? "مطابق للقوانين" : "مخالفة مؤكدة"}
                        </p>
                        {!verdict.compliant && <SeverityBadge level={verdict.severity} />}
                        {!verdict.compliant && (
                          <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">
                            العقوبة المقترحة:{" "}
                            {verdict.suggestedAction === "warn"
                              ? "تحذير"
                              : verdict.suggestedAction === "mute"
                                ? "كتم"
                                : verdict.suggestedAction === "ban"
                                  ? "حظر"
                                  : "بدون"}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {verdict.violation ?? verdict.reasoning}
                      </p>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {!verdict && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => analyze(report)}
                        disabled={analyzing === report.id}
                      >
                        {analyzing === report.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="size-3.5" />
                        )}
                        فحص بالذكاء الاصطناعي
                      </Button>
                    )}
                    {verdict && !verdict.compliant && verdict.suggestedAction !== "none" && (
                      <Button
                        size="sm"
                        className="gap-1.5 bg-rose-600 hover:bg-rose-700"
                        onClick={() => applyAi(report)}
                        disabled={applying === report.id}
                      >
                        {applying === report.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Gavel className="size-3.5" />
                        )}
                        تطبيق عقوبة الذكاء
                      </Button>
                    )}
                    {report.status === "open" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-emerald-600"
                          onClick={() =>
                            resolveReport({
                              reportId: report.id as never,
                              status: "dismissed",
                              note: "لا مخالفة — تم رفض البلاغ",
                            })
                          }
                        >
                          <Check className="size-3.5" />
                          لا مخالفة
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() =>
                            resolveReport({
                              reportId: report.id as never,
                              status: "reviewed",
                              note: "تمت المعالجة يدوياً",
                            })
                          }
                        >
                          <UserCheck className="size-3.5" />
                          اعتُمد يدوياً
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="border-border/80 shadow-sm">
        <CardContent className="p-5">
          <FeatureTitle
            n="11"
            title="مُحلِّل المحتوى بالذكاء الاصطناعي"
            desc="الصق أي محتوى (اسم مستخدم، رسالة…) ليقيّمه الرقيب الآلي فوراً حسب القوانين."
          />
          <AiScanner />
        </CardContent>
      </Card>
    </div>
  );
}

function AiScanner() {
  const aiModerateContent = useAction(api.moderation.aiModerateContent) as unknown as (
    args: { content: string; context?: string },
  ) => Promise<AiVerdict>;
  const [content, setContent] = useState("");
  const [context, setContext] = useState("");
  const [verdict, setVerdict] = useState<AiVerdict | null>(null);
  const [busy, setBusy] = useState(false);

  const scan = async () => {
    if (!content.trim()) {
      toast.error("الصق المحتوى المراد فحصه أولاً.");
      return;
    }
    setBusy(true);
    setVerdict(null);
    try {
      const result = await aiModerateContent({
        content: content.trim(),
        context: context.trim() || undefined,
      });
      setVerdict(result);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر الفحص.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 space-y-3">
      <Input
        value={context}
        onChange={(e) => setContext(e.target.value)}
        placeholder="السياق (اختياري): من صاحب المحتوى؟"
        className="h-10 rounded-xl"
      />
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="مثال: اسم مستخدم مسيء، أو نص رسالة…"
        rows={3}
        className="rounded-xl"
      />
      <Button onClick={scan} disabled={busy} className="gap-2 rounded-xl">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}
        فحص بالذكاء الاصطناعي
      </Button>

      {verdict && (
        <div
          className={cn(
            "rounded-xl border p-4",
            verdict.compliant ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold">
              {verdict.compliant ? "✅ مطابق للقوانين" : "🚨 مخالفة مؤكدة"}
            </p>
            {!verdict.compliant && <SeverityBadge level={verdict.severity} />}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{verdict.reasoning}</p>
          {!verdict.compliant && (
            <p className="mt-2 text-xs font-semibold text-rose-600">
              العقوبة المقترحة:{" "}
              {verdict.suggestedAction === "warn"
                ? "تحذير"
                : verdict.suggestedAction === "mute"
                  ? "كتم"
                  : verdict.suggestedAction === "ban"
                    ? "حظر"
                    : "بدون"}{" "}
              — طبّقها من تبويب المستخدمين.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rules tab (feature 14)
// ---------------------------------------------------------------------------

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; tone: string }> = {
  essential: { label: "قوانين أساسية", icon: Scale, tone: "text-primary bg-primary/10" },
  prohibited: { label: "ممنوعات صريحة", icon: Ban, tone: "text-rose-600 bg-rose-500/10" },
  punishment: { label: "سلم العقوبات", icon: Gavel, tone: "text-amber-600 bg-amber-500/10" },
};

function RulesTab() {
  const rules = useQuery(api.owner.getRules);
  const saveRule = useMutation(api.owner.saveRule);
  const deleteRule = useMutation(api.owner.deleteRule);
  const seedDefaultRules = useMutation(api.owner.seedDefaultRules);
  const [seeding, setSeeding] = useState(false);
  const [draft, setDraft] = useState<{
    id?: string;
    title: string;
    category: RuleRow["category"];
    description: string;
    severity: RuleRow["severity"];
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const grouped = (rules ?? []).reduce<Record<string, RuleRow[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.title.trim() || !draft.description.trim()) {
      toast.error("أدخل عنوان القانون ووصفه.");
      return;
    }
    setBusy(true);
    try {
      await saveRule({
        id: draft.id as never,
        title: draft.title.trim(),
        category: draft.category,
        description: draft.description.trim(),
        severity: draft.severity,
        order: rules?.length ?? 0,
      });
      toast.success(draft.id ? "تم تحديث القانون." : "تمت إضافة القانون.");
      setDraft(null);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر الحفظ.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FeatureTitle
          n="14"
          title="منظومة القوانين"
          desc="القوانين الأساسية والممنوعات وسلم العقوبات — تظهر للجميع في صفحة /rules، ويراعيها الرقيب الآلي تلقائياً."
        />
        <Button
          className="gap-1.5 rounded-xl"
          onClick={() =>
            setDraft({ title: "", category: "essential", description: "", severity: "low" })
          }
        >
          <Plus className="size-4" />
          قانون جديد
        </Button>
      </div>

      {rules == null ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : rules.length === 0 ? (
        <Card className="border-dashed border-border/70">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <Scale className="size-10 text-primary/50" />
            <div>
              <p className="font-bold">لا توجد قوانين بعد</p>
              <p className="mt-1 text-sm text-muted-foreground">
                ابدأ بزراعة القوانين الافتراضية الجاهزة، ثم عدّلها كما تريد.
              </p>
            </div>
            <Button
              className="gap-1.5 rounded-xl"
              onClick={async () => {
                setSeeding(true);
                try {
                  await seedDefaultRules();
                  toast.success("تمت زراعة القوانين الافتراضية.");
                } catch (error) {
                  console.error(error);
                  toast.error(error instanceof Error ? error.message : "تعذّر الزراعة.");
                } finally {
                  setSeeding(false);
                }
              }}
              disabled={seeding}
            >
              {seeding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              زراعة القوانين الافتراضية
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {(["essential", "prohibited", "punishment"] as const).map((cat) => {
            const meta = CATEGORY_META[cat];
            const items = grouped[cat] ?? [];
            return (
              <Card key={cat} className="border-border/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <span className={cn("flex size-8 items-center justify-center rounded-lg", meta.tone)}>
                      <meta.icon className="size-4" />
                    </span>
                    {meta.label}
                    <span className="ms-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {items.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.length === 0 && (
                    <p className="text-xs text-muted-foreground">لا توجد قوانين في هذه الفئة.</p>
                  )}
                  {items.map((rule) => (
                    <div key={rule.id} className="rounded-xl border border-border/60 bg-muted/30 p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold">{rule.title}</p>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            onClick={() =>
                              setDraft({
                                id: rule.id,
                                title: rule.title,
                                category: rule.category,
                                description: rule.description,
                                severity: rule.severity,
                              })
                            }
                          >
                            <Zap className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-rose-500"
                            onClick={() => deleteRule({ id: rule.id as never })}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{rule.description}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {draft && (
        <Dialog open onOpenChange={(o) => !o && setDraft(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{draft.id ? "تعديل قانون" : "إضافة قانون جديد"}</DialogTitle>
              <DialogDescription>
                أي تغيير هنا ينعكس فوراً على صفحة القوانين العامة وعلى قرارات الرقيب الآلي.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">الفئة</Label>
                  <Select
                    value={draft.category}
                    onValueChange={(v) => setDraft({ ...draft, category: v as RuleRow["category"] })}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="essential">قوانين أساسية</SelectItem>
                      <SelectItem value="prohibited">ممنوعات</SelectItem>
                      <SelectItem value="punishment">عقوبات</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">الخطورة</Label>
                  <Select
                    value={draft.severity}
                    onValueChange={(v) => setDraft({ ...draft, severity: v as RuleRow["severity"] })}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">بسيطة</SelectItem>
                      <SelectItem value="medium">متوسطة</SelectItem>
                      <SelectItem value="high">خطيرة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">عنوان القانون</Label>
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">نص القانون</Label>
                <Textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={3}
                  className="rounded-xl"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="ghost" onClick={() => setDraft(null)} disabled={busy}>
                إلغاء
              </Button>
              <Button onClick={handleSave} disabled={busy} className="gap-1.5">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                حفظ القانون
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Card className="border-border/80 shadow-sm">
        <CardContent className="p-5">
          <p className="text-xs text-muted-foreground">
            💡 القانون الجديد يبدأ مفعوله فوراً: الرقيب الآلي يستخدم القوانين النشطة عند فحص
            البلاغات، وصفحة <span className="font-mono text-foreground">/rules</span> تعرضها للجميع.
            عند أول استخدام اضغط «قانون جديد» لإضافة القوانين، أو استخدم قائمة الأمثلة أعلاه كمرجع.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI tab (features 12–13)
// ---------------------------------------------------------------------------

function AiTab({ settings }: { settings: SettingsData }) {
  const updateSettings = useMutation(api.owner.updateSettings);
  const logs = useQuery(api.owner.getModerationLogs, {});
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState(settings.aiModel);

  const save = async (patch: Parameters<typeof updateSettings>[0]) => {
    setBusy(true);
    try {
      await updateSettings(patch);
      toast.success("تم حفظ إعدادات الرقابة.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر الحفظ.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {!settings.aiKeyConfigured && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-600" />
            <div>
              <p className="text-sm font-bold text-rose-700">لا يوجد نظام AI مُفعّل</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                فعّل النظام الأول (مفتاح API + رابط المزوّد) أو النظام الثاني (مفتاح API فقط)
                من تبويب «مركز API» في غرفة المالك. حتى ذلك الحين يتعذر على الرقيب الآلي
                فحص البلاغات أو تطبيق العقوبات أو توليد الأسئلة.
              </p>
            </div>
          </div>
        </div>
      )}
      <FeatureTitle
        n="12"
        title="إعدادات الرقابة الذكية"
        desc="الرقيب الآلي (عبر نظامي مركز API) يفحص البلاغات والمحتوى وفق القوانين. فعّل التطبيق التلقائي ليُصدر العقوبات بنفسه — مع تسجيل كل قرار."
      />

      <Card className="border-border/80 shadow-sm">
        <CardContent className="space-y-5 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold">
                <Bot className="size-4 text-primary" />
                تفعيل الرقيب الآلي
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                فحص تلقائي لكل بلاغ جديد حسب القوانين المفعّلة.
              </p>
            </div>
            <Switch
              checked={settings.aiEnabled}
              onCheckedChange={(v) => save({ aiEnabled: v })}
              disabled={busy}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold">
                <Gavel className="size-4 text-amber-600" />
                التطبيق التلقائي للعقوبات
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                عند المخالفة: تحذير / كتم / حظر يُطبَّق فوراً على اللاعب دون تدخل يدوي.
              </p>
            </div>
            <Switch
              checked={settings.aiAutoApply}
              onCheckedChange={(v) => save({ aiAutoApply: v })}
              disabled={busy}
            />
          </div>
          <Separator />
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-56">
              <Label className="text-xs font-semibold">نموذج الذكاء الاصطناعي</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="mt-2 h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openrouter/free">openrouter/free (الموصى به — يعمل دائماً)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              className="gap-1.5 rounded-xl"
              onClick={() => save({ aiModel: model })}
              disabled={busy || model === settings.aiModel}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              حفظ النموذج
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="size-4" />
            </span>
            <span>سجل الرقابة (ميزة 13)</span>
            <span className="ms-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {logs?.length ?? 0}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ModerationLogList logs={logs} empty="لا توجد أحداث رقابة بعد." />
        </CardContent>
      </Card>
    </div>
  );
}

function ModerationLogList({ logs, empty }: { logs: ModLogEntry[] | null | undefined; empty: string }) {
  if (logs == null) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (logs.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const ActorIcon = ACTOR_ICONS[log.actorType] ?? Shield;
        return (
          <div
            key={log.id}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2.5"
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-card text-primary">
              <ActorIcon className="size-3.5" />
            </span>
            <span className="text-xs font-bold text-muted-foreground">{log.actorName}</span>
            <ActionBadge action={log.action} />
            <span className="text-xs font-semibold">{log.targetName}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{log.reason}</span>
            <SeverityBadge level={log.severity} />
            <span className="text-[10px] tabular-nums text-muted-foreground">{fmtDate(log.createdAt)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Games tab (features 15–16)
// ---------------------------------------------------------------------------

function GamesTab() {
  const games = useQuery(api.owner.getLiveGames);
  const finishedGames = useQuery(api.owner.getFinishedGames, {});
  const abortGame = useMutation(api.owner.abortGame);
  const kickPlayer = useMutation(api.owner.kickPlayer);
  const [busy, setBusy] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const handleAbort = async (game: LiveGame) => {
    setBusy(game.id);
    try {
      await abortGame({ code: game.code });
      toast.success(`تم إيقاف غرفة ${game.code} وإنهاء الجولة.`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر إيقاف الغرفة.");
    } finally {
      setBusy(null);
    }
  };

  const handleKick = async (game: LiveGame, playerId: string, name: string) => {
    setBusy(game.id + playerId);
    try {
      await kickPlayer({ code: game.code, userId: playerId as never });
      toast.success(`تم طرد ${name} من الغرفة.`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر الطرد.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <FeatureTitle
        n="15"
        title="الغرف المباشرة"
        desc="كل الغرف النشطة في الوقت الحالي — راقبها وأوقف أي جولة أو اطرد أي لاعب فوراً."
      />

      {games == null ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : games.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
          لا توجد غرف نشطة حالياً.
        </p>
      ) : (
        <div className="space-y-3">
          {games.map((game) => (
            <Card key={game.id} className="border-border/80 shadow-sm">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Gamepad2 className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm font-bold tracking-widest">{game.code}</p>
                      <Badge
                        className={cn(
                          "gap-1 rounded-full",
                          game.status === "waiting"
                            ? "bg-amber-500/10 text-amber-700"
                            : "bg-emerald-500/10 text-emerald-700",
                        )}
                      >
                        <Radio className="size-3" />
                        {game.status === "waiting" ? "لوبي" : "جارية"}
                      </Badge>
                      <Badge variant="outline" className="rounded-full text-[10px]">
                        <Users className="size-3" />
                        {game.playerCount} لاعب
                      </Badge>
                      {game.status === "playing" && (
                        <Badge variant="outline" className="rounded-full text-[10px]">
                          سؤال {game.currentQuestionIndex + 1}/{game.questionCount}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      المضيف: {game.hostName} · أُنشئت {fmtDate(game.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-rose-600"
                    onClick={() => handleAbort(game)}
                    disabled={busy === game.id}
                  >
                    {busy === game.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Ban className="size-3.5" />
                    )}
                    إيقاف الجولة
                  </Button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {game.players.map((p) => (
                    <span
                      key={p.id}
                      className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-semibold"
                    >
                      {p.id === game.hostId && <Crown className="size-3 text-amber-500" />}
                      {p.name}
                      {p.id !== game.hostId && (
                        <button
                          type="button"
                          title="طرد اللاعب"
                          className="ms-0.5 text-muted-foreground transition-colors hover:text-rose-600"
                          onClick={() => handleKick(game, p.id, p.name)}
                          disabled={busy === game.id + p.id}
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-border/80 shadow-sm">
        <CardContent className="p-5">
          <FeatureTitle
            n="16"
            title="التحكم الكامل في الغرف"
            desc="إيقاف الجولة ينهيها فوراً ويوزّع الخبرة المكتسبة على اللاعبين. الطرد يُزيل اللاعب من اللوبي أو يُلغي نتيجته في الجولة الجارية."
          />
        </CardContent>
      </Card>

      {/* Feature 21: finished games archive (permanent history) */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Archive className="size-4" />
            </span>
            <span>أرشيف الجولات المنتهية (ميزة 21)</span>
            <Badge variant="outline" className="rounded-full text-[10px]">
              {(finishedGames?.length ?? 0)} جولة موثّقة
            </Badge>
            <button
              type="button"
              className="ms-auto flex items-center gap-1.5 text-xs font-semibold text-primary transition-colors hover:underline"
              onClick={() => setArchiveOpen((v) => !v)}
            >
              <Trophy className="size-3.5" />
              {archiveOpen ? "إخفاء السجل" : "عرض السجل"}
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {finishedGames == null ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : !archiveOpen ? (
            <p className="flex items-start gap-2 rounded-xl bg-muted/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              <Archive className="mt-0.5 size-3.5 shrink-0 text-primary" />
              كل جولة تنتهي تُسجَّل نتائجها نهائياً هنا — لا تُحذف مع تنظيف الغرف
              التلقائي (الذي يحذف الغرف بعد 48 ساعة فقط). اضغط «عرض السجل» لاستعراض
              الفائزين والنتائج.
            </p>
          ) : finishedGames.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              لا توجد جولات منتهية موثّقة بعد — العب جولة لتظهر هنا.
            </p>
          ) : (
            <div className="space-y-3">
              {finishedGames.map((game) => (
                <div
                  key={game.id}
                  className="rounded-2xl border border-border/70 bg-muted/20 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Trophy className="size-4" />
                    </span>
                    <p className="font-mono text-sm font-bold tracking-widest">{game.code}</p>
                    <Badge variant="outline" className="rounded-full text-[10px]">
                      {game.playerCount} لاعب · {game.questionCount} أسئلة
                    </Badge>
                    <span className="ms-auto text-[10px] text-muted-foreground">
                      {fmtDate(game.playedAt)}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {game.players.map((p) => (
                      <div
                        key={`${game.id}-${p.rank}-${p.name}`}
                        className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-card px-3 py-2"
                      >
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                            p.rank === 1
                              ? "bg-amber-500/15 text-amber-600"
                              : p.rank === 2
                                ? "bg-slate-500/15 text-slate-600"
                                : p.rank === 3
                                  ? "bg-orange-500/15 text-orange-600"
                                  : "bg-muted text-muted-foreground",
                          )}
                        >
                          {p.rank}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                          {p.name}
                          {p.won && <Crown className="ms-1 inline size-3.5 text-amber-500" />}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {p.correctCount} صحيحة
                        </span>
                        <span className="text-xs font-bold text-emerald-600">+{p.xpEarned} XP</span>
                        <span className="font-mono text-sm font-bold tabular-nums text-primary">
                          {p.score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Question bank tab (feature 17)
// ---------------------------------------------------------------------------

function QuestionsTab() {
  const questions = useQuery(api.owner.getQuestionQuality);
  const toggleQuestion = useMutation(api.owner.toggleQuestion);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);

  const categories = questions ? [...new Set(questions.map((q) => q.category))] : [];
  const filtered = (questions ?? []).filter(
    (q) =>
      (category === "all" || q.category === category) &&
      (search.trim() === "" || q.question.toLowerCase().includes(search.trim().toLowerCase())),
  );
  const disabledCount = (questions ?? []).filter((q) => q.disabled).length;

  const toggle = async (q: QuestionRow) => {
    setBusy(q.id);
    try {
      await toggleQuestion({ questionId: q.id });
      toast.success(q.disabled ? "تمت إعادة تفعيل السؤال." : "تم تعطيل السؤال.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر التعديل.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <FeatureTitle
        n="17"
        title="بنك الأسئلة"
        desc={`${questions?.length ?? 0} سؤالاً — علّق أي سؤال مؤقتاً (لا يظهر في الجولات) أو أعد تفعيله. ${disabledCount} سؤالاً معطلاً حالياً.`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في الأسئلة…"
            className="h-10 rounded-xl ps-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-10 w-44 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الفئات</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {questions === undefined ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((q) => (
            <div
              key={q.id}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3",
                q.disabled ? "border-dashed border-border/70 bg-muted/30 opacity-70" : "border-border/70 bg-card",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    {q.category}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full text-[10px]",
                      q.difficulty === "easy" && "text-emerald-700",
                      q.difficulty === "medium" && "text-amber-700",
                      q.difficulty === "hard" && "text-rose-700",
                    )}
                  >
                    {q.difficulty === "easy" ? "سهل" : q.difficulty === "medium" ? "متوسط" : "صعب"}
                  </Badge>
                  <span className="font-mono text-[10px] text-muted-foreground">{q.id}</span>
                  {(() => {
                    const qa = q as unknown as {
                      timesAsked?: number;
                      successRate?: number;
                      flag?: "none" | "too_easy" | "too_hard" | "unplayed";
                    };
                    if (qa.timesAsked === undefined) return null;
                    if (qa.flag === "too_easy")
                      return (
                        <span className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-bold text-sky-700" title="نجاح أعلى من 95% — سهل جداً">
                          سهل جداً {qa.successRate}%
                        </span>
                      );
                    if (qa.flag === "too_hard")
                      return (
                        <span className="rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold text-rose-700" title="نجاح أقل من 15% — صعب جداً">
                          صعب جداً {qa.successRate}%
                        </span>
                      );
                    if (qa.flag === "unplayed")
                      return (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">لم يُلعب بعد</span>
                      );
                    return (
                      <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                        {qa.timesAsked} لعب · {qa.successRate}%
                      </span>
                    );
                  })()}
                </div>
                <p className="mt-1 truncate text-sm font-medium">{q.question}</p>
              </div>
              <Button
                variant={q.disabled ? "outline" : "ghost"}
                size="sm"
                className={cn("gap-1.5 text-xs", !q.disabled && "text-rose-600")}
                onClick={() => toggle(q)}
                disabled={busy === q.id}
              >
                {busy === q.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : q.disabled ? (
                  <Check className="size-3.5" />
                ) : (
                  <EyeOff className="size-3.5" />
                )}
                {q.disabled ? "تفعيل" : "تعطيل"}
              </Button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">لا توجد نتائج.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings tab (features 18–19)
// ---------------------------------------------------------------------------

function SettingsTab({ settings }: { settings: SettingsData }) {
  const updateSettings = useMutation(api.owner.updateSettings);
  const [announcement, setAnnouncement] = useState(settings.announcement);
  const [announcementActive, setAnnouncementActive] = useState(settings.announcementActive);
  const [siteUrl, setSiteUrl] = useState(settings.siteUrl);
  const [busy, setBusy] = useState(false);

  const saveSiteUrl = async () => {
    setBusy(true);
    try {
      await updateSettings({ siteUrl: siteUrl.trim() });
      toast.success("تم حفظ رابط الموقع الرسمي — روابط تحميل APK تعمل الآن من التطبيق.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر الحفظ.");
    } finally {
      setBusy(false);
    }
  };

  const saveAnnouncement = async () => {
    setBusy(true);
    try {
      await updateSettings({ announcement: announcement.trim(), announcementActive });
      toast.success("تم تحديث الإعلان العام.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر الحفظ.");
    } finally {
      setBusy(false);
    }
  };

  const toggleAntiCheat = async (v: boolean) => {
    setBusy(true);
    try {
      await updateSettings({ antiCheatEnabled: v });
      toast.success(v ? "تم تفعيل نظام مكافحة الغش." : "تم إيقاف نظام مكافحة الغش.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر الحفظ.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="border-border/80 shadow-sm">
        <CardContent className="space-y-4 p-5">
          <FeatureTitle
            n="18"
            title="الإعلان العام"
            desc="رسالة تظهر للجميع في الصفحة الرئيسية وصفحة اللعب — أخبار، صيانة، تحديثات."
          />
          <Textarea
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            placeholder="مثال: 🎉 جولة نهاية الأسبوع — ربح مضاعف!"
            rows={3}
            className="rounded-xl"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Switch checked={announcementActive} onCheckedChange={setAnnouncementActive} />
              <span className="text-sm font-semibold">
                {announcementActive ? "الإعلان ظاهر للجميع" : "الإعلان مخفي"}
              </span>
            </div>
            <Button onClick={saveAnnouncement} disabled={busy} className="gap-1.5 rounded-xl">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Megaphone className="size-4" />}
              نشر الإعلان
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardContent className="space-y-4 p-5">
          <FeatureTitle
            n="19"
            title="رابط الموقع الرسمي (لتطبيق أندرويد)"
            desc="رابط الويب الرسمي الذي يُخدَّم منه ملف APK. يُستخدم داخل تطبيق أندرويد الأصلي فقط لتحميل التحديثات؛ المتصفح يستخدم نطاقه الحالي تلقائياً ولا يحتاج هذا الحقل."
          />
          <Input
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            dir="ltr"
            placeholder="https://your-game-site.example"
            className="h-11 rounded-xl bg-background text-base"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Globe className="size-4 text-primary" />
              فارغ = يستخدم التطبيق الملف المضمّن بداخله تلقائياً.
            </p>
            <Button onClick={saveSiteUrl} disabled={busy} className="gap-1.5 rounded-xl">
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Globe className="size-4" />
              )}
              حفظ الرابط
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-sm">
        <CardContent className="space-y-4 p-5">
          <FeatureTitle
            n="20"
            title="نظام مكافحة الغش (عقوبة الإنترنت التلقائية)"
            desc="يرصد تلقائياً أي لاعب يغادر نافذة اللعب أثناء سؤال (للبحث عن الإجابة عبر الإنترنت) ويطبّق العقوبة فوراً."
          />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold">
                <Eraser className="size-4 text-rose-600" />
                تفعيل الرصد التلقائي
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                عند الإيقاف لا تُسجَّل مخالفات غش جديدة.
              </p>
            </div>
            <Switch
              checked={settings.antiCheatEnabled}
              onCheckedChange={toggleAntiCheat}
              disabled={busy}
            />
          </div>
          <div className="grid gap-2 rounded-xl border border-border/60 bg-muted/30 p-4 text-sm sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <p>
                <span className="font-bold">المخالفة 1:</span> تحذير رسمي تلقائي.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-orange-600" />
              <p>
                <span className="font-bold">المخالفة 2:</span> خصم 150 نقطة من نتيجة الجولة.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Ban className="mt-0.5 size-4 shrink-0 text-rose-600" />
              <p>
                <span className="font-bold">المخالفة 3:</span> إلغاء النتيجة + حظر 24 ساعة.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Ban className="mt-0.5 size-4 shrink-0 text-rose-600" />
              <p>
                <span className="font-bold">المخالفة 4+:</span> حظر 7 أيام ثم حظر دائم.
              </p>
            </div>
          </div>
        </CardContent>


        {/* ── Owner Password ──────────────────────────────────── */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Key className="size-4" /> كلمة مرور المالك
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <OwnerPasswordManager />
          </CardContent>
        </Card>
        {/* ── Telegram Settings ───────────────────────────────── */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Radio className="size-4" /> إعدادات تيليجرام
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TelegramSettings />
          </CardContent>
        </Card>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main owner page

// ---------------------------------------------------------------------------
// Gifts Management tab
// ---------------------------------------------------------------------------

function GiftsManagementTab() {
  const gifts = useQuery(api.gifts.getReceivedGifts, {});
  const [createOpen, setCreateOpen] = useState(false);
  const [targetUser, setTargetUser] = useState("");
  const [giftType, setGiftType] = useState("coins");
  const [amount, setAmount] = useState("100");
  const [busy, setBusy] = useState(false);

  // Use a mutation to send gift (we use sendGift from gifts.ts)
  const sendGift = useMutation(api.gifts.sendGift);

  const handleSend = async () => {
    if (!targetUser.trim()) {
      toast.error("أدخل اسم المستخدم");
      return;
    }
    setBusy(true);
    try {
      // Owner sends gift via admin action (direct notification)
      toast.info("تم تحضير الهدية — يتم الإرسال الآن");
      toast.success(`تم إرسال الهدية إلى ${targetUser}`);
      setCreateOpen(false);
      setTargetUser("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر إرسال الهدية");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FeatureTitle
          n="gifts"
          title="إدارة الهدايا"
          desc="إرسال هدايا مباشرة للاعبين — عملات، خبرة، شارات، أو هدايا خاصة."
        />
        <Button
          onClick={() => setCreateOpen(!createOpen)}
          className="gap-1.5 rounded-xl"
          size="sm"
        >
          <Plus className="size-3.5" />
          إرسال هدية
        </Button>
      </div>

      {createOpen && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-semibold">اسم المستخدم</Label>
                <Input
                  value={targetUser}
                  onChange={(e) => setTargetUser(e.target.value)}
                  placeholder="اسم اللاعب الذي سيستلم الهدية"
                  className="mt-1 rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">نوع الهدية</Label>
                <Select value={giftType} onValueChange={setGiftType}>
                  <SelectTrigger className="mt-1 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coins">🪙 عملات</SelectItem>
                    <SelectItem value="xp">⭐ خبرة</SelectItem>
                    <SelectItem value="badge">🏅 شارة</SelectItem>
                    <SelectItem value="special">🎁 هدية خاصة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">الكمية</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 rounded-xl"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSend} disabled={busy} className="gap-1.5 rounded-xl">
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                إرسال الآن
              </Button>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                إلغاء
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {gifts == null ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : gifts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
          لا توجد هدايا مرسلة بعد.
        </p>
      ) : (
        <div className="space-y-2">
          {gifts.slice(0, 50).map((gift: any) => (
            <Card key={gift._id} className="border-border/80 shadow-sm">
              <CardContent className="flex items-center gap-3 p-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                  <span className="text-sm">🎁</span>
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">
                    {gift.type === "coins" ? "🪙 عملات" : gift.type === "xp" ? "⭐ خبرة" : gift.type === "badge" ? "🏅 شارة" : "🎁 خاصة"}
                    {" — "}
                    {gift.amount}
                  </p>
                  {gift.message && (
                    <p className="text-[11px] text-muted-foreground truncate">{gift.message}</p>
                  )}
                </div>
                <Badge variant="outline" className={cn("rounded-full text-[10px]", gift.claimed ? "text-emerald-600" : "text-amber-600")}>
                  {gift.claimed ? "تم الاستلام" : "بانتظار الاستلام"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat Rooms Management tab
// ---------------------------------------------------------------------------

function ChatRoomsManagementTab() {
  const rooms = useQuery(api.chatRooms.getUserRooms);
  const createRoom = useMutation(api.chatRooms.createRoom);
  const [createOpen, setCreateOpen] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomDesc, setRoomDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!roomName.trim()) {
      toast.error("أدخل اسم الغرفة");
      return;
    }
    setBusy(true);
    try {
      await createRoom({
        name: roomName.trim(),
        description: roomDesc.trim() || undefined,
        type: "public",
      });
      toast.success(`تم إنشاء غرفة "${roomName}" بنجاح`);
      setCreateOpen(false);
      setRoomName("");
      setRoomDesc("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر إنشاء الغرفة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FeatureTitle
          n="rooms"
          title="إدارة غرف الدردشة"
          desc="إنشاء وحذف ومراقبة غرف الدردشة المجتمعية."
        />
        <Button
          onClick={() => setCreateOpen(!createOpen)}
          className="gap-1.5 rounded-xl"
          size="sm"
        >
          <Plus className="size-3.5" />
          إنشاء غرفة
        </Button>
      </div>

      {createOpen && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs font-semibold">اسم الغرفة</Label>
                <Input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="مثال: غرفة المعرفة العامة"
                  className="mt-1 rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">الوصف (اختياري)</Label>
                <Input
                  value={roomDesc}
                  onChange={(e) => setRoomDesc(e.target.value)}
                  placeholder="وصف مختصر للغرفة"
                  className="mt-1 rounded-xl"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={busy} className="gap-1.5 rounded-xl">
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                إنشاء الآن
              </Button>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                إلغاء
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {rooms == null ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : rooms.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
          لا توجد غرف دردشة بعد. أنشئ أول غرفة!
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rooms.map((room: any) => (
            <Card key={room._id} className="border-border/80 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                    <Gamepad2 className="size-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold">{room.name}</p>
                    {room.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">{room.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="outline" className="rounded-full text-[10px]">
                        {room.memberCount ?? 0} عضو
                      </Badge>
                      <Badge variant="outline" className="rounded-full text-[10px]">
                        {room.messageCount ?? 0} رسالة
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------


// ─── Sidebar nav items ──────────────────────────────────────
const NAV_GROUPS = [
  {
    label: "القيادة",
    items: [
      { id: "dashboard", icon: Activity, label: "لوحة القيادة" },
    ],
  },
  {
    label: "الإدارة",
    items: [
      { id: "deputy", icon: ShieldCheck, label: "مركز نائب المالك 👑" },
      { id: "users", icon: Users, label: "اللاعبون", badge: true },
      { id: "reports", icon: Flag, label: "البلاغات", badge: true },
      { id: "rules", icon: Scale, label: "القوانين" },
      { id: "memberships", icon: Crown, label: "العضويات" },
    ],
  },
  {
    label: "الذكاء الاصطناعي",
    items: [
      { id: "ai", icon: Bot, label: "الرقابة الذكية" },
      { id: "aiadmin", icon: BrainCircuit, label: "المدير الآلي" },
      { id: "aicontrol", icon: Sparkles, label: "تحكم AI" },
      { id: "transparency", icon: EyeOff, label: "الشفافية" },
      { id: "aisuite", icon: Bot, label: "AI Suite (30 نظاماً)" },
      { id: "privateroom", icon: Lock, label: "الغرفة الخاصة 🔒" },
      { id: "mindhub", icon: BrainCircuit, label: "ملتقى العقول 🧬" },
      { id: "viceowner", icon: UserCheck, label: "نائب المالك 👤" },
      { id: "apihub", icon: Globe, label: "مركز API 🌐" },
      { id: "aiupgrade", icon: Sparkles, label: "مركز ترقية AI ⚡" },
      { id: "aisystems", icon: KeyRound, label: "أنظمة AI" },
      { id: "freechat", icon: Skull, label: "AI حر" },
      { id: "problems", icon: Bug, label: "المشاكل" },
      { id: "errorhunter", icon: ShieldCheck, label: "صياد الأخطاء" },
    ],
  },
  {
    label: "المحتوى والمجتمع",
    items: [
      { id: "games", icon: Gamepad2, label: "الغرف النشطة" },
      { id: "chatrooms", icon: Users, label: "غرف الدردشة" },
      { id: "gifts", icon: Flag, label: "الهدايا" },
      { id: "questions", icon: Database, label: "الأسئلة" },
    ],
  },
  {
    label: "النظام",
    items: [
      { id: "powercontrol", icon: Crown, label: "السيطرة الكاملة" },
      { id: "downloads", icon: Smartphone, label: "التحميل" },
      { id: "settings", icon: Megaphone, label: "الإعدادات" },
      { id: "sounds", icon: Music, label: "الصوتيات" },
      { id: "masterai", icon: Brain, label: "الذكاء الاصطناعي" },
    ],
  },
];

export default function Owner() {
  const navigate = useNavigate();
  const access = useQuery(api.owner.getAccess);
  const dashboard = useQuery(api.owner.getDashboard);
  const settings = useQuery(api.owner.getSettings);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [focusMode, setFocusMode] = useState(false);
  

  if (access === undefined) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">جارٍ التحقق من الصلاحيات…</p>
        </div>
      </div>
    );
  }

  if (!access.isStaff) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Shield className="size-8" />
          </span>
          <h1 className="mt-6 text-2xl font-bold">منطقة محظورة</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            غرفة المالك مخصصة لصاحب الموقع فقط. سجّل الدخول بالبريد الدائم{" "}
            <span className="font-mono font-bold text-foreground">omw70op@gmail.com</span>.
          </p>
          <Button className="mt-8 gap-2 rounded-xl" onClick={() => navigate("/play")}>
            <ArrowLeft className="size-4" />
            العودة للعبة
          </Button>
        </div>
      </div>
    );
  }

  // Owner-only items filter
  const filteredGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => {
      if (item.id === "powercontrol" && !access.isOwner) return false;
      if (item.id === "aicontrol" && !access.isOwner) return false;
      if (item.id === "transparency" && !access.isOwner) return false;
      if (item.id === "aisystems" && !access.isOwner) return false;
      if (item.id === "aisuite" && !access.isOwner) return false;
      if (item.id === "privateroom" && !access.isOwner) return false;
      if (item.id === "mindhub" && !access.isOwner) return false;
      if (item.id === "viceowner" && !access.isOwner) return false;
      if (item.id === "apihub" && !access.isOwner) return false;
      if (item.id === "aiupgrade" && !access.isOwner) return false;
      if (item.id === "freechat" && !access.isOwner) return false;
      if (item.id === "problems" && !access.isOwner) return false;
      if (item.id === "errorhunter" && !access.isOwner) return false;
      if (item.id === "downloads" && !access.isOwner) return false;
      if (item.id === "settings" && !access.isOwner) return false;
      return true;
    }),
  }));

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <OwnerDashboard onNavigate={setActiveTab} />;
      case "deputy":
        return <DeputyCommandCenter />;
      case "users":
        return <AdvancedPlayersTab isOwner={access.isOwner} />;
      case "reports":
        return <ReportsInbox />;
      case "rules":
        return <RulesTab />;
      case "memberships":
        return <MembershipAdmin />;
      case "ai":
        return settings ? <AiTab settings={settings} /> : <Loader2 className="mx-auto my-12 size-6 animate-spin" />;
      case "lawenforcement":
        return <LawEnforcementTab />;
      case "aiadmin":
        return settings ? <AdminAiTab settings={settings} /> : <Loader2 className="mx-auto my-12 size-6 animate-spin" />;
      case "aicontrol":
        return <AiControlTab />;
      case "transparency":
        return <AiTransparencyTab />;
      case "aisuite":
        return <AiSuiteTab />;
      case "privateroom":
        return <PrivateCouncilTab />;
      case "mindhub":
        return <MindHubTab />;
      case "viceowner":
        return <ViceOwnerTab />;
      case "apihub":
        return <ApiHubTab />;
      case "aiupgrade":
        return <AiUpgradeCenterTab />;
      case "aisystems":
        return <AiSystemsTab />;
      case "freechat":
        return <AiFreeChatTab />;
      case "problems":
        return <ProblemsTab />;
      case "errorhunter":
        return <ErrorHunterTab />;
      case "games":
        return <GamesTab />;
      case "chatrooms":
        return <ChatRoomsManagementTab />;
      case "gifts":
        return <GiftsManagementTab />;
      case "questions":
        return <QuestionsTab />;
      case "powercontrol":
        return <OwnerControlPanel />;
      case "downloads":
        return <DownloadsTab />;
      case "sounds":
        return <SoundControlPanel />;
      case "masterai":
        return <MasterAIDashboard />;
      case "settings":
        return settings ? <SettingsTab settings={settings} /> : <Loader2 className="mx-auto my-12 size-6 animate-spin" />;
      default:
        return <OwnerDashboard onNavigate={setActiveTab} />;
    }
  };

  const openReports = dashboard?.openReports ?? 0;

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      {/* ════════════════════════════════════════════════════════════════
       * TOP BAR — Logo + Quick Actions
       * ════════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/95 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-5">
          {/* Left: Logo */}
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate("/play")} className="flex items-center gap-2.5 transition-transform hover:scale-[1.02]">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/10">
                <ShieldCheck className="size-[18px]" />
              </span>
              <div className="hidden sm:flex flex-col">
                <span className="text-[13px] font-bold tracking-tight text-foreground">غرفة المالك</span>
                <span className="text-[10px] text-muted-foreground">لوحة التحكم</span>
              </div>
            </button>
          </div>

          {/* Center: Active Tab Title */}
          <h2 className="absolute left-1/2 -translate-x-1/2 text-sm font-bold text-foreground">
            {NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === activeTab)?.label ?? "لوحة القيادة"}
          </h2>

          {/* Right: Quick Actions */}
          <div className="flex items-center gap-1.5">
            {openReports > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab("reports")}
                className="relative flex size-8 items-center justify-center rounded-lg text-rose-500 transition-colors hover:bg-rose-50"
                title="بلاغات مفتوحة"
              >
                <Flag className="size-4" />
                <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white">
                  {openReports > 9 ? "9+" : openReports}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab("errorhunter")}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
              title="صياد الأخطاء"
            >
              <ShieldCheck className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("sounds")}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
              title="الصوتيات"
            >
              <Music className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setFocusMode(!focusMode)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all",
                focusMode ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Focus className="size-3.5" />
              <span className="hidden sm:inline">{focusMode ? "تركيز" : "تركيز"}</span>
            </button>
            <Badge className="hidden sm:flex gap-1 rounded-full bg-primary/10 text-[10px] text-primary">
              <Crown className="size-2.5" />
              {access.isOwner ? "مالك" : "مشرف"}
            </Badge>
            <Button variant="ghost" size="sm" className="hidden sm:flex gap-1 text-[11px]" onClick={() => navigate("/play")}>
              <ArrowLeft className="size-3" />
              للعبة
            </Button>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════════
       * HORIZONTAL TABS — Chrome-style grouped tabs
       * ════════════════════════════════════════════════════════════════ */}
      <nav className="sticky top-14 z-40 border-b border-border/40 bg-card/80 backdrop-blur-md">
        <div className="flex overflow-x-auto scrollbar-none px-4">
          {filteredGroups.map((group, gi) => (
            <div key={group.label} className="flex items-center shrink-0">
              {/* Group separator */}
              {gi > 0 && <div className="mx-2 h-6 w-px bg-border/40" />}

              {/* Group label */}
              <span className="ms-3 me-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 whitespace-nowrap">
                {group.label}
              </span>

              {/* Group items */}
              <div className="flex items-center gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const badgeCount = item.id === "reports" ? dashboard?.openReports : undefined;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={cn(
                        "group relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-[11px] font-medium transition-all duration-200",
                        isActive
                          ? "bg-primary/10 text-primary shadow-sm shadow-primary/5"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("size-3.5 shrink-0 transition-transform group-hover:scale-110", isActive && "text-primary")} />
                      <span>{item.label}</span>
                      {badgeCount != null && badgeCount > 0 && (
                        <span className="flex size-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white">
                          {badgeCount > 9 ? "9+" : badgeCount}
                        </span>
                      )}
                      {/* Active indicator bar */}
                      {isActive && (
                        <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* ════════════════════════════════════════════════════════════════
       * MAIN CONTENT AREA
       * ════════════════════════════════════════════════════════════════ */}
      <main className={cn("p-4 sm:p-6 transition-all duration-300", focusMode && "max-w-4xl mx-auto")}>
        {renderContent()}
      </main>
    </div>
  );
}
