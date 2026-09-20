/**
 * 🏛️ إنشاء غرفة خاصة متقدمة (v10.0)
 *
 * يعرض أنواع الغرف المتاحة حسب رتبة العضوية الحقيقية للاعب، وحصته، وحدود
 * الأعضاء الفعلية — ثم يُنشئ الغرفة على الخادم بكل إعداداتها (نوع، خصوصية،
 * قواعد، ترحيب، وسوم، وضع بطيء، مدة، عرض في الملتقى).
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const KINDS = [
  { id: "open", label: "مفتوحة", emoji: "🌍", note: "يدخلها أي لاعب بلا دعوة" },
  { id: "private", label: "خاصة", emoji: "🔒", note: "برابط دعوة فقط" },
  { id: "group", label: "جماعية محدودة", emoji: "👥", note: "للأصدقاء والفرق الصغيرة" },
  { id: "membership", label: "حسب العضوية", emoji: "💎", note: "تحتاج رتبة عضوية محددة" },
  { id: "clan", label: "غرفة عشيرة", emoji: "🛡️", note: "لدخول أعضاء العشيرة" },
  { id: "event", label: "حدث/مواجهة", emoji: "🏟️", note: "تُفتح لحدث محدد بمدة" },
  { id: "temporary", label: "مؤقتة", emoji: "⏳", note: "تُغلق تلقائياً بعد مدتها" },
  { id: "duel", label: "مواجهة ثنائية", emoji: "⚔️", note: "تحدٍّ مباشر بين عقلين" },
] as const;

const TONES = ["emerald", "sky", "violet", "amber", "rose", "slate", "teal"];

export function CreateRoomDialogV2() {
  const quota = useQuery(api.roomNexus.getMyRoomQuota);
  const create = useMutation(api.roomNexus.createRoomV2);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>("private");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState("💬");
  const [tone, setTone] = useState("slate");
  const [tags, setTags] = useState("");
  const [rules, setRules] = useState("");
  const [welcome, setWelcome] = useState("");
  const [memberLimit, setMemberLimit] = useState(0);
  const [requiresTier, setRequiresTier] = useState("bronze");
  const [durationHours, setDurationHours] = useState(0);
  const [slowModeSec, setSlowModeSec] = useState(0);
  const [featured, setFeatured] = useState(false);
  const [saving, setSaving] = useState(false);

  const availableKinds = useMemo(
    () => (quota ? KINDS.filter((k) => quota.canUseKinds.includes(k.id as never)) : []),
    [quota],
  );

  const submit = async () => {
    setSaving(true);
    try {
      await create({
        name,
        kind,
        description,
        avatar,
        tone,
        tags: tags.split(/[,\s]+/).filter(Boolean),
        rules,
        welcomeMessage: welcome,
        memberLimit,
        requiresTier: kind === "membership" ? requiresTier : undefined,
        durationHours,
        featured,
        slowModeSec,
      });
      toast.success("أُنشئت الغرفة — ابدأ بدعوة أعضائها");
      setOpen(false);
      setName("");
      setDescription("");
      setRules("");
      setWelcome("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر إنشاء الغرفة");
    } finally {
      setSaving(false);
    }
  };

  const limitReached = quota ? quota.maxRooms > 0 && quota.used >= quota.maxRooms : false;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-1.5 rounded-xl" disabled={Boolean(quota && quota.maxRooms === 0)}>
          <Sparkles className="size-4" /> غرفة متقدمة
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> إنشاء غرفة خاصة متقدمة
          </DialogTitle>
        </DialogHeader>

        {quota && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-2.5 text-[11px]">
            <Badge variant="outline" className="rounded-full">عضويتك: {quota.tier}</Badge>
            <span className="text-muted-foreground">
              {quota.maxRooms < 0 ? "غرف بلا حد" : `${quota.used}/${quota.maxRooms} غرفة`}
              {" · "}حد الأعضاء الفعلي {quota.memberLimit}
              {" · "}عرض في الملتقى {quota.featuredLimit}
            </span>
          </div>
        )}

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">نوع الغرفة (حسب عضويتك)</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {availableKinds.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setKind(k.id)}
                  className={cn(
                    "flex items-start gap-2 rounded-xl border p-2.5 text-start transition-colors",
                    kind === k.id ? "border-primary/50 bg-primary/5" : "border-border/60 hover:bg-muted/40",
                  )}
                >
                  <span className="text-lg">{k.emoji}</span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold">{k.label}</span>
                    <span className="block text-[10px] text-muted-foreground">{k.note}</span>
                  </span>
                </button>
              ))}
              {availableKinds.length === 0 && (
                <p className="text-[11px] text-muted-foreground">لا أنواع متاحة — ارقِ عضويتك لفتح الغرف الخاصة.</p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">اسم الغرفة</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" maxLength={40} placeholder="مثال: حلقة المنطق" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">الرمز</span>
              <Input value={avatar} onChange={(e) => setAvatar(e.target.value)} className="rounded-xl text-center" maxLength={4} />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">الوصف</span>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-xl" placeholder="ما هدف الغرفة ومن يناسبها؟" />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">حد الأعضاء (٠ = حسب النوع)</span>
              <Input type="number" min={0} value={memberLimit} onChange={(e) => setMemberLimit(Number(e.target.value))} className="rounded-xl" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">وضع بطيء (ثانية)</span>
              <Input type="number" min={0} max={3600} value={slowModeSec} onChange={(e) => setSlowModeSec(Number(e.target.value))} className="rounded-xl" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">مدة (ساعة · ٠ = دائمة)</span>
              <Input type="number" min={0} value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} className="rounded-xl" />
            </label>
          </div>

          {kind === "membership" && (
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">أدنى رتبة عضوية للانضمام</span>
              <div className="flex flex-wrap gap-1.5">
                {["silver", "gold", "platinum", "diamond"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setRequiresTier(t)}
                    className={cn(
                      "rounded-lg border px-2 py-1 text-[10px]",
                      requiresTier === t ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </label>
          )}

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">الوسوم</span>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} className="rounded-xl" placeholder="منطق، رياضيات" />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">قوانين الغرفة</span>
            <Textarea value={rules} onChange={(e) => setRules(e.target.value)} className="min-h-[80px] rounded-xl" />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">رسالة ترحيب تُنشر لعضو جديد</span>
            <Input value={welcome} onChange={(e) => setWelcome(e.target.value)} className="rounded-xl" placeholder="أهلاً بك — اقرأ القوانين وشارك" />
          </label>

          <div className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
            <Switch checked={featured} onCheckedChange={setFeatured} />
            <div className="flex-1">
              <p className="text-xs font-bold">عرض الغرفة في ملتقى العقول</p>
              <p className="text-[10px] text-muted-foreground">يجعلها مرئية في قسم «غرف مميزة»</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground">السمة اللونية</p>
            <div className="flex flex-wrap gap-1.5">
              {TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={cn("rounded-lg border px-2 py-1 text-[10px]", tone === t ? "border-primary/60 bg-primary/10 text-primary" : "border-border/60")}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full gap-1.5 rounded-xl" onClick={submit} disabled={saving || name.trim().length < 3 || limitReached}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {limitReached ? `وصلت حدّ عضويتك (${quota?.maxRooms})` : "أنشئ الغرفة"}
          </Button>
          {limitReached && (
            <p className="text-center text-[10px] text-amber-600">ارقِ عضويتك لفتح غرف أكثر — أو أرشف غرفة قديمة.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
