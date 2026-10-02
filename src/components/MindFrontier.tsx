import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * 🌌 جولة التوسيع 8 — «الأُفق»: مستكشفو الأحرار في 12 مجالاً كبرى،
 * يقرأون حيوية كل مجال من الأحداث الحقيقية ويرسمون روابط الجاذبية.
 */
export function MindFrontier() {
  const data = useQuery(api.aiMindFrontier.getMindFrontier, {});

  if (data === undefined) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/70 p-5 text-sm text-muted-foreground">
        🌌 جاري تحميل خريطة الأُفق...
      </div>
    );
  }

  const { latest, links, stats } = data;

  const verdictStyle = (v: string) =>
    v === "حيوي"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
      : v === "نشط"
        ? "border-sky-500/40 bg-sky-500/10 text-sky-600"
        : v === "هادئ"
          ? "border-amber-500/40 bg-amber-500/10 text-amber-600"
          : "border-rose-500/40 bg-rose-500/10 text-rose-600";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl border border-violet-500/25 bg-violet-500/10 text-xl">
          🌌
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold">أُفق الأحرار</p>
          <p className="text-xs text-muted-foreground">
            مستكشفون أحرار يخرجون إلى 12 مجالاً كبرى من حياة اللعبة، يقيسون حيوية كل مجال
            من الأحداث الحقيقية، ويرسمون ما يرتبط بِمَ — بلا سؤال أحد.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <Badge variant="outline" className="rounded-full">
            {stats.exploredDomains}/{stats.totalDomains} مجال
          </Badge>
          <Badge variant="outline" className="rounded-full text-emerald-600">
            {stats.vital} حيوي
          </Badge>
          {stats.dormant > 0 && (
            <Badge variant="outline" className="rounded-full text-rose-600">
              {stats.dormant} خامل
            </Badge>
          )}
          {stats.llmInsights > 0 && (
            <Badge variant="outline" className="rounded-full text-violet-600">
              {stats.llmInsights} استنتاج AI
            </Badge>
          )}
        </div>
      </div>

      {latest.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card/70 p-5 text-sm text-muted-foreground">
          لم يكتشف المستكشفون أي مجال بعد — أول نبضة أُفق قادمة خلال ساعات قليلة.
        </div>
      ) : (
        <>
          {/* المجالات */}
          <div className="grid gap-2 sm:grid-cols-2">
            {latest.map((f) => (
              <div
                key={f._id}
                className={cn("rounded-2xl border p-3", verdictStyle(f.verdict))}
              >
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold">{f.domainLabel}</p>
                  <span className="ms-auto rounded-full bg-background/60 px-2 py-0.5 text-[10px] font-bold">
                    {f.verdict}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-foreground/80">
                  {f.insight}
                </p>
                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{f.signals} إشارة حقيقية</span>
                  <span>·</span>
                  <span>{f.engine === "llm" ? "استنتاج AI" : "قياس محلي"}</span>
                  <span className="ms-auto">{new Date(f.createdAt).toLocaleTimeString("ar-EG")}</span>
                </div>
              </div>
            ))}
          </div>

          {/* روابط الجاذبية */}
          {links.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
              <p className="text-xs font-bold text-muted-foreground">روابط الجاذبية بين المجالات</p>
              <div className="mt-2 space-y-1.5">
                {links.map((l) => (
                  <div key={l._id} className="flex items-center gap-2 text-[11px]">
                    <span className="shrink-0">🔗</span>
                    <span className="text-muted-foreground">{l.note}</span>
                    <div className="ms-auto h-1 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-violet-500"
                        style={{ width: `${Math.round(l.weight * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
