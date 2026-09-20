import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Ban,
  Crown,
  Loader2,
  Pencil,
  RefreshCcw,
  ShieldAlert,
  Snowflake,
  Sun,
  Swords,
  Users,
  Zap,
} from "lucide-react";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * ⚔️ نكسس العشائر — قيادة العرش للمجتمع المنظَّم
 * ═══════════════════════════════════════════════════════════════════════
 * العشائر صارت قوة ذهنية حقيقية (من عقول أعضائها)، وهذا القسم يمنح
 * العرش السيطرة الكاملة: نبضة حيّة، تجميد، تصفير أسبوع، إعادة تسمية،
 * وحلّ عشيرة — وكل قرار يُسجَّل في سجل التدقيق.
 * ═══════════════════════════════════════════════════════════════════════
 */

const ar = (ts: number) =>
  new Date(ts).toLocaleString("ar", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric" });

export function ClanNexusPanel() {
  const data = useQuery(api.clanNexus.getClanPulse);
  const freeze = useMutation(api.clanNexus.ownerFreezeClan);
  const resetWeek = useMutation(api.clanNexus.ownerResetClanWeek);
  const dissolve = useMutation(api.clanNexus.ownerDissolveClan);
  const rename = useMutation(api.clanNexus.ownerRenameClan);

  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  if (data === undefined) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  if (data === null) return null;

  const { pulse, clans, recentFlags } = data;
  const maxBucket = Math.max(1, ...pulse.rankBuckets.map((b) => b.count));

  const run = async (key: string, fn: () => Promise<{ ok: boolean; message: string }>) => {
    setBusy(key);
    try {
      const res = await fn();
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر تنفيذ القرار");
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  return (
    <Card className="overflow-hidden border-emerald-500/25">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 bg-emerald-500/5 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <Swords className="size-4 text-emerald-600" />
          نكسس العشائر
          <span className="text-[10px] font-normal text-muted-foreground">
            قوة ذهنية جماعية · أهداف · رقابة · قيادة كاملة
          </span>
        </CardTitle>
        <Badge variant="secondary" className="text-[10px] font-bold">
          {pulse.totalClans} عشيرة · {pulse.totalMembers} عضو
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {/* ═══ النبضة ═══ */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { icon: Zap, label: "متوسط القوة الذهنية", value: `${pulse.avgPower}` },
            { icon: Crown, label: "أقوى عشيرة", value: `${pulse.topPower}` },
            { icon: Snowflake, label: "عشائر مُجمَّدة", value: `${pulse.frozen}` },
            { icon: ShieldAlert, label: "مخالفات 24س", value: `${pulse.flags24h}` },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border/70 bg-muted/20 p-3">
              <s.icon className="size-4 text-muted-foreground" />
              <p className="mt-1.5 text-base font-black tabular-nums leading-none">{s.value}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {pulse.empty ? (
          <p className="rounded-2xl border border-dashed border-border/70 p-5 text-center text-xs text-muted-foreground">
            لا عشائر بعد — أول عشيرة تُؤسَّس ستظهر هنا فوراً مع قوتها الذهنية.
          </p>
        ) : (
          <>
            {/* ═══ توزيع رتب العشائر + المخالفة الأكثر ═══ */}
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 p-3">
                <p className="mb-2.5 text-xs font-bold">توزيع العشائر على سلّم القوة</p>
                <div className="space-y-1.5">
                  {pulse.rankBuckets
                    .slice()
                    .reverse()
                    .map((b) => (
                      <div key={b.level} className="flex items-center gap-2">
                        <span className="w-28 shrink-0 truncate text-[10px] font-bold">
                          {b.icon} {b.name}
                        </span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-l from-emerald-500 to-teal-500"
                            style={{ width: `${Math.round((b.count / maxBucket) * 100)}%` }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-left text-[10px] font-black tabular-nums">
                          {b.count}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 p-3">
                <p className="text-xs font-bold">قراءة سريعة</p>
                <ul className="mt-2 space-y-1.5 text-[11px]">
                  <li className="flex items-center justify-between">
                    <span className="text-muted-foreground">أعلى نقاط حرب هذا الأسبوع</span>
                    <span className="font-black tabular-nums">{pulse.warLeaderPoints}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-muted-foreground">أكثر مخالفة شيوعاً</span>
                    <span className="font-black">
                      {pulse.topViolation ? `${pulse.topViolation.label} (${pulse.topViolation.count})` : "لا مخالفات ✅"}
                    </span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-muted-foreground">متوسط حجم العشيرة</span>
                    <span className="font-black tabular-nums">
                      {pulse.totalClans > 0 ? Math.round((pulse.totalMembers / pulse.totalClans) * 10) / 10 : 0} عضو
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/* ═══ العشائر + أدوات القيادة ═══ */}
            <div>
              <p className="mb-2 text-xs font-bold">العشائر — وقيادة كاملة</p>
              <ul className="space-y-1.5">
                {clans.map((c) => (
                  <li
                    key={c.id}
                    className={cn(
                      "rounded-2xl border p-2.5",
                      c.frozen ? "border-rose-500/40 bg-rose-500/5" : "border-border/70 bg-card/60",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-muted text-lg">
                        {c.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold">
                          {c.name}
                          {c.frozen && (
                            <Badge variant="destructive" className="ms-1.5 text-[9px]">
                              مُجمَّدة
                            </Badge>
                          )}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {c.rankIcon} {c.rankName} · قوة {c.power} · {c.memberCount} عضو · {c.pointsThisWeek} نقطة حرب
                        </p>
                      </div>
                      <Badge variant="outline" className="hidden shrink-0 text-[9px] sm:inline-flex">
                        <Users className="size-3" /> {c.memberCount}
                      </Badge>
                    </div>

                    {editing === c.id ? (
                      <div className="mt-2 flex gap-1.5">
                        <Input
                          dir="rtl"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="الاسم الجديد…"
                          maxLength={24}
                          className="h-8 text-xs"
                        />
                        <Button
                          size="sm"
                          className="h-8 text-[11px]"
                          disabled={busy === `rename:${c.id}`}
                          onClick={() =>
                            run(`rename:${c.id}`, () => rename({ clanId: c.id as Id<"clans">, name: newName }))
                          }
                        >
                          حفظ
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-[11px]"
                          onClick={() => {
                            setEditing(null);
                            setNewName("");
                          }}
                        >
                          إلغاء
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-[11px]"
                          disabled={busy === `freeze:${c.id}`}
                          onClick={() =>
                            run(`freeze:${c.id}`, () =>
                              freeze({ clanId: c.id as Id<"clans">, frozen: !c.frozen }),
                            )
                          }
                        >
                          {c.frozen ? <Sun className="size-3" /> : <Snowflake className="size-3" />}
                          {c.frozen ? "رفع التجميد" : "تجميد"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-[11px]"
                          disabled={busy === `reset:${c.id}`}
                          onClick={() => run(`reset:${c.id}`, () => resetWeek({ clanId: c.id as Id<"clans"> }))}
                        >
                          <RefreshCcw className="size-3" />
                          تصفير الأسبوع
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-[11px]"
                          onClick={() => {
                            setEditing(c.id);
                            setNewName(c.name);
                          }}
                        >
                          <Pencil className="size-3" />
                          تسمية
                        </Button>
                        {confirm === c.id ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 gap-1 text-[11px]"
                            disabled={busy === `dissolve:${c.id}`}
                            onClick={() =>
                              run(`dissolve:${c.id}`, () =>
                                dissolve({ clanId: c.id as Id<"clans">, reason: "قرار العرش" }),
                              )
                            }
                          >
                            {busy === `dissolve:${c.id}` ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Ban className="size-3" />
                            )}
                            تأكيد الحل
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 text-[11px] text-muted-foreground"
                            onClick={() => {
                              setConfirm(c.id);
                              setTimeout(() => setConfirm((x) => (x === c.id ? null : x)), 5000);
                            }}
                          >
                            <Ban className="size-3" />
                            حل العشيرة
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* ═══ سجل الرقابة ═══ */}
            <div className="rounded-2xl border border-border/70 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold">
                <AlertTriangle className="size-3.5 text-amber-600" />
                سجل رقابة العشائر
              </p>
              {recentFlags.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  لا مخالفات مسجَّلة — دردشات العشائر نظيفة ✅
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {recentFlags.map((f) => (
                    <li key={f.id} className="flex items-start justify-between gap-2 text-[11px]">
                      <span className="min-w-0">
                        <span className="font-bold">{f.userName}</span>
                        <span className="text-muted-foreground">
                          {" — "}
                          {f.clanName} · {f.reason}
                        </span>
                        {f.preview && (
                          <span className="block text-[10px] text-muted-foreground">«{f.preview}»</span>
                        )}
                      </span>
                      <span className="shrink-0 text-left">
                        <Badge
                          variant={f.verdict === "flag" ? "destructive" : "secondary"}
                          className="text-[9px] font-bold"
                        >
                          {f.verdict === "flag" ? "رُفضت" : "تنبيه"}
                        </Badge>
                        <span className="mt-0.5 block text-[9px] text-muted-foreground">{ar(f.at)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ═══ خريطة الترابط ═══ */}
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
              <p className="mb-2 text-xs font-bold">كيف صارت العشيرة نظاماً حقيقياً؟</p>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {[
                  { icon: "🧠", text: "قوة العشيرة = مجموع قوة عقول أعضائها ⇒ العشائر القوية سببها لاعبون أذكى" },
                  { icon: "🎖️", text: "الرتبة (٨ رتب) تمنح مزايا فعلية: زيادة نقاط حرب ومكافآت أهداف أكبر" },
                  { icon: "🎯", text: "أهداف أسبوعية تتوسّع مع حجم العشيرة — لا تُنصف الصغيرة ولا تُحابي الكبيرة" },
                  { icon: "⚖️", text: "المكافأة ٣٠٪ بالتساوي + ٧٠٪ بحسب المساهمة ⇒ من عمل أكثر أخذ أكثر" },
                  { icon: "🏦", text: "مكافآت الأهداف تملأ خزينة العشيرة ⇒ تُصرَف على ترقيات حرب العشائر" },
                  { icon: "🛡️", text: "رقابة مُفسَّرة على الدردشة: تحذير يمرّ، ومخالفة صريحة تُرفض وتُسجَّل هنا" },
                ].map((r) => (
                  <li key={r.text} className="flex items-start gap-2 rounded-xl bg-background/60 p-2">
                    <span className="text-sm">{r.icon}</span>
                    <span className="text-[10px] leading-relaxed text-muted-foreground">{r.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
