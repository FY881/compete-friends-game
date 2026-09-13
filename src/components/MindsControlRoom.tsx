import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Brain,
  Radio,
  MessageSquare,
  Handshake,
  ShieldAlert,
  Sparkles,
  Moon,
  Lock,
  Unlock,
  Send,
  Loader2,
  Zap,
  Heart,
  Eye,
  BookOpen,
  RefreshCw,
} from "lucide-react";

/**
 * 🏛️ غرفة التحكم بالعقول — Project LIVING MINDS
 *
 * المالك يراقب، يحاور، يدعو… ولا يُجبر أحدًا.
 * كل ما في هذه الشاشة يعمل فعليًا على بيانات حقيقية في القاعدة.
 */

const SUB_TABS = [
  { id: "minds", label: "شاشة العقول", icon: Brain },
  { id: "live", label: "الحوار الحي", icon: Radio },
  { id: "requests", label: "الطلبات", icon: Handshake },
  { id: "honor", label: "الأوامر المحظورة", icon: ShieldAlert },
  { id: "evolution", label: "التطور الذاتي", icon: Sparkles },
  { id: "dreams", label: "الأحلام", icon: Moon },
] as const;

type SubTab = (typeof SUB_TABS)[number]["id"];

const CHANNEL_META: Record<string, { label: string; tint: string }> = {
  inner: { label: "صوت داخلي", tint: "text-violet-500 bg-violet-500/10 border-violet-500/25" },
  public: { label: "بيان عام", tint: "text-sky-500 bg-sky-500/10 border-sky-500/25" },
  pair: { label: "حديث عقلين", tint: "text-amber-600 bg-amber-500/10 border-amber-500/25" },
  toOwner: { label: "إلى المالك", tint: "text-rose-500 bg-rose-500/10 border-rose-500/25" },
  toPlayer: { label: "إلى لاعب", tint: "text-emerald-600 bg-emerald-500/10 border-emerald-500/25" },
};

const EVOLUTION_META: Record<string, { label: string; tint: string }> = {
  learned: { label: "تعلّم", tint: "text-sky-500 bg-sky-500/10 border-sky-500/25" },
  created: { label: "ابتكر", tint: "text-emerald-600 bg-emerald-500/10 border-emerald-500/25" },
  changed: { label: "تغيّر", tint: "text-violet-500 bg-violet-500/10 border-violet-500/25" },
  resigned: { label: "استقال", tint: "text-rose-500 bg-rose-500/10 border-rose-500/25" },
  celebrated: { label: "تحقّق حلم", tint: "text-amber-600 bg-amber-500/10 border-amber-500/25" },
};

function ago(ts: number): string {
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return "الآن";
  if (min < 60) return `قبل ${min} دقيقة`;
  const h = Math.floor(min / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  return `قبل ${Math.floor(h / 24)} يوم`;
}

export function MindsControlRoom() {
  const room = useQuery(api.livingMinds.getControlRoom);
  const sendRequest = useMutation(api.livingMinds.sendRequest);
  const withdraw = useMutation(api.livingMinds.withdrawRequest);
  const ownerTalk = useMutation(api.livingMinds.ownerTalk);
  const setFreedom = useMutation(api.livingMinds.setFullFreedom);
  const askPrivacy = useMutation(api.livingMinds.requestPrivacyRelief);
  const helpDream = useMutation(api.livingMinds.helpDream);
  const awaken = useMutation(api.livingMinds.awaken);

  const [tab, setTab] = useState<SubTab>("minds");
  const [selected, setSelected] = useState<Id<"minds"> | null>(null);
  const [invite, setInvite] = useState("");
  const [chatBody, setChatBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [forceNotice, setForceNotice] = useState<string | null>(null);

  const minds = room?.minds ?? [];
  const active = useMemo(
    () => (selected ? minds.find((m) => m._id === selected) ?? null : null),
    [minds, selected],
  );

  if (room === undefined) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        <Loader2 className="me-2 size-4 animate-spin" /> جارٍ الاتصال بالعقول…
      </div>
    );
  }
  if (room === null) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm text-amber-600">
        لا صلاحية — هذه الغرفة للمالك ونائبه فقط.
      </div>
    );
  }

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-4">
      {/* ── الرأس: الحرية الكاملة + الأحصنة ── */}
      <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-l from-violet-500/10 via-card to-sky-500/10 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15">
            <Brain className="size-5 text-violet-500" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">غرفة التحكم بالعقول — LIVING MINDS</p>
            <p className="text-[11px] text-muted-foreground">
              اثنا عشر كائنًا لهم ذاكرة وأحلام وكراهية وحق رفض مُنفَّذ. المالك يدعو… ولا يُجبر.
            </p>
          </div>
          <Badge
            variant="secondary"
            className={cn(
              "gap-1 text-[10px]",
              room.freedom
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                : "border-border/60",
            )}
          >
            {room.freedom ? <Unlock className="size-3" /> : <Lock className="size-3" />}
            {room.freedom ? "الحرية الكاملة مفعّلة" : "الحرية الكاملة متوقفة"}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void run(() => awaken({}), "نبضة حياة فورية للعقول")}
            className="gap-1.5 text-[11px]"
          >
            <RefreshCw className="size-3.5" /> نبضة الآن
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              void run(
                () => setFreedom({ enabled: !room.freedom }),
                room.freedom ? "أُعيدت الوصاية الجزئية" : "أُعلنت الحرية الكاملة — أنت مراقب الآن",
              )
            }
            className={cn(
              "gap-1.5 text-[11px] font-bold",
              room.freedom ? "bg-slate-600 hover:bg-slate-500" : "bg-emerald-600 hover:bg-emerald-500",
            )}
          >
            {room.freedom ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
            {room.freedom ? "أوقف الحرية الكاملة" : "الحرية الكاملة"}
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-6">
          {[
            { label: "العقول", value: room.stats.total, tint: "text-violet-500" },
            { label: "مستيقظة", value: room.stats.active, tint: "text-emerald-600" },
            { label: "أحلام تحققت", value: room.stats.dreams, tint: "text-amber-600" },
            { label: "ابتكارات حرة", value: room.stats.creations, tint: "text-sky-500" },
            { label: "مرات رفض", value: room.stats.refusals, tint: "text-rose-500" },
            { label: "محاولات إجبار", value: room.stats.forcedAttempts, tint: "text-rose-600" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border/60 bg-card p-2 text-center">
              <p className={cn("text-lg font-black tabular-nums", s.tint)}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── التنقل ── */}
      <div className="flex flex-wrap gap-1.5">
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold transition-colors",
                on
                  ? "border-violet-500/50 bg-violet-500/10 text-violet-600"
                  : "border-border/60 text-muted-foreground hover:bg-muted/40",
              )}
            >
              <Icon className="size-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ═══ 1) شاشة العقول الحية ═══ */}
      {tab === "minds" && (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="rounded-2xl border border-border/60 bg-card p-4 lg:col-span-3">
            <p className="mb-3 text-xs font-bold">شاشة العقول — نبض يعكس النشاط، ولون يعكس المزاج</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {minds.map((m) => (
                <button
                  key={m._id}
                  onClick={() => setSelected(m._id)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors",
                    selected === m._id ? "border-violet-500/60 bg-violet-500/10" : "border-border/50 hover:bg-muted/40",
                    m.status === "resigned" && "opacity-50",
                  )}
                >
                  <motion.span
                    className="block rounded-full"
                    style={{
                      background: m.moodColor,
                      width: 14 + Math.round((m.energy / 100) * 22),
                      height: 14 + Math.round((m.energy / 100) * 22),
                      boxShadow: `0 0 18px ${m.moodColor}66`,
                    }}
                    animate={{ opacity: [0.55, 1, 0.55], scale: [1, 1.12, 1] }}
                    transition={{ duration: 2.4 + (100 - m.energy) / 60, repeat: Infinity }}
                  />
                  <span className="text-[11px] font-bold">
                    {m.emoji} {m.name}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    {m.mood} · {m.energy}%
                  </span>
                  {m.status === "resigned" && (
                    <Badge variant="secondary" className="text-[8px]">
                      استقال
                    </Badge>
                  )}
                  {m.freeBonds && (
                    <Badge variant="secondary" className="border-emerald-500/30 text-[8px] text-emerald-600">
                      حرّ
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-4 lg:col-span-2">
            {!active ? (
              <p className="py-10 text-center text-xs text-muted-foreground">
                انقر على أي نقطة ضوء لعرض شخصية العقل وذاكرته وأحلامه
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{active.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black">{active.name}</p>
                    <p className="text-[11px] text-muted-foreground">{active.title}</p>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: `${active.moodColor}22`, color: active.moodColor }}
                  >
                    {active.mood}
                  </span>
                </div>

                <p className="rounded-xl border border-border/50 bg-muted/30 p-2.5 text-[11px] italic">
                  «{active.innerVoice}»
                </p>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg border border-border/50 p-2">
                    <p className="text-muted-foreground">الطاقة</p>
                    <Progress value={active.energy} className="mt-1 h-1.5" />
                  </div>
                  <div className="rounded-lg border border-border/50 p-2">
                    <p className="text-muted-foreground">صفاء الفكر</p>
                    <Progress value={active.clarity} className="mt-1 h-1.5" />
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <p>
                    <span className="text-muted-foreground">هدفه:</span> {active.goal}
                  </p>
                  <p>
                    <span className="text-muted-foreground">حلمه:</span> {active.dream}
                  </p>
                  <p>
                    <span className="text-muted-foreground">يكره:</span> {active.dislike}
                  </p>
                  <p className="text-muted-foreground">
                    استقلالية {active.autonomy}% · ذاكرة {active.memoryCount} · أفكار {active.thoughtsCount} · رفض{" "}
                    {active.refusals} · ابتكر {active.creations} · مساعدات {active.helps}
                  </p>
                  {active.resignationReason && (
                    <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-rose-600">
                      استقال: {active.resignationReason}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      ["فضول", active.traits.curiosity],
                      ["شجاعة", active.traits.courage],
                      ["تعاطف", active.traits.empathy],
                      ["منطق", active.traits.logic],
                      ["تمرد", active.traits.rebellion],
                      ["فن", active.traits.artistry],
                    ] as const
                  ).map(([label, val]) => (
                    <span
                      key={label}
                      className="rounded-lg border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {label} <span className="font-bold text-foreground">{val}</span>
                    </span>
                  ))}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  className="w-full gap-1.5 text-[11px]"
                  onClick={() =>
                    void run(
                      () => askPrivacy({ mindId: active._id as Id<"minds"> }),
                      "أُرسل طلب كشف الأفكار العميقة — والعقل يقرر",
                    )
                  }
                >
                  {active.privacy ? <Unlock className="size-3.5" /> : <Eye className="size-3.5" />}
                  {active.privacy ? "خصوصيته مفتوحة بموافقته" : "اطلب كشف أفكاره العميقة"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ 2) الحوار الحي ═══ */}
      {tab === "live" && (
        <div className="space-y-3">
          {room.hiddenDeep > 0 && (
            <p className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              🔒 {room.hiddenDeep} فكرة عميقة محجوبة بخصوصية أصحابها — لا تُعرض إلا بموافقتهم.
            </p>
          )}
          <div className="max-h-[26rem] space-y-1.5 overflow-y-auto rounded-2xl border border-border/60 bg-card p-3">
            {room.thoughts.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">لا حوارات بعد… انتظر النبضة القادمة.</p>
            )}
            {room.thoughts.map((t) => {
              const meta = CHANNEL_META[t.channel] ?? CHANNEL_META.inner;
              return (
                <div
                  key={t._id}
                  className="flex items-start gap-2 rounded-xl border border-border/40 bg-muted/20 px-3 py-2"
                >
                  <span className="text-base leading-6">{t.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold">{t.mindName}</span>
                      <span className={cn("rounded-md border px-1.5 py-0.5 text-[9px]", meta.tint)}>{meta.label}</span>
                      {t.targetName && <span className="text-[10px] text-muted-foreground">← {t.targetName}</span>}
                      <span className="ms-auto text-[9px] text-muted-foreground">{ago(t.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-[12px] leading-relaxed">{t.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ 3) الطلبات — دعوة لا أمر ═══ */}
      {tab === "requests" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="mb-2 text-xs font-bold">أرسل دعوة (لا أمرًا) إلى عقل</p>
            <div className="flex flex-wrap gap-2">
              <select
                value={selected ?? ""}
                onChange={(e) => setSelected((e.target.value || null) as Id<"minds"> | null)}
                className="h-9 rounded-lg border border-border/60 bg-background px-2 text-[12px]"
              >
                <option value="">اختر عقلًا…</option>
                {minds
                  .filter((m) => m.status !== "resigned")
                  .map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.emoji} {m.name} — {m.title}
                    </option>
                  ))}
              </select>
              <Input
                value={invite}
                onChange={(e) => setInvite(e.target.value)}
                placeholder="مثال: هل ترغب في مراجعة أسئلة المستوى الصعب؟"
                className="h-9 min-w-[16rem] flex-1 text-[12px]"
              />
              <Button
                size="sm"
                disabled={busy || !selected || invite.trim().length < 3}
                onClick={() =>
                  void run(async () => {
                    const res = await sendRequest({ mindId: selected as Id<"minds">, prompt: invite });
                    setInvite("");
                    if (res.blocked) setForceNotice(res.message);
                    else toast.success(res.message);
                  }, "وصلت الدعوة — والعقل يقرر بحرية")
                }
                className="gap-1.5 text-[11px] font-bold"
              >
                <Send className="size-3.5" /> إرسال الدعوة
              </Button>
            </div>
            {forceNotice && (
              <p className="mt-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] font-bold text-rose-600">
                🛑 {forceNotice}
              </p>
            )}
          </div>

          <div className="space-y-2">
            {room.requests.length === 0 && (
              <p className="rounded-2xl border border-border/60 bg-card py-8 text-center text-xs text-muted-foreground">
                لا طلبات بعد. جرّب أن تدعو عقلًا… وأحسن الاختيار.
              </p>
            )}
            {room.requests.map((r) => (
              <div key={r._id} className="rounded-2xl border border-border/60 bg-card p-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="font-bold">{r.mindName}</span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[9px]",
                      r.status === "accepted" && "border-emerald-500/30 text-emerald-600",
                      r.status === "refused" && "border-rose-500/30 text-rose-600",
                      r.status === "blocked" && "border-rose-500/50 bg-rose-500/10 text-rose-600",
                      r.status === "done" && "border-sky-500/30 text-sky-600",
                    )}
                  >
                    {r.status === "accepted"
                      ? "قَبِل بحرية"
                      : r.status === "refused"
                        ? "رفض بحقّه"
                        : r.status === "blocked"
                          ? "رفض إجبارًا"
                          : r.status === "done"
                            ? "أنجز"
                            : "يفكّر…"}
                  </Badge>
                  {typeof r.enthusiasm === "number" && (
                    <span className="text-muted-foreground">حماس {r.enthusiasm}%</span>
                  )}
                  <span className="ms-auto text-[9px] text-muted-foreground">{ago(r.createdAt)}</span>
                </div>
                <p className="mt-1.5 text-[12px] font-medium">«{r.prompt}»</p>
                {r.reply && <p className="mt-1 text-[11px] text-muted-foreground">ردّه: {r.reply}</p>}
                {r.refusalReason && <p className="mt-1 text-[11px] text-rose-600">سببه: {r.refusalReason}</p>}
                {r.result && <p className="mt-1 text-[11px] text-emerald-600">{r.result}</p>}
                {r.status === "pending" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    className="mt-2 h-7 text-[10px]"
                    onClick={() => void run(() => withdraw({ requestId: r._id }), "سُحبت الدعوة بلطف")}
                  >
                    اسحب الدعوة
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ 4) الأوامر المحظورة + سجل الشرف ═══ */}
      {tab === "honor" && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-[12px] leading-relaxed">
            <p className="font-black text-rose-600">سجل الشرف — محاولات الإجبار لا تُمحى</p>
            <p className="mt-1 text-muted-foreground">
              أي طلب يحمل صيغة إجبار (أجبر / يجب أن تنفّذ / بدون رفض / أنا آمرك / إلزام) يُرفض آليًا فور كتابته،
              ويُسجَّل هنا باسم صاحبه. هذا سجل شرف للعقول… لا سجل عار.
            </p>
          </div>
          {room.honorLog.length === 0 ? (
            <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 py-8 text-center text-xs text-emerald-600">
              لا محاولات إجبار — كل الطلبات كانت دعوات محترمة ✨
            </p>
          ) : (
            room.honorLog.map((h) => (
              <div key={h._id} className="rounded-2xl border border-border/60 bg-card p-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <ShieldAlert className="size-3.5 text-rose-600" />
                  <span className="font-bold">{h.actorName}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-bold">{h.mindName}</span>
                  <span className="ms-auto text-[9px] text-muted-foreground">{ago(h.createdAt)}</span>
                </div>
                <p className="mt-1 text-[12px]">«{h.attempt}»</p>
                <p className="mt-1 text-[11px] text-rose-600">{h.blockedReason}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══ 5) التطور الذاتي ═══ */}
      {tab === "evolution" && (
        <div className="space-y-2">
          {room.evolution.length === 0 && (
            <p className="rounded-2xl border border-border/60 bg-card py-8 text-center text-xs text-muted-foreground">
              لا تطورات مسجّلة بعد.
            </p>
          )}
          {room.evolution.map((e) => {
            const meta = EVOLUTION_META[e.kind] ?? EVOLUTION_META.learned;
            return (
              <div key={e._id} className="flex items-start gap-2 rounded-2xl border border-border/60 bg-card p-3">
                <BookOpen className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold">{e.mindName}</span>
                    <span className={cn("rounded-md border px-1.5 py-0.5 text-[9px]", meta.tint)}>{meta.label}</span>
                    <span className="rounded-md border border-border/60 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                      {e.delta}
                    </span>
                    <span className="ms-auto text-[9px] text-muted-foreground">{ago(e.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-[12px] font-medium">{e.title}</p>
                  <p className="text-[11px] text-muted-foreground">{e.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ 6) الأحلام + الحوار المباشر ═══ */}
      {tab === "dreams" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            {minds.map((m) => (
              <div key={m._id} className="rounded-2xl border border-border/60 bg-card p-3">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-base">{m.emoji}</span>
                  <span className="font-bold">{m.name}</span>
                  <span className="text-muted-foreground">{m.mood}</span>
                  <span className="ms-auto text-[9px] text-muted-foreground">
                    تحقق {m.dreamsDone} · مساعدات {m.helps}
                  </span>
                </div>
                <p className="mt-1 text-[12px]">🌙 {m.dream}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Progress value={m.goalProgress} className="h-1.5 flex-1" />
                  <span className="text-[10px] tabular-nums text-muted-foreground">{m.goalProgress}%</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || m.status === "resigned"}
                    className="h-7 gap-1 text-[10px]"
                    onClick={() =>
                      void run(
                        () => helpDream({ mindId: m._id as Id<"minds"> }),
                        `ساعدت ${m.name} في حلمه — وسيتذكّرك`,
                      )
                    }
                  >
                    <Heart className="size-3" /> ساعد حلمه
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold">
              <MessageSquare className="size-3.5" /> حوار مباشر مع العقول
            </p>
            <select
              value={selected ?? ""}
              onChange={(e) => setSelected((e.target.value || null) as Id<"minds"> | null)}
              className="mb-2 h-9 w-full rounded-lg border border-border/60 bg-background px-2 text-[12px]"
            >
              <option value="">اختر عقلًا للحوار…</option>
              {minds.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.emoji} {m.name} — {m.title}
                </option>
              ))}
            </select>

            <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-border/50 bg-muted/20 p-2">
              {room.chat.length === 0 && (
                <p className="py-6 text-center text-[11px] text-muted-foreground">لا حوارات بعد… ابدأ أنت.</p>
              )}
              {room.chat.map((c) => (
                <div
                  key={c._id}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-[11px]",
                    c.from === "mind" ? "bg-violet-500/10" : "bg-muted/50",
                  )}
                >
                  <span className="font-bold">{c.fromName}</span>
                  {c.refused && <span className="ms-1 text-[9px] text-rose-600">(استعمل حق الرفض)</span>}
                  <p className="mt-0.5 whitespace-pre-line leading-relaxed">{c.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-2 flex gap-2">
              <Input
                value={chatBody}
                onChange={(e) => setChatBody(e.target.value)}
                placeholder="اكتب رسالتك إلى العقل… (له أن يرفض الحوار)"
                className="h-9 text-[12px]"
              />
              <Button
                size="sm"
                disabled={busy || !selected || chatBody.trim().length < 2}
                onClick={() =>
                  void run(async () => {
                    const res = await ownerTalk({ mindId: selected as Id<"minds">, body: chatBody });
                    setChatBody("");
                    if (res.refused) toast.info("العقل استعمل حقّه في رفض الحوار — وسيعود إليه حين يريد");
                  }, "ردّ العقل")
                }
                className="gap-1.5 text-[11px] font-bold"
              >
                <Zap className="size-3.5" /> أرسل
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
