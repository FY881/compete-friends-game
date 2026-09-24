import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2,
  Crown,
  Zap,
  Siren,
  Snowflake,
  Undo2,
  ShieldCheck,
  Timer,
  Sparkles,
  Gavel,
} from "lucide-react";
import { GovernanceConsole } from "@/components/GovernanceConsole";

const KIND_LABELS: Record<string, string> = {
  xp_multiplier: "⭐ مضاعف الخبرة",
  coin_multiplier: "🪙 مضاعف العملات",
  shop_discount: "🏷️ خصم المتجر",
  category_spotlight: "🎯 تخصص الأسبوع",
  martial_mode: "🚨 وضع الطوارئ",
  quarantine: "🧊 عزل لاعب",
};

/** بطاقة نبض الحاكم السيادي — تظهر في لوحة القيادة: حالة الطوارئ والمراسيم النشطة */
export function SovereignPulseCard({ compact }: { compact?: boolean }) {
  const state = useQuery(api.sovereign.getSovereignState);
  if (state === undefined || state === null) return null;
  const active = state.activeDecrees ?? [];
  const pending = state.pendingDualSign ?? [];
  const martial = active.find((d) => d.kind === "martial_mode");
  return (      <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-4 shadow-sm",
        compact && "px-4 py-3",
        martial
          ? "border-rose-500/50 bg-rose-500/10"
          : active.length > 0
            ? "border-amber-500/40 bg-amber-500/5"
            : "border-border/70 bg-card",
      )}
    >
      <Crown className="size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">الحاكم السيادي</p>
        <p className="text-xs text-muted-foreground">
          {martial
            ? "🚨 وضع الطوارئ مفعّل — الاقتصاد والمطابقة والدردشة مجمّدة"
            : active.length > 0
              ? `${active.length} مرسوماً نشطاً — ${active.map((d) => KIND_LABELS[d.kind] ?? d.kind).join(" · ")}`
              : "اللعبة بوضعها الطبيعي — لا مراسيم نشطة"}
        </p>
      </div>
      {pending.length > 0 && (
        <Badge className="rounded-full bg-rose-500 text-[10px] text-white">
          {pending.length} بصمة مزدوجة بانتظار التأكيد
        </Badge>
      )}
    </div>
  );
}

/** لوحة الحاكم السيادي — المرحلة 1: المرسوم الفوري + الطوارئ + العزل + البصمة المزدوجة */
export function SovereignPanel() {
  const state = useQuery(api.sovereign.getSovereignState);
  const issueDecree = useMutation(api.sovereign.issueDecree);
  const toggleMartial = useMutation(api.sovereign.toggleMartialMode);
  const quarantine = useMutation(api.sovereign.quarantinePlayer);
  const releaseQuarantine = useMutation(api.sovereign.releaseQuarantine);
  const confirmDecree = useMutation(api.sovereign.confirmDecree);
  const dropDecree = useMutation(api.sovereign.dropDecree);

  const [kind, setKind] = useState("xp_multiplier");
  const [value, setValue] = useState("2");
  const [label, setLabel] = useState("مضاعف نهاية الأسبوع");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("24");
  const [martialReason, setMartialReason] = useState("");
  const [qName, setQName] = useState("");
  const [qReason, setQReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  if (state === undefined || state === null) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const run = async (key: string, fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(okMsg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر التنفيذ");
    } finally {
      setBusy(null);
    }
  };

  const pending = state.pendingDualSign ?? [];

  return (
    <div className="space-y-5">
      {/* البصمة المزدوجة */}
      {pending.length > 0 && (
        <Card className="border-rose-500/40 bg-rose-500/5 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-rose-700">
              <ShieldCheck className="size-4" /> بصمة مزدوجة مطلوبة — {pending.length} أمراً خطيراً
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.map((d) => {
              const secs = Math.max(0, Math.round(((d.dualSignDeadline ?? 0) - state.now) / 1000));
              return (
                <div key={d._id} className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-500/20 bg-card p-3">
                  <span className="text-sm font-bold">{d.label}</span>
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    <Timer className="me-1 size-3" /> {secs} ثانية
                  </Badge>
                  <p className="w-full text-xs text-muted-foreground">السبب: {d.reason}</p>
                  <div className="ms-auto flex gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5 rounded-xl"
                      disabled={busy === `c-${d._id}`}
                      onClick={() =>
                        run(`c-${d._id}`, () => confirmDecree({ decreeId: d._id }), "نُفِّذ الأمر")
                      }
                    >
                      {busy === `c-${d._id}` ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                      تأكيد (بصمة ثانية)
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-600"
                      disabled={busy === `d-${d._id}`}
                      onClick={() => run(`d-${d._id}`, () => dropDecree({ decreeId: d._id }), "أُسقط الأمر")}
                    >
                      <Undo2 className="size-3.5" /> إسقاط
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* المرسوم الفوري */}
      <Card className="border-primary/25 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Crown className="size-4 text-primary" /> المرسوم الفوري
            <Badge variant="outline" className="rounded-full text-[10px]">يُطبَّق لحظياً على الجميع</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold">نوع المرسوم</label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="xp_multiplier">⭐ مضاعف الخبرة</SelectItem>
                  <SelectItem value="coin_multiplier">🪙 مضاعف العملات</SelectItem>
                  <SelectItem value="shop_discount">🏷️ خصم المتجر (٪)</SelectItem>
                  <SelectItem value="category_spotlight">🎯 تخصص الأسبوع المضاعف</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">
                {kind === "shop_discount" ? "نسبة الخصم (1–70)" : kind === "category_spotlight" ? "اسم التخصص" : "المضاعف (مثال: 2 = ×2)"}
              </label>
              <Input value={value} onChange={(e) => setValue(e.target.value)} className="h-10 rounded-xl" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">الوصف الظاهر للاعبين</label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-10 rounded-xl" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">المدة (ساعات — 0 = دائم حتى الإلغاء)</label>
              <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="h-10 rounded-xl" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">سبب الحاكم (موثَّق في السجل ويظهر للاعبين)</label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: احتفال موسم الحروب الفكرية" className="rounded-xl" />
          </div>
          <Button
            className="gap-2 rounded-xl"
            disabled={busy === "decree" || !reason.trim() || !label.trim()}
            onClick={() =>
              run(
                "decree",
                () =>
                  issueDecree({
                    kind: kind as "xp_multiplier" | "coin_multiplier" | "shop_discount" | "category_spotlight",
                    value: Number(value) || 1,
                    label: label.trim(),
                    reason: reason.trim(),
                    durationHours: kind === "category_spotlight" ? 168 : Number(duration) || 0,
                  }),
                "صدر المرسوم — يُطبَّق الآن على كل الأنظمة",
              )
            }
          >
            {busy === "decree" ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
            إصدار المرسوم
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* وضع الطوارئ */}
        <Card className="border-rose-500/25 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-rose-700">
              <Siren className="size-4" /> وضع الطوارئ (Martial Mode)
              <Badge variant="outline" className="rounded-full text-[10px]">بصمة مزدوجة إلزامية</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              تجميد كامل: يتوقف الاقتصاد والمطابقة والدردشة العامة لحظياً — للصيانة العاجلة أو الرد على اختراق.
            </p>
            <Textarea rows={2} value={martialReason} onChange={(e) => setMartialReason(e.target.value)} placeholder="سبب الطوارئ…" className="rounded-xl" />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="gap-2 rounded-xl"
                disabled={busy === "martial-on" || !martialReason.trim()}
                onClick={() =>
                  run("martial-on", () => toggleMartial({ enable: true, reason: martialReason.trim() }), "بانتظار البصمة الثانية (60 ثانية)")
                }
              >
                {busy === "martial-on" ? <Loader2 className="size-4 animate-spin" /> : <Siren className="size-4" />}
                تفعيل الطوارئ
              </Button>
              <Button
                variant="outline"
                className="gap-2 rounded-xl"
                disabled={busy === "martial-off"}
                onClick={() => run("martial-off", () => toggleMartial({ enable: false, reason: "قرار الحاكم" }), "رُفعت حالة الطوارئ")}
              >
                {busy === "martial-off" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                رفع الطوارئ
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* العزل */}
        <Card className="border-sky-500/25 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-sky-700">
              <Snowflake className="size-4" /> حجرة العزل (Quarantine)
              <Badge variant="outline" className="rounded-full text-[10px]">بصمة مزدوجة إلزامية</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              فصل لاعب مشتبه به حتى المراجعة: لا يرى ولا يُرى، وتجري جولاته مراقَبة.
            </p>
            <Input value={qName} onChange={(e) => setQName(e.target.value)} placeholder="اسم اللاعب" className="h-10 rounded-xl" />
            <Textarea rows={2} value={qReason} onChange={(e) => setQReason(e.target.value)} placeholder="سبب العزل…" className="rounded-xl" />
            <Button
              className="gap-2 rounded-xl"
              disabled={busy === "quar" || !qName.trim() || !qReason.trim()}
              onClick={() =>
                run(
                  "quar",
                  () => quarantine({ username: qName.trim(), reason: qReason.trim() }),
                  "طلب العزل جاهز — أكّده بالبصمة الثانية",
                )
              }
            >
              {busy === "quar" ? <Loader2 className="size-4 animate-spin" /> : <Snowflake className="size-4" />}
              طلب عزل
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* المراسيم النشطة */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-amber-500" /> المراسيم النشطة ({state.activeDecrees?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(state.activeDecrees ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
              لا مراسيم نشطة — اللعبة بوضعها الطبيعي.
            </p>
          ) : (
            (state.activeDecrees ?? []).map((d) => (
              <div key={d._id} className={cn("flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3", d.kind === "martial_mode" ? "border-rose-500/30 bg-rose-500/5" : "border-border/70 bg-card")}>
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{KIND_LABELS[d.kind] ?? d.kind} — {d.label}</span>
                {d.expiresAt ? (
                  <Badge variant="outline" className="rounded-full text-[10px]">
                    ينتهي بعد {Math.max(0, Math.round((d.expiresAt - state.now) / 3600_000))} ساعة
                  </Badge>
                ) : (
                  <Badge variant="outline" className="rounded-full text-[10px]">دائم</Badge>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-rose-600"
                  disabled={busy === `x-${d._id}`}
                  onClick={() =>
                    d.kind === "quarantine"
                      ? run(`x-${d._id}`, () => releaseQuarantine({ decreeId: d._id }), "رُفع العزل")
                      : run(`x-${d._id}`, () => dropDecree({ decreeId: d._id }), "أُلغي المرسوم")
                  }
                >
                  <Undo2 className="size-3.5" /> إلغاء
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* حاكمة التطور — المحكمة ← نائب المالك ← إذن المالك ← الحاكم السيادي + الأداة الحقيقية */}
      <Card className="border-amber-500/30 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-amber-700">
            <Gavel className="size-4" /> حاكمة التطور — تعديل حقيقي للعبة
            <Badge variant="outline" className="rounded-full text-[10px]">
              بموافقتك الصريحة فقط
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
            المحكمة (٤٠ وحدة ذكاء) تُراجع الطلب، نائب المالك يُصادق، أنت تمنح الإذن، ثم ينفّذ الحاكم
            على وحدة runtime حقيقية. لا يُنفَّذ أي تعديل على الإنتاج أو main تلقائياً.
          </p>
          <GovernanceConsole />
        </CardContent>
      </Card>
    </div>
  );
}
