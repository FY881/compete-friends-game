import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  AlertTriangle,
  Info,
  ShieldAlert,
  Users,
  Coins,
  ScrollText,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Gauge,
  RefreshCw,
} from "lucide-react";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🛰️ غرفة القيادة المركزية — الترقية المستقبلية لغرفة المالك
 *  لوحة حية موحّدة: مؤشرات فورية + تنبيهات ذكية قابلة للنقر +
 *  بحث لاعبين متقدم + سجل تدقيق ذكي + نبضة اقتصاد حقيقية.
 * ═══════════════════════════════════════════════════════════════════════
 */

const LEVEL_STYLE: Record<string, string> = {
  critical: "border-rose-500/40 bg-rose-500/10 text-rose-600",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-600",
};

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const tones = {
    default: "text-foreground",
    good: "text-emerald-600",
    warn: "text-amber-600",
    bad: "text-rose-600",
  };
  return (
    <Card className="border-border/70 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className={cn("text-xl font-bold tabular-nums leading-tight", tones[tone])}>
            {value}
          </p>
          {hint && <p className="truncate text-[10px] text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function CommandDeck({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const overview = useQuery(api.commandDeck.getCommandOverview, {});
  const economy = useQuery(api.commandDeck.getEconomyPulse, {});

  // ── بحث اللاعبين المتقدم ──
  const [playerQuery, setPlayerQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("level");
  const players = useQuery(api.commandDeck.searchPlayers, {
    search: playerQuery.trim() || undefined,
    status: status as "all" | "banned" | "muted" | "clean",
    sort: sort as "level" | "games" | "warnings",
    limit: 25,
  });

  // ── سجل التدقيق الذكي ──
  const [auditQuery, setAuditQuery] = useState("");
  const [auditSource, setAuditSource] = useState("all");
  const [auditSeverity, setAuditSeverity] = useState("all");
  const audit = useQuery(api.commandDeck.searchAuditTrail, {
    search: auditQuery.trim() || undefined,
    source: auditSource as "all" | "ai" | "owner" | "system",
    severity: auditSeverity as "all" | "low" | "medium" | "high",
    hours: 168,
  });

  const alerts = overview?.alerts ?? [];
  const criticalCount = alerts.filter((a) => a.level === "critical").length;

  const healthTone =
    !economy ? "default" : economy.health >= 70 ? "good" : economy.health >= 40 ? "warn" : "bad";

  const fmt = (n: number) =>
    Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

  return (
    <div dir="rtl" className="space-y-6">
      {/* ═══ رأس اللوحة ═══ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Zap className="size-5" />
            <span className="owner-status-live absolute -end-1 -top-1 size-3 rounded-full border-2 border-card bg-emerald-500" />
          </span>
          <div>
            <h2 className="text-lg font-bold tracking-tight">غرفة القيادة المركزية</h2>
            <p className="text-xs text-muted-foreground">
              نبضة حية من كل أنظمة اللعبة — تحديث فوري بلا إعادة تحميل
            </p>
          </div>
        </div>
        {criticalCount > 0 && (
          <Badge className="animate-war-pulse gap-1.5 rounded-full bg-rose-500/15 text-rose-600">
            <ShieldAlert className="size-3.5" />
            {criticalCount} حالة حرجة
          </Badge>
        )}
      </div>

      {/* ═══ التنبيهات الذكية ═══ */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {alerts.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onNavigate?.(a.tab)}
            className={cn(
              "group flex items-start gap-3 rounded-2xl border p-3.5 text-start transition-all hover:scale-[1.01] hover:shadow-md",
              LEVEL_STYLE[a.level],
            )}
          >
            {a.level === "critical" ? (
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            ) : a.level === "warning" ? (
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            ) : (
              <Info className="mt-0.5 size-4 shrink-0" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{a.title}</span>
              <span className="mt-0.5 block text-[11px] leading-relaxed opacity-80">{a.detail}</span>
            </span>
            <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ))}
      </div>

      {/* ═══ المؤشرات الحية ═══ */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="إجمالي اللاعبين" value={overview?.users.total ?? "…"} hint={`${overview?.users.banned ?? 0} محظور · ${overview?.users.newPlayers ?? 0} جديد اليوم`} />
        <Stat icon={Activity} label="غرف نشطة الآن" value={overview?.games.active ?? "…"} hint={`من ${overview?.games.total ?? 0} غرفة كلياً`} />
        <Stat icon={ScrollText} label="بلاغات مفتوحة" value={overview?.reports.open ?? "…"} tone={(overview?.reports.open ?? 0) > 5 ? "bad" : "good"} hint="بانتظار المراجعة" />
        <Stat icon={Gauge} label="إجراءات 24 ساعة" value={overview?.actions.total24h ?? "…"} hint={`${overview?.ai.actions24h ?? 0} من AI · ${overview?.actions.owner24h ?? 0} من الإدارة`} />
        <Stat icon={Coins} label="تدفق النقاط (خارج)" value={fmt(economy?.outflow ?? 0)} hint="إنفاق آخر 24 ساعة" />
        <Stat icon={Coins} label="تدفق النقاط (داخل)" value={fmt(economy?.inflow ?? 0)} tone="good" hint="كسب آخر 24 ساعة" />
        <Stat icon={RefreshCw} label="صافي الاقتصاد" value={fmt(economy?.net ?? 0)} tone={healthTone} hint="داخل − خارج" />
        <Stat icon={Zap} label="صحة الاقتصاد" value={`${economy?.health ?? "…"}%`} tone={healthTone} hint={`${economy?.entries24h ?? 0} حركة مسجلة`} />
      </div>

      {/* ═══ صحة الاقتصاد — تفصيل ═══ */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="size-4 text-amber-500" /> صحة الاقتصاد — أسباب الحركة الكبرى
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(economy?.reasons ?? []).map((r) => (
              <Badge
                key={r.reason}
                variant="outline"
                className={cn(
                  "rounded-full text-[11px]",
                  r.total >= 0 ? "border-emerald-500/40 text-emerald-600" : "border-rose-500/40 text-rose-600",
                )}
              >
                {r.total >= 0 ? <ArrowDownRight className="size-3" /> : <ArrowUpRight className="size-3" />}
                {r.reason}: {fmt(r.total)}
              </Badge>
            ))}
            {economy && economy.reasons.length === 0 && (
              <p className="py-2 text-xs text-muted-foreground">لا حركات مسجلة خلال 24 ساعة بعد.</p>
            )}
          </div>
          {(economy?.topSpenders.length ?? 0) > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">أكبر المنفقين (24 ساعة)</p>
              <div className="flex flex-wrap gap-2">
                {economy!.topSpenders.map((s) => (
                  <Badge key={s.userId} variant="outline" className="rounded-full text-[11px]">
                    {s.name}: −{fmt(s.spent)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ بحث اللاعبين المتقدم ═══ */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-primary" /> بحث اللاعبين المتقدم
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={playerQuery}
                onChange={(e) => setPlayerQuery(e.target.value)}
                placeholder="ابحث بالاسم أو البريد…"
                className="h-10 rounded-xl ps-9"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-10 w-36 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="clean">نشط</SelectItem>
                <SelectItem value="muted">مكتوم</SelectItem>
                <SelectItem value="banned">محظور</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-10 w-36 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="level">ترتيب: المستوى</SelectItem>
                <SelectItem value="games">ترتيب: الجولات</SelectItem>
                <SelectItem value="warnings">ترتيب: التحذيرات</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {players === undefined || players === null ? (
            <p className="py-6 text-center text-xs text-muted-foreground">جارٍ البحث…</p>
          ) : players.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">لا نتائج مطابقة.</p>
          ) : (
            <div className="divide-y divide-border/60 rounded-xl border border-border/60">
              {players.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                  <Badge variant="outline" className="rounded-full text-[10px]">مستوى {p.level}</Badge>
                  <span className="text-[11px] text-muted-foreground">{p.gamesPlayed} جولة · {p.winRate}% فوز</span>
                  {p.warnings > 0 && <Badge variant="outline" className="rounded-full border-amber-500/40 text-[10px] text-amber-600">{p.warnings} تحذير</Badge>}
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full text-[10px]",
                      p.status === "banned" && "border-rose-500/40 text-rose-600",
                      p.status === "muted" && "border-amber-500/40 text-amber-600",
                      p.status === "clean" && "border-emerald-500/40 text-emerald-600",
                    )}
                  >
                    {p.status === "banned" ? "محظور" : p.status === "muted" ? "مكتوم" : "نشط"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ سجل التدقيق الذكي ═══ */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="size-4 text-primary" /> سجل التدقيق الذكي — آخر 7 أيام
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={auditQuery}
                onChange={(e) => setAuditQuery(e.target.value)}
                placeholder="ابحث في السجل (فعل، اسم، سبب)…"
                className="h-10 rounded-xl ps-9"
              />
            </div>
            <Select value={auditSource} onValueChange={setAuditSource}>
              <SelectTrigger className="h-10 w-36 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المصادر</SelectItem>
                <SelectItem value="ai">الذكاء الآلي</SelectItem>
                <SelectItem value="owner">الإدارة</SelectItem>
                <SelectItem value="system">النظام</SelectItem>
              </SelectContent>
            </Select>
            <Select value={auditSeverity} onValueChange={setAuditSeverity}>
              <SelectTrigger className="h-10 w-36 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الخطورة</SelectItem>
                <SelectItem value="high">عالية</SelectItem>
                <SelectItem value="medium">متوسطة</SelectItem>
                <SelectItem value="low">منخفضة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {audit === undefined || audit === null ? (
            <p className="py-6 text-center text-xs text-muted-foreground">جارٍ التحميل…</p>
          ) : audit.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">لا إجراءات مطابقة.</p>
          ) : (
            <div className="max-h-96 space-y-1.5 overflow-y-auto pe-1">
              {audit.map((e, i) => (
                <div
                  key={`${e.at}-${i}`}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs"
                >
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full text-[9px]",
                      e.severity === "high" && "border-rose-500/40 text-rose-600",
                      e.severity === "medium" && "border-amber-500/40 text-amber-600",
                      e.severity === "low" && "border-sky-500/40 text-sky-600",
                    )}
                  >
                    {e.source === "ai" ? "🤖 AI" : e.source === "owner" ? "👑 إدارة" : "⚙️ نظام"}
                  </Badge>
                  <span className="font-bold">{e.action}</span>
                  {e.target && <span className="text-muted-foreground">→ {e.target}</span>}
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{e.detail}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {new Date(e.at).toLocaleString("ar", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
