import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Trophy, Star, Heart, Bookmark, Copy, Gift, Swords, Calendar,
  Target, Brain, Clock, Users, Eye, EyeOff, TrendingUp, Award,
  SwordsIcon, Timer, Zap, BarChart3, Archive, Share2, UserPlus,
  Sparkles, Shield, Flame, Crown, Medal, CheckCircle2, XCircle,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// 1. نظام الإنجازات المتقدم
// ═══════════════════════════════════════════════════════════════
export function AchievementsPanel() {
  const achievements = useQuery(api.playerControl.getMyAchievements);

  const rarityConfig: Record<string, { color: string; label: string }> = {
    common: { color: "bg-gray-400", label: "عادي" },
    uncommon: { color: "bg-green-500", label: "غير شائع" },
    rare: { color: "bg-blue-500", label: "نادر" },
    epic: { color: "bg-purple-500", label: "ملحمي" },
    legendary: { color: "bg-yellow-500", label: "أسطوري" },
  };

  const allAchievements = [
    { type: "first_win", name: "أول انتصار", icon: "🏆", rarity: "common" },
    { type: "streak_5", name: "سلسلة 5", icon: "🔥", rarity: "uncommon" },
    { type: "streak_10", name: "سلسلة 10", icon: "⚡", rarity: "rare" },
    { type: "games_10", name: "لاعب مخضرم", icon: "🎮", rarity: "common" },
    { type: "games_50", name: "محترف", icon: "🏅", rarity: "uncommon" },
    { type: "perfect_10", name: "مثالي", icon: "💎", rarity: "epic" },
    { type: "xp_1000", name: "طالب المعرفة", icon: "📚", rarity: "uncommon" },
    { type: "xp_5000", name: "حكيم", icon: "👑", rarity: "rare" },
    { type: "games_100", name: "أسطورة", icon: "🌟", rarity: "legendary" },
    { type: "wins_25", name: "محارب", icon: "⚔️", rarity: "rare" },
  ];

  const earnedTypes = new Set(achievements?.map((a) => a.type) ?? []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Trophy className="size-4 text-yellow-500" />
          الإنجازات ({earnedTypes.size}/{allAchievements.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {allAchievements.map((a) => {
            const earned = earnedTypes.has(a.type);
            const rc = rarityConfig[a.rarity];
            return (
              <div
                key={a.type}
                className={`relative flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all ${
                  earned
                    ? "border-primary/30 bg-primary/5 shadow-sm"
                    : "border-dashed opacity-40 grayscale"
                }`}
              >
                <span className="text-2xl">{a.icon}</span>
                <span className="text-[10px] font-medium leading-tight">{a.name}</span>
                <Badge variant="secondary" className={`text-[8px] ${rc.color} text-white`}>{rc.label}</Badge>
                {earned && <CheckCircle2 className="absolute top-1 left-1 size-3 text-green-500" />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// 2. نظام الهدايا
// ═══════════════════════════════════════════════════════════════
export function GiftsPanel() {
  const gifts = useQuery(api.playerControl.getMyGifts);
  const claimGift = useMutation(api.playerControl.claimGift);
  const [tab, setTab] = useState<"received" | "sent">("received");

  const giftIcons: Record<string, string> = {
    xp: "⚡", badge: "🏅", emoji: "🎉", hearts: "❤️", stars: "⭐",
  };

  if (!gifts) return <div className="p-4 text-muted-foreground text-sm">جارٍ التحميل...</div>;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Gift className="size-4 text-pink-500" />
          الهدايا ({gifts.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="h-8">
            <TabsTrigger value="received" className="text-xs">الواردة</TabsTrigger>
            <TabsTrigger value="sent" className="text-xs">المرسلة</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {gifts.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">لا توجد هدايا بعد</p>
          )}
          {gifts.map((g) => (
            <div key={g._id} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${g.claimed ? "bg-muted/30" : "bg-primary/5 border border-primary/20"}`}>
              <span className="text-lg">{giftIcons[g.giftType] ?? "🎁"}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{tab === "received" ? `من ${g.senderName}` : `إلى ${g.receiverName}`}</p>
                {g.message && <p className="text-muted-foreground truncate">{g.message}</p>}
                {g.xpAmount && <Badge variant="secondary" className="text-[10px]">+{g.xpAmount} XP</Badge>}
              </div>
              {!g.claimed && tab === "received" && (
                <Button size="sm" onClick={() => { claimGift({ giftId: g._id }); toast("تم استلام الهدية!"); }}>استلام</Button>
              )}
              {g.claimed && <CheckCircle2 className="size-3 text-green-500" />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// 3. الأرشيف الشخصي للأسئلة
// ═══════════════════════════════════════════════════════════════
export function ArchivePanel() {
  const archive = useQuery(api.playerControl.getMyArchive, { favoritesOnly: false });
  const favorites = useQuery(api.playerControl.getMyArchive, { favoritesOnly: true });
  const toggleFav = useMutation(api.playerControl.toggleFavorite);
  const [showFavOnly, setShowFavOnly] = useState(false);

  const items = showFavOnly ? favorites : archive;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Archive className="size-4 text-blue-500" />
          أرشيفي ({items?.length ?? 0})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex gap-2">
          <Button size="sm" variant={showFavOnly ? "default" : "outline"} onClick={() => setShowFavOnly(false)}>
            الكل ({archive?.length ?? 0})
          </Button>
          <Button size="sm" variant={showFavOnly ? "default" : "outline"} onClick={() => setShowFavOnly(true)}>
            <Bookmark className="size-3" /> المفضلة ({favorites?.length ?? 0})
          </Button>
        </div>
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {items && items.length > 0 ? items.map((item) => (
            <div key={item._id} className="rounded-lg border p-2.5 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium flex-1">{item.question}</p>
                <button onClick={() => toggleFav({ archiveId: item._id })} className="shrink-0">
                  <Bookmark className={`size-4 ${item.favorited ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"}`} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {item.options.map((opt, i) => (
                  <Badge key={i} variant={i === item.correctIndex ? "default" : i === 0 && !item.wasCorrect ? "destructive" : "secondary"} className="text-[10px]">
                    {opt}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{item.category}</span>
                {item.wasCorrect ? (
                  <span className="text-green-600"><CheckCircle2 className="size-3 inline" /> صحيحة</span>
                ) : (
                  <span className="text-red-600"><XCircle className="size-3 inline" /> خاطئة</span>
                )}
              </div>
            </div>
          )) : (
            <p className="text-xs text-muted-foreground text-center py-4">لا توجد أسئلة في الأرشيف</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// 4. نظام السمعة
// ═══════════════════════════════════════════════════════════════
export function ReputationBadge({ userId }: { userId: string }) {
  const rep = useQuery(api.playerControl.getReputation, { userId: userId as any });
  if (!rep) return null;

  const getLevel = (score: number) => {
    if (score >= 50) return { label: "موقّر جداً", color: "text-yellow-500", icon: "👑" };
    if (score >= 20) return { label: "موثوق", color: "text-green-500", icon: "⭐" };
    if (score >= 0) return { label: "عادي", color: "text-gray-400", icon: "👤" };
    if (score >= -20) return { label: "محل شك", color: "text-orange-500", icon: "⚠️" };
    return { label: "محظور", color: "text-red-500", icon: "🚫" };
  };

  const level = getLevel(rep.score);
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${level.color}`}>
      {level.icon} {level.label} ({rep.score > 0 ? "+" : ""}{rep.score})
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// 5. نظام الدعوات
// ═══════════════════════════════════════════════════════════════
export function InvitePanel() {
  const createInvite = useMutation(api.playerControl.createInviteCode);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    const result = await createInvite();
    setInviteCode(result.code);
  };

  const copyCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      toast("تم النسخ!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <UserPlus className="size-4 text-green-500" />
          دعوة صديق
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">ادعُ صديقاً واحصلا على 50 XP كمكافأة عند تسجيله!</p>
        {inviteCode ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono text-center">{inviteCode}</code>
            <Button size="sm" variant="outline" onClick={copyCode}>
              {copied ? <CheckCircle2 className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        ) : (
          <Button onClick={handleCreate} className="w-full">
            <Share2 className="size-4" /> إنشاء كود دعوة
          </Button>
        )}
        <p className="text-[10px] text-muted-foreground text-center">+50 XP لك و+50 XP للصديق عند وصوله للمستوى 5</p>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// 6. تحديات1v1
// ═══════════════════════════════════════════════════════════════
export function DuelPanel() {
  const duels = useQuery(api.playerControl.getAvailableDuels);
  const createDuel = useMutation(api.playerControl.createDuel);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Swords className="size-4 text-red-500" />
          تحديات1v1
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">تحدَ صديقاً في معركة ذكاء مباشرة!</p>
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {duels && duels.length > 0 ? duels.map((d) => (
            <div key={d._id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs">
              <Swords className="size-3 text-red-500" />
              <span className="font-medium">{d.challengerName}</span>
              <span className="text-muted-foreground">vs</span>
              <span className="font-medium">{d.opponentName ?? "بانتظار..."}</span>
              <Badge variant="secondary" className="text-[10px]">{d.questionCount} أسئلة</Badge>
            </div>
          )) : (
            <p className="text-xs text-muted-foreground text-center py-2">لا توجد تحديات مفتوحة</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// 7. نظام الموسم
// ═══════════════════════════════════════════════════════════════
export function SeasonBadge() {
  const season = useQuery(api.playerControl.getActiveSeason);
  if (!season) return null;

  const daysLeft = Math.max(0, Math.ceil((season.endAt - Date.now()) / (24 * 60 * 60 * 1000)));
  return (
    <Badge variant="outline" className="gap-1 text-[10px]">
      <Crown className="size-3 text-yellow-500" />
      {season.name} — {daysLeft} يوم متبقي
    </Badge>
  );
}

// ═══════════════════════════════════════════════════════════════
// 8. تحدي اليوم — لوحة المتصدرين
// ═══════════════════════════════════════════════════════════════
export function DailyChallengeLeaderboard() {
  const board = useQuery(api.playerControl.getDailyChallengeLeaderboard);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Flame className="size-4 text-orange-500" />
          متصدرو تحدي اليوم
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!board || board.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">لم يلعب أحد اليوم بعد</p>
        ) : (
          <div className="space-y-1">
            {board.slice(0, 10).map((e, i) => (
              <div key={e._id} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${i === 0 ? "bg-yellow-50 border border-yellow-200" : i === 1 ? "bg-gray-50 border border-gray-200" : i === 2 ? "bg-orange-50 border border-orange-200" : "bg-muted/30"}`}>
                <span className="font-bold w-6 text-center">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
                <span className="flex-1 font-medium">{e.userName}</span>
                <span className="text-primary font-bold">{e.score}</span>
                <span className="text-muted-foreground">{e.correctCount}/{10}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// 9. الأهداف الجماعية (العقل الجمعي)
// ═══════════════════════════════════════════════════════════════
export function CollectiveGoalsPanel() {
  const goals = useQuery(api.playerControl.getActiveGoals);
  const contribute = useMutation(api.playerControl.contributeToGoal);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Users className="size-4 text-blue-500" />
          تحديات جماعية
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!goals || goals.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">لا توجد أهداف جماعية حالياً</p>
        ) : goals.map((g) => {
          const progress = Math.min((g.currentScore / g.targetScore) * 100, 100);
          const daysLeft = Math.max(0, Math.ceil((g.deadline - Date.now()) / (24 * 60 * 60 * 1000)));
          return (
            <div key={g._id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{g.title}</p>
                  <p className="text-[10px] text-muted-foreground">{g.participants.length} مشارك • {daysLeft} يوم متبقي</p>
                </div>
                <Badge variant="secondary">{Math.round(progress)}%</Badge>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground">المكافأة: {g.reward}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// 10. وضع الظلام / التركيز الكامل
// ═══════════════════════════════════════════════════════════════
export function FocusModeToggle() {
  const [focusMode, setFocusMode] = useState(false);

  const toggleFocus = () => {
    setFocusMode(!focusMode);
    document.documentElement.classList.toggle("focus-mode", !focusMode);
    toast(focusMode ? "تم إيقاف وضع التركيز" : "تم تفعيل وضع التركيز — تقليل التشتت");
  };

  return (
    <Button size="sm" variant={focusMode ? "default" : "outline"} onClick={toggleFocus} className="gap-1.5">
      {focusMode ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
      {focusMode ? "إيقاف التركيز" : "وضع التركيز"}
    </Button>
  );
}

// ═══════════════════════════════════════════════════════════════
// 11. تحليل الأداء الشخصي
// ═══════════════════════════════════════════════════════════════
export function PerformanceAnalysis({ profile }: { profile: any }) {
  if (!profile) return null;

  const accuracy = profile.totalAnswers > 0 ? Math.round((profile.correctAnswers / profile.totalAnswers) * 100) : 0;
  const winRate = profile.gamesPlayed > 0 ? Math.round((profile.gamesWon / profile.gamesPlayed) * 100) : 0;
  const avgScore = profile.gamesPlayed > 0 ? Math.round(profile.bestScore / Math.max(profile.gamesPlayed, 1)) : 0;

  const getGrade = (acc: number) => {
    if (acc >= 90) return { grade: "ممتاز", color: "text-green-500", icon: "🌟" };
    if (acc >= 75) return { grade: "جيد جداً", color: "text-blue-500", icon: "⭐" };
    if (acc >= 60) return { grade: "جيد", color: "text-yellow-500", icon: "👍" };
    if (acc >= 40) return { grade: "متوسط", color: "text-orange-500", icon: "📊" };
    return { grade: "يحتاج تحسين", color: "text-red-500", icon: "📈" };
  };

  const grade = getGrade(accuracy);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BarChart3 className="size-4 text-purple-500" />
          تحليل الأداء
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">{grade.icon}</span>
          <div>
            <p className={`text-sm font-bold ${grade.color}`}>{grade.grade}</p>
            <p className="text-[10px] text-muted-foreground">التصنيف العام</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "نسبة الدقة", value: `${accuracy}%`, icon: <Target className="size-3" /> },
            { label: "نسبة الفوز", value: `${winRate}%`, icon: <TrendingUp className="size-3" /> },
            { label: "أفضل سلسلة", value: `${profile.bestStreak}`, icon: <Flame className="size-3" /> },
            { label: "أفضل نتيجة", value: `${profile.bestScore}`, icon: <Trophy className="size-3" /> },
            { label: "الجولات", value: `${profile.gamesPlayed}`, icon: <Swords className="size-3" /> },
            { label: "الانتصارات", value: `${profile.gamesWon}`, icon: <Medal className="size-3" /> },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
              <span className="text-muted-foreground">{stat.icon}</span>
              <div>
                <p className="text-xs font-bold">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// 12. التدريب الذكي (يركز على نقاط الضعف)
// ═══════════════════════════════════════════════════════════════
export function SmartTrainingInfo() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Brain className="size-4 text-indigo-500" />
          التدريب الذكي
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          يحلل التدريب الذكي نتائجك ويحدد نقاط ضعفك تلقائياً، ثم يقدم لك أسئلة مركّزة في تلك المجالات لتحسين مستواك بسرعة.
        </p>
        <div className="mt-2 flex gap-1.5 flex-wrap">
          <Badge variant="secondary" className="text-[10px]">تحليل تلقائي</Badge>
          <Badge variant="secondary" className="text-[10px]">أسئلة مركّزة</Badge>
          <Badge variant="secondary" className="text-[10px]">تتبع التقدم</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// 13. إعادة محاولة ذكية مع شرح
// ═══════════════════════════════════════════════════════════════
export function SmartRetryInfo() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <RefreshCw className="size-4 text-teal-500" />
          إعادة المحاولة الذكية
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          عند الإجابة خاطئة، يمكنك إعادة محاولة السؤال مع شرح مختصر يوضح السبب ويعلّمك المعلومة الصحيحة. متاح مرة واحدة لكل سؤال.
        </p>
      </CardContent>
    </Card>
  );
}

// Import RefreshCw
import { RefreshCw } from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// 14. تحديات زمنية محدودة
// ═══════════════════════════════════════════════════════════════
export function TimeChallengeInfo() {
  return (
    <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-orange-600">
          <Timer className="size-4" />
          تحدي زمني محدود!
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-orange-700 dark:text-orange-300">
          تحدٍ ظهر فجأة! أجب على 5 أسئلة في أقل من 60 ثانية واحصل على ضعف النقاط!
        </p>
        <Button size="sm" className="mt-2 bg-orange-500 hover:bg-orange-600">
          <Zap className="size-3" /> ابدأ التحدي!
        </Button>
      </CardContent>
    </Card>
  );
}
