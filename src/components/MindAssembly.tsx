import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";

/**
 * 🏛️ جولة التوسيع 9 — «مجالس الأحرار»: الأحرار يماطلون ويصوّتون
 * على اقتراحات مبنية على بيانات حقيقية، بوزن خبرة كل وكيل.
 */
export function MindAssembly() {
  const data = useQuery(api.aiMindAssembly.getMindAssembly, {});

  if (data === undefined) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/70 p-5 text-sm text-muted-foreground">
        🏛️ جاري تحميل سجل المجالس...
      </div>
    );
  }

  const { rows, stats } = data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10 text-xl">
          🏛️
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold">مجالس الأحرار</p>
          <p className="text-xs text-muted-foreground">
            الديمقراطية الصامتة: كل 6 ساعات يُعقد مجلسان — الأُفق والصيانة — يقرأان
            البيانات الحقيقية ويصوّت الأحرار بوزن خبرتهم، ويُسجَّل القرار بالأغلبية.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <Badge variant="outline" className="rounded-full">
            {stats.sessions} جلسة
          </Badge>
          <Badge variant="outline" className="rounded-full text-emerald-600">
            {stats.passed} اعتُمدت
          </Badge>
          <Badge variant="outline" className="rounded-full text-rose-600">
            {stats.rejected} رُفضت
          </Badge>
          {stats.noQuorum > 0 && (
            <Badge variant="outline" className="rounded-full text-amber-600">
              {stats.noQuorum} بلا نصاب
            </Badge>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card/70 p-5 text-sm text-muted-foreground">
          لم يُعقد أي مجلس بعد — أول جلسة خلال ساعات قليلة.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const total = Math.max(1, r.yes + r.no + r.abstain);
            const yesPct = Math.round((r.yes / total) * 100);
            const noPct = Math.round((r.no / total) * 100);
            const verdict =
              r.passed === true
                ? { txt: "اعتُمد", cls: "text-emerald-600" }
                : r.passed === false
                  ? { txt: "رُفض", cls: "text-rose-600" }
                  : { txt: "بلا نصاب", cls: "text-amber-600" };
            return (
              <div key={r._id} className="rounded-2xl border border-border/60 bg-card/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="shrink-0 rounded-full text-[10px]">
                    {r.seatName}
                  </Badge>
                  <p className="text-xs font-bold">{r.topic}</p>
                  <span className={`ms-auto text-[11px] font-bold ${verdict.cls}`}>
                    {verdict.txt}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {r.proposal}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground/70">الأساس: {r.basis}</p>
                {/* شريط التصويت */}
                <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-emerald-500" style={{ width: `${yesPct}%` }} />
                  <div className="h-full bg-rose-500" style={{ width: `${noPct}%` }} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="text-emerald-600">موافقة {r.yes}</span>
                  <span className="text-rose-600">معارضة {r.no}</span>
                  <span>محتاد {r.abstain}</span>
                  <span>·</span>
                  <span>{r.votersCount} صوتاً · نصاب {r.quorum}</span>
                  <span className="ms-auto">{new Date(r.createdAt).toLocaleString("ar-EG")}</span>
                </div>
                <p className="mt-1.5 rounded-xl bg-muted/40 px-3 py-2 text-[11px] font-semibold">
                  ⚖️ {r.resolution}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
