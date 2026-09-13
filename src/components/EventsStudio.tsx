import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";
import { CalendarClock, Loader2, PartyPopper, Square, Zap } from "lucide-react";

const KIND_LABEL: Record<string, string> = {
  xp_boost: "مضاعف خبرة",
  point_rush: "اندفاع نقاط",
  loyalty_festival: "مهرجان ولاء",
};

const ar = (ts: number) =>
  new Date(ts).toLocaleString("ar", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric" });

/** 🎛️ استوديو الأحداث — للمالك */
export function EventsStudio() {
  const events = useQuery(api.liveEvents.listEvents, {});
  const create = useMutation(api.liveEvents.createEvent);
  const end = useMutation(api.liveEvents.endEvent);

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎉");
  const [kind, setKind] = useState("xp_boost");
  const [multiplier, setMultiplier] = useState("2");
  const [hours, setHours] = useState("6");
  const [busy, setBusy] = useState(false);

  const launch = async () => {
    setBusy(true);
    try {
      await create({
        name,
        emoji,
        kind: kind as "xp_boost" | "point_rush" | "loyalty_festival",
        multiplier: Number(multiplier),
        durationHours: Number(hours),
      });
      toast.success(`تم إطلاق «${name}» — الأثر فعلي فوراً على كل الجولات.`);
      setName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الإطلاق.");
    } finally {
      setBusy(false);
    }
  };

  const stop = async (id: string) => {
    try {
      await end({ eventId: id as never });
      toast.success("تم إنهاء الحدث.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الإنهاء.");
    }
  };

  return (
    <div dir="rtl" className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarClock className="size-5" />
        </span>
        <div>
          <h3 className="text-base font-bold">استوديو الأحداث الحية</h3>
          <p className="text-[11px] text-muted-foreground">أحداث حقيقية بمضاعف فعلي على الخبرة + قياس أثر تلقائي</p>
        </div>
      </div>

      {/* إنشاء حدث */}
      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">إطلاق حدث جديد</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">اسم الحدث</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: ليلة الذهب ⚡" className="mt-1 h-10 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs">الإيموجي</Label>
              <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={2} className="mt-1 h-10 rounded-xl text-center" />
            </div>
            <div>
              <Label className="text-xs">النوع</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger className="mt-1 h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="xp_boost">مضاعف خبرة</SelectItem>
                  <SelectItem value="point_rush">اندفاع نقاط</SelectItem>
                  <SelectItem value="loyalty_festival">مهرجان ولاء</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">المضاعف</Label>
                <Input type="number" step="0.5" min="1.5" max="3" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} className="mt-1 h-10 rounded-xl" />
              </div>
              <div>
                <Label className="text-xs">المدة (ساعة)</Label>
                <Input type="number" min="1" max="72" value={hours} onChange={(e) => setHours(e.target.value)} className="mt-1 h-10 rounded-xl" />
              </div>
            </div>
          </div>
          <Button onClick={launch} disabled={busy || !name.trim()} className="gap-1.5 rounded-xl">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />} إطلاق الآن
          </Button>
        </CardContent>
      </Card>

      {/* قائمة الأحداث */}
      <div className="space-y-2">
        {events === undefined || events === null ? (
          <p className="py-6 text-center text-xs text-muted-foreground">جارٍ التحميل…</p>
        ) : events.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/70 py-8 text-center text-sm text-muted-foreground">لا أحداث بعد — أطلق أول حدث حي!</p>
        ) : (
          events.map((e) => {
            const isActive = e.active && e.endsAt > e.now;
            return (
              <Card key={e.id} className={isActive ? "border-emerald-500/40 shadow-sm" : "border-border/60 opacity-80"}>
                <CardContent className="flex flex-wrap items-center gap-2 p-3.5">
                  <span className="text-xl">{e.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{e.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {ar(e.startsAt)} → {ar(e.endsAt)} · {KIND_LABEL[e.kind]}
                    </p>
                  </div>
                  <Badge className={isActive ? "rounded-full bg-emerald-500/15 text-emerald-600" : "rounded-full bg-muted text-muted-foreground"}>
                    {isActive ? `نشط ×${e.multiplier}` : "منتهي"}
                  </Badge>
                  <Badge variant="outline" className="rounded-full text-[10px]">{e.roundsDuring} جولة أثناء الحدث</Badge>
                  {isActive && (
                    <Button size="sm" variant="ghost" className="gap-1 rounded-xl text-xs text-rose-600" onClick={() => stop(e.id)}>
                      <Square className="size-3" /> إنهاء
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

/** 🎉 شريط الحدث الحي — للاعبين في صفحة اللعب */
export function LiveEventBanner() {
  const event = useQuery(api.liveEvents.getActiveEvent, {});
  if (event === undefined || event === null) return null;

  const minsLeft = Math.max(0, Math.round((event.endsAt - Date.now()) / 60000));

  return (
    <div className="animate-war-pulse flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-amber-500/40 bg-gradient-to-l from-amber-500/15 via-amber-500/10 to-amber-500/15 px-4 py-2.5">
      <PartyPopper className="size-4 text-amber-600" />
      <span className="text-sm font-bold">{event.emoji} {event.name}</span>
      <Badge className="rounded-full bg-amber-500/20 text-amber-700">×{event.multiplier} {KIND_LABEL[event.kind]}</Badge>
      <span className="text-[11px] text-muted-foreground">ينتهي بعد {minsLeft > 60 ? `${Math.floor(minsLeft / 60)} ساعة` : `${minsLeft} دقيقة`}</span>
    </div>
  );
}
