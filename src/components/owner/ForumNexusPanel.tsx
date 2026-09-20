/**
 * 👑 نكسس ملتقى العقول — سيادة كاملة على الملتقى
 *
 * نبضة جودة حيّة، إدارة الأقسام (إنشاء/تعديل/قفل/حدود)، تعيين وعزل مشرفين
 * بصلاحيات محددة، ضبط الحدود العامة والإبراز التلقائي، مراقبة ما يحتاج تدخلاً،
 * وسجل إشراف كامل — كل قرار يُسجَّل.
 */
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  BrainCircuit,
  Gauge,
  Layers,
  Plus,
  Shield,
  Sparkles,
  TrendingDown,
  UserMinus,
  UserPlus,
} from "lucide-react";

const TONE: Record<string, string> = {
  emerald: "text-emerald-600 border-emerald-500/40",
  amber: "text-amber-600 border-amber-500/40",
  rose: "text-rose-600 border-rose-500/40",
};

export function ForumNexusPanel() {
  const pulse = useQuery(api.forum.forumOwnerPulse, {});
  const upsertSection = useMutation(api.forum.ownerUpsertSection);
  const appoint = useMutation(api.forum.appointModerator);
  const revoke = useMutation(api.forum.revokeModerator);
  const setLimits = useMutation(api.forum.ownerSetLimits);
  const moderate = useMutation(api.forum.moderatePost);
  const users = useQuery(api.owner.listUsers, { search: "" });

  const [newSection, setNewSection] = useState({ slug: "", name: "", emoji: "💬", description: "", minTierRank: 0 });
  const [modTarget, setModTarget] = useState("");
  const [modSections, setModSections] = useState<string[]>(["*"]);
  const [modCaps, setModCaps] = useState({ canPin: true, canLock: true, canHide: false });
  const [limits, setLimitDraft] = useState<Record<string, number | boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(msg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر التنفيذ");
    } finally {
      setBusy(null);
    }
  };

  if (pulse === null) {
    return <p className="py-6 text-center text-xs text-muted-foreground">هذه اللوحة للحاكم السيادي فقط.</p>;
  }

  return (
    <div dir="rtl" className="space-y-4">
      {/* النبضة */}
      <Card className={cn("bg-card", pulse ? `border ${TONE[pulse.pulse.tone]}` : "")}>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BrainCircuit className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">نكسس ملتقى العقول</p>
              <p className="text-[11px] text-muted-foreground">
                أقسام · مشرفون · حدود · إبراز · إشراف — بسيطرة كاملة ومباشرة
              </p>
            </div>
            {pulse && (
              <Badge variant="outline" className={cn("rounded-full", TONE[pulse.pulse.tone])}>
                <Gauge className="me-1 size-3" /> {pulse.pulse.verdict} · {pulse.pulse.score}%
              </Badge>
            )}
          </div>

          {pulse === undefined ? (
            <p className="text-xs text-muted-foreground">جارٍ التحميل…</p>
          ) : (
            <>
              <Progress value={pulse.pulse.score} className="h-1.5" />
              <div className="flex flex-wrap gap-1.5">
                {pulse.pulse.reasons.map((r, i) => (
                  <span key={i} className="rounded-lg bg-muted/60 px-2 py-0.5 text-[10px]">{r}</span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full">{pulse.totals.posts} منشور</Badge>
                <Badge variant="outline" className="rounded-full">{pulse.totals.visible} ظاهر</Badge>
                <Badge variant="outline" className="rounded-full">{pulse.totals.highlighted} مميز</Badge>
                <Badge variant="outline" className="rounded-full">{pulse.totals.comments} تعليق</Badge>
                <Badge variant="outline" className="rounded-full">{pulse.totals.moderators} مشرف</Badge>
                {pulse.totals.hidden > 0 && (
                  <Badge variant="outline" className="rounded-full border-rose-500/40 text-rose-600">{pulse.totals.hidden} مخفي</Badge>
                )}
                {pulse.totals.openReports > 0 && (
                  <Badge variant="outline" className="rounded-full border-amber-500/40 text-amber-600">{pulse.totals.openReports} بلاغ مفتوح</Badge>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* يحتاج تدخلاً */}
      {pulse && pulse.needsAttention.length > 0 && (
        <Card className="border-rose-500/30 bg-rose-500/[0.03]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-rose-700">
              <TrendingDown className="size-4" /> محتوى سلبي يستحق نظرة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {pulse.needsAttention.map((p) => (
              <div key={p._id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card p-2.5 text-[11px]">
                <span className="min-w-0 flex-1 truncate font-semibold">{p.title}</span>
                <span className="text-muted-foreground">{p.authorName}</span>
                <span className="text-rose-600">👎 {p.downvotes}</span>
                <span className="text-emerald-600">👍 {p.upvotes}</span>
                <button
                  type="button"
                  onClick={() => run(p._id, () => moderate({ postId: p._id as never, action: "unhighlight", reason: "تقييم سلبي" }), "أُلغي الإبراز")}
                  className="rounded-lg border border-border/60 px-2 py-0.5 hover:bg-muted"
                >
                  إلغاء الإبراز
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const reason = window.prompt("سبب الإخفاء؟") ?? "";
                    if (!reason.trim()) return;
                    return run(p._id, () => moderate({ postId: p._id as never, action: "lock", reason }), "أُغلق النقاش");
                  }}
                  className="rounded-lg border border-rose-500/40 px-2 py-0.5 text-rose-600 hover:bg-rose-500/10"
                >
                  إغلاق النقاش
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* الأقسام */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Layers className="size-4 text-primary" /> الأقسام والحدود
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pulse?.bySection.map((s) => (
              <div key={s.slug} className="space-y-2 rounded-xl border border-border/60 bg-card p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{s.emoji}</span>
                  <span className="text-xs font-bold">{s.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {s.total} منشور · {s.last24h} اليوم · حدّ الرتبة {s.minTierRank}
                  </span>
                  {s.locked && <Badge variant="outline" className="rounded-full text-[9px] text-rose-600">مقفل</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  {[
                    { key: "allowPosts" as const, label: "نشر" },
                    { key: "allowPolls" as const, label: "استطلاعات" },
                    { key: "allowComments" as const, label: "تعليقات" },
                  ].map((f) => (
                    <label key={f.key} className="flex items-center gap-1">
                      <Switch
                        checked={Boolean(s[f.key])}
                        onCheckedChange={(v) =>
                          run(s.slug, () => upsertSection({ slug: s.slug, [f.key]: v }), `${f.label}: ${v ? "مفعّل" : "موقوف"}`)
                        }
                      />
                      {f.label}
                    </label>
                  ))}
                  <label className="flex items-center gap-1">
                    <Switch
                      checked={s.locked}
                      onCheckedChange={(v) => run(s.slug, () => upsertSection({ slug: s.slug, locked: v }), v ? "قُفل القسم" : "فُتح القسم")}
                    />
                    قفل القسم
                  </label>
                  <div className="ms-auto flex items-center gap-1">
                    <span>حد الرتبة</span>
                    <Input
                      type="number"
                      min={0}
                      max={5}
                      defaultValue={s.minTierRank}
                      className="h-6 w-14 rounded-lg text-[10px]"
                      onBlur={(e) =>
                        run(s.slug, () => upsertSection({ slug: s.slug, minTierRank: Number(e.target.value) }), "حُدِّثت الرتبة")
                      }
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="space-y-2 rounded-xl border border-dashed border-border/70 p-2.5">
              <p className="text-xs font-bold">قسم جديد</p>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="المعرّف (إنجليزي)" value={newSection.slug} onChange={(e) => setNewSection({ ...newSection, slug: e.target.value })} className="h-8 rounded-lg text-xs" />
                <Input placeholder="الاسم" value={newSection.name} onChange={(e) => setNewSection({ ...newSection, name: e.target.value })} className="h-8 rounded-lg text-xs" />
                <Input placeholder="رمز" value={newSection.emoji} onChange={(e) => setNewSection({ ...newSection, emoji: e.target.value })} className="h-8 rounded-lg text-xs" />
                <Input
                  type="number"
                  min={0}
                  max={5}
                  value={newSection.minTierRank}
                  onChange={(e) => setNewSection({ ...newSection, minTierRank: Number(e.target.value) })}
                  className="h-8 rounded-lg text-xs"
                />
              </div>
              <Input placeholder="الوصف" value={newSection.description} onChange={(e) => setNewSection({ ...newSection, description: e.target.value })} className="h-8 rounded-lg text-xs" />
              <Button
                size="sm"
                className="w-full gap-1.5 rounded-xl"
                disabled={newSection.slug.length < 2 || newSection.name.length < 2 || busy === "newSection"}
                onClick={() =>
                  run(
                    "newSection",
                    async () => {
                      await upsertSection(newSection);
                      setNewSection({ slug: "", name: "", emoji: "💬", description: "", minTierRank: 0 });
                    },
                    "أُنشئ القسم",
                  )
                }
              >
                <Plus className="size-3.5" /> أنشئ القسم
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* المشرفون */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Shield className="size-4 text-primary" /> مشرفو الملتقى
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(pulse?.moderators.length ?? 0) === 0 && (
                <p className="text-[11px] text-muted-foreground">لا مشرفون بعد — عيّن مشرفاً ليتولى الإشراف الفعلي في أقسامه.</p>
              )}
              {pulse?.moderators.map((m) => (
                <div key={m._id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card p-2.5 text-[11px]">
                  <span className="font-bold">{m.userName}</span>
                  <span className="text-muted-foreground">
                    {m.sections.includes("*") ? "كل الأقسام" : m.sections.join(" · ")}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {m.canPin ? "تثبيت " : ""}{m.canLock ? "إغلاق " : ""}{m.canHide ? "إخفاء" : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => run(m._id, () => revoke({ userId: m.userId as never }), "أُنهيت صلاحية الإشراف")}
                    className="ms-auto rounded-lg border border-rose-500/40 px-2 py-0.5 text-rose-600 hover:bg-rose-500/10"
                  >
                    <UserMinus className="me-1 inline size-3" /> عزل
                  </button>
                </div>
              ))}

              <div className="space-y-2 rounded-xl border border-dashed border-border/70 p-2.5">
                <p className="text-xs font-bold">تعيين/تعديل مشرف</p>
                <select
                  value={modTarget}
                  onChange={(e) => setModTarget(e.target.value)}
                  className="w-full rounded-lg border border-border/60 bg-background px-2 py-1 text-xs"
                >
                  <option value="">اختر لاعباً…</option>
                  {(users ?? []).slice(0, 80).map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setModSections(["*"])}
                    className={cn("rounded-lg border px-2 py-0.5 text-[10px]", modSections.includes("*") ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60")}
                  >
                    كل الأقسام
                  </button>
                  {pulse?.bySection.map((s) => (
                    <button
                      key={s.slug}
                      type="button"
                      onClick={() =>
                        setModSections((prev) =>
                          prev.includes(s.slug) ? prev.filter((x) => x !== s.slug) : [...prev.filter((x) => x !== "*"), s.slug],
                        )
                      }
                      className={cn("rounded-lg border px-2 py-0.5 text-[10px]", modSections.includes(s.slug) ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60")}
                    >
                      {s.emoji} {s.name}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 text-[10px]">
                  {[
                    { key: "canPin" as const, label: "تثبيت وإبراز" },
                    { key: "canLock" as const, label: "إغلاق النقاش" },
                    { key: "canHide" as const, label: "إخفاء المحتوى" },
                  ].map((c) => (
                    <label key={c.key} className="flex items-center gap-1">
                      <Switch checked={modCaps[c.key]} onCheckedChange={(v) => setModCaps({ ...modCaps, [c.key]: v })} />
                      {c.label}
                    </label>
                  ))}
                </div>
                <Button
                  size="sm"
                  className="w-full gap-1.5 rounded-xl"
                  disabled={!modTarget || modSections.length === 0 || busy === "appoint"}
                  onClick={() =>
                    run(
                      "appoint",
                      () => appoint({ userId: modTarget as never, sections: modSections, ...modCaps }),
                      "عُيّن المشرف بصلاحياته",
                    )
                  }
                >
                  <UserPlus className="size-3.5" /> عيّن المشرف
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* الحدود العامة */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="size-4 text-amber-600" /> الحدود العامة والإبراز
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-3">
                {[
                  { key: "allowPosts" as const, label: "النشر العام" },
                  { key: "allowComments" as const, label: "التعليقات" },
                  { key: "allowPolls" as const, label: "الاستطلاعات" },
                  { key: "allowRoomsShowcase" as const, label: "عرض الغرف" },
                ].map((f) => (
                  <label key={f.key} className="flex items-center gap-1.5 text-[11px]">
                    <Switch
                      checked={f.key in limits ? Boolean(limits[f.key]) : true}
                      onCheckedChange={(v) => setLimitDraft({ ...limits, [f.key]: v })}
                    />
                    {f.label}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: "minPostLength" as const, label: "أدنى طول", def: 15 },
                  { key: "maxPostsPerHour" as const, label: "منشورات/ساعة", def: 5 },
                  { key: "autoHighlightScore" as const, label: "عتبة الإبراز", def: 62 },
                ].map((n) => (
                  <label key={n.key} className="space-y-1">
                    <span className="text-[10px] text-muted-foreground">{n.label}</span>
                    <Input
                      type="number"
                      value={Number(limits[n.key] ?? n.def)}
                      onChange={(e) => setLimitDraft({ ...limits, [n.key]: Number(e.target.value) })}
                      className="h-8 rounded-lg text-xs"
                    />
                  </label>
                ))}
              </div>
              <Button
                className="w-full rounded-xl"
                disabled={busy === "limits"}
                onClick={() => run("limits", () => submitLimits(setLimits, limits), "حُدِّثت الحدود العامة")}
              >
                حفظ الحدود
              </Button>
              <p className="text-[10px] text-muted-foreground">
                عتبة الإبراز تحدد متى يصبح المنشور «مميزاً» تلقائياً بجودة محتواه.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* سجل الإشراف */}
      {pulse && pulse.recentModActions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="size-4 text-amber-600" /> سجل الإشراف
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-64 space-y-1.5 overflow-y-auto">
            {pulse.recentModActions.map((m) => (
              <div key={m._id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5 text-[11px]">
                <span className="font-bold">{m.actorName}</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px]">{m.action}</span>
                <span className="text-[10px] text-muted-foreground">{m.targetType}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{m.details}</span>
                <span className="text-[9px] text-muted-foreground">{new Date(m.at).toLocaleString("ar")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** يجمع الحدود المدخلة ويرسلها في نداء واحد */
function submitLimits(
  setLimits: (args: {
    allowPosts?: boolean;
    allowComments?: boolean;
    allowPolls?: boolean;
    allowRoomsShowcase?: boolean;
    minPostLength?: number;
    maxPostsPerHour?: number;
    autoHighlightScore?: number;
  }) => Promise<unknown>,
  limits: Record<string, number | boolean>,
) {
  return setLimits({
    allowPosts: limits.allowPosts as boolean | undefined,
    allowComments: limits.allowComments as boolean | undefined,
    allowPolls: limits.allowPolls as boolean | undefined,
    allowRoomsShowcase: limits.allowRoomsShowcase as boolean | undefined,
    minPostLength: limits.minPostLength as number | undefined,
    maxPostsPerHour: limits.maxPostsPerHour as number | undefined,
    autoHighlightScore: limits.autoHighlightScore as number | undefined,
  });
}
