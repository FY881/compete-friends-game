/**
 * ═══════════════════════════════════════════════════════════════════
 * لوحة تحكم العضويات — المالك (4 تبويبات)
 * ═══════════════════════════════════════════════════════════════════
 */

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { sounds } from "@/lib/sounds";
// 🏅 أنظمة العضوية 4.0 (فرق/رتب/تجديد/خزنة) — مراقبة وتحكم فعلي للمالك
import { MembershipOpsPanel } from "@/components/membership/MembershipOwnerPanel";
import {
  Crown,
  Users,
  Key,
  BarChart3,
  Loader2,
  Plus,
  TrendingUp,
  Shield,
  Target,
  Gift,
  Trophy,
  Search,
  Calendar,
  Zap,
  Settings,
  Gamepad2,
  Headphones,
  Brain,
  Flame,
  Gem,
  Send,
  BellRing,
  CalendarClock,
  ShieldAlert,
  ScrollText,
} from "lucide-react";

const TIER_ORDER = ["bronze", "silver", "gold", "diamond", "exclusive"];
const TIER_INFO: Record<string, { name: string; emoji: string; color: string }> = {
  bronze: { name: "برونزي", emoji: "🥉", color: "gray" },
  silver: { name: "فضي", emoji: "🥈", color: "slate" },
  gold: { name: "ذهبي", emoji: "🥇", color: "yellow" },
  diamond: { name: "ماسي", emoji: "💎", color: "blue" },
  exclusive: { name: "أسطوري", emoji: "👑", color: "purple" },
};

// ─── Tier Bar Chart ───────────────────────────────────────────
function TierBar({ label, emoji, count, total, color }: { label: string; emoji: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5"><span>{emoji}</span><span className="font-medium">{label}</span></span>
        <span className="text-muted-foreground">{count} ({pct}%)</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={cn("h-full rounded-full", `bg-${color}-500`)}
        />
      </div>
    </div>
  );
}

// ─── Code Creator ─────────────────────────────────────────────
function CodeCreator() {
  const createCode = useMutation(api.memberships.createCode);
  const [tierId, setTierId] = useState("silver");
  const [count, setCount] = useState("1");
  const [duration, setDuration] = useState("30");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    setBusy(true);
    try {
      const result = await createCode({ tierId, count: parseInt(count) || 1, durationDays: parseInt(duration) || 30 });
      sounds.victory();
      toast.success(`تم إنشاء ${result.count} كود بنجاح`);
    } catch (error) {
      sounds.error();
      toast.error(error instanceof Error ? error.message : "خطأ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-4">
          <Key className="size-4 text-primary" />
          إنشاء أكواد عضوية
        </h3>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { value: "silver", label: "🥈 فضي" },
            { value: "gold", label: "🥇 ذهبي" },
            { value: "diamond", label: "💎 ماسي" },
            { value: "exclusive", label: "👑 أسطوري" },
          ].map((t) => (
            <button key={t.value} type="button" onClick={() => { sounds.click(); setTierId(t.value); }}
              className={cn("rounded-xl border p-2.5 text-center text-xs font-medium transition-all",
                tierId === t.value ? "border-primary bg-primary/10 text-primary" : "border-border/60 hover:border-border")}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">عدد الأكواد</label>
            <Input type="number" value={count} onChange={(e) => setCount(e.target.value)} className="h-9 rounded-xl text-xs" min="1" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">المدة (بالأيام)</label>
            <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="h-9 rounded-xl text-xs" min="1" />
          </div>
        </div>
        <Button onClick={handleCreate} disabled={busy} className="w-full rounded-xl" size="sm">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <><Plus className="size-4" /> إنشاء الأكواد</>}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Manual Tier Changer ──────────────────────────────────────
function ManualTierChanger() {
  const changeTier = useMutation(api.membershipFeatures.adminChangeTier);
  const [userId, setUserId] = useState("");
  const [newTier, setNewTier] = useState("silver");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("");
  const [busy, setBusy] = useState(false);

  const handleChange = async () => {
    if (!userId.trim() || !reason.trim()) {
      toast.error("أدخل معرف المستخدم والسبب");
      return;
    }
    setBusy(true);
    try {
      await changeTier({
        targetUserId: userId.trim() as any,
        newTier,
        reason: reason.trim(),
        durationDays: duration ? parseInt(duration) : undefined,
      });
      sounds.victory();
      toast.success("تم تغيير العضوية بنجاح");
      setUserId(""); setReason(""); setDuration("");
    } catch (error) {
      sounds.error();
      toast.error(error instanceof Error ? error.message : "خطأ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-4">
          <Crown className="size-4 text-yellow-500" />
          تغيير عضوية يدوي
        </h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">معرف المستخدم (User ID)</label>
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="أدخل معرف المستخدم" className="rounded-xl text-xs" dir="ltr" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">المستوى الجديد</label>
            <div className="grid grid-cols-5 gap-1.5">
              {TIER_ORDER.map((tier) => (
                <button key={tier} type="button" onClick={() => { sounds.click(); setNewTier(tier); }}
                  className={cn("rounded-lg border p-2 text-center text-xs font-medium transition-all",
                    newTier === tier ? "border-primary bg-primary/10 text-primary" : "border-border/60 hover:border-border")}>
                  {TIER_INFO[tier].emoji}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">المدة (بالأيام) — اتركه فارغاً للدائمة</label>
            <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="مدة مؤقتة (اختياري)" className="rounded-xl text-xs" min="1" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">سبب التغيير</label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب تغيير العضوية..." className="rounded-xl text-xs min-h-[60px]" />
          </div>
          <Button onClick={handleChange} disabled={busy} className="w-full rounded-xl" size="sm">
            {busy ? <Loader2 className="size-4 animate-spin" /> : "تطبيق التغيير"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Honor Board ──────────────────────────────────────────────
function HonorBoard({ tier }: { tier: string }) {
  const board = useQuery(api.membershipFeatures.getHonorBoard, { tier });
  const info = TIER_INFO[tier];

  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <h4 className="flex items-center gap-2 text-sm font-bold mb-3">
          <Trophy className="size-4 text-yellow-500" />
          لوحة شرف {info?.emoji} {info?.name}
        </h4>
        {board === undefined ? (
          <div className="flex justify-center py-4"><Loader2 className="size-4 animate-spin" /></div>
        ) : board.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">لا يوجد أعضاء بعد</p>
        ) : (
          <div className="space-y-1.5">
            {board.map((member, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-muted-foreground w-5">#{idx + 1}</span>
                  <span className="font-medium">{member.name}</span>
                </div>
                <span className="text-muted-foreground">{member.days} يوم</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Exclusive Games Manager ──────────────────────────────────
function ExclusiveGamesManager() {
  const games = [
    { id: "mind-race", name: "سباق الذكاء", icon: "⚡", requiredTier: "bronz●", status: "active" },
    { id: "puzzle-clash", name: "عصر الألغاز", icon: "🧩", requiredTier: "silver", status: "active" },
    { id: "hero-challenge", name: "تحدي الأبطال", icon: "⚔️", requiredTier: "gold", status: "active" },
    { id: "diamond-rush", name: "اندفاع الماس", icon: "💎", requiredTier: "diamond", status: "active" },
    { id: "legend-arena", name: "ساحة الأساطير", icon: "👑", requiredTier: "exclusive", status: "active" },
  ];

  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <h4 className="flex items-center gap-2 text-sm font-bold mb-3">
          <Gamepad2 className="size-4 text-primary" />
          الألعاب الحصرية
        </h4>
        <div className="space-y-2">
          {games.map((game) => {
            const info = TIER_INFO[game.requiredTier];
            return (
              <div key={game.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{game.icon}</span>
                  <div>
                    <div className="text-xs font-medium">{game.name}</div>
                    <div className="text-[10px] text-muted-foreground">يتطلب: {info?.emoji} {info?.name}</div>
                  </div>
                </div>
                <Badge variant={game.status === "active" ? "default" : "secondary"} className="text-[10px]">
                  {game.status === "active" ? "نشط" : "متوقف"}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Sound Packs Manager ──────────────────────────────────────
function SoundPacksManager() {
  const packs = [
    { tier: "silver", name: "حزمة الفضي", sounds: 3 },
    { tier: "gold", name: "حزمة الذهب", sounds: 5 },
    { tier: "diamond", name: "حزمة الماس", sounds: 6 },
    { tier: "exclusive", name: "حزمة الأساطير", sounds: 7 },
  ];

  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <h4 className="flex items-center gap-2 text-sm font-bold mb-3">
          <Headphones className="size-4 text-green-500" />
          الحزم الصوتية
        </h4>
        <div className="space-y-2">
          {packs.map((pack) => {
            const info = TIER_INFO[pack.tier];
            return (
              <div key={pack.tier} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{info?.emoji}</span>
                  <div>
                    <div className="text-xs font-medium">{pack.name}</div>
                    <div className="text-[10px] text-muted-foreground">{pack.sounds} مؤثرات صوتية</div>
                  </div>
                </div>
                <Badge variant="default" className="text-[10px]">نشطة</Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── AI Levels Reference ──────────────────────────────────────
function AiLevelsReference() {
  const levels = [
    { tier: "bronze", level: "أساسي", capabilities: ["تحليل أساسي", "نصائح عامة"] },
    { tier: "silver", level: "قياسي", capabilities: ["تتبع أداء", "توصيات"] },
    { tier: "gold", level: "متقدم", capabilities: ["تحديات مخصصة", "نقاط ضعف"] },
    { tier: "diamond", level: "خبير", capabilities: ["تنبؤات", "اكتشاف أنماط"] },
    { tier: "exclusive", level: "احترافي", capabilities: ["أهداف شخصية", "متابعة يومية", "تحديات مولدة"] },
  ];

  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <h4 className="flex items-center gap-2 text-sm font-bold mb-3">
          <Brain className="size-4 text-purple-500" />
          مستويات الذكاء الاصطناعي
        </h4>
        <div className="space-y-2">
          {levels.map((item) => {
            const info = TIER_INFO[item.tier];
            return (
              <div key={item.tier} className="rounded-lg bg-white/5 px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span>{info?.emoji}</span>
                  <span className="text-xs font-bold">AI {item.level}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {item.capabilities.map((cap) => (
                    <span key={cap} className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] text-muted-foreground">{cap}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── حارسة العضويات «جيم» — ربط نظام العضويات بمساعد نائب المالك ───
const GEM_ID = "as_gem";
function StewardPanel() {
  const insights = useQuery(api.membershipOps.getMembershipInsights);
  const world = useQuery(api.assistantsStore.getWorld);
  const executeCommand = useAction(api.viceControl.executeCommand);
  const [order, setOrder] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const gem = world?.assistants.find((a) => a.assistantId === GEM_ID);
  const gemLogs = (insights?.recentLogs ?? []).filter((l) => l.actor === GEM_ID || l.actor === "owner");

  const runAsGem = async (command: string) => {
    if (!command.trim()) return;
    setBusy(true);
    setLastResult(null);
    try {
      const r = await executeCommand({ command: command.trim(), executor: GEM_ID });
      const msg = r.ok ? `💎 جيم: ${r.result}` : `❌ ${r.result}`;
      setLastResult(msg);
      sounds.victory();
      toast.success(r.ok ? "نفّذت جيم الأمر فعلياً — سُجّل في السجل" : r.result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذّر التنفيذ";
      setLastResult(`❌ ${msg}`);
      sounds.error();
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* بطاقة حارسة العضويات */}
      <Card className="border-emerald-500/30 bg-emerald-500/[0.04]">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-500/10 text-2xl">💎</div>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                جيم — أمينة الخزينة وحارسة العضويات
                <Badge variant="outline" className="rounded-full text-[10px] text-emerald-600">مساعدة نائب المالك</Badge>
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                تراقب العضويات وتُرسل تذكيرات التجديد، وتنفّذ منح/تمديد العضويات بأمرك وتوثّق كل حركة في السجل.
              </p>
            </div>
            {gem && (
              <div className="flex gap-2 text-[10px] text-muted-foreground">
                <span>طاقة {gem.energy}%</span>
                <span>سمعة {gem.reputation}</span>
                <span>أنجزت {gem.tasksCompleted} مهام</span>
              </div>
            )}
          </div>

          {/* مؤشرات حية */}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "عضويات مدفوعة", value: insights?.paidActive ?? 0, icon: Crown, color: "text-yellow-400" },
              { label: "نسبة التحويل", value: `${insights?.conversionRate ?? 0}%`, icon: TrendingUp, color: "text-purple-400" },
              { label: "متوسط الأيام", value: insights?.avgDays ?? 0, icon: Calendar, color: "text-blue-400" },
              { label: "تنتهي خلال 7 أيام", value: insights?.expiringSoon?.length ?? 0, icon: CalendarClock, color: "text-rose-400" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border/60 bg-white/5 p-2.5">
                <div className="flex items-center gap-1.5">
                  <stat.icon className={cn("size-3", stat.color)} />
                  <span className="text-[9px] text-muted-foreground">{stat.label}</span>
                </div>
                <div className="mt-0.5 text-base font-bold">{stat.value}</div>
              </div>
            ))}
          </div>

          {/* أزرار حية */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" className="gap-1.5 rounded-xl" onClick={() => runAsGem("membership audit")} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}
              جولة رقابة وتذكيرات (جيم)
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={() => runAsGem("membership insights")} disabled={busy}>
              <ShieldAlert className="size-4" />
              تقرير الانتهاء القريب
            </Button>
          </div>

          {/* أمر مباشر إلى جيم */}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAsGem(order)}
              placeholder="أمر إلى جيم… مثال: membership grant أحمد gold 30"
              className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-emerald-500/60"
            />
            <Button onClick={() => runAsGem(order)} disabled={busy || !order.trim()} className="gap-1.5 rounded-xl">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              أرسل لجيم
            </Button>
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            الأوامر المتاحة: <code className="rounded bg-muted px-1 py-0.5">membership grant اسم مستوى الأيام</code> · <code className="rounded bg-muted px-1 py-0.5">membership extend اسم الأيام</code> · <code className="rounded bg-muted px-1 py-0.5">membership revoke اسم</code> · <code className="rounded bg-muted px-1 py-0.5">membership code مستوى الأيام العدد</code>
          </p>
          {lastResult && (
            <div className="mt-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-2.5 text-xs leading-relaxed">
              {lastResult}
            </div>
          )}
        </CardContent>
      </Card>

      {/* تنتهي قريباً — تمديد سريع عبر جيم */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <h4 className="flex items-center gap-2 text-sm font-bold mb-3">
            <CalendarClock className="size-4 text-rose-500" />
            تنتهي عضويتهم خلال 7 أيام
          </h4>
          {!insights ? (
            <div className="flex justify-center py-4"><Loader2 className="size-4 animate-spin" /></div>
          ) : insights.expiringSoon.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">لا توجد عضويات تنتهي قريباً 🎉</p>
          ) : (
            <div className="space-y-2">
              {insights.expiringSoon.map((m, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5">
                  <span>{TIER_INFO[m.tier]?.emoji ?? "🎫"}</span>
                  <span className="text-xs font-medium">{m.name}</span>
                  <span className="text-[10px] text-rose-500">{m.daysLeft} يوم متبقٍ</span>
                  <div className="ms-auto flex gap-1.5">
                    <Button size="sm" variant="ghost" className="h-7 gap-1 rounded-lg text-[10px]" disabled={busy} onClick={() => runAsGem(`membership extend ${m.name} 7`)}>
                      <Zap className="size-3" /> تمديد 7
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 gap-1 rounded-lg text-[10px]" disabled={busy} onClick={() => runAsGem(`membership extend ${m.name} 30`)}>
                      <Zap className="size-3" /> تمديد 30
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* أعلى الأعضاء وفاءً */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <h4 className="flex items-center gap-2 text-sm font-bold mb-3">
            <Trophy className="size-4 text-yellow-500" />
            أطول العضويات المدفوعة
          </h4>
          <div className="space-y-1.5">
            {(insights?.topByDays ?? []).slice(0, 6).map((m, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs">
                <span className="flex items-center gap-2">
                  <span className="font-bold text-muted-foreground w-5">#{i + 1}</span>
                  <span>{TIER_INFO[m.tier]?.emoji}</span>
                  <span className="font-medium">{m.name}</span>
                </span>
                <span className="text-muted-foreground">{m.days} يوم</span>
              </div>
            ))}
            {(insights?.topByDays ?? []).length === 0 && (
              <p className="py-3 text-center text-xs text-muted-foreground">لا توجد عضويات مدفوعة بعد</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* سجل أفعال العضوية — أثر حقيقي قابل للتحقق */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <h4 className="flex items-center gap-2 text-sm font-bold mb-3">
            <ScrollText className="size-4 text-primary" />
            سجل أفعال العضوية (المالك + جيم)
          </h4>
          {!insights ? (
            <div className="flex justify-center py-4"><Loader2 className="size-4 animate-spin" /></div>
          ) : gemLogs.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">لا سجلات بعد — نفّذ أمراً أو جولة رقابة وستظهر كل حركة هنا.</p>
          ) : (
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {gemLogs.map((l, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2">
                  <span className="mt-0.5 text-xs">{l.actor === GEM_ID ? "💎" : "👑"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] leading-relaxed">
                      <strong className="text-foreground">{l.actorName}</strong> — {l.detail}
                    </p>
                    <span className="text-[9px] text-muted-foreground">
                      {new Date(l.at).toLocaleString("ar-SA", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function MembershipAdmin() {
  const [activeTab, setActiveTab] = useState<
    "overview" | "codes" | "honor" | "settings" | "steward" | "ops"
  >("overview");
  const stats = useQuery(api.membershipSystem.getMembershipStats);
  const data = useQuery(api.membershipSystem.getOwnerMembershipData);

  if (stats === undefined || data === undefined || stats === null || data === null) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* ── Tabs ── */}
      <div className="flex gap-1.5 rounded-xl bg-white/5 p-1">
        {[
          { id: "overview" as const, label: "نظرة عامة", icon: BarChart3 },
          { id: "codes" as const, label: "الأكواد", icon: Key },
          { id: "honor" as const, label: "لوحة الشرف", icon: Trophy },
          { id: "settings" as const, label: "الإعدادات", icon: Settings },
          { id: "steward" as const, label: "حارسة العضويات", icon: Gem },
          { id: "ops" as const, label: "أنظمة 4.0", icon: BarChart3 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => { sounds.click(); setActiveTab(tab.id); }}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all",
              activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="size-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === "overview" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "إجمالي المستخدمين", value: stats.totalUsers, icon: Users, color: "text-blue-400" },
              { label: "العضويات النشطة", value: stats.activeMemberships ?? stats.totalMemberships, icon: Crown, color: "text-yellow-400" },
              { label: "الأكواد النشطة", value: stats.activeCodes, icon: Key, color: "text-green-400" },
              { label: "نسبة التحويل", value: `${stats.conversionRate}%`, icon: TrendingUp, color: "text-purple-400" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border/60 bg-white/5 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className={cn("size-3.5", stat.color)} />
                  <span className="text-[10px] text-muted-foreground">{stat.label}</span>
                </div>
                <div className="text-lg font-bold">{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Tier Distribution */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <h4 className="flex items-center gap-2 text-sm font-bold mb-3">
                <BarChart3 className="size-4 text-primary" />
                توزيع المستويات
              </h4>
              <div className="space-y-3">
                {data.tierStats.map((tier) => (
                  <TierBar key={tier.tier} label={tier.name} emoji={tier.emoji} count={tier.count} total={stats.totalUsers} color={TIER_INFO[tier.tier]?.color ?? "gray"} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="rounded-xl h-auto py-3 flex-col gap-1" onClick={() => setActiveTab("codes")}>
              <Key className="size-4" />
              <span className="text-xs">إنشاء أكواد</span>
            </Button>
            <Button variant="outline" className="rounded-xl h-auto py-3 flex-col gap-1" onClick={() => setActiveTab("honor")}>
              <Trophy className="size-4" />
              <span className="text-xs">لوحة الشرف</span>
            </Button>
          </div>
        </motion.div>
      )}

      {/* ── Codes Tab ── */}
      {activeTab === "codes" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <CodeCreator />
          <ManualTierChanger />
        </motion.div>
      )}

      {/* ── Honor Tab ── */}
      {activeTab === "honor" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <HonorBoard tier="exclusive" />
          <HonorBoard tier="diamond" />
          <HonorBoard tier="gold" />
        </motion.div>
      )}

      {/* ── Settings Tab ── */}
      {activeTab === "settings" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <ExclusiveGamesManager />
          <SoundPacksManager />
          <AiLevelsReference />

          {/* Reference Table */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <h4 className="flex items-center gap-2 text-sm font-bold mb-3">
                <Target className="size-4 text-orange-500" />
                مرجع المميزات
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className="p-2 text-right">الميزة</th>
                      <th className="p-2 text-center">🥉</th>
                      <th className="p-2 text-center">🥈</th>
                      <th className="p-2 text-center">🥇</th>
                      <th className="p-2 text-center">💎</th>
                      <th className="p-2 text-center">👑</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { feat: "تحديات يومية", values: ["5", "8", "12", "20", "30"] },
                      { feat: "مضاعف مكافآت", values: ["1x", "1.25x", "1.5x", "1.75x", "2x"] },
                      { feat: "الألعاب", values: ["1", "2", "3", "4", "5"] },
                      { feat: "غرف خاصة", values: ["-", "1", "3", "5", "∞"] },
                      { feat: "هدايا يومية", values: ["-", "3", "8", "15", "50"] },
                      { feat: "شارة", values: ["-", "🥈", "🥇", "💎", "👑"] },
                      { feat: "AI", values: ["أساسي", "قياسي", "متقدم", "خبير", "احترافي"] },
                      { feat: "صوتيات", values: ["-", "فضي", "ذهبي", "ماسي", "أسطوري"] },
                    ].map((row) => (
                      <tr key={row.feat} className="border-b border-border/30">
                        <td className="p-2 text-right font-medium">{row.feat}</td>
                        {row.values.map((val, i) => (
                          <td key={i} className="p-2 text-center">{val}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── حارسة العضويات «جيم» — ربط نظام العضويات بمساعد نائب المالك ── */}
      {activeTab === "steward" && (
        <StewardPanel />
      )}

      {/* ── أنظمة العضوية 4.0: فرق ومقاعد · رتب شرفية · تجديد واسترداد · خزنة ── */}
      {activeTab === "ops" && (
        <MembershipOpsPanel />
      )}
    </div>
  );
}
