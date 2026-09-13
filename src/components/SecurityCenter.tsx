import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState } from "react";
import {
  ShieldCheck,
  History,
  Camera,
  RotateCcw,
  Lock,
  LockOpen,
  Loader2,
  Search,
  Bot,
} from "lucide-react";

/**
 * 🛡️ مركز الأمان والصيانة:
 *  - شبكة الأمان: قفل الموقع / تعطيل الذكاء الرقابي بكتابة «أؤكد»
 *  - سجل عمليات الإعدادات بنمط الفرق (قبل ← بعد) مع بحث
 *  - لقطات إعدادات قابلة للاستعادة بنقرة (نسخة احتياطية حقيقية)
 */

const ar = (ts: number) =>
  new Date(ts).toLocaleString("ar", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric" });

const EXPECTED = "أؤكد";

export function SecurityCenter() {
  const journal = useQuery(api.commandDeck.getSettingsJournal, {});
  const snaps = useQuery(api.commandDeck.getConfigSnapshots, {});
  const danger = useQuery(api.commandDeck.getDangerState, {});
  const runAction = useMutation(api.commandDeck.runSafetyAction);
  const makeSnapshot = useMutation(api.commandDeck.snapshotSettings);
  const restore = useMutation(api.commandDeck.restoreSnapshot);

  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const act = async (action: "lock_site" | "unlock_site" | "disable_ai" | "enable_ai") => {
    if (confirmText.trim() !== EXPECTED) {
      toast.error(`اكتب «${EXPECTED}» في حقل التأكيد أولاً — شبكة الأمان إلزامية.`);
      return;
    }
    setPending(action);
    try {
      await runAction({ action, confirmText: confirmText.trim() });
      toast.success("نُفّذت العملية وسُجّلت في سجل العمليات.");
      setConfirmText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التنفيذ.");
    } finally {
      setPending(null);
    }
  };

  const snap = async () => {
    setPending("snapshot");
    try {
      await makeSnapshot({});
      toast.success("أُنشئت لقطة إعدادات جديدة.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل إنشاء اللقطة.");
    } finally {
      setPending(null);
    }
  };

  const doRestore = async (id: string) => {
    setPending(`restore-${id}`);
    try {
      const r = await restore({ snapshotId: id as never });
      toast.success(`استُعيدت ${r?.restored ?? 0} إعدادات من اللقطة — راجع سجل العمليات.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشلت الاستعادة.");
    } finally {
      setPending(null);
    }
  };

  const filteredJournal = journal?.filter((j) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return (
      j.actorName.toLowerCase().includes(needle) ||
      j.changes.some((c) => c.key.toLowerCase().includes(needle) || c.label.includes(search.trim()))
    );
  });

  const aiOn = danger?.aiEnabled ?? true;
  const locked = danger?.siteLocked ?? false;

  return (
    <div dir="rtl" className="space-y-5">
      {/* ═══ شبكة الأمان ═══ */}
      <Card className={cn("border shadow-sm", locked ? "border-rose-500/50" : "border-border/70")}>
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            <ShieldCheck className="size-4 text-emerald-600" /> شبكة الأمان — عمليات خطرة
            {locked && <Badge className="rounded-full bg-rose-500/15 text-rose-600">⚠ الموقع مقفل حالياً</Badge>}
            {!aiOn && <Badge className="rounded-full bg-amber-500/15 text-amber-600">الذكاء الرقابي معطّل</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            كل عملية هنا تُنفَّذ فقط بعد كتابة كلمة التأكيد <span className="font-bold text-primary">«{EXPECTED}»</span>، وتُسجَّل دائماً في سجل العمليات مع القيمة قبل وبعد.
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={`اكتب «${EXPECTED}» لتفعيل أزرار العمليات`}
            className="h-9 rounded-lg text-sm"
          />
          <div className="flex flex-wrap gap-2">
            {locked ? (
              <Button variant="outline" size="sm" className="gap-1.5 rounded-lg border-emerald-500/40 text-emerald-600" onClick={() => act("unlock_site")} disabled={pending !== null || confirmText.trim() !== EXPECTED}>
                {pending === "unlock_site" ? <Loader2 className="size-3.5 animate-spin" /> : <LockOpen className="size-3.5" />}
                فتح الموقع
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="gap-1.5 rounded-lg border-rose-500/40 text-rose-600" onClick={() => act("lock_site")} disabled={pending !== null || confirmText.trim() !== EXPECTED}>
                {pending === "lock_site" ? <Loader2 className="size-3.5 animate-spin" /> : <Lock className="size-3.5" />}
                قفل الموقع بالكامل (صيانة)
              </Button>
            )}
            {aiOn ? (
              <Button variant="outline" size="sm" className="gap-1.5 rounded-lg border-amber-500/40 text-amber-600" onClick={() => act("disable_ai")} disabled={pending !== null || confirmText.trim() !== EXPECTED}>
                {pending === "disable_ai" ? <Loader2 className="size-3.5 animate-spin" /> : <Bot className="size-3.5" />}
                تعطيل الذكاء الرقابي مؤقتاً
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="gap-1.5 rounded-lg border-emerald-500/40 text-emerald-600" onClick={() => act("enable_ai")} disabled={pending !== null || confirmText.trim() !== EXPECTED}>
                {pending === "enable_ai" ? <Loader2 className="size-3.5 animate-spin" /> : <Bot className="size-3.5" />}
                إعادة تشغيل الذكاء الرقابي
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ═══ اللقطات الاحتياطية ═══ */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            <Camera className="size-4 text-sky-600" /> لقطات الإعدادات (نسخ احتياطي)
            {snaps && <Badge variant="outline" className="ms-auto rounded-full text-[10px]">{snaps.length} لقطة</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button size="sm" variant="outline" className="gap-1.5 rounded-lg" onClick={snap} disabled={pending === "snapshot"}>
            {pending === "snapshot" ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
            إنشاء لقطة الآن
          </Button>
          {snaps === undefined ? (
            <p className="py-4 text-center text-xs text-muted-foreground">جارٍ التحميل…</p>
          ) : snaps.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">لا لقطات بعد — أنشئ الأولى قبل أي تغيير كبير.</p>
          ) : (
            <div className="max-h-60 space-y-1.5 overflow-y-auto pe-1">
              {snaps.map((s) => (
                <div key={s._id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs">
                  <span className="min-w-0 flex-1 truncate font-bold">{s.label}</span>
                  <span className="text-[10px] text-muted-foreground">{s.actorName} · {ar(s.at)}</span>
                  <Button size="sm" variant="outline" className="h-7 gap-1 rounded-lg px-2 text-[10px]" onClick={() => doRestore(s._id)} disabled={pending !== null}>
                    {pending === `restore-${s._id}` ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
                    استعادة
                  </Button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">الاستعادة تُطبّق كل القيم المحفوظة في اللقطة وتسجّل الفروقات في سجل العمليات. الأسرار (مفاتيح API) لا تُنسخ أبداً.</p>
        </CardContent>
      </Card>

      {/* ═══ سجل عمليات الإعدادات (قبل ← بعد) ═══ */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
            <History className="size-4 text-primary" /> سجل عمليات الإعدادات
            <div className="relative ms-auto">
              <Search className="absolute start-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث في السجل…" className="h-8 w-44 rounded-lg ps-7 text-[11px]" />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredJournal === undefined ? (
            <p className="py-4 text-center text-xs text-muted-foreground">جارٍ التحميل…</p>
          ) : filteredJournal.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              {journal && journal.length > 0 ? "لا نتائج مطابقة للبحث." : "لا تغييرات مسجلة بعد — كل تعديل إعدادات مستقبلي سيظهر هنا بنمط «قبل ← بعد»."}
            </p>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto pe-1">
              {filteredJournal.map((j) => (
                <div key={j._id} className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="font-bold text-primary">{j.actorName}</span>
                    <span className="text-[10px] text-muted-foreground">{ar(j.at)}</span>
                    <Badge variant="outline" className="ms-auto rounded-full text-[9px]">{j.changes.length} تغيير</Badge>
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {j.changes.map((c, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                        <span className="font-sans font-bold">{c.label}:</span>
                        <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-rose-600 line-through">{c.before}</span>
                        <span className="text-muted-foreground">←</span>
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600">{c.after}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
