import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { GameData, GameSettings } from "@/convex/games";
import { CATEGORIES } from "@/convex/questions";
import {
  formatTimeOption,
  QUESTION_COUNT_OPTIONS,
  TIME_OPTIONS,
} from "@/lib/game-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Check,
  Crown,
  Copy,
  Flag,
  Gauge,
  Link2,
  ListChecks,
  Loader2,
  Play,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  UserRoundPlus,
  UserX,
} from "lucide-react";

const QUICK_REACTIONS = ["🔥", "😂", "👍", "🎉", "😱", "👏"];

/** A reaction bubble that fades out after a few seconds. */
function ReactionBubble({
  id,
  emoji,
  name,
}: {
  id: string;
  emoji: string;
  name: string;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, [id]);
  if (!visible) return null;
  return (
    <div
      key={id}
      className="pointer-events-none flex items-center gap-1.5 rounded-full border border-border/70 bg-card/90 px-3 py-1.5 text-sm shadow-md backdrop-blur animate-in fade-in slide-in-from-bottom-2"
    >
      <span className="text-base">{emoji}</span>
      <span className="text-[11px] font-bold text-muted-foreground">{name}</span>
    </div>
  );
}

/** Quick emoji reactions shared by everyone in the lobby (live). */
function ReactionsPanel({ code }: { code: string }) {
  const reactions = useQuery(api.games.getReactions, { code });
  const sendReaction = useMutation(api.games.sendReaction);
  const [busy, setBusy] = useState<string | null>(null);
  const shown = useRef<Set<string>>(new Set());

  const handleSend = async (emoji: string) => {
    if (busy) return;
    setBusy(emoji);
    try {
      await sendReaction({ code, emoji });
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر إرسال التفاعل.");
    } finally {
      setBusy(null);
    }
  };

  const fresh = (reactions ?? []).filter((r) => {
    if (shown.current.has(r.id)) return false;
    if (Date.now() - r.createdAt > 5000) return false;
    shown.current.add(r.id);
    return true;
  });

  return (
    <div className="mt-6 rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-bold">
          <Sparkles className="size-4 text-primary" />
          تفاعلات اللوبي
        </p>
        <span className="text-xs text-muted-foreground">تظهر للجميع فوراً</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => handleSend(emoji)}
            disabled={busy != null}
            className="flex size-10 items-center justify-center rounded-xl border border-border/70 bg-muted/40 text-lg transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/10 disabled:opacity-50"
            title={`أرسل ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
      {fresh.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {fresh.map((r) => (
            <ReactionBubble key={r.id} id={r.id} emoji={r.emoji} name={r.name} />
          ))}
        </div>
      )}
    </div>
  );
}
import { GameAvatar, copyText } from "./ui";

const REPORT_REASONS = [
  "اسم مسيء أو غير لائق",
  "إساءة أو تنمر",
  "غش",
  "إزعاج أو سبام",
  "سلوك آخر يخالف القوانين",
];

function SettingsSummary({ settings }: { settings: GameSettings }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="gap-1.5 rounded-full">
        <ListChecks className="size-3.5 text-primary" />
        {settings.questionCount} أسئلة
      </Badge>
      <Badge variant="outline" className="gap-1.5 rounded-full">
        <Gauge className="size-3.5 text-primary" />
        {formatTimeOption(settings.timePerQuestionMs)} لكل سؤال
      </Badge>
      {settings.categories.length > 0 ? (
        <Badge variant="outline" className="gap-1.5 rounded-full">
          {settings.categories.length} فئة مختارة
        </Badge>
      ) : (
        <Badge variant="outline" className="gap-1.5 rounded-full">
          كل الفئات
        </Badge>
      )}
    </div>
  );
}

function HostSettings({
  settings,
  disabled,
  onChange,
}: {
  settings: GameSettings;
  disabled: boolean;
  onChange: (next: GameSettings) => void;
}) {
  const toggleCategory = (category: string) => {
    const current = settings.categories;
    const next = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category];
    onChange({ ...settings, categories: next });
  };

  return (
    <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/[0.03] p-5">
      <p className="flex items-center gap-2 text-sm font-bold text-foreground">
        <SlidersHorizontal className="size-4 text-primary" />
        إعدادات الجولة
      </p>

      {/* Question count */}
      <div className="mt-4">
        <p className="text-xs font-semibold text-muted-foreground">عدد الأسئلة</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {QUESTION_COUNT_OPTIONS.map((count) => (
            <button
              key={count}
              type="button"
              disabled={disabled}
              onClick={() =>
                onChange({ ...settings, questionCount: count })
              }
              className={cn(
                "rounded-xl border px-4 py-2 text-sm font-bold transition-all",
                settings.questionCount === count
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border/80 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      {/* Time per question */}
      <div className="mt-4">
        <p className="text-xs font-semibold text-muted-foreground">الوقت لكل سؤال</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TIME_OPTIONS.map((ms) => (
            <button
              key={ms}
              type="button"
              disabled={disabled}
              onClick={() =>
                onChange({ ...settings, timePerQuestionMs: ms })
              }
              className={cn(
                "rounded-xl border px-4 py-2 text-sm font-bold transition-all",
                settings.timePerQuestionMs === ms
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border/80 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {formatTimeOption(ms)}
              {ms === 5000 && (
                <span className="ms-1 text-[10px] font-extrabold tracking-wide">⚡ برق</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="mt-4">
        <p className="text-xs font-semibold text-muted-foreground">
          الفئات{" "}
          <span className="font-normal">
            (اتركها فارغة لتشمل كل الفئات)
          </span>
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange({ ...settings, categories: [] })}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
              settings.categories.length === 0
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/80 bg-card text-muted-foreground hover:border-primary/40",
            )}
          >
            الكل
          </button>
          {CATEGORIES.map((category) => {
            const active = settings.categories.includes(category);
            return (
              <button
                key={category}
                type="button"
                disabled={disabled}
                onClick={() => toggleCategory(category)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/80 bg-card text-muted-foreground hover:border-primary/40",
                )}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ReportPlayerDialog({
  target,
  onClose,
}: {
  target: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const submitReport = useMutation(api.owner.submitReport);
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await submitReport({
        targetId: target.id as never,
        reason,
        details: details.trim() || undefined,
      });
      toast.success("تم إرسال البلاغ — الرقيب الآلي سيراجعه فوراً.");
      setDetails("");
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "تعذّر إرسال البلاغ.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={target != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="size-4 text-rose-500" />
            الإبلاغ عن {target?.name}
          </DialogTitle>
          <DialogDescription>
            البلاغ يُرسل إلى الإدارة ويُفحص تلقائياً بالذكاء الاصطناعي حسب قوانين
            الموقع. البلاغات الكاذبة تُعاقب أيضاً.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">سبب البلاغ</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">تفاصيل إضافية (اختياري)</Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              placeholder="اشرح ما حدث…"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={busy}
            className="gap-1.5 bg-rose-600 hover:bg-rose-700"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />}
            إرسال البلاغ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Lobby({
  game,
  me,
  onLeave,
}: {
  game: GameData;
  me: GameData["players"][number] | undefined;
  onLeave: () => void;
}) {
  const startGame = useMutation(api.games.startGame);
  const updateSettings = useMutation(api.games.updateSettings);
  const kickPlayer = useMutation(api.games.kickPlayerFromLobby);
  const [kicking, setKicking] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);

  const host = game.players.find((p) => p.isHost);
  const isHost = me?.isHost ?? false;
  const code = game.game.code;
  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/game/${code}`
      : "";

  const handleCopy = async (kind: "code" | "link") => {
    await copyText(
      kind === "code" ? code : inviteLink,
      kind === "code" ? "الرمز" : "رابط الدعوة",
    );
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      await startGame({ code });
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "تعذّر بدء التحدي، حاول مجدداً.",
      );
      setStarting(false);
    }
  };

  const handleSettingsChange = (next: GameSettings) => {
    if (!isHost || savingSettings) return;
    setSavingSettings(true);
    updateSettings({ code, settings: next })
      .catch((error) => {
        console.error(error);
        toast.error(
          error instanceof Error ? error.message : "تعذّر حفظ الإعدادات.",
        );
      })
      .finally(() => setSavingSettings(false));
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Invite card */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card p-8 text-center shadow-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 start-1/2 h-52 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
        />
        <Badge variant="outline" className="gap-1.5 rounded-full text-primary">
          <UserRoundPlus className="size-3.5" />
          شارك الرمز وابدأ التحدي
        </Badge>

        <h2 className="mt-6 text-sm font-semibold text-muted-foreground">
          رمز الغرفة
        </h2>
        <div className="mt-2 flex justify-center gap-2">
          {code.split("").map((char, i) => (
            <span
              key={i}
              className="flex size-12 items-center justify-center rounded-xl border border-border/80 bg-background text-2xl font-bold tracking-wider text-foreground shadow-sm"
            >
              {char}
            </span>
          ))}
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => handleCopy("code")}
          >
            {copied === "code" ? (
              <Check className="size-4 text-emerald-600" />
            ) : (
              <Copy className="size-4" />
            )}
            نسخ الرمز
          </Button>
          <Button
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => handleCopy("link")}
          >
            {copied === "link" ? (
              <Check className="size-4 text-emerald-600" />
            ) : (
              <Link2 className="size-4" />
            )}
            نسخ رابط الدعوة
          </Button>
          {navigator.share && (
            <Button
              variant="ghost"
              className="gap-2 rounded-xl"
              onClick={() => {
                navigator
                  .share({
                    title: "العبقري",
                    text: `انضم إليّ في العبقري! رمز الغرفة: ${code}`,
                    url: inviteLink,
                  })
                  .catch(() => undefined);
              }}
            >
              <Share2 className="size-4" />
              مشاركة
            </Button>
          )}
        </div>
      </div>

      {/* Room rules */}
      {isHost ? (
        <HostSettings
          settings={game.game.settings}
          disabled={savingSettings}
          onChange={handleSettingsChange}
        />
      ) : (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Gauge className="size-4 text-primary" />
            إعدادات الجولة
          </p>
          <SettingsSummary settings={game.game.settings} />
        </div>
      )}

      {/* Players */}
      <div className="mt-6 rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Users className="size-4 text-primary" />
            اللاعبون ({game.players.length})
          </p>
          <span className="text-xs text-muted-foreground">
            سيبدأ التحدي تلقائياً بعد ضغط «ابدأ»
          </span>
        </div>

        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {game.players.map((player, i) => (
            <li
              key={player.id}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/40 px-3.5 py-3"
            >
              <GameAvatar name={player.name} index={i} />
              <span className="flex-1 truncate text-sm font-semibold text-foreground">
                {player.name}
                {player.isMe && (
                  <span className="ms-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                    أنت
                  </span>
                )}
              </span>
              {player.isHost && (
                <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                  <Crown className="size-3.5" />
                  المضيف
                </span>
              )}
              {!player.isMe && isHost && (
                <button
                  type="button"
                  title="طرد اللاعب من الغرفة"
                  aria-label={`طرد ${player.name}`}
                  className="rounded-lg p-1.5 text-muted-foreground/50 transition-colors hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-50"
                  disabled={kicking === player.id}
                  onClick={async () => {
                    setKicking(player.id);
                    try {
                      await kickPlayer({ code, userId: player.id as never });
                      toast.success(`تم طرد ${player.name} من الغرفة.`);
                    } catch (error) {
                      console.error(error);
                      toast.error(
                        error instanceof Error ? error.message : "تعذّر الطرد.",
                      );
                    } finally {
                      setKicking(null);
                    }
                  }}
                >
                  {kicking === player.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <UserX className="size-3.5" />
                  )}
                </button>
              )}
              {!player.isMe && !isHost && (
                <button
                  type="button"
                  title="الإبلاغ عن اللاعب"
                  aria-label={`الإبلاغ عن ${player.name}`}
                  className="rounded-lg p-1.5 text-muted-foreground/50 transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                  onClick={() => setReportTarget({ id: player.id, name: player.name })}
                >
                  <Flag className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>

        <p className="mt-4 flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-2.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0 text-primary" />
          اللعب النزيه إلزامي: مغادرة نافذة اللعب أثناء الأسئلة تُعتبر غشاً وتُعاقَب
          تلقائياً. اطّلع على{" "}
          <a href="/rules" className="font-bold text-primary underline underline-offset-2">
            قوانين اللعب
          </a>
          .
        </p>

        {/* Live emoji reactions */}
        <ReactionsPanel code={code} />

        {host && !isHost && (
          <p className="mt-5 rounded-xl bg-muted/60 px-4 py-3 text-center text-sm text-muted-foreground">
            بانتظار <span className="font-bold text-foreground">{host.name}</span>{" "}
            لبدء التحدي…
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {isHost ? (
          <Button
            size="lg"
            className="flex-1 gap-2 rounded-xl text-base"
            onClick={handleStart}
            disabled={starting}
          >
            {starting ? (
              <Loader2 className="size-4.5 animate-spin" />
            ) : (
              <Play className="size-4.5" />
            )}
            {game.players.length < 2 ? "ابدأ التحدي وحدك" : "ابدأ التحدي"}
          </Button>
        ) : (
          <div className="flex-1 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-center text-sm font-medium text-primary">
            مستعد؟ انتظر المضيف لبدء الجولة
          </div>
        )}
        <Button variant="outline" size="lg" className="gap-2 rounded-xl" onClick={onLeave}>
          مغادرة الغرفة
        </Button>
      </div>

      {isHost && game.players.length < 2 && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          يمكنك البدء وحدك للتدريب، لكن التحدي يكون أجمل مع صديق واحد على الأقل.
        </p>
      )}

      <ReportPlayerDialog target={reportTarget} onClose={() => setReportTarget(null)} />
    </div>
  );
}
