import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";
import {
  Loader2,
  ShieldCheck,
  Timer,
  Ban,
  FileUser,
  Coins,
  Swords,
  ScrollText,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

/**
 * 👤 ملف اللاعب الشامل — نافذة واحدة بكل شيء عن اللاعب:
 * هوية + إحصاءات + شارات سلوك + خط العقوبات + الاقتصاد + آخر الجولات.
 */

const FLAG_STYLE: Record<string, string> = {
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  bad: "border-rose-500/40 bg-rose-500/10 text-rose-600",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-600",
};

const ar = (ts: number) =>
  new Date(ts).toLocaleString("ar", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

export function PlayerDossier({
  userId,
  open,
  onClose,
  onChanged,
}: {
  userId: string | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const dossier = useQuery(
    api.commandDeck.getPlayerDossier,
    open && userId ? { userId: userId as never } : "skip",
  );
  const punish = useMutation(api.owner.applyPunishment);
  const [busy, setBusy] = useState(false);

  if (!open || !userId) return null;

  const act = async (type: "warn" | "mute" | "ban") => {
    if (!dossier) return;
    setBusy(true);
    try {
      await punish({
        userId: userId as never,
        type,
        reason: "من ملف اللاعب الشامل",
      });
      toast.success(type === "warn" ? "تم التحذير." : type === "mute" ? "تم الكتم." : "تم الحظر.");
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التنفيذ.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUser className="size-5 text-primary" />
            {dossier ? dossier.identity.name : "جارٍ التحميل…"}
          </DialogTitle>
        </DialogHeader>

        {dossier === undefined ? (
          <p className="py-10 text-center text-sm text-muted-foreground">جارٍ جمع الملف…</p>
        ) : dossier === null ? (
          <p className="py-10 text-center text-sm text-muted-foreground">تعذّر تحميل الملف.</p>
        ) : (
          <div className="space-y-4">
            {/* الهوية + الشارات */}
            <div className="flex flex-wrap items-center gap-2">
              {dossier.identity.email && (
                <span className="font-mono text-[11px] text-muted-foreground">{dossier.identity.email}</span>
              )}
              {dossier.flags.map((f) => (
                <Badge key={f.key} variant="outline" className={cn("rounded-full text-[10px]", FLAG_STYLE[f.tone])}>
                  {f.label}
                </Badge>
              ))}
            </div>

            {/* إحصاءات */}
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: "المستوى", value: dossier.stats.xp },
                { label: "جولات", value: dossier.stats.gamesPlayed },
                { label: "% فوز", value: dossier.stats.winRate },
                { label: "% دقة", value: dossier.stats.accuracy },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-border/60 bg-muted/30 p-2">
                  <p className="text-lg font-bold tabular-nums">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* إجراءات سريعة */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-1.5 rounded-xl text-xs" onClick={() => act("warn")} disabled={busy || dossier.stats.bannedNow}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />} تحذير
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 rounded-xl text-xs" onClick={() => act("mute")} disabled={busy || dossier.stats.bannedNow}>
                <Timer className="size-3.5" /> كتم
              </Button>
              <Button size="sm" variant="destructive" className="gap-1.5 rounded-xl text-xs" onClick={() => act("ban")} disabled={busy}>
                <Ban className="size-3.5" /> حظر
              </Button>
              <span className="ms-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                {dossier.stats.warnings > 0 && <>{dossier.stats.warnings} تحذير ·</>}
                {dossier.stats.cheatStrikes > 0 && <>{dossier.stats.cheatStrikes} غش ·</>}
                سمعة المُبلِّغ: {dossier.identity.reporterReputation > 0 ? "+" : ""}
                {dossier.identity.reporterReputation}
              </span>
            </div>

            {/* خط العقوبات */}
            {dossier.punishments.length > 0 && (
              <section>
                <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold"><ScrollText className="size-3.5 text-primary" /> خط العقوبات</h4>
                <div className="max-h-36 space-y-1 overflow-y-auto pe-1">
                  {dossier.punishments.slice(0, 10).map((p, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5 text-[11px]">
                      <Badge variant="outline" className="rounded-full px-1.5 text-[9px]">{p.action}</Badge>
                      <span className="min-w-0 flex-1 truncate">{p.reason}</span>
                      <span className="shrink-0 text-muted-foreground">{ar(p.at)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* الاقتصاد */}
            {dossier.ledger.length > 0 && (
              <section>
                <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold"><Coins className="size-3.5 text-amber-500" /> آخر حركات المحفظة</h4>
                <div className="max-h-32 space-y-1 overflow-y-auto pe-1">
                  {dossier.ledger.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5 text-[11px]">
                      {l.delta >= 0 ? <TrendingUp className="size-3 text-emerald-600" /> : <TrendingDown className="size-3 text-rose-600" />}
                      <span className={cn("font-mono font-bold", l.delta >= 0 ? "text-emerald-600" : "text-rose-600")}>
                        {l.delta >= 0 ? "+" : ""}{l.delta}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{l.reason}</span>
                      <span className="shrink-0 text-muted-foreground">{ar(l.at)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* آخر الجولات */}
            {dossier.recentGames.length > 0 && (
              <section>
                <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold"><Swords className="size-3.5 text-primary" /> آخر الجولات</h4>
                <div className="max-h-36 space-y-1 overflow-y-auto pe-1">
                  {dossier.recentGames.map((g, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5 text-[11px]">
                      <span className={cn("font-mono font-bold", g.rank === 1 ? "text-amber-500" : "text-muted-foreground")}>#{g.rank}</span>
                      <span className="text-muted-foreground">من {g.playerCount}</span>
                      <span className="font-bold">{g.score}</span>
                      <span className="text-muted-foreground">({g.correct}/{g.questions})</span>
                      {g.won && <Badge className="rounded-full bg-amber-500/15 px-1.5 text-[9px] text-amber-600">فوز 🏆</Badge>}
                      <span className="ms-auto shrink-0 text-muted-foreground">{ar(g.playedAt)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
