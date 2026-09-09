import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MessageSquareWarning, ShieldCheck } from "lucide-react";

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} س`;
  return `منذ ${Math.floor(hours / 24)} يوم`;
}

/** موجّة 4.1 — مراقب السمومية: أحدث رسائل الغرف المعلّمة آلياً. */
export function ToxicityMonitor() {
  const feed = useQuery(api.chatAdvanced.getToxicityFeed, { limit: 12 }) ?? [];

  return (
    <Card className="border-border/50 bg-card/80">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <MessageSquareWarning className="size-4 text-amber-500" />
            مراقب السمومية — غرف الدردشة
          </h3>
          <Badge variant="outline" className="rounded-full text-[10px]">
            {feed?.length ?? 0} رسالة معلّمة
          </Badge>
        </div>
        {feed === undefined ? null : feed.length === 0 ? (
          <p className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-emerald-500" />
            لا رسائل سامة — الغرف نظيفة 🕊️
          </p>
        ) : (
          <div className="max-h-64 space-y-1.5 overflow-y-auto scrollbar-thin">
            {feed.map((m) => (
              <div key={m.id} className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-foreground/85">{m.senderName}</p>
                  <span className="shrink-0 text-[9px] text-muted-foreground">{timeAgo(m.createdAt)}</span>
                </div>
                <p className={cn("mt-0.5 truncate text-[11px] text-muted-foreground")} title={m.content}>
                  {m.content}
                </p>
                {m.reason && (
                  <p className="mt-0.5 text-[9px] font-semibold text-amber-700">{m.reason}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}