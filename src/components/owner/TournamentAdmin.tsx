import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trophy, Plus, Square, Loader2, Crown } from "lucide-react";

/** موجّة 5.3 — إدارة البطولات: إنشاء/إنهاء من لوحة القيادة. */
export function TournamentAdmin() {
  const active = useQuery(api.tournaments.getActive);
  const past = useQuery(api.tournaments.getPast, { limit: 3 });
  const create = useMutation(api.tournaments.create);
  const end = useMutation(api.tournaments.end);

  const [name, setName] = useState("");
  const [durationDays, setDurationDays] = useState("7");
  const [bestRounds, setBestRounds] = useState("5");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("أدخل اسم البطولة");
      return;
    }
    setBusy(true);
    try {
      await create({
        name: name.trim(),
        durationDays: Math.max(parseInt(durationDays) || 7, 1),
        bestRoundsCount: Math.max(parseInt(bestRounds) || 5, 1),
      });
      toast.success("انطلقت البطولة — تظهر الآن لكل اللاعبين في صفحة اللعب 🏆");
      setName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر الإنشاء");
    } finally {
      setBusy(false);
    }
  };

  const handleEnd = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const r = await end({ tournamentId: active._id });
      toast.success(`انتهت البطولة — الفائز: ${r.winners[0] ?? "لا أحد"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر الإنهاء");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-border/50 bg-card/80">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Trophy className="size-4 text-amber-500" />
            البطولات الأسبوعية
          </h3>
          {active && (
            <Badge variant="outline" className="rounded-full border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-700">
              نشطة الآن
            </Badge>
          )}
        </div>

        {active ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
            <div>
              <p className="text-xs font-bold">{active.name}</p>
              <p className="text-[10px] text-muted-foreground">
                تحتسب أفضل {active.bestRoundsCount} جولات — تنتهي {new Date(active.endsAt).toLocaleDateString()}
              </p>
            </div>
            <button
              type="button"
              onClick={handleEnd}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-rose-600 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Square className="size-3.5" />}
              إنهاء وإعلان الفائز
            </button>
          </div>
        ) : (
          <div className="space-y-2 rounded-xl border border-border/50 bg-muted/20 p-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم البطولة — مثال: بطولة نهاية الأسبوع 🏆"
              className="h-9 rounded-lg text-xs"
            />
            <div className="flex gap-2">
              <label className="flex-1">
                <span className="mb-1 block text-[10px] font-semibold text-muted-foreground">المدة (أيام)</span>
                <Input
                  type="number"
                  min="1"
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  className="h-8 rounded-lg text-[11px]"
                />
              </label>
              <label className="flex-1">
                <span className="mb-1 block text-[10px] font-semibold text-muted-foreground">أفضل جولات محتسبة</span>
                <Input
                  type="number"
                  min="1"
                  value={bestRounds}
                  onChange={(e) => setBestRounds(e.target.value)}
                  className="h-8 rounded-lg text-[11px]"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              إطلاق البطولة
            </button>
          </div>
        )}

        {past && past.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground">بطولات سابقة</p>
            {past.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/20 px-2.5 py-1.5">
                <span className="text-[11px] font-bold">{t.name}</span>
                <span className="flex items-center gap-1 text-[10px] text-amber-600">
                  <Crown className="size-3" />
                  {t.winners.map((w) => `${w.trophy} ${w.name}`).join(" · ") || "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
