import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState } from "react";
import {
  Store,
  Gift,
  Loader2,
  Check,
  RotateCcw,
  Coins,
} from "lucide-react";

/**
 * 🛒 غرفة عمليات الاقتصاد — رؤية وتدخل سريع:
 *  - نبضة الاقتصاد الحية (مدمجة من غرفة القيادة)
 *  - تدقيق الهدايا: معدل الاستلام + الأنواع + آخر الهدايا
 *  - محرر متجر حي: عدّل سعر أي امتياز فوراً — يطبّق على الجميع
 */

const ar = (ts: number) =>
  new Date(ts).toLocaleString("ar", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric" });

export function EconomyWarRoom() {
  const pulse = useQuery(api.commandDeck.getEconomyPulse, {});
  const audit = useQuery(api.commandDeck.getGiftAudit, {});
  const shop = useQuery(api.commandDeck.getShopAdmin, {});
  const govFeed = useQuery(api.commandDeck.getGovernorEconomyFeed, {});
  const setPrice = useMutation(api.commandDeck.setPerkPrice);

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const savePrice = async (perkKey: string, baseCost: number) => {
    const raw = edits[perkKey]?.trim();
    const cost = raw === "" ? baseCost : Number(raw);
    if (Number.isNaN(cost)) {
      toast.error("أدخل رقماً صالحاً.");
      return;
    }
    setBusy(perkKey);
    try {
      await setPrice({ perkKey, cost });
      toast.success(raw === "" ? "أُعيد السعر الأساسي." : `تم تحديث السعر إلى ${cost} نقطة — يسري فوراً.`);
      setEdits((e) => {
        const next = { ...e };
        delete next[perkKey];
        return next;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التحديث.");
    } finally {
      setBusy(null);
    }
  };

  const health = pulse?.health ?? null;

  return (
    <div dir="rtl" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
            <Coins className="size-5" />
          </span>
          <div>
            <h3 className="text-base font-bold">غرفة عمليات الاقتصاد</h3>
            <p className="text-[11px] text-muted-foreground">رؤية حية + تدخل فوري في المتجر والهدايا</p>
          </div>
        </div>
        {health !== null && (
          <Badge
            variant="outline"
            className={cn(
              "rounded-full text-xs",
              health >= 70 ? "border-emerald-500/40 text-emerald-600" : health >= 40 ? "border-amber-500/40 text-amber-600" : "border-rose-500/40 text-rose-600",
            )}
          >
            صحة الاقتصاد: {health}%
          </Badge>
        )}
      </div>

      {/* ═══ تنبيهات الحاكم الآلي — قسم الاقتصاد ═══ */}
      {govFeed && (govFeed.economyActions.length > 0 || govFeed.economyRequests.length > 0) && (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              🤖 تقارير «خازن الدراهم» — الحاكم الآلي
              {govFeed.economyRequests.length > 0 && (
                <Badge className="ms-auto rounded-full bg-rose-500/15 text-rose-600">
                  {govFeed.economyRequests.length} طلب تدخل معلّق
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {govFeed.economyRequests.map((r) => (
              <div key={r.id} className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2.5">
                <p className="text-xs font-bold text-rose-600">{r.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed">{r.reasoning}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">انتظر قرارك في تبويب الحاكم الآلي 🤖</p>
              </div>
            ))}
            <div className="max-h-40 space-y-1 overflow-y-auto pe-1">
              {govFeed.economyActions.map((a) => (
                <div key={a.id} className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px]",
                  a.summary.includes("🚨") ? "border-amber-500/40 bg-amber-500/5" : "border-border/50 bg-muted/20")}>
                  <span className="shrink-0 font-bold text-primary">{a.agentName}:</span>
                  <span className="min-w-0 flex-1">{a.summary}</span>
                  <span className="shrink-0 text-[9px] text-muted-foreground">{ar(a.createdAt)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ محرر المتجر الحي ═══ */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Store className="size-4 text-primary" /> المتجر الحي — أسعار فورية
          </CardTitle>
        </CardHeader>
        <CardContent>
          {shop === undefined || shop === null ? (
            <p className="py-6 text-center text-xs text-muted-foreground">جارٍ التحميل…</p>
          ) : (
            <div className="space-y-2">
              {shop.map((p) => (
                <div key={p.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-sm">
                  <span className="text-lg">{p.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{p.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{p.desc}</p>
                  </div>
                  {p.overridden && (
                    <Badge variant="outline" className="rounded-full border-amber-500/40 text-[9px] text-amber-600">
                      سعر معدَّل (أساسي {p.baseCost})
                    </Badge>
                  )}
                  <span className="font-mono text-sm font-bold text-primary">{p.currentCost}</span>
                  <Input
                    value={edits[p.key] ?? ""}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [p.key]: e.target.value }))}
                    placeholder={`${p.baseCost}`}
                    type="number"
                    className="h-8 w-24 rounded-lg text-xs"
                  />
                  <Button size="sm" variant="outline" className="gap-1 rounded-lg text-[10px]" onClick={() => savePrice(p.key, p.baseCost)} disabled={busy === p.key}>
                    {busy === p.key ? <Loader2 className="size-3 animate-spin" /> : edits[p.key]?.trim() === "" ? <RotateCcw className="size-3" /> : <Check className="size-3" />}
                    {edits[p.key]?.trim() === "" ? "استعادة" : "حفظ"}
                  </Button>
                </div>
              ))}
              <p className="pt-1 text-[10px] text-muted-foreground">
                اترك الحقل فارغاً واضغط «استعادة» للعودة للسعر الأساسي. التغيير يسري على كل اللاعبين فوراً.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ تدقيق الهدايا ═══ */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            <Gift className="size-4 text-pink-500" /> تدقيق الهدايا — آخر 30 يوماً
            {audit && (
              <Badge variant="outline" className="ms-auto rounded-full text-[10px]">
                استلام {audit.totals.claimRate}%
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {audit && audit.byType.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {audit.byType.map((t) => (
                <Badge key={t.type} variant="outline" className="rounded-full text-[11px]">
                  {t.type}: {t.count}
                </Badge>
              ))}
            </div>
          )}
          {audit === undefined || audit === null ? (
            <p className="py-6 text-center text-xs text-muted-foreground">جارٍ التحميل…</p>
          ) : audit.recent.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">لا هدايا خلال 30 يوماً.</p>
          ) : (
            <div className="max-h-72 space-y-1.5 overflow-y-auto pe-1">
              {audit.recent.map((g) => (
                <div key={g.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs">
                  <span className="font-bold">{g.senderName}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-bold">{g.receiverName}</span>
                  <Badge variant="outline" className="rounded-full px-1.5 text-[9px]">{g.giftType}</Badge>
                  {g.xpAmount != null && <span className="font-mono text-primary">+{g.xpAmount} XP</span>}
                  <Badge
                    variant="outline"
                    className={cn(
                      "ms-auto rounded-full text-[9px]",
                      g.claimed ? "border-emerald-500/40 text-emerald-600" : "border-amber-500/40 text-amber-600",
                    )}
                  >
                    {g.claimed ? "استُلمت" : "بانتظار الاستلام"}
                  </Badge>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{ar(g.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
