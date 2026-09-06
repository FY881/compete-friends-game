/**
 * ⚡ مركز ترقية AI — لوحة المالك لميزات الترقية الخمس
 * ذاكرة كل عقل · التقييم الذاتي · نجوم المالك · الاقتراحات الاستباقية · الثقة والنبرة
 */
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Brain, Star, Lightbulb, Gauge, Trash2, Check, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const KIND_LABELS: Record<string, { label: string; color: string }> = {
  lesson: { label: "درس", color: "bg-violet-500/10 text-violet-600" },
  preference: { label: "تفضيل", color: "bg-sky-500/10 text-sky-600" },
  fact: { label: "حقيقة", color: "bg-emerald-500/10 text-emerald-600" },
  style: { label: "أسلوب", color: "bg-amber-500/10 text-amber-600" },
};

export function AiUpgradeCenterTab() {
  const [watchAgent, setWatchAgent] = useState("mindHub:noor");
  const [tab, setTab] = useState<"memories" | "suggestions" | "ratings">("suggestions");

  const stats = useQuery(api.aiEnhancements.getUpgradeStats, {});
  const ratings = useQuery(api.aiEnhancements.getAllRatings, {});
  const suggestions = useQuery(api.aiEnhancements.listSuggestions, {});
  const memories = useQuery(api.aiEnhancements.recall, { agentId: watchAgent, limit: 30 });

  const decide = useMutation(api.aiEnhancements.decideSuggestion);
  const rate = useMutation(api.aiEnhancements.rateOwner);
  const forget = useMutation(api.aiEnhancements.forget);

  if (!stats || !ratings || !suggestions || !memories) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const openSugs = suggestions.filter((s) => s.status === "open");

  return (
    <div dir="rtl" className="mx-auto max-w-5xl space-y-5">
      {/* ═══ بطاقات الإحصاء ═══ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { icon: Brain, label: "ذكريات دائمة", value: stats.totalMemories, tone: "text-violet-600" },
          { icon: Sparkles, label: "عقول متعلّمة", value: stats.agentsWithMemory, tone: "text-sky-600" },
          { icon: Star, label: "تقييمات", value: stats.totalRatings, tone: "text-amber-600" },
          { icon: Gauge, label: "متوسط النجوم", value: stats.averageRating, tone: "text-emerald-600" },
          { icon: Lightbulb, label: "اقتراحات مفتوحة", value: stats.openSuggestions, tone: "text-orange-600" },
          { icon: Check, label: "اقتراحات مقبولة", value: stats.acceptedSuggestions, tone: "text-teal-600" },
        ].map(({ icon: Icon, label, value, tone }) => (
          <Card key={label} className="border-border/60">
            <CardContent className="flex flex-col items-center gap-1 p-4 text-center">
              <Icon className={cn("size-4", tone)} />
              <span className="text-xl font-bold tracking-tight">{value}</span>
              <span className="text-[10px] leading-tight text-muted-foreground">{label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ═══ التبويبات ═══ */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="suggestions" className="gap-1.5">
            <Lightbulb className="size-3.5" /> اقتراحات العقول {openSugs.length > 0 && `(${openSugs.length})`}
          </TabsTrigger>
          <TabsTrigger value="ratings" className="gap-1.5">
            <Star className="size-3.5" /> تقييم المالك
          </TabsTrigger>
          <TabsTrigger value="memories" className="gap-1.5">
            <Brain className="size-3.5" /> ذاكرة عقل
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ═══ الاقتراحات الاستباقية ═══ */}
      {tab === "suggestions" && (
        <div className="space-y-2.5">
          {suggestions.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              لا اقتراحات بعد — العقول ترفع اقتراحاتها تلقائياً عندما يلمسون فرصة تحسين بصيغة [اقتراح].
            </p>
          )}
          {suggestions.map((s) => (
            <Card key={s._id} className={cn("border-border/60", s.status !== "open" && "opacity-60")}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      s.impact === "high" ? "border-rose-300 text-rose-600" : s.impact === "medium" ? "border-amber-300 text-amber-600" : "border-border text-muted-foreground",
                    )}
                  >
                    {s.impact === "high" ? "أثر كبير" : s.impact === "medium" ? "أثر متوسط" : "أثر بسيط"}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">{s.agentName || s.agentId}</Badge>
                  <span className="ms-auto text-[10px] text-muted-foreground">
                    {new Date(s.createdAt).toLocaleDateString("ar")}
                  </span>
                </div>
                <h4 className="mt-2 text-sm font-bold tracking-tight">{s.title}</h4>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.detail}</p>
                {s.status === "open" && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 gap-1 rounded-lg text-[11px]"
                      onClick={() => decide({ suggestionId: s._id, decision: "accepted" }).then(() => toast.success("قُبل الاقتراح")).catch(() => toast.error("فشل"))}
                    >
                      <Check className="size-3" /> قبول
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 rounded-lg text-[11px]"
                      onClick={() => decide({ suggestionId: s._id, decision: "dismissed" }).then(() => toast("تُجاهل الاقتراح")).catch(() => toast.error("فشل"))}
                    >
                      <X className="size-3" /> تجاهل
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ═══ تقييم المالك ═══ */}
      {tab === "ratings" && (
        <div className="space-y-2">
          {ratings.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              لا تقييمات بعد — قيّم أي عقل من شاشاته بـ 1-5 نجوم ليغذي تعلّمه.
            </p>
          )}
          {ratings.map((r) => (
            <Card key={r.agentId} className="border-border/60">
              <CardContent className="flex flex-wrap items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs font-bold">{r.agentId}</p>
                  <p className="text-[10px] text-muted-foreground">{r.count} تقييم</p>
                </div>
                <div className="flex items-center gap-1" dir="ltr">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className="cursor-pointer transition-transform hover:scale-125"
                      onClick={() => rate({ agentId: r.agentId, rating: star }).then(() => toast.success(`قيّمت ${r.agentId} بـ ${star} نجوم`))}
                    >
                      <Star className={cn("size-4", star <= Math.round(r.average) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
                    </button>
                  ))}
                </div>
                <Badge variant="secondary" className="font-bold">{r.average}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ═══ ذاكرة عقل محدد ═══ */}
      {tab === "memories" && (
        <div className="space-y-3">
          <Card className="border-border/60">
            <CardContent className="flex flex-wrap items-center gap-2 p-3">
              <Input
                value={watchAgent}
                onChange={(e) => setWatchAgent(e.target.value)}
                placeholder="mindHub:noor — أمثلة: aiSuite:coder، viceOwner، aiCouncil:sara"
                className="h-8 flex-1 font-mono text-xs"
              />
              <Badge variant="secondary" className="text-[10px]">{memories.length} ذكرى</Badge>
            </CardContent>
          </Card>
          {memories.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">هذا العقل لم يبِ ذكريات بعد.</p>
          ) : (
            <div className="space-y-2">
              {memories.map((m) => {
                const kind = KIND_LABELS[m.kind] ?? { label: m.kind, color: "bg-muted text-muted-foreground" };
                return (
                  <Card key={m._id} className="border-border/60">
                    <CardContent className="flex items-start gap-3 p-3.5">
                      <Badge className={cn("shrink-0 text-[10px]", kind.color)}>{kind.label}</Badge>
                      <p className="min-w-0 flex-1 text-xs leading-relaxed">{m.content}</p>
                      <div className="flex shrink-0 flex-col items-center gap-0.5">
                        <span className="text-[10px] font-bold text-violet-600">أهمية {m.importance}/10</span>
                        <span className="text-[9px] text-muted-foreground">استُخدمت {m.useCount}×</span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 shrink-0 text-muted-foreground hover:text-rose-600"
                        onClick={() => forget({ memoryId: m._id }).then(() => toast("حُذفت الذكرى")).catch(() => toast.error("فشل"))}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
