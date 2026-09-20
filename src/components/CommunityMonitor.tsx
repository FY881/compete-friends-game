import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import {
  MessagesSquare,
  Flame,
  ShieldAlert,
  Loader2,
  Trash2,
} from "lucide-react";
import { ClanNexusPanel } from "@/components/owner/ClanNexusPanel";
import { RoomsNexusPanel } from "@/components/owner/RoomsNexusPanel";
import { ForumNexusPanel } from "@/components/owner/ForumNexusPanel";

/**
 * 💬 مراقب المجتمع الحي — الغرف النشطة + الرسائل المُعلَّمة + إجراء فوري
 * (حذف رسالة مخالفة) كل الأرقام من بيانات حقيقية لآخر 24 ساعة.
 */

const ar = (ts: number) =>
  new Date(ts).toLocaleString("ar", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric" });

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  flagged: { label: "مُعلَّمة ⚠️", cls: "border-amber-500/40 bg-amber-500/10 text-amber-600" },
  blocked: { label: "محجوبة 🚫", cls: "border-rose-500/40 bg-rose-500/10 text-rose-600" },
  passed: { label: "سليمة", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600" },
};

export function CommunityMonitor() {
  const monitor = useQuery(api.commandDeck.getCommunityMonitor, {});
  const deleteMsg = useMutation(api.chatRooms.deleteMessage);
  const [busy, setBusy] = useState<string | null>(null);
  // 👑 v10.0 — تبويب مراقبة/سيادة: عشائر · غرف خاصة · ملتقى العقول
  const [board, setBoard] = useState<"clans" | "rooms" | "forum" | "live">("clans");

  const del = async (messageId: string) => {
    setBusy(messageId);
    try {
      await deleteMsg({ messageId });
      toast.success("تم حذف الرسالة.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر الحذف.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div dir="rtl" className="space-y-5">
      {/* 👑 v10.0 — لوحات سيادة المجتمع: العشائر · الغرف الخاصة · ملتقى العقول */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-border/60 bg-muted/40 p-1">
        {[
          { id: "clans" as const, label: "⚔️ العشائر الفكرية" },
          { id: "rooms" as const, label: "🏛️ الغرف الخاصة" },
          { id: "forum" as const, label: "🧠 ملتقى العقول" },
          { id: "live" as const, label: "💬 البث الحي" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setBoard(tab.id)}
            className={cn(
              "rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-all",
              board === tab.id ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:bg-background/60",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {board === "clans" && <ClanNexusPanel />}
      {board === "rooms" && <RoomsNexusPanel />}
      {board === "forum" && <ForumNexusPanel />}

      <div className={cn("space-y-5", board !== "live" && "hidden")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessagesSquare className="size-5" />
          </span>
          <div>
            <h3 className="text-base font-bold">مراقب المجتمع الحي</h3>
            <p className="text-[11px] text-muted-foreground">نشاط الغرف آخر 24 ساعة — الرسائل المُعلَّمة تطفو أولاً</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="rounded-full">{monitor?.totals.rooms ?? 0} غرفة</Badge>
          <Badge variant="outline" className="rounded-full">{monitor?.totals.msgs24h ?? 0} رسالة</Badge>
          {(monitor?.totals.flagged24h ?? 0) > 0 && (
            <Badge className="rounded-full bg-rose-500/15 text-rose-600">
              <ShieldAlert className="size-3" /> {monitor!.totals.flagged24h} مُعلَّمة
            </Badge>
          )}
        </div>
      </div>

      {/* نقاط الاشتباك الساخنة */}
      {(monitor?.hotRooms.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          {monitor!.hotRooms.map((r) => (
            <Badge key={r.id} className="animate-war-pulse gap-1 rounded-full bg-rose-500/15 text-rose-600">
              <Flame className="size-3" /> {r.name}: {r.flagged24h} مخالفة
            </Badge>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        {/* الغرف */}
        <Card className="border-border/70 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">الغرف الأنشط</CardTitle>
          </CardHeader>
          <CardContent>
            {monitor === undefined || monitor === null ? (
              <p className="py-6 text-center text-xs text-muted-foreground">جارٍ التحميل…</p>
            ) : monitor.rooms.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">لا غرف بعد.</p>
            ) : (
              <div className="space-y-1.5">
                {monitor.rooms.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs">
                    <span className="min-w-0 flex-1 truncate font-bold">{r.name}</span>
                    {r.flagged24h > 0 && (
                      <Badge variant="outline" className="rounded-full border-rose-500/40 px-1.5 text-[9px] text-rose-600">
                        {r.flagged24h}
                      </Badge>
                    )}
                    <span className="text-muted-foreground">{r.msgs24h} رسالة</span>
                    <span className="text-muted-foreground">{r.memberCount} عضو</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* آخر الرسائل */}
        <Card className="border-border/70 shadow-sm lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">بث الرسائل الأخيرة</CardTitle>
          </CardHeader>
          <CardContent>
            {monitor === undefined || monitor === null ? (
              <p className="py-6 text-center text-xs text-muted-foreground">جارٍ التحميل…</p>
            ) : monitor.recent.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">لا رسائل خلال 24 ساعة.</p>
            ) : (
              <div className="max-h-96 space-y-1.5 overflow-y-auto pe-1">
                {monitor.recent.map((m) => {
                  const s = STATUS_STYLE[m.status] ?? STATUS_STYLE.passed;
                  const needsAction = m.status === "flagged" || m.status === "blocked";
                  return (
                    <div key={m.id} className={cn("flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                      needsAction ? "border-amber-500/30 bg-amber-500/5" : "border-border/50 bg-muted/20")}>
                      <Badge variant="outline" className={cn("rounded-full px-1.5 text-[9px]", s.cls)}>{s.label}</Badge>
                      <span className="font-bold">{m.senderName}</span>
                      <span className="text-[10px] text-muted-foreground">في {m.roomName}</span>
                      <span className="min-w-0 flex-1 truncate">{m.content}</span>
                      {needsAction && (
                        <Button size="sm" variant="ghost" className="gap-1 rounded-lg text-[10px] text-rose-600" onClick={() => del(m.id)} disabled={busy === m.id}>
                          {busy === m.id ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />} حذف
                        </Button>
                      )}
                      <span className="shrink-0 text-[10px] text-muted-foreground">{ar(m.createdAt)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}
