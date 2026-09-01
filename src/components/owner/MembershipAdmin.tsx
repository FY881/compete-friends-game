import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
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
  ChevronDown,
  ChevronUp,
  Calendar,
  Zap,
} from "lucide-react";

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
        <div className={cn("h-full rounded-full transition-all duration-1000", color)} style={{ width: `${pct}%` }} />
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
      toast.success(`تم إنشاء ${result.count} كود بنجاح`);
    } catch (error) {
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
            <button key={t.value} type="button" onClick={() => setTierId(t.value)}
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
        <Button onClick={handleCreate} disabled={busy} className="w-full gap-1.5 rounded-xl">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          إنشاء الأكواد
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Manual Tier Change Dialog ────────────────────────────────
function TierChangeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const adminChangeTier = useMutation(api.membershipFeatures.adminChangeTier);
  const users = useQuery(api.owner.listUsers, {});
  const [targetId, setTargetId] = useState("");
  const [newTier, setNewTier] = useState("gold");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const filteredUsers = (users ?? []).filter((u) =>
    search && (u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()))
  ).slice(0, 10);

  const handleChange = async () => {
    if (!targetId || !reason) {
      toast.error("أدخل المستخدم والسبب");
      return;
    }
    setBusy(true);
    try {
      await adminChangeTier({
        targetUserId: targetId as any,
        newTier,
        reason,
        durationDays: duration ? parseInt(duration) : undefined,
      });
      toast.success("تم تغيير العضوية بنجاح");
      onClose();
      setTargetId("");
      setReason("");
      setDuration("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطأ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">تغيير عضوية يدوي</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Search user */}
          <div>
            <label className="mb-1 block text-xs font-medium">اللاعب</label>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو البريد…"
                className="h-9 rounded-xl ps-8 text-xs" />
            </div>
            {filteredUsers.length > 0 && !targetId && (
              <div className="mt-1 max-h-32 overflow-y-auto rounded-xl border bg-background">
                {filteredUsers.map((u) => (
                  <button key={u.id} type="button"
                    onClick={() => { setTargetId(u.id); setSearch(u.name); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-muted">
                    <span className="font-medium">{u.name}</span>
                    <span className="text-muted-foreground">{u.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tier selection */}
          <div>
            <label className="mb-1 block text-xs font-medium">المستوى الجديد</label>
            <div className="grid grid-cols-5 gap-1">
              {["bronze", "silver", "gold", "diamond", "exclusive"].map((t) => (
                <button key={t} type="button" onClick={() => setNewTier(t)}
                  className={cn("rounded-lg border p-2 text-center text-[10px] font-medium transition-all",
                    newTier === t ? "border-primary bg-primary/10 text-primary" : "border-border/60")}>
                  {t === "bronze" ? "🥉" : t === "silver" ? "🥈" : t === "gold" ? "🥇" : t === "diamond" ? "💎" : "👑"}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="mb-1 block text-xs font-medium">المدة (اختياري — يوم)</label>
            <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)}
              placeholder="فارغ = دائم" className="h-9 rounded-xl text-xs" min="1" />
          </div>

          {/* Reason */}
          <div>
            <label className="mb-1 block text-xs font-medium">السبب *</label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="سبب التغيير…" rows={2} className="rounded-xl text-xs" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>إلغاء</Button>
          <Button size="sm" className="gap-1.5 rounded-xl" onClick={handleChange} disabled={busy || !targetId || !reason}>
            {busy ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
            تطبيق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Admin Panel ─────────────────────────────────────────
export function MembershipAdmin() {
  const stats = useQuery(api.membershipSystem.getMembershipStats);
  const honorBoard = useQuery(api.membershipFeatures.getHonorBoard, { tier: "exclusive" });
  const weeklyExclusive = useQuery(api.membershipFeatures.getWeeklyExclusive);
  const [showTierChange, setShowTierChange] = useState(false);
  const [activeSection, setActiveSection] = useState<"overview" | "codes" | "honor" | "settings">("overview");

  return (
    <div className="space-y-5">
      {/* Section Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {[
          { id: "overview" as const, label: "نظرة عامة", icon: BarChart3 },
          { id: "codes" as const, label: "الأكواد", icon: Key },
          { id: "honor" as const, label: "لوحة الشرف", icon: Trophy },
          { id: "settings" as const, label: "الإعدادات", icon: Shield },
        ].map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveSection(tab.id)}
            className={cn("flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all whitespace-nowrap",
              activeSection === tab.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
            <tab.icon className="size-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Section */}
      {activeSection === "overview" && (
        <div className="space-y-5">
          {/* Stats Cards */}
          {stats && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-border/60"><CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Users className="size-5" /></div>
                  <div><p className="text-2xl font-bold">{stats.totalUsers}</p><p className="text-[10px] text-muted-foreground">إجمالي اللاعبين</p></div>
                </div>
              </CardContent></Card>
              <Card className="border-border/60"><CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-600"><Crown className="size-5" /></div>
                  <div><p className="text-2xl font-bold">{stats.totalMemberships}</p><p className="text-[10px] text-muted-foreground">عضوية نشطة</p></div>
                </div>
              </CardContent></Card>
              <Card className="border-border/60"><CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><Key className="size-5" /></div>
                  <div><p className="text-2xl font-bold">{stats.activeCodes}</p><p className="text-[10px] text-muted-foreground">كود نشط</p></div>
                </div>
              </CardContent></Card>
              <Card className="border-border/60"><CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600"><TrendingUp className="size-5" /></div>
                  <div><p className="text-2xl font-bold">{stats.totalUsers > 0 ? Math.round((stats.totalMemberships / stats.totalUsers) * 100) : 0}%</p><p className="text-[10px] text-muted-foreground">نسبة التحويل</p></div>
                </div>
              </CardContent></Card>
            </div>
          )}

          {/* Tier Distribution */}
          {stats && (
            <Card className="border-border/60"><CardContent className="p-5">
              <h3 className="flex items-center gap-2 text-sm font-bold mb-4"><BarChart3 className="size-4 text-primary" />توزيع المستويات</h3>
              <div className="space-y-3">
                <TierBar label="برونزي" emoji="🥉" count={stats.tierCounts.bronze ?? 0} total={stats.totalUsers} color="bg-gray-400" />
                <TierBar label="فضي" emoji="🥈" count={stats.tierCounts.silver ?? 0} total={stats.totalUsers} color="bg-slate-400" />
                <TierBar label="ذهبي" emoji="🥇" count={stats.tierCounts.gold ?? 0} total={stats.totalUsers} color="bg-yellow-500" />
                <TierBar label="ماسي" emoji="💎" count={stats.tierCounts.diamond ?? 0} total={stats.totalUsers} color="bg-blue-500" />
                <TierBar label="أسطوري" emoji="👑" count={stats.tierCounts.exclusive ?? 0} total={stats.totalUsers} color="bg-purple-500" />
              </div>
            </CardContent></Card>
          )}

          {/* Weekly Exclusive Info */}
          {weeklyExclusive && (
            <Card className="border-border/60"><CardContent className="p-5">
              <h3 className="flex items-center gap-2 text-sm font-bold mb-3"><Calendar className="size-4 text-primary" />اليوم الحصري الأسبوعي</h3>
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="text-xs font-medium">{weeklyExclusive.description}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  مضاعف المكافآت: {weeklyExclusive.multiplier}x
                </p>
              </div>
            </CardContent></Card>
          )}

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button onClick={() => setShowTierChange(true)} className="gap-1.5 rounded-xl text-xs">
              <Zap className="size-3.5" /> تغيير عضوية يدوي
            </Button>
          </div>
        </div>
      )}

      {/* Codes Section */}
      {activeSection === "codes" && <CodeCreator />}

      {/* Honor Board Section */}
      {activeSection === "honor" && (
        <Card className="border-border/60"><CardContent className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold mb-4"><Trophy className="size-4 text-yellow-500" />لوحة شرف الأعضاء الأسطوريين</h3>
          {!honorBoard ? (
            <div className="flex justify-center py-6"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
          ) : honorBoard.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">لا يوجد أعضاء أسطوريين بعد</p>
          ) : (
            <div className="space-y-2">
              {honorBoard.map((player, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-border/40 p-3">
                  <span className={cn("flex size-8 items-center justify-center rounded-full text-sm font-bold",
                    i === 0 ? "bg-yellow-500/20 text-yellow-700" : i === 1 ? "bg-slate-400/20 text-slate-600" : i === 2 ? "bg-amber-600/20 text-amber-700" : "bg-muted text-muted-foreground")}>
                    {i + 1}
                  </span>
                  <div className="flex-1"><p className="text-xs font-bold">{player.name}</p></div>
                  <Badge variant="outline" className="rounded-full text-[9px]">👑 أسطوري</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent></Card>
      )}

      {/* Settings Section */}
      {activeSection === "settings" && (
        <Card className="border-border/60"><CardContent className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold mb-4"><Shield className="size-4 text-primary" />مرجع المميزات لكل مستوى</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="p-2 text-start font-medium text-muted-foreground">الميزة</th>
                  <th className="p-2 text-center">🥉</th><th className="p-2 text-center">🥈</th><th className="p-2 text-center">🥇</th><th className="p-2 text-center">💎</th><th className="p-2 text-center">👑</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "تحديات يومية", values: ["5", "8", "12", "20", "30"] },
                  { label: "مضاعف المكافآت", values: ["1x", "1.25x", "1.5x", "1.75x", "2x"] },
                  { label: "عدد الألعاب", values: ["1", "2", "3", "3+", "4+"] },
                  { label: "هدايا إرسال", values: ["0", "3", "8", "15", "50"] },
                  { label: "شارة خاصة", values: ["—", "✓", "✓+", "✓✓", "✓✓✓"] },
                  { label: "غرف خاصة", values: ["—", "—", "1", "5", "∞"] },
                  { label: "AI شخصي", values: ["أساسي", "قياسي", "متقدم", "خبير", "احترافي"] },
                  { label: "تأثيرات بصرية", values: ["—", "—", "خفيفة", "متحركة", "استثنائية"] },
                  { label: "عصابة", values: ["—", "—", "10", "20", "∞"] },
                  { label: "يوم حصري", values: ["—", "—", "جمعة", "خميس+", "3 أيام"] },
                ].map((row) => (
                  <tr key={row.label} className="border-b border-border/20">
                    <td className="p-2 font-medium">{row.label}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className={cn("p-2 text-center", v === "—" ? "text-muted-foreground/40" : "")}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent></Card>
      )}

      {/* Tier Change Dialog */}
      <TierChangeDialog open={showTierChange} onClose={() => setShowTierChange(false)} />
    </div>
  );
}
