/**
 * 🧠 ملتقى العقول — الواجهة المجتمعية للاعبين (v10.0)
 *
 * منتدى حقيقي: أقسام · منشورات بأنواعها · تعليقات متفرعة واقتباس · تصويت
 * بلا تكرار · استطلاعات · تحديات جماعية · عرض غرف مميزة · إبراز المحتوى
 * الجيد تلقائياً · مشرفون معيّنون · متابعة وإشعارات ذكية.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowRight,
  Award,
  Bell,
  BellOff,
  BrainCircuit,
  CheckCircle2,
  Clock,
  Flame,
  Flag,
  Hash,
  Layers,
  Lightbulb,
  Lock,
  MessageCircle,
  PenLine,
  Pin,
  Plus,
  Repeat2,
  Search,
  Shield,
  Sparkles,
  Swords,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────
   خرائط مساعدة (نفس عقد الخادم — لا نسخة ثانية من المنطق)
   ───────────────────────────────────────────────────────────────────── */
const KIND_META: Record<string, { label: string; emoji: string; tone: string }> = {
  discussion: { label: "نقاش", emoji: "💬", tone: "text-sky-600 bg-sky-500/10" },
  question: { label: "استفسار", emoji: "❓", tone: "text-violet-600 bg-violet-500/10" },
  idea: { label: "اقتراح", emoji: "🧩", tone: "text-amber-600 bg-amber-500/10" },
  challenge: { label: "تحدٍّ جماعي", emoji: "⚔️", tone: "text-rose-600 bg-rose-500/10" },
  poll: { label: "استطلاع", emoji: "📊", tone: "text-emerald-600 bg-emerald-500/10" },
  announcement: { label: "إعلان", emoji: "📣", tone: "text-primary bg-primary/10" },
  room: { label: "عرض غرفة", emoji: "🏛️", tone: "text-teal-600 bg-teal-500/10" },
};

const SORTS = [
  { id: "new", label: "الأحدث", icon: Clock },
  { id: "hot", label: "الأكثر تفاعلاً", icon: Flame },
  { id: "value", label: "الأكثر قيمة", icon: Sparkles },
  { id: "top", label: "الأعلى تقييماً", icon: TrendingUp },
  { id: "unanswered", label: "بلا إجابة", icon: MessageCircle },
] as const;

const KINDS_FOR_COMPOSER = [
  { id: "discussion", label: "نقاش", emoji: "💬" },
  { id: "question", label: "استفسار", emoji: "❓" },
  { id: "idea", label: "اقتراح", emoji: "🧩" },
  { id: "challenge", label: "تحدٍّ جماعي", emoji: "⚔️" },
  { id: "poll", label: "استطلاع", emoji: "📊" },
  { id: "room", label: "عرض غرفة", emoji: "🏛️" },
] as const;

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  const d = Math.floor(h / 24);
  if (d < 30) return `قبل ${d} يوم`;
  return new Date(ts).toLocaleDateString("ar");
}

/* ═════════════════════════════════════════════════════════════════════
   الصفحة
   ═════════════════════════════════════════════════════════════════════ */
export default function Forum() {
  const ensureReady = useMutation(api.forum.ensureForumReady);
  const { user } = useAuth();
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    ensureReady({}).catch(() => {
      /* التهيئة تعمل عند أول دخول فقط — الفشل هنا لا يمنع القراءة */
    });
  }, [ensureReady]);

  const sections = useQuery(api.forum.listSections);
  const stats = useQuery(api.forum.getForumStats);
  const me = useQuery(api.forum.getMyForumProfile);
  const subs = useQuery(api.forum.getMySubscriptions);
  const rooms = useQuery(api.forum.listRoomsShowcase, { limit: 6 });
  // ⚔️ تحدّيات الملتقى الحقيقية (لكل منشور تحدٍّ كود يُلعَب في الساحة)
  const forumChallenges = useQuery(api.challenges.getForumChallenges, {}) ?? [];

  const [sectionSlug, setSectionSlug] = useState<string | null>(null);
  const [sort, setSort] = useState<string>("new");
  const [kindFilter, setKindFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [showMine, setShowMine] = useState(false);

  const posts = useQuery(api.forum.listPosts, {
    sectionSlug: sectionSlug ?? undefined,
    sort,
    kind: kindFilter ?? undefined,
    q: search.trim().length > 1 ? search.trim() : undefined,
    authorId: showMine && user ? (user._id as never) : undefined,
    limit: 40,
  });

  const activeSection = useMemo(
    () => sections?.sections.find((s) => s.slug === sectionSlug) ?? null,
    [sections, sectionSlug],
  );

  if (openPostId) {
    return <PostView postId={openPostId} onBack={() => setOpenPostId(null)} sections={sections?.sections ?? []} />;
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* ── ترويسة ── */}
      <div className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BrainCircuit className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">ملتقى العقول</h1>
            <p className="text-xs text-muted-foreground">
              ساحة المجتمع: نقاشات · تحديات جماعية · اقتراحات · استفسارات · غرف مميزة
            </p>
          </div>
          {me && (
            <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background px-3 py-2">
              <span className="text-lg">{me.rank.emoji}</span>
              <div className="leading-tight">
                <p className="text-xs font-bold">{me.rank.label}</p>
                <p className="text-[10px] text-muted-foreground">{me.karma} نقطة سمعة</p>
              </div>
            </div>
          )}
          <ComposerButton sections={sections?.sections ?? []} />
        </div>
        {stats && (
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 pb-3">
            <Badge variant="outline" className="rounded-full text-[10px]">{stats.posts} منشور</Badge>
            <Badge variant="outline" className="rounded-full text-[10px]">{stats.comments} تعليق</Badge>
            <Badge variant="outline" className="rounded-full text-[10px]">{stats.authors24} كاتب اليوم</Badge>
            {stats.highlighted > 0 && (
              <Badge variant="outline" className="rounded-full text-[10px] text-amber-600">
                {stats.highlighted} محتوى مميز
              </Badge>
            )}
            {stats.unanswered > 0 && (
              <Badge variant="outline" className="rounded-full text-[10px] text-violet-600">
                {stats.unanswered} استفسار بلا إجابة
              </Badge>
            )}
            {stats.moderators.length > 0 && (
              <Badge variant="outline" className="rounded-full text-[10px]">
                <Shield className="me-1 size-3" /> {stats.moderators.length} مشرف
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 lg:grid-cols-[1fr_300px]">
        {/* ── التغذية ── */}
        <div className="space-y-4">
          {/* الأقسام */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSectionSlug(null)}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors",
                sectionSlug === null ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 hover:bg-muted/50",
              )}
            >
              <Layers className="me-1 inline size-3" /> كل الأقسام
            </button>
            {sections?.sections.map((s) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => {
                  setSectionSlug(s.slug);
                  setKindFilter(null);
                }}
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors",
                  sectionSlug === s.slug ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 hover:bg-muted/50",
                  s.lockedForMe && "opacity-60",
                )}
                title={s.description}
              >
                <span className="me-1">{s.emoji}</span>
                {s.name}
                <span className="ms-1 text-[10px] text-muted-foreground">{s.postCount}</span>
                {s.canModerate && <Shield className="ms-1 inline size-3 text-primary" />}
              </button>
            ))}
          </div>

          {activeSection && (
            <Card className="border-primary/20 bg-primary/[0.03]">
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <span className="text-2xl">{activeSection.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{activeSection.name}</p>
                  <p className="text-xs text-muted-foreground">{activeSection.description}</p>
                </div>
                {activeSection.locked && (
                  <Badge variant="outline" className="rounded-full text-[10px] text-rose-600">
                    <Lock className="me-1 size-3" /> مقفل
                  </Badge>
                )}
              </CardContent>
            </Card>
          )}

          {/* أدوات الترتيب والبحث */}
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap gap-1.5">
                {SORTS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSort(s.id);
                        setKindFilter(null);
                      }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-all",
                        sort === s.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted",
                      )}
                      title={s.label}
                    >
                      <Icon className="size-3" />
                      {s.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[180px] flex-1">
                  <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ابحث في العناوين والنصوص والوسوم…"
                    className="h-9 rounded-xl ps-9 text-sm"
                  />
                </div>
                {KINDS_FOR_COMPOSER.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setKindFilter(kindFilter === k.id ? null : k.id)}
                    className={cn(
                      "rounded-xl border px-2.5 py-1 text-[11px] font-medium transition-colors",
                      kindFilter === k.id ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 hover:bg-muted/50",
                    )}
                  >
                    {k.emoji} {k.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowMine(!showMine)}
                  className={cn(
                    "rounded-xl border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    showMine ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 hover:bg-muted/50",
                  )}
                >
                  <PenLine className="me-1 inline size-3" /> منشوراتي
                </button>
              </div>
            </CardContent>
          </Card>

          {/* المنشورات */}
          {!posts ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="h-28 p-4" />
                </Card>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <Card>
              <CardContent className="py-14 text-center">
                <PenLine className="mx-auto mb-3 size-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">لا منشورات مطابقة — كن أول من يكتب هنا</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {posts.map((p) => (
                  <motion.div
                    key={p._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <PostCard post={p} onOpen={() => setOpenPostId(p._id)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── الشريط الجانبي ── */}
        <div className="space-y-4">
          {/* غرف مميزة */}
          {rooms && rooms.length > 0 && (
            <Card className="border-teal-500/25 bg-teal-500/[0.03]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Users className="size-4 text-teal-600" /> غرف خاصة مميزة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {rooms.map((r) => (
                  <Link
                    key={r.roomId}
                    to="/rooms"
                    className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-2.5 transition-colors hover:border-teal-500/40"
                  >
                    <span className="text-lg">{r.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">{r.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {r.memberCount} عضو · {r.messageCount} رسالة
                      </p>
                    </div>
                    {r.challengeReward > 0 && (
                      <Badge variant="outline" className="rounded-full text-[9px] text-amber-600">
                        <Trophy className="me-0.5 size-2.5" /> {r.challengeReward}
                      </Badge>
                    )}
                  </Link>
                ))}
                <Button asChild variant="outline" size="sm" className="w-full rounded-xl">
                  <Link to="/rooms">تصفح كل الغرف</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ⚔️ تحدّيات الملتقى الحيّة — كل زر يفتح التحدّي الحقيقي في الساحة */}
          {forumChallenges.length > 0 && (
            <Card className="border-rose-500/25">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Swords className="size-4 text-rose-600" /> تحدّيات مفتوحة الآن
                  <Badge variant="outline" className="ms-auto rounded-full text-[9px] tabular-nums">
                    {forumChallenges.filter((c) => c.status === "open").length} فعّال
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {forumChallenges.slice(0, 4).map((c) => (
                  <Link
                    key={c.id}
                    to={`/arena?challenge=${c.code}`}
                    className="block rounded-xl border border-border/60 bg-card p-2.5 transition-colors hover:border-rose-500/40"
                  >
                    <p className="truncate text-xs font-bold">{c.title}</p>
                    <p className="flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
                      <span className="font-mono">{c.code}</span>
                      <span>· {c.questionCount} أسئلة</span>
                      <span>· مكافأة {c.rewardXp} خبرة</span>
                      <span>· {c.participants} مشاركة</span>
                      <span>· {c.remaining}</span>
                    </p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* الوسوم الرائجة */}
          {stats && stats.trending.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Hash className="size-4 text-primary" /> وسوم رائجة
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {stats.trending.map((t) => (
                  <button
                    key={t.tag}
                    type="button"
                    onClick={() => setSearch(t.tag)}
                    className="rounded-full border border-border/60 px-2.5 py-1 text-[10px] font-medium hover:border-primary/40 hover:bg-primary/5"
                  >
                    #{t.tag} · {t.weight}
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ملفي */}
          {me && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Award className="size-4 text-amber-600" /> سمعتي في الملتقى
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{me.rank.emoji}</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{me.rank.label}</p>
                    <p className="text-[11px] text-muted-foreground">{me.rank.note}</p>
                  </div>
                </div>
                {me.nextRank && (
                  <>
                    <Progress value={Math.min(100, Math.round((me.karma / me.nextRank.min) * 100))} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground">
                      {me.remaining} نقطة حتى «{me.nextRank.label}»
                    </p>
                  </>
                )}
                <div className="grid grid-cols-2 gap-2 text-center">
                  <Stat label="منشورات" value={me.posts} />
                  <Stat label="تعليقات" value={me.comments} />
                  <Stat label="تصويتات مستلمة" value={me.upvotesReceived} />
                  <Stat label="أفضل إجابات" value={me.acceptedAnswers} />
                </div>
                {me.isModerator && (
                  <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-2.5 text-[11px]">
                    <p className="flex items-center gap-1.5 font-bold text-primary">
                      <Shield className="size-3.5" /> مشرف الملتقى
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      أقسامك: {me.moderatedSections.includes("*") ? "كل الأقسام" : me.moderatedSections.join(" · ")}
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      صلاحيات: {me.caps?.canPin ? "تثبيت " : ""}{me.caps?.canLock ? "إغلاق " : ""}{me.caps?.canHide ? "إخفاء" : ""}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* متابعاتي */}
          {subs && subs.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Bell className="size-4 text-primary" /> أتابعها ({subs.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {subs.slice(0, 6).map((s) => (
                  <button
                    key={s.postId}
                    type="button"
                    onClick={() => setOpenPostId(s.postId)}
                    className="flex w-full items-center gap-2 rounded-lg border border-border/60 p-2 text-start hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold">{s.title}</p>
                      <p className="text-[9px] text-muted-foreground">
                        {s.commentCount} تعليق · {timeAgo(s.lastActivityAt)}
                      </p>
                    </div>
                    {s.newSinceSubscribe && <span className="size-2 rounded-full bg-primary" />}
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-2">
      <p className="text-sm font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   بطاقة منشور
   ═════════════════════════════════════════════════════════════════════ */
function PostCard({ post, onOpen }: { post: any; onOpen: () => void }) {
  const votePost = useMutation(api.forum.votePost);
  const subscribe = useMutation(api.forum.subscribePost);
  const meta = KIND_META[post.kind] ?? KIND_META.discussion;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:border-primary/30 hover:shadow-sm",
        post.highlighted && "border-amber-500/40 bg-amber-500/[0.02]",
        post.pinned && "border-primary/40",
      )}
      onClick={onOpen}
    >
      <CardContent className="flex gap-3 p-4">
        <div className="flex w-11 shrink-0 flex-col items-center gap-1">
          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await votePost({ postId: post._id as never, value: post.myVote === 1 ? 0 : 1 });
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "تعذّر التصويت");
              }
            }}
            className={cn(
              "flex size-8 items-center justify-center rounded-xl border transition-colors",
              post.myVote === 1 ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 hover:bg-muted",
            )}
            title="أعجبني"
          >
            <ThumbsUp className="size-3.5" />
          </button>
          <span className="text-xs font-bold">{post.upvotes - post.downvotes}</span>
          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation();
              try {
                await votePost({ postId: post._id as never, value: post.myVote === -1 ? 0 : -1 });
              } catch {
                /* التصويت السلبي لا يستحق إزعاجاً */
              }
            }}
            className={cn(
              "flex size-7 items-center justify-center rounded-lg border transition-colors",
              post.myVote === -1 ? "border-rose-500/40 bg-rose-500/10 text-rose-600" : "border-border/50 hover:bg-muted",
            )}
            title="لم يعجبني"
          >
            <ThumbsDown className="size-3" />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", meta.tone)}>
              {meta.emoji} {meta.label}
            </span>
            {post.pinned && (
              <Badge variant="outline" className="rounded-full text-[9px] text-primary">
                <Pin className="me-0.5 size-2.5" /> مثبّت
              </Badge>
            )}
            {post.highlighted && (
              <Badge variant="outline" className="rounded-full text-[9px] text-amber-600">
                <Sparkles className="me-0.5 size-2.5" /> مميز · جودة {post.qualityScore}
              </Badge>
            )}
            {post.locked && (
              <Badge variant="outline" className="rounded-full text-[9px] text-muted-foreground">
                <Lock className="me-0.5 size-2.5" /> مغلق
              </Badge>
            )}
            {post.kind === "question" && post.acceptedCommentId && (
              <Badge variant="outline" className="rounded-full text-[9px] text-emerald-600">
                <CheckCircle2 className="me-0.5 size-2.5" /> تمت الإجابة
              </Badge>
            )}
          </div>

          <h3 className="mt-1.5 text-sm font-bold leading-snug">{post.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{post.body}</p>

          {post.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {post.tags.map((t: string) => (
                <span key={t} className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                  #{t}
                </span>
              ))}
            </div>
          )}

          {post.challenge && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/[0.04] p-2 text-[10px]">
              <Swords className="size-3.5 text-rose-600" />
              <span className="font-bold">تحدٍّ مفتوح</span>
              <span className="text-muted-foreground">
                {post.challenge.questionCount} أسئلة · {post.challenge.difficulty === "easy" ? "سهل" : post.challenge.difficulty === "hard" ? "صعب" : "متوسط"}
              </span>
              <span className="flex items-center gap-1 text-amber-600">
                <Trophy className="size-3" /> {post.challenge.reward} خبرة
              </span>
              <Link
                to={post.challenge.code ? `/arena?challenge=${post.challenge.code}` : "/arena"}
                onClick={(e) => e.stopPropagation()}
                className="ms-auto rounded-lg bg-rose-600 px-2 py-1 font-bold text-white hover:bg-rose-700"
              >
                {post.challenge.code ? "العب التحدّي" : "العب الآن"}
              </Link>
            </div>
          )}

          {post.roomId && (
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-teal-500/25 bg-teal-500/[0.04] p-2 text-[10px]">
              <Users className="size-3.5 text-teal-600" />
              <span className="font-bold">غرفة خاصة معروضة</span>
              <Link
                to="/rooms"
                onClick={(e) => e.stopPropagation()}
                className="ms-auto rounded-lg bg-teal-600 px-2 py-1 font-bold text-white hover:bg-teal-700"
              >
                زيارة الغرفة
              </Link>
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              {post.authorRank.emoji} {post.authorName}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="size-3" /> {post.commentCount}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3" /> {timeAgo(post.lastActivityAt)}
            </span>
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await subscribe({ postId: post._id as never, subscribe: !post.subscribed });
                  toast(post.subscribed ? "أُلغي المتابعة" : "تتابع هذا المنشور الآن");
                } catch {
                  toast.error("تعذّر تغيير المتابعة");
                }
              }}
              className="flex items-center gap-1 font-semibold hover:text-primary"
            >
              {post.subscribed ? <BellOff className="size-3" /> : <Bell className="size-3" />}
              {post.subscribed ? "أتابعه" : "تابع"}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   إنشاء منشور
   ═════════════════════════════════════════════════════════════════════ */
function ComposerButton({ sections }: { sections: Array<{ slug: string; name: string; emoji: string; kinds: string[]; lockedForMe: boolean }> }) {
  const createPost = useMutation(api.forum.createPost);
  const myRooms = useQuery(api.roomNexus.listRoomsV2, { filter: "mine", sort: "active", limit: 30 });
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(sections[0]?.slug ?? "general");
  const [kind, setKind] = useState("discussion");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [pollOptions, setPollOptions] = useState("خيار أول\nخيار ثانٍ");
  const [challengeDifficulty, setChallengeDifficulty] = useState("medium");
  const [challengeQuestions, setChallengeQuestions] = useState(10);
  const [challengeReward, setChallengeReward] = useState(50);
  const [roomId, setRoomId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const target = sections.find((s) => s.slug === slug);
  const allowedKinds = target ? KINDS_FOR_COMPOSER.filter((k) => target.kinds.includes(k.id)) : KINDS_FOR_COMPOSER;

  const submit = async () => {
    setSaving(true);
    try {
      const res = await createPost({
        sectionSlug: slug,
        kind,
        title,
        body,
        tags: tags.split(/[,\s]+/).filter(Boolean),
        pollOptions: kind === "poll" ? pollOptions.split("\n").map((s) => s.trim()).filter(Boolean) : undefined,
        challengeDifficulty: kind === "challenge" ? challengeDifficulty : undefined,
        challengeQuestions: kind === "challenge" ? challengeQuestions : undefined,
        challengeReward: kind === "challenge" ? challengeReward : undefined,
        roomId: kind === "room" && roomId ? (roomId as never) : undefined,
      });
      if (res.challengeCode) {
        toast.success(`نُشر التحدّي بكود ${res.challengeCode} — صار قابلاً للعب الآن في الساحة ⚔️`);
      } else {
        toast.success(res.highlighted ? "نُشر — ومحتواك استحق الإبراز التلقائي ✨" : "تم النشر");
      }
      setOpen(false);
      setTitle("");
      setBody("");
      setTags("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر النشر");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5 rounded-xl">
          <Plus className="size-4" /> منشور جديد
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="size-4 text-primary" /> اكتب في ملتقى العقول
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">القسم</p>
            <div className="flex flex-wrap gap-1.5">
              {sections.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  disabled={s.lockedForMe}
                  onClick={() => {
                    setSlug(s.slug);
                    if (!s.kinds.includes(kind)) setKind(s.kinds[0]);
                  }}
                  className={cn(
                    "rounded-xl border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-40",
                    slug === s.slug ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 hover:bg-muted/50",
                  )}
                >
                  {s.emoji} {s.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">النوع</p>
            <div className="flex flex-wrap gap-1.5">
              {allowedKinds.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKind(k.id)}
                  className={cn(
                    "rounded-xl border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    kind === k.id ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 hover:bg-muted/50",
                  )}
                >
                  {k.emoji} {k.label}
                </button>
              ))}
            </div>
          </div>

          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان واضح ومحدد…" className="rounded-xl" maxLength={120} />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="اكتب تفاصيلك… وضّح السؤال أو الفكرة أو التحدي" className="min-h-[160px] rounded-xl" maxLength={4000} />
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="وسوم: منطق، أفكار، تحدي (حتى ٥)" className="rounded-xl" />

          {kind === "poll" && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">خيارات الاستطلاع (كل سطر خيار · ٢–٦)</p>
              <Textarea value={pollOptions} onChange={(e) => setPollOptions(e.target.value)} className="min-h-[110px] rounded-xl" />
            </div>
          )}

          {kind === "challenge" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">الصعوبة</p>
                <div className="flex gap-1.5">
                  {[
                    { id: "easy", label: "سهل" },
                    { id: "medium", label: "متوسط" },
                    { id: "hard", label: "صعب" },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setChallengeDifficulty(d.id)}
                      className={cn(
                        "flex-1 rounded-lg border px-2 py-1 text-[11px] font-medium",
                        challengeDifficulty === d.id ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60",
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">عدد الأسئلة</p>
                <Input type="number" min={5} max={40} value={challengeQuestions} onChange={(e) => setChallengeQuestions(Number(e.target.value))} className="rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">المكافأة (خبرة حقيقية — يدفعها الخادم حسب النتيجة)</p>
                <Input type="number" min={10} max={600} value={challengeReward} onChange={(e) => setChallengeReward(Number(e.target.value))} className="rounded-lg" />
              </div>
            </div>
          )}

          {kind === "room" && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">اختر غرفة تملكها لعرضها</p>
              <div className="flex flex-wrap gap-1.5">
                {(myRooms ?? []).map((r: any) => (
                  <button
                    key={r._id}
                    type="button"
                    onClick={() => setRoomId(r._id)}
                    className={cn(
                      "rounded-xl border px-2.5 py-1 text-[11px]",
                      roomId === r._id ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60",
                    )}
                  >
                    {r.avatar} {r.name} · {r.memberCount}
                  </button>
                ))}
                {(!myRooms || myRooms.length === 0) && (
                  <p className="text-[11px] text-muted-foreground">لا تملك غرفاً بعد — أنشئ غرفة من صفحة الغرف</p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="text-[10px] text-muted-foreground">
              المحتوى الجيد يُبرَز تلقائياً · الحد الأقصى ٥ منشورات في الساعة
            </p>
            <Button onClick={submit} disabled={saving || title.trim().length < 6 || body.trim().length < 15} className="gap-1.5 rounded-xl">
              {saving ? <Repeat2 className="size-4 animate-spin" /> : <Plus className="size-4" />} انشر
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   عرض منشور كامل + التعليقات + الإشراف
   ═════════════════════════════════════════════════════════════════════ */
function PostView({ postId, onBack, sections }: { postId: string; onBack: () => void; sections: Array<{ slug: string; name: string; emoji: string }> }) {
  const data = useQuery(api.forum.getPost, { postId: postId as never });
  const votePost = useMutation(api.forum.votePost);
  const voteComment = useMutation(api.forum.voteComment);
  const votePoll = useMutation(api.forum.votePoll);
  const addComment = useMutation(api.forum.addComment);
  const acceptAnswer = useMutation(api.forum.acceptAnswer);
  const subscribe = useMutation(api.forum.subscribePost);
  const moderate = useMutation(api.forum.moderatePost);
  const report = useMutation(api.forum.reportPost);
  const removePost = useMutation(api.forum.deletePost);

  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string; body: string } | null>(null);
  const [quote, setQuote] = useState<string | null>(null);

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10" dir="rtl">
        <Card className="animate-pulse">
          <CardContent className="h-40" />
        </Card>
      </div>
    );
  }

  const post = data.post;
  const meta = KIND_META[post.kind] ?? KIND_META.discussion;
  const roots = data.comments.filter((c: any) => !c.parentId);
  const childrenOf = (id: string) => data.comments.filter((c: any) => c.parentId === id);
  const myPollVotes = new Set((data.pollVotes ?? []).map((v: any) => v.targetId.split(":")[1]));
  const pollTotal = post.poll ? post.poll.options.reduce((s: number, x: any) => s + x.votes, 0) || 1 : 1;

  const send = async () => {
    if (comment.trim().length < 2) return;
    try {
      await addComment({
        postId: postId as never,
        body: comment,
        parentId: replyTo ? (replyTo.id as never) : undefined,
        quoted: quote ?? undefined,
      });
      setComment("");
      setReplyTo(null);
      setQuote(null);
      toast.success("أُضيف تعليقك");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر إضافة التعليق");
    }
  };

  const CommentNode = ({ c, depth }: { c: any; depth: number }) => {
    const kids = childrenOf(c._id);
    return (
      <div className={cn("space-y-2", depth > 0 && "ms-4 border-s border-border/50 ps-3")}>
        <div className={cn("rounded-xl border p-3", c.isAnswer ? "border-emerald-500/40 bg-emerald-500/[0.04]" : "border-border/60 bg-card")}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold">{c.authorRank.emoji} {c.authorName}</span>
            {c.isAnswer && (
              <Badge variant="outline" className="rounded-full text-[9px] text-emerald-600">
                <CheckCircle2 className="me-0.5 size-2.5" /> أفضل جواب
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
            <div className="ms-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => voteComment({ commentId: c._id as never, value: c.myVote === 1 ? 0 : 1 })}
                className={cn(
                  "flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px]",
                  c.myVote === 1 ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60",
                )}
              >
                <ThumbsUp className="size-2.5" /> {c.upvotes}
              </button>
              {!c.deleted && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTo({ id: c._id, name: c.authorName, body: c.body });
                      setQuote(null);
                    }}
                    className="rounded-lg border border-border/60 px-1.5 py-0.5 text-[10px] hover:bg-muted"
                  >
                    رد
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTo({ id: c._id, name: c.authorName, body: c.body });
                      setQuote(c.body.slice(0, 160));
                    }}
                    className="rounded-lg border border-border/60 px-1.5 py-0.5 text-[10px] hover:bg-muted"
                  >
                    اقتباس
                  </button>
                  {data.myCaps.isAuthor && post.kind === "question" && !c.isAnswer && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await acceptAnswer({ commentId: c._id as never });
                          toast.success("اخترت أفضل جواب");
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "تعذّر الاختيار");
                        }
                      }}
                      className="rounded-lg border border-emerald-500/40 px-1.5 py-0.5 text-[10px] text-emerald-600"
                    >
                      أفضل جواب
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          {c.quoted && (
            <p className="mt-1.5 rounded-lg border-s-2 border-primary/40 bg-muted/40 p-1.5 text-[10px] text-muted-foreground">
              اقتباس: {c.quoted}
            </p>
          )}
          <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed">{c.body}</p>
        </div>
        {kids.length > 0 && depth < 3 && (
          <div className="space-y-2">
            {kids.map((k: any) => (
              <CommentNode key={k._id} c={k} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl">
            <ArrowRight className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              {sections.find((s) => s.slug === post.sectionSlug)?.emoji} {post.sectionName} · {meta.label}
            </p>
            <h2 className="truncate text-sm font-bold">{post.title}</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl"
            onClick={async () => {
              await subscribe({ postId: postId as never, subscribe: !data.subscribed });
              toast(data.subscribed ? "أُلغي المتابعة" : "تتابع المنشور");
            }}
          >
            {data.subscribed ? <BellOff className="size-3.5" /> : <Bell className="size-3.5" />}
            {data.subscribed ? "أتابعه" : "تابع"}
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        {/* المنشور */}
        <Card className={cn(post.highlighted && "border-amber-500/40 bg-amber-500/[0.02]")}>
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", meta.tone)}>
                {meta.emoji} {meta.label}
              </span>
              {post.highlighted && (
                <Badge variant="outline" className="rounded-full text-[10px] text-amber-600">
                  <Sparkles className="me-0.5 size-3" /> مميز · جودة {post.qualityScore}
                </Badge>
              )}
              {post.pinned && (
                <Badge variant="outline" className="rounded-full text-[10px] text-primary">
                  <Pin className="me-0.5 size-3" /> مثبّت
                </Badge>
              )}
              {post.locked && (
                <Badge variant="outline" className="rounded-full text-[10px] text-muted-foreground">
                  <Lock className="me-0.5 size-3" /> النقاش مغلق
                </Badge>
              )}
              {post.hidden && (
                <Badge variant="outline" className="rounded-full text-[10px] text-rose-600">مخفي</Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-bold text-foreground">{post.authorRank.emoji} {post.authorName}</span>
              <span>· {post.authorRank.label} · {post.authorKarma} نقطة</span>
              <span>· {timeAgo(post.createdAt)}</span>
            </div>

            <h1 className="text-lg font-bold leading-snug">{post.title}</h1>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{post.body}</p>

            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {post.tags.map((t: string) => (
                  <span key={t} className="rounded-md bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">#{t}</span>
                ))}
              </div>
            )}

            {/* استطلاع */}
            {post.poll && (
              <div className="space-y-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.03] p-3">
                <p className="text-xs font-bold text-emerald-700">📊 استطلاع {post.poll.multi ? "(اختيار متعدد)" : ""}</p>
                {post.poll.options.map((o: any) => {
                  const pct = Math.round((o.votes / pollTotal) * 100);
                  const picked = myPollVotes.has(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={async () => {
                        try {
                          await votePoll({ postId: postId as never, optionId: o.id });
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "تعذّر التصويت");
                        }
                      }}
                      className={cn(
                        "relative w-full overflow-hidden rounded-xl border p-2 text-start text-xs",
                        picked ? "border-emerald-500/50" : "border-border/60",
                      )}
                    >
                      <span className="relative z-10 flex items-center justify-between">
                        <span>{picked ? "✅ " : ""}{o.label}</span>
                        <span className="text-[10px] text-muted-foreground">{o.votes} · {pct}%</span>
                      </span>
                      <span className="absolute inset-y-0 start-0 z-0 bg-emerald-500/10" style={{ width: `${pct}%` }} />
                    </button>
                  );
                })}
                <p className="text-[10px] text-muted-foreground">ينتهي: {new Date(post.poll.endsAt).toLocaleDateString("ar")}</p>
              </div>
            )}

            {/* تحدي */}
            {post.challenge && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.04] p-3 text-xs">
                <Swords className="size-4 text-rose-600" />
                <span className="font-bold">تحدٍّ مفتوح للجميع</span>
                <span className="text-muted-foreground">
                  {post.challenge.questionCount} أسئلة · {post.challenge.difficulty}
                </span>
                <span className="flex items-center gap-1 text-amber-600">
                  <Trophy className="size-3.5" /> {post.challenge.reward} خبرة
                </span>
                {post.challenge.code && (
                  <Badge variant="outline" className="rounded-full font-mono text-[10px]">
                    {post.challenge.code}
                  </Badge>
                )}
                <Button asChild size="sm" className="ms-auto rounded-xl bg-rose-600 hover:bg-rose-700">
                  <Link to={post.challenge.code ? `/arena?challenge=${post.challenge.code}` : "/arena"}>
                    ادخل التحدّي واقبض المكافأة
                  </Link>
                </Button>
              </div>
            )}

            {post.roomId && (
              <div className="flex items-center gap-3 rounded-xl border border-teal-500/25 bg-teal-500/[0.04] p-3 text-xs">
                <Users className="size-4 text-teal-600" />
                <span className="font-bold">غرفة خاصة معروضة في الملتقى</span>
                <Button asChild size="sm" className="ms-auto rounded-xl bg-teal-600 hover:bg-teal-700">
                  <Link to="/rooms">زيارة الغرفة</Link>
                </Button>
              </div>
            )}

            {/* شريط التفاعل */}
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <Button
                variant={data.myVote === 1 ? "default" : "outline"}
                size="sm"
                className="gap-1.5 rounded-xl"
                onClick={() => votePost({ postId: postId as never, value: data.myVote === 1 ? 0 : 1 })}
              >
                <ThumbsUp className="size-3.5" /> {post.upvotes}
              </Button>
              <Button
                variant={data.myVote === -1 ? "default" : "outline"}
                size="sm"
                className="gap-1.5 rounded-xl"
                onClick={() => votePost({ postId: postId as never, value: data.myVote === -1 ? 0 : -1 })}
              >
                <ThumbsDown className="size-3.5" /> {post.downvotes}
              </Button>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <MessageCircle className="size-3.5" /> {post.commentCount} تعليق
              </span>

              {/* أدوات الإشراف */}
              {data.canModerate && (
                <div className="ms-auto flex flex-wrap gap-1.5">
                  {data.myCaps.canPin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 rounded-xl text-[11px]"
                      onClick={() => moderate({ postId: postId as never, action: post.pinned ? "unpin" : "pin" })}
                    >
                      <Pin className="size-3" /> {post.pinned ? "إلغاء التثبيت" : "تثبيت"}
                    </Button>
                  )}
                  {data.myCaps.canPin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 rounded-xl text-[11px]"
                      onClick={() => moderate({ postId: postId as never, action: post.highlighted ? "unhighlight" : "highlight" })}
                    >
                      <Sparkles className="size-3" /> {post.highlighted ? "إلغاء الإبراز" : "إبراز"}
                    </Button>
                  )}
                  {data.myCaps.canLock && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 rounded-xl text-[11px]"
                      onClick={() => moderate({ postId: postId as never, action: post.locked ? "unlock" : "lock" })}
                    >
                      <Lock className="size-3" /> {post.locked ? "فتح" : "إغلاق"}
                    </Button>
                  )}
                  {data.myCaps.canHide && !post.hidden && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 rounded-xl text-[11px] text-rose-600"
                      onClick={async () => {
                        const reason = window.prompt("سبب الإخفاء؟") ?? "";
                        try {
                          await removePost({ postId: postId as never, reason });
                          toast.success("أُخفي المنشور");
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "تعذّر الإخفاء");
                        }
                      }}
                    >
                      إخفاء
                    </Button>
                  )}
                  {post.hidden && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-[11px] text-emerald-600"
                      onClick={() => moderate({ postId: postId as never, action: "restore" })}
                    >
                      استعادة
                    </Button>
                  )}
                </div>
              )}

              {!data.canModerate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ms-auto gap-1 rounded-xl text-[11px] text-muted-foreground"
                  onClick={async () => {
                    const reason = window.prompt("سبب البلاغ؟") ?? "";
                    if (!reason.trim()) return;
                    try {
                      await report({ postId: postId as never, reason });
                      toast.success("وصل بلاغك للمشرفين");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "تعذّر الإبلاغ");
                    }
                  }}
                >
                  <Flag className="size-3" /> بلاغ
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* التعليقات */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MessageCircle className="size-4 text-primary" /> التعليقات ({post.commentCount})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {roots.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">لا تعليقات بعد — ابدأ النقاش</p>
            ) : (
              <div className="space-y-3">
                {roots.map((c: any) => (
                  <CommentNode key={c._id} c={c} depth={0} />
                ))}
              </div>
            )}

            {!post.locked && !post.hidden && (
              <div className="space-y-2 border-t pt-3">
                {replyTo && (
                  <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/[0.04] p-2 text-[11px]">
                    <span className="font-bold">رد على {replyTo.name}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{replyTo.body}</span>
                    <button type="button" onClick={() => { setReplyTo(null); setQuote(null); }} className="text-muted-foreground">
                      ✕
                    </button>
                  </div>
                )}
                {quote && (
                  <p className="rounded-lg border-s-2 border-primary/40 bg-muted/40 p-2 text-[10px] text-muted-foreground">
                    اقتباس: {quote.slice(0, 140)}
                  </p>
                )}
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="شارك رأيك أو أجب بأفضل ما تعرف…"
                  className="min-h-[90px] rounded-xl"
                  maxLength={2000}
                />
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground">ردود حتى ٣ مستويات · الاقتباس متاح</p>
                  <Button onClick={send} disabled={comment.trim().length < 2} className="gap-1.5 rounded-xl">
                    <MessageCircle className="size-4" /> أرسل
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* منشورات ذات صلة */}
        {data.related.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Lightbulb className="size-4 text-amber-600" /> ذات صلة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {data.related.map((r: any) => (
                <div key={r._id} className="flex items-center gap-2 rounded-xl border border-border/60 p-2.5 text-xs">
                  <span>{KIND_META[r.kind]?.emoji ?? "💬"}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{r.title}</span>
                  <span className="text-[10px] text-muted-foreground">👍 {r.upvotes} · 💬 {r.commentCount}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
