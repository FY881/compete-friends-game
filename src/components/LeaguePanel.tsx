/**
 * لوحة الدوريات الخاصة — مجموعة أصدقاء بصدارة أسبوعية
 * إنشاء دوري برمز دعوة، الانضمام برمز، صدارة حية، ومشاركة الرمز عبر واتساب/تيليجرام.
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trophy, Plus, LogIn, Users, Share2, Copy, Loader2, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

const TIER_LABEL: Record<string, string> = {
  bronze: "🥉 برونز",
  silver: "🥈 فضي",
  gold: "🥇 ذهبي",
  diamond: "💎 ماسي",
};

type Standing = { userId: string; name: string; weeklyPoints: number; isMe: boolean };

type MyLeague = {
  leagueId: string;
  name: string;
  code: string;
  tier: string;
  isOwner: boolean;
  memberCount: number;
  myWeeklyPoints: number;
  myRank: number;
  standings: Standing[];
};

export function LeaguePanel() {
  const leagues = useQuery(api.leagues.getMyLeagues);
  const createLeague = useMutation(api.leagues.createLeague);
  const joinLeague = useMutation(api.leagues.joinLeague);
  const leaveLeague = useMutation(api.leagues.leaveLeague);
  const deleteLeague = useMutation(api.leagues.deleteLeague);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  if (leagues === undefined) return null;

  async function handleCreate() {
    setBusy(true);
    try {
      const res = await createLeague({ name });
      toast.success(`تم إنشاء الدوري! رمز الدعوة: ${res.code}`);
      setName("");
      setShowForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر إنشاء الدوري");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    setBusy(true);
    try {
      const res = await joinLeague({ code: joinCode });
      toast.success(`انضممت لدوري «${res.leagueName}»`);
      setJoinCode("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر الانضمام");
    } finally {
      setBusy(false);
    }
  }

  function shareLeague(l: MyLeague) {
    const url = `${window.location.origin}/`;
    const text = `تحدَّني في دوري «${l.name}» 🏆\nرمز الدعوة: ${l.code}\nانضم هنا: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  function shareTelegram(l: MyLeague) {
    const url = `${window.location.origin}/`;
    const text = `تحدَّني في دوري «${l.name}» 🏆 رمز الدعوة: ${l.code}`;
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      "_blank",
    );
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("تم نسخ رمز الدعوة");
    } catch {
      toast.error("تعذّر النسخ");
    }
  }

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
            <Trophy className="size-4" />
          </span>
          الدوريات الخاصة
          {leagues.length > 0 && (
            <Badge variant="outline" className="rounded-full text-[10px]">
              {leagues.length} دوري
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* إنشاء / انضمام */}
        {leagues.length === 0 && !showForm && (
          <p className="text-sm text-muted-foreground">
            أنشئ دورياً لأصدقائك بصدارة أسبوعية خاصة — أو انضم برمز دعوة.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 rounded-xl text-xs"
            onClick={() => setShowForm((s) => !s)}
          >
            <Plus className="size-3.5" /> إنشاء دوري
          </Button>
          <div className="flex items-center gap-1.5">
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="رمز الدعوة"
              className="h-8 w-36 rounded-xl text-center text-xs font-mono tracking-widest"
              maxLength={6}
              dir="ltr"
            />
            <Button
              size="sm"
              className="gap-1.5 rounded-xl text-xs"
              disabled={joinCode.length !== 6 || busy}
              onClick={handleJoin}
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <LogIn className="size-3.5" />}
              انضم
            </Button>
          </div>
        </div>

        {showForm && (
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم الدوري"
              className="h-8 flex-1 rounded-xl text-xs"
              maxLength={40}
            />
            <Button
              size="sm"
              disabled={name.trim().length < 2 || busy}
              onClick={handleCreate}
              className="rounded-xl text-xs"
            >
              إنشاء
            </Button>
          </div>
        )}

        {/* قائمة الدوريات */}
        {leagues.map((l) => (
          <div
            key={l.leagueId}
            className="space-y-2 rounded-xl border border-border/70 bg-card p-3.5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold">{l.name}</p>
              <Badge variant="secondary" className="rounded-full text-[10px]">
                {TIER_LABEL[l.tier] ?? l.tier}
              </Badge>
              {l.isOwner && (
                <Badge className="rounded-full text-[10px]" variant="outline">
                  <Crown className="size-2.5 me-1" /> مالك
                </Badge>
              )}
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="size-3" /> {l.memberCount}
              </span>
              <span className="ms-auto font-mono text-xs font-bold text-primary" dir="ltr">
                {l.code}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={() => copyCode(l.code)}
                title="نسخ الرمز"
              >
                <Copy className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7 text-emerald-600"
                onClick={() => shareLeague(l)}
                title="مشاركة عبر واتساب"
              >
                <Share2 className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7 text-sky-600"
                onClick={() => shareTelegram(l)}
                title="مشاركة عبر تيليجرام"
              >
                <Share2 className="size-3.5" />
              </Button>
            </div>

            {/* الصدارة الأسبوعية */}
            <div className="space-y-1">
              {l.standings.map((s, i) => (
                <div
                  key={s.userId}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs",
                    s.isMe ? "bg-primary/10 font-bold" : "bg-muted/40",
                  )}
                >
                  <span
                    className={cn(
                      "w-5 text-center font-mono",
                      i === 0 && "text-amber-500",
                      i === 1 && "text-zinc-400",
                      i === 2 && "text-orange-400",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="font-mono tabular-nums">{s.weeklyPoints}</span>
                </div>
              ))}
              {l.memberCount > 10 && l.myRank > 10 && (
                <p className="px-2.5 py-1 text-xs text-muted-foreground">
                  ترتيبك: #{l.myRank} — {l.myWeeklyPoints} نقطة
                </p>
              )}
            </div>

            <div className="flex gap-2">
              {!l.isOwner && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted-foreground"
                  onClick={async () => {
                    try {
                      await leaveLeague({ leagueId: l.leagueId as never });
                      toast.success("تمت مغادرة الدوري");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "تعذّرت المغادرة");
                    }
                  }}
                >
                  مغادرة
                </Button>
              )}
              {l.isOwner && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-rose-500"
                  onClick={async () => {
                    try {
                      await deleteLeague({ leagueId: l.leagueId as never });
                      toast.success("تم حذف الدوري");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "تعذّر الحذف");
                    }
                  }}
                >
                  حذف الدوري
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
