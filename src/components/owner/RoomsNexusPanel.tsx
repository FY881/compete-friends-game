/**
 * 👑 نكسس الغرف الخاصة — سيادة كاملة على كل غرفة في اللعبة
 *
 * نبضة حيّة (صحة كل غرفة)، توزيع الأنواع، أقوى ما يحتاج تدخلاً، وأدوات فورية:
 * مراقبة/قفل/إغلاق، تعديل حد الأعضاء، إبراز في الملتقى، نقل الملكية، أرشفة
 * الغرف المنتهية، وحذف غرفة بقرار مكتوب — كل قرار يُسجَّل في سجل الغرفة.
 */
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Archive,
  Crown,
  Eye,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Unlock,
  Users,
} from "lucide-react";

const STATE_STYLE: Record<string, { label: string; cls: string }> = {
  normal: { label: "طبيعية", cls: "border-emerald-500/40 text-emerald-600" },
  watch: { label: "مراقبة", cls: "border-amber-500/40 text-amber-600" },
  locked: { label: "مقفلة", cls: "border-rose-500/40 text-rose-600" },
  closed: { label: "مغلقة", cls: "border-muted-foreground/40 text-muted-foreground" },
};

export function RoomsNexusPanel() {
  const pulse = useQuery(api.roomNexus.ownerRoomsPulse, {});
  const setState = useMutation(api.roomNexus.ownerSetRoomState);
  const setLimit = useMutation(api.roomNexus.ownerSetRoomLimit);
  const setFeatured = useMutation(api.roomNexus.ownerSetFeatured);
  const transfer = useMutation(api.roomNexus.ownerTransferRoom);
  const removeRoom = useMutation(api.roomNexus.ownerDeleteRoom);
  const prune = useMutation(api.roomNexus.pruneExpiredRooms);
  const users = useQuery(api.owner.listUsers, { search: "" });

  const [search, setSearch] = useState("");
  const [onlyProblem, setOnlyProblem] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const rooms = useQuery(api.roomNexus.ownerListRooms, { q: search.trim() || undefined, onlyProblem });

  const run = async (id: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(id);
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
      <Card className="border-primary/25 bg-primary/[0.03]">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">نكسس الغرف الخاصة</p>
              <p className="text-[11px] text-muted-foreground">
                سيادة كاملة: مراقبة · قفل · حد أعضاء · إبراز · نقل ملكية · أرشفة
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-xl"
              disabled={busy === "prune"}
              onClick={() =>
                run("prune", async () => {
                  const res = await prune({});
                  toast.success(`أُرشفت ${res.archived} غرفة منتهية من ${res.expired}`);
                }, "تم الفحص")
              }
            >
              {busy === "prune" ? <RefreshCw className="size-3.5 animate-spin" /> : <Archive className="size-3.5" />}
              أرشفة المنتهية
            </Button>
          </div>

          {pulse === undefined ? (
            <p className="text-xs text-muted-foreground">جارٍ التحميل…</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full">{pulse.totals.rooms} غرفة</Badge>
                <Badge variant="outline" className="rounded-full">{pulse.totals.members} عضو</Badge>
                <Badge variant="outline" className="rounded-full">{pulse.totals.messages} رسالة</Badge>
                <Badge variant="outline" className="rounded-full">{pulse.totals.featured} معروضة</Badge>
                {pulse.totals.watch > 0 && (
                  <Badge variant="outline" className="rounded-full border-amber-500/40 text-amber-600">
                    <Eye className="me-1 size-3" /> {pulse.totals.watch} مراقبة
                  </Badge>
                )}
                {pulse.totals.locked > 0 && (
                  <Badge variant="outline" className="rounded-full border-rose-500/40 text-rose-600">
                    <Lock className="me-1 size-3" /> {pulse.totals.locked} مقفلة
                  </Badge>
                )}
                {pulse.totals.expired > 0 && (
                  <Badge variant="outline" className="rounded-full border-amber-500/40 text-amber-600">
                    {pulse.totals.expired} منتهية
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">متوسط صحة الغرف</span>
                  <span className="font-bold">{pulse.totals.avgHealth}%</span>
                </div>
                <Progress value={pulse.totals.avgHealth} className="h-1.5" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(pulse.byKind).map(([kind, count]) => (
                  <span key={kind} className="rounded-lg bg-muted/60 px-2 py-0.5 text-[10px]">
                    {kind}: {count}
                  </span>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* يحتاج انتباهاً */}
      {pulse && pulse.needsAttention.length > 0 && (
        <Card className="border-rose-500/30 bg-rose-500/[0.03]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-rose-700">
              <AlertTriangle className="size-4" /> يحتاج تدخلاً ({pulse.needsAttention.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pulse.needsAttention.map((r) => (
              <div key={r._id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card p-2.5">
                <span className="text-base">{r.emoji}</span>
                <span className="text-xs font-bold">{r.name}</span>
                <Badge variant="outline" className="rounded-full text-[9px]">{r.kindLabel}</Badge>
                <span className="text-[10px] text-muted-foreground">صحة {r.health.score}% · {r.health.verdict}</span>
                <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">{r.health.reasons.join(" · ")}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => run(r._id, () => setState({ roomId: r._id as never, state: "watch", note: "مراقبة وقائية" }), "وُضعت تحت المراقبة")}
                    className="rounded-lg border border-border/60 px-1.5 py-0.5 text-[10px] hover:bg-muted"
                  >
                    مراقبة
                  </button>
                  <button
                    type="button"
                    onClick={() => run(r._id, () => setState({ roomId: r._id as never, state: "locked", note: "قفل مؤقت" }), "أُقفلت")}
                    className="rounded-lg border border-border/60 px-1.5 py-0.5 text-[10px] text-amber-600 hover:bg-muted"
                  >
                    قفل
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* كل الغرف */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            <Users className="size-4 text-primary" /> كل الغرف
            <div className="ms-auto flex items-center gap-2">
              <div className="relative">
                <Search className="absolute start-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث باسم الغرفة أو المالك"
                  className="h-8 w-48 rounded-xl ps-7 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() => setOnlyProblem(!onlyProblem)}
                className={cn(
                  "rounded-xl border px-2 py-1 text-[10px]",
                  onlyProblem ? "border-rose-500/40 bg-rose-500/10 text-rose-600" : "border-border/60",
                )}
              >
                المشاكل فقط
              </button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!rooms ? (
            <p className="py-4 text-center text-xs text-muted-foreground">جارٍ التحميل…</p>
          ) : rooms.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">لا غرف مطابقة</p>
          ) : (
            rooms.map((r) => {
              const st = STATE_STYLE[r.moderationState] ?? STATE_STYLE.normal;
              return (
                <div key={r._id} className="space-y-2 rounded-xl border border-border/60 bg-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base">{r.emoji}</span>
                    <span className="text-xs font-bold">{r.name}</span>
                    <Badge variant="outline" className="rounded-full text-[9px]">{r.kindLabel}</Badge>
                    <Badge variant="outline" className={cn("rounded-full text-[9px]", st.cls)}>{st.label}</Badge>
                    {r.featured && (
                      <Badge variant="outline" className="rounded-full text-[9px] text-teal-600">
                        <Star className="me-0.5 size-2.5" /> معروضة
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      المالك: {r.ownerName} · {r.memberCount}
                      {r.memberLimit > 0 ? `/${r.memberLimit}` : ""} · {r.messageCount} رسالة · صحة {r.health.score}%
                    </span>
                  </div>

                  {(r.rules || r.expiresAt > 0) && (
                    <p className="text-[10px] text-muted-foreground">
                      {r.rules ? `قوانين: ${r.rules.slice(0, 90)}` : ""}
                      {r.expiresAt > 0 ? ` · تنتهي ${new Date(r.expiresAt).toLocaleDateString("ar")}` : ""}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { s: "normal", label: "رفع القيود" },
                      { s: "watch", label: "مراقبة" },
                      { s: "locked", label: "قفل" },
                      { s: "closed", label: "إغلاق" },
                    ].map((act) => (
                      <button
                        key={act.s}
                        type="button"
                        disabled={busy === r._id}
                        onClick={() => {
                          const note = window.prompt(`ملاحظة قرار «${act.label}» (اختياري):`) ?? "";
                          return run(r._id, () => setState({ roomId: r._id as never, state: act.s, note }), `نُفِّذ: ${act.label}`);
                        }}
                        className={cn(
                          "rounded-lg border px-2 py-0.5 text-[10px] hover:bg-muted",
                          r.moderationState === act.s ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60",
                        )}
                      >
                        {act.s === "normal" ? <Unlock className="me-1 inline size-3" /> : null}
                        {act.label}
                      </button>
                    ))}

                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        defaultValue={r.memberLimit}
                        className="h-7 w-20 rounded-lg text-[10px]"
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (!v || v === r.memberLimit) return;
                          return run(r._id, () => setLimit({ roomId: r._id as never, memberLimit: v }), "حُدِّث حد الأعضاء");
                        }}
                      />
                      <span className="text-[10px] text-muted-foreground">حد الأعضاء</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => run(r._id, () => setFeatured({ roomId: r._id as never, featured: !r.featured }), r.featured ? "أُخفيت" : "عُرضت في الملتقى")}
                      className="rounded-lg border border-border/60 px-2 py-0.5 text-[10px] hover:bg-muted"
                    >
                      {r.featured ? "إخفاء من الملتقى" : "عرض في الملتقى"}
                    </button>

                    <select
                      className="rounded-lg border border-border/60 bg-background px-1.5 py-0.5 text-[10px]"
                      defaultValue=""
                      onChange={(e) => {
                        const id = e.target.value;
                        if (!id) return;
                        const target = users?.find((u) => u.id === id);
                        if (!window.confirm(`نقل ملكية «${r.name}» إلى ${target?.name ?? "اللاعب"}؟`)) return;
                        return run(r._id, () => transfer({ roomId: r._id as never, targetUserId: id as never }), "انتقلت الملكية");
                      }}
                    >
                      <option value="">نقل الملكية إلى…</option>
                      {(users ?? []).slice(0, 60).map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        const reason = window.prompt("سبب إغلاق/أرشفة الغرفة؟") ?? "";
                        if (!reason.trim()) return;
                        return run(r._id, () => removeRoom({ roomId: r._id as never, reason }), "أُغلقت الغرفة وأُرشفـت");
                      }}
                      className="ms-auto rounded-lg border border-rose-500/40 px-2 py-0.5 text-[10px] text-rose-600 hover:bg-rose-500/10"
                    >
                      <Crown className="me-1 inline size-3" /> أرشفة الغرفة
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* آخر الإجراءات */}
      {pulse && pulse.recentActions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">آخر إجراءات الغرف</CardTitle>
          </CardHeader>
          <CardContent className="max-h-64 space-y-1.5 overflow-y-auto">
            {pulse.recentActions.map((a) => (
              <div key={a._id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5 text-[11px]">
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[9px]",
                    a.source === "owner" ? "bg-primary/10 text-primary" : a.source === "member" ? "bg-muted" : "bg-amber-500/10 text-amber-600",
                  )}
                >
                  {a.source}
                </span>
                <span className="font-bold">{a.actorName}</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px]">{a.action}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{a.details}</span>
                <span className="text-[9px] text-muted-foreground">{new Date(a.at).toLocaleString("ar")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
