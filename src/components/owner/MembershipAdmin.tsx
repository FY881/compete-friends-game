import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";

// ─── Tier Bar Chart ───────────────────────────────────────────
function TierBar({
  label,
  emoji,
  count,
  total,
  color,
}: {
  label: string;
  emoji: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5">
          <span>{emoji}</span>
          <span className="font-medium">{label}</span>
        </span>
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
      const result = await createCode({
        tierId,
        count: parseInt(count) || 1,
        durationDays: parseInt(duration) || 30,
      });
      toast.success(`تم إنشاء ${result.count} كود بنجاح`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطأ");
    } finally {
      setBusy(false);
    }
  };

  const tierOptions = [
    { value: "silver", label: "🥈 فضي" },
    { value: "gold", label: "🥇 ذهبي" },
    { value: "diamond", label: "💎 ماسي" },
    { value: "exclusive", label: "👑 أسطوري" },
  ];

  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold mb-4">
          <Key className="size-4 text-primary" />
          إنشاء أكواد عضوية
        </h3>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {tierOptions.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTierId(t.value)}
              className={cn(
                "rounded-xl border p-2.5 text-center text-xs font-medium transition-all",
                tierId === t.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 hover:border-border",
              )}
            >
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

// ─── Main Admin Panel ─────────────────────────────────────────
export function MembershipAdmin() {
  const stats = useQuery(api.membershipSystem.getMembershipStats);

  return (
    <div className="space-y-5">
      {/* Stats Overview */}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Users className="size-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                  <p className="text-[10px] text-muted-foreground">إجمالي اللاعبين</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-600">
                  <Crown className="size-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalMemberships}</p>
                  <p className="text-[10px] text-muted-foreground">عضوية نشطة</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Key className="size-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.activeCodes}</p>
                  <p className="text-[10px] text-muted-foreground">كود نشط</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                  <TrendingUp className="size-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {stats.totalUsers > 0 ? Math.round((stats.totalMemberships / stats.totalUsers) * 100) : 0}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">نسبة التحويل</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tier Distribution */}
      {stats && (
        <Card className="border-border/60">
          <CardContent className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold mb-4">
              <BarChart3 className="size-4 text-primary" />
              توزيع المستويات
            </h3>
            <div className="space-y-3">
              <TierBar label="برونزي" emoji="🥉" count={stats.tierCounts.bronze ?? 0} total={stats.totalUsers} color="bg-gray-400" />
              <TierBar label="فضي" emoji="🥈" count={stats.tierCounts.silver ?? 0} total={stats.totalUsers} color="bg-slate-400" />
              <TierBar label="ذهبي" emoji="🥇" count={stats.tierCounts.gold ?? 0} total={stats.totalUsers} color="bg-yellow-500" />
              <TierBar label="ماسي" emoji="💎" count={stats.tierCounts.diamond ?? 0} total={stats.totalUsers} color="bg-blue-500" />
              <TierBar label="أسطوري" emoji="👑" count={stats.tierCounts.exclusive ?? 0} total={stats.totalUsers} color="bg-purple-500" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Code Creator */}
      <CodeCreator />

      {/* Benefits Reference */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold mb-4">
            <Shield className="size-4 text-primary" />
            مرجع المميزات لكل مستوى
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="p-2 text-start font-medium text-muted-foreground">الميزة</th>
                  <th className="p-2 text-center">🥉</th>
                  <th className="p-2 text-center">🥈</th>
                  <th className="p-2 text-center">🥇</th>
                  <th className="p-2 text-center">💎</th>
                  <th className="p-2 text-center">👑</th>
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
                ].map((row) => (
                  <tr key={row.label} className="border-b border-border/20">
                    <td className="p-2 font-medium">{row.label}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className={cn("p-2 text-center", v === "—" ? "text-muted-foreground/40" : "")}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
