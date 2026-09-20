/**
 * 🏛️ لوحة تحكم الغرفة الخاصة (v10.0)
 *
 * كل ما هنا مفعّل فعلياً على الخادم: إعدادات وقواعد وترحيب، أدوار وصلاحيات
 * دقيقة، دعوات بروابط محدودة، مواضيع، وضع بطيء، إشراف بسبب مكتوب، نقل ملكية،
 * تحدٍّ بمكافأة، وسجل إجراءات كامل.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  BarChart3,
  Clock,
  Copy,
  Crown,
  KeyRound,
  Link2,
  Lock,
  Plus,
  ScrollText,
  Settings2,
  Shield,
  Swords,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RoomPollsPanel } from "@/components/rooms/RoomPollsPanel";

const ROLE_LABEL: Record<string, string> = {
  owner: "👑 مالك الغرفة",
  admin: "🛡️ مشرف عام",
  moderator: "⚖️ عريف",
  member: "👤 عضو",
  restricted: "🔇 مقيَّد",
};

const PERMISSION_LABEL: { id: string; label: string }[] = [
  { id: "speak", label: "الكتابة" },
  { id: "invite", label: "الدعوة" },
  { id: "pin", label: "التثبيت" },
  { id: "deleteMessages", label: "حذف الرسائل" },
  { id: "manageRoles", label: "إدارة الأدوار" },
  { id: "manageSettings", label: "إعدادات الغرفة" },
  { id: "mute", label: "الكتم" },
  { id: "kick", label: "الطرد" },
  { id: "topics", label: "المواضيع" },
  { id: "polls", label: "الاستطلاعات" },
  { id: "challenges", label: "التحديات" },
  { id: "announce", label: "الإعلانات" },
  { id: "viewAudit", label: "قراءة السجل" },
];

const TONES = ["emerald", "sky", "violet", "amber", "rose", "slate", "teal"];

export function RoomControlPanel({ roomId, onDone }: { roomId: string; onDone?: () => void }) {
  const details = useQuery(api.roomNexus.getRoomDetails, { roomId: roomId as never });
  const update = useMutation(api.roomNexus.updateRoomSettings);
  const setRole = useMutation(api.roomNexus.setMemberRole);
  const transfer = useMutation(api.roomNexus.transferOwnership);
  const createInvite = useMutation(api.roomNexus.createInvite);
  const revokeInvite = useMutation(api.roomNexus.revokeInvite);
  const createTopic = useMutation(api.roomNexus.createTopic);
  const setTopicState = useMutation(api.roomNexus.setTopicState);
  const moderate = useMutation(api.roomNexus.roomModerate);
  const challenge = useMutation(api.roomNexus.startRoomChallenge);
  const reportRoom = useMutation(api.roomNexus.reportRoom);
  // ⚔️ تحدّيات الغرفة الحقيقية: حالتها وعدد لاعبيها وكود كل تحدٍّ
  const roomChallenges = useQuery(api.challenges.getRoomChallenges, { roomId: roomId as never });
  const [lastChallenge, setLastChallenge] = useState<{ code: string; reward: number; coins: number; difficulty: string } | null>(null);

  const profile = details?.profile;
  const [form, setForm] = useState<Record<string, string | number | boolean>>({});
  const [rules, setRules] = useState<string | null>(null);
  const [welcome, setWelcome] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState("");
  const [inviteUses, setInviteUses] = useState(0);
  const [inviteHours, setInviteHours] = useState(168);
  const [permDraft, setPermDraft] = useState<Record<string, Record<string, boolean>> | null>(null);

  const value = (key: string, fallback: string | number | boolean) =>
    form[key] !== undefined ? form[key] : fallback;

  const rolePerms = useMemo(() => {
    if (permDraft) return permDraft;
    return (profile?.rolePerms ?? {}) as Record<string, Record<string, boolean>>;
  }, [permDraft, profile]);

  if (!details || !profile) {
    return <div className="p-6 text-center text-sm text-muted-foreground">جارٍ التحميل…</div>;
  }

  if (!details.canManage && !details.canModerate) {
    return (
      <div className="space-y-4 p-6" dir="rtl">
        <p className="text-sm text-muted-foreground">أنت عضو في هذه الغرفة — أدوات الإدارة لأصحاب الصلاحيات فقط.</p>
        <div className="rounded-xl border border-border/60 bg-card p-3 text-xs">
          <p className="font-bold">اسمك في الغرفة: {ROLE_LABEL[details.myRole ?? "member"]}</p>
          <p className="mt-1 text-muted-foreground">
            صلاحياتك: {details.myPerms.map((p) => PERMISSION_LABEL.find((x) => x.id === p)?.label ?? p).join(" · ") || "لا شيء"}
          </p>
        </div>
        {/* 🗳 v11.0 — الاستطلاعات متاحة لكل عضو (نظام حقيقي لا صلاحية معلّقة) */}
        <RoomPollsPanel roomId={roomId} />

        <Button
          variant="outline"
          className="w-full rounded-xl text-rose-600"
          onClick={async () => {
            const reason = window.prompt("سبب البلاغ عن الغرفة؟") ?? "";
            if (!reason.trim()) return;
            try {
              await reportRoom({ roomId: roomId as never, reason });
              toast.success("وصل بلاغك للإدارة");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "تعذّر الإبلاغ");
            }
          }}
        >
          إبلاغ عن الغرفة
        </Button>
      </div>
    );
  }

  const stateBadge =
    details.state.closed ? (
      <Badge variant="outline" className="rounded-full text-[10px] text-rose-600">مغلقة</Badge>
    ) : details.state.locked ? (
      <Badge variant="outline" className="rounded-full text-[10px] text-amber-600">مقفلة</Badge>
    ) : details.state.watch ? (
      <Badge variant="outline" className="rounded-full text-[10px] text-amber-600">تحت المراقبة</Badge>
    ) : (
      <Badge variant="outline" className="rounded-full text-[10px] text-emerald-600">نشطة</Badge>
    );

  return (
    <div className="space-y-4" dir="rtl">
      {/* الحالة */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card p-3">
        <span className="text-2xl">{profile.avatar}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{details.room.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {details.kind.label} · {details.stats.memberCount}
            {profile.memberLimit > 0 ? `/${profile.memberLimit}` : ""} عضو · {profile.messageCount} رسالة
          </p>
        </div>
        {stateBadge}
        {profile.featured && (
          <Badge variant="outline" className="rounded-full text-[10px] text-teal-600">معروضة في الملتقى</Badge>
        )}
        {profile.slowModeSec > 0 && (
          <Badge variant="outline" className="rounded-full text-[10px]">
            <Clock className="me-1 size-3" /> وضع بطيء {profile.slowModeSec}ث
          </Badge>
        )}
        {profile.expiresAt > 0 && (
          <Badge variant="outline" className="rounded-full text-[10px]">
            تنتهي {new Date(profile.expiresAt).toLocaleDateString("ar")}
          </Badge>
        )}
      </div>

      <Tabs defaultValue="settings">
        <TabsList className="flex h-auto flex-wrap gap-1 rounded-2xl bg-muted/50 p-1">
          <TabsTrigger value="settings" className="rounded-xl text-[11px]"><Settings2 className="me-1 size-3" /> إعدادات</TabsTrigger>
          <TabsTrigger value="rules" className="rounded-xl text-[11px]"><ScrollText className="me-1 size-3" /> قواعد وترحيب</TabsTrigger>
          <TabsTrigger value="roles" className="rounded-xl text-[11px]"><UserCog className="me-1 size-3" /> أدوار وصلاحيات</TabsTrigger>
          <TabsTrigger value="invites" className="rounded-xl text-[11px]"><Link2 className="me-1 size-3" /> دعوات</TabsTrigger>
          <TabsTrigger value="topics" className="rounded-xl text-[11px]"><ScrollText className="me-1 size-3" /> مواضيع</TabsTrigger>
          <TabsTrigger value="polls" className="rounded-xl text-[11px]"><BarChart3 className="me-1 size-3" /> استطلاعات</TabsTrigger>
          <TabsTrigger value="mod" className="rounded-xl text-[11px]"><Shield className="me-1 size-3" /> إشراف</TabsTrigger>
          <TabsTrigger value="audit" className="rounded-xl text-[11px]"><Clock className="me-1 size-3" /> سجل</TabsTrigger>
        </TabsList>

        {/* ── الإعدادات ── */}
        <TabsContent value="settings" className="space-y-3 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="اسم الغرفة">
              <Input value={String(value("name", details.room.name))} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl" />
            </Field>
            <Field label="الرمز (إيموجي)">
              <Input value={String(value("avatar", profile.avatar))} onChange={(e) => setForm({ ...form, avatar: e.target.value })} className="rounded-xl" maxLength={4} />
            </Field>
          </div>
          <Field label="الوصف">
            <Textarea value={String(value("description", details.room.description))} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-xl" />
          </Field>
          <Field label="الوسوم (بفاصلة)">
            <Input value={String(value("tags", (profile.tags ?? []).join(", ")))} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="rounded-xl" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="حد الأعضاء">
              <Input
                type="number"
                min={2}
                value={Number(value("memberLimit", profile.memberLimit))}
                onChange={(e) => setForm({ ...form, memberLimit: Number(e.target.value) })}
                className="rounded-xl"
              />
            </Field>
            <Field label="الوضع البطيء (ثانية)">
              <Input
                type="number"
                min={0}
                max={3600}
                value={Number(value("slowModeSec", profile.slowModeSec))}
                onChange={(e) => setForm({ ...form, slowModeSec: Number(e.target.value) })}
                className="rounded-xl"
              />
            </Field>
            <Field label="مكافأة التحدّي (خبرة حقيقية لكل لاعب ناجح)">
              <Input
                type="number"
                min={10}
                max={600}
                value={Number(value("challengeReward", profile.challengeReward))}
                onChange={(e) => setForm({ ...form, challengeReward: Number(e.target.value) })}
                className="rounded-xl"
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="مدة الغرفة (٠ = دائمة)">
              <Input
                type="number"
                min={0}
                value={Number(value("durationHours", 0))}
                onChange={(e) => setForm({ ...form, durationHours: Number(e.target.value) })}
                className="rounded-xl"
              />
            </Field>
            <Field label="السمة اللونية">
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, tone: t })}
                    className={cn(
                      "rounded-lg border px-2 py-1 text-[10px]",
                      String(value("tone", profile.bannerTone)) === t ? "border-primary/60 bg-primary/10 text-primary" : "border-border/60",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
            <Switch
              checked={Boolean(value("featured", profile.featured))}
              onCheckedChange={(v) => setForm({ ...form, featured: v })}
            />
            <div className="flex-1">
              <p className="text-xs font-bold">عرض الغرفة في ملتقى العقول</p>
              <p className="text-[10px] text-muted-foreground">الحد حسب عضويتك (فضية ١ · بلاتينية ٣)</p>
            </div>
          </div>
          <Button
            className="w-full rounded-xl"
            onClick={async () => {
              try {
                const res = await update({
                  roomId: roomId as never,
                  name: form.name !== undefined ? String(form.name) : undefined,
                  description: form.description !== undefined ? String(form.description) : undefined,
                  avatar: form.avatar !== undefined ? String(form.avatar) : undefined,
                  tone: form.tone !== undefined ? String(form.tone) : undefined,
                  tags: form.tags !== undefined ? String(form.tags).split(",").map((t) => t.trim()).filter(Boolean) : undefined,
                  memberLimit: form.memberLimit !== undefined ? Number(form.memberLimit) : undefined,
                  slowModeSec: form.slowModeSec !== undefined ? Number(form.slowModeSec) : undefined,
                  challengeReward: form.challengeReward !== undefined ? Number(form.challengeReward) : undefined,
                  durationHours: form.durationHours !== undefined ? Number(form.durationHours) : undefined,
                  featured: form.featured !== undefined ? Boolean(form.featured) : undefined,
                });
                toast.success(res.changed.length > 0 ? `حُدِّث: ${res.changed.join(" · ")}` : "لا تغييرات");
                setForm({});
                onDone?.();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
              }
            }}
          >
            حفظ الإعدادات
          </Button>
        </TabsContent>

        {/* ── القواعد والترحيب ── */}
        <TabsContent value="rules" className="space-y-3 pt-3">
          <Field label="قوانين الغرفة (تُفرض مع قوانين المجتمع)">
            <Textarea
              value={rules ?? profile.rules}
              onChange={(e) => setRules(e.target.value)}
              className="min-h-[140px] rounded-xl"
              placeholder="مثال: احترام متبادل · لا روابط خارجية · النقاش في الموضوع المخصص"
            />
          </Field>
          <Field label="رسالة الترحيب (تُضاف تلقائياً عند انضمام عضو)">
            <Input value={welcome ?? profile.welcomeMessage} onChange={(e) => setWelcome(e.target.value)} className="rounded-xl" />
          </Field>
          <Button
            className="w-full rounded-xl"
            onClick={async () => {
              try {
                const res = await update({
                  roomId: roomId as never,
                  rules: rules !== null ? rules : undefined,
                  welcomeMessage: welcome !== null ? welcome : undefined,
                });
                toast.success(res.changed.length > 0 ? `حُدِّث: ${res.changed.join(" · ")}` : "لا تغييرات");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
              }
            }}
          >
            حفظ القواعد والترحيب
          </Button>
        </TabsContent>

        {/* ── الأدوار والصلاحيات ── */}
        <TabsContent value="roles" className="space-y-4 pt-3">
          <div className="space-y-2">
            <p className="text-xs font-bold">أعضاء الغرفة وأدوارهم</p>
            {details.members.map((m) => (
              <div key={m._id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card p-2.5">
                <span className="text-xs font-semibold">{m.name}</span>
                <Badge variant="outline" className="rounded-full text-[10px]">{m.roleLabel}</Badge>
                {m.role !== "owner" && (
                  <div className="ms-auto flex gap-1">
                    {["admin", "moderator", "member", "restricted"].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={async () => {
                          try {
                            await setRole({ roomId: roomId as never, targetUserId: m._id as never, role: r });
                            toast.success(`دور ${m.name} → ${ROLE_LABEL[r]}`);
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "تعذّر التغيير");
                          }
                        }}
                        className={cn(
                          "rounded-lg border px-1.5 py-0.5 text-[10px]",
                          m.role === r ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 hover:bg-muted",
                        )}
                      >
                        {ROLE_LABEL[r]}
                      </button>
                    ))}
                  </div>
                )}
                {m.role === "owner" && <Crown className="ms-auto size-3.5 text-amber-500" />}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold">صلاحيات كل دور (تفعيل/تعطيل فوري)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="p-1 text-start">الدور</th>
                    {PERMISSION_LABEL.map((p) => (
                      <th key={p.id} className="p-1 text-center">{p.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {["admin", "moderator", "member", "restricted"].map((role) => (
                    <tr key={role} className="border-t border-border/50">
                      <td className="p-1 font-semibold">{ROLE_LABEL[role]}</td>
                      {PERMISSION_LABEL.map((p) => {
                        const override = rolePerms[role]?.[p.id];
                        return (
                          <td key={p.id} className="p-1 text-center">
                            <input
                              type="checkbox"
                              checked={override === undefined ? role !== "restricted" && !["manageRoles", "manageSettings", "kick", "deleteMessages"].includes(p.id) : override}
                              onChange={(e) => {
                                const next = { ...rolePerms, [role]: { ...(rolePerms[role] ?? {}), [p.id]: e.target.checked } };
                                setPermDraft(next);
                              }}
                              className="size-3.5 accent-emerald-600"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground">
              المربّع الفارغ = القيمة الافتراضية · المالك لا تُسلب صلاحياته أبداً.
            </p>
            <Button
              variant="outline"
              className="w-full rounded-xl"
              disabled={!permDraft}
              onClick={async () => {
                try {
                  await update({ roomId: roomId as never, rolePerms: rolePerms });
                  toast.success("حُفظت صلاحيات الأدوار");
                  setPermDraft(null);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "تعذّر الحفظ");
                }
              }}
            >
              حفظ صلاحيات الأدوار
            </Button>
          </div>

          {details.myRole === "owner" && (
            <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                <Crown className="size-3.5" /> نقل الملكية
              </p>
              <div className="flex flex-wrap gap-1.5">
                {details.members
                  .filter((m) => m.role !== "owner")
                  .map((m) => (
                    <button
                      key={m._id}
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`نقل ملكية «${details.room.name}» إلى ${m.name}؟`)) return;
                        try {
                          await transfer({ roomId: roomId as never, targetUserId: m._id as never });
                          toast.success(`انتقلت الملكية إلى ${m.name}`);
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "تعذّر النقل");
                        }
                      }}
                      className="rounded-lg border border-border/60 px-2 py-1 text-[10px] hover:bg-muted"
                    >
                      {m.name}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── الدعوات ── */}
        <TabsContent value="invites" className="space-y-3 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="عدد الاستخدامات (٠ = بلا حد)">
              <Input type="number" min={0} value={inviteUses} onChange={(e) => setInviteUses(Number(e.target.value))} className="rounded-xl" />
            </Field>
            <Field label="الصلاحية (ساعة · ٠ = بلا انتهاء)">
              <Input type="number" min={0} value={inviteHours} onChange={(e) => setInviteHours(Number(e.target.value))} className="rounded-xl" />
            </Field>
          </div>
          <Button
            className="w-full gap-1.5 rounded-xl"
            onClick={async () => {
              try {
                const res = await createInvite({
                  roomId: roomId as never,
                  maxUses: inviteUses,
                  durationHours: inviteHours,
                });
                toast.success(`أُنشئت دعوة: ${res.code}`);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "تعذّر إنشاء الدعوة");
              }
            }}
          >
            <Plus className="size-4" /> إنشاء رابط دعوة
          </Button>
          <div className="space-y-2">
            {details.invites.length === 0 && <p className="text-[11px] text-muted-foreground">لا دعوات فعّالة</p>}
            {details.invites.map((inv) => (
              <div key={inv._id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card p-2.5">
                <KeyRound className="size-3.5 text-primary" />
                <code className="text-xs font-bold">{inv.code}</code>
                <span className="text-[10px] text-muted-foreground">
                  {inv.uses}{inv.maxUses > 0 ? `/${inv.maxUses}` : ""} استخدام
                  {inv.expiresAt > 0 ? ` · تنتهي ${new Date(inv.expiresAt).toLocaleDateString("ar")}` : " · بلا انتهاء"}
                </span>
                {inv.revoked && <Badge variant="outline" className="rounded-full text-[9px] text-rose-600">ملغاة</Badge>}
                <div className="ms-auto flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(inv.code);
                      toast.success("نُسخ كود الدعوة");
                    }}
                    className="rounded-lg border border-border/60 p-1.5 hover:bg-muted"
                    title="نسخ"
                  >
                    <Copy className="size-3" />
                  </button>
                  {!inv.revoked && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await revokeInvite({ inviteId: inv._id as never });
                          toast.success("أُلغيت الدعوة");
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "تعذّر الإلغاء");
                        }
                      }}
                      className="rounded-lg border border-border/60 p-1.5 text-rose-600 hover:bg-rose-500/10"
                      title="إلغاء"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── المواضيع ── */}
        <TabsContent value="topics" className="space-y-3 pt-3">
          <div className="flex gap-2">
            <Input value={newTopic} onChange={(e) => setNewTopic(e.target.value)} placeholder="عنوان موضوع جديد داخل الغرفة…" className="rounded-xl" />
            <Button
              className="shrink-0 gap-1.5 rounded-xl"
              disabled={newTopic.trim().length < 3}
              onClick={async () => {
                try {
                  await createTopic({ roomId: roomId as never, title: newTopic });
                  toast.success("فُتح الموضوع");
                  setNewTopic("");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "تعذّر إنشاء الموضوع");
                }
              }}
            >
              <Plus className="size-4" /> فتح
            </Button>
          </div>
          <div className="space-y-2">
            {details.topics.length === 0 && <p className="text-[11px] text-muted-foreground">لا مواضيع بعد — المواضيع تقسّم النقاش إلى مسارات مرتبة</p>}
            {details.topics.map((t) => (
              <div key={t._id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card p-2.5">
                <span className="text-xs font-bold">{t.title}</span>
                <span className="text-[10px] text-muted-foreground">{t.messageCount} رسالة · {t.createdByName}</span>
                {t.pinned && <Badge variant="outline" className="rounded-full text-[9px] text-primary">مثبّت</Badge>}
                {t.status === "closed" && <Badge variant="outline" className="rounded-full text-[9px] text-rose-600">مغلق</Badge>}
                <div className="ms-auto flex gap-1">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await setTopicState({ topicId: t._id as never, pinned: !t.pinned });
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "تعذّر التثبيت");
                      }
                    }}
                    className="rounded-lg border border-border/60 px-2 py-1 text-[10px] hover:bg-muted"
                  >
                    {t.pinned ? "إلغاء التثبيت" : "تثبيت"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await setTopicState({ topicId: t._id as never, status: t.status === "open" ? "closed" : "open" });
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "تعذّر التغيير");
                      }
                    }}
                    className="rounded-lg border border-border/60 px-2 py-1 text-[10px] hover:bg-muted"
                  >
                    {t.status === "open" ? "إغلاق" : "فتح"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── الإشراف ── */}
        <TabsContent value="polls" className="space-y-3 pt-3">
          <RoomPollsPanel roomId={roomId} />
        </TabsContent>

        <TabsContent value="mod" className="space-y-4 pt-3">
          <div className="space-y-2 rounded-xl border border-rose-500/25 bg-rose-500/[0.03] p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
              <Swords className="size-3.5" /> تحدٍّ ذهني داخل الغرفة
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { d: "easy", label: "سهل · ١٠ أسئلة", n: 10 },
                { d: "medium", label: "متوسط · ١٥ سؤالاً", n: 15 },
                { d: "hard", label: "صعب · ٢٠ سؤالاً", n: 20 },
                { d: "expert", label: "خبير · ٢٥ سؤالاً", n: 25 },
              ].map((c) => (
                <button
                  key={c.d}
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await challenge({
                        roomId: roomId as never,
                        difficulty: c.d,
                        questionCount: c.n,
                        reward: profile.challengeReward,
                      });
                      setLastChallenge({ code: res.code, reward: res.reward, coins: res.coins, difficulty: res.difficulty });
                      toast.success(`انطلق التحدّي — كود ${res.code}`);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "تعذّر إطلاق التحدي");
                    }
                  }}
                  className="rounded-lg border border-border/60 px-2 py-1 text-[10px] hover:bg-muted"
                >
                  {c.label}
                </button>
              ))}
            </div>
            {lastChallenge && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2">
                <span className="text-[11px] font-bold tabular-nums">كود اللعب: {lastChallenge.code}</span>
                <span className="text-[10px] text-muted-foreground">
                  مكافأة {lastChallenge.reward} خبرة
                  {lastChallenge.coins > 0 ? ` + ${lastChallenge.coins} عملة` : ""}
                </span>
                <Button asChild size="sm" variant="outline" className="h-6 rounded-lg px-2 text-[10px]">
                  <Link to={`/arena?challenge=${lastChallenge.code}`}>العب الآن</Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 rounded-lg px-2 text-[10px]"
                  onClick={() => {
                    void navigator.clipboard?.writeText(`${window.location.origin}/arena?challenge=${lastChallenge.code}`);
                    toast.success("نُسخ رابط التحدّي");
                  }}
                >
                  <Copy className="size-3" /> نسخ الرابط
                </Button>
              </div>
            )}
            {(roomChallenges ?? []).length > 0 && (
              <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-2">
                <p className="text-[11px] font-bold">تحدّيات هذه الغرفة</p>
                {(roomChallenges ?? []).slice(0, 5).map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <Badge variant="outline" className="rounded-full font-mono text-[9px]">{c.code}</Badge>
                    <span className="tabular-nums">{c.questionCount} أسئلة</span>
                    <span className="tabular-nums text-muted-foreground">· {c.plays} محاولة · {c.participants} لاعب · {c.rewardedCount} نالوا المكافأة</span>
                    <span className="text-muted-foreground">· {c.remaining}</span>
                    <Button asChild size="sm" variant="ghost" className="ms-auto h-5 rounded-md px-1.5 text-[9px]">
                      <Link to={`/arena?challenge=${c.code}`}>لعب</Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              يُنشر التحدي كرسالة مثبّتة بكود، ويُلعَب فعلياً في الساحة — والمكافأة يدفعها الخادم حسب نتيجتك.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold">إجراءات على الأعضاء (بسبب مكتوب)</p>
            {details.members
              .filter((m) => m.role !== "owner")
              .map((m) => (
                <div key={m._id} className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-card p-2.5">
                  <Users className="size-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold">{m.name}</span>
                  <Badge variant="outline" className="rounded-full text-[9px]">{m.roleLabel}</Badge>
                  <div className="ms-auto flex flex-wrap gap-1">
                    {[
                      { a: "warn", label: "⚠️ تحذير" },
                      { a: "mute", label: "🔇 كتم" },
                      { a: "restrict", label: "⛔ تقييد" },
                      { a: "unmute", label: "✅ رفع" },
                      { a: "kick", label: "🚪 طرد" },
                    ].map((act) => (
                      <button
                        key={act.a}
                        type="button"
                        onClick={async () => {
                          const reason = window.prompt(`سبب الإجراء (${act.label})؟`) ?? "";
                          if (!reason.trim()) return;
                          try {
                            await moderate({
                              roomId: roomId as never,
                              targetUserId: m._id as never,
                              action: act.a,
                              reason,
                              durationMinutes: act.a === "mute" ? 60 : undefined,
                            });
                            toast.success("نُفِّذ الإجراء وسُجِّل");
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "تعذّر التنفيذ");
                          }
                        }}
                        className="rounded-lg border border-border/60 px-1.5 py-0.5 text-[10px] hover:bg-muted"
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </TabsContent>

        {/* ── السجل ── */}
        <TabsContent value="audit" className="space-y-3 pt-3">
          <div className="rounded-xl border border-border/60 bg-card p-3">
            <p className="text-xs font-bold">ملخص آخر الإجراءات</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {details.audit.slice(0, 20).map((a) => (
                <Badge key={a._id} variant="outline" className="rounded-full text-[10px]">
                  {a.action} · {a.actorName}
                </Badge>
              ))}
              {details.audit.length === 0 && <p className="text-[11px] text-muted-foreground">لا إجراءات مسجّلة بعد</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            {details.audit.map((a) => (
              <div key={a._id} className="rounded-xl border border-border/60 p-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{a.actorName}</span>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px]">{a.action}</span>
                  <span className="ms-auto text-[10px] text-muted-foreground">{new Date(a.at).toLocaleString("ar")}</span>
                </div>
                {a.details && <p className="mt-1 text-[10px] text-muted-foreground">{a.details}</p>}
              </div>
            ))}
          </div>
          {details.modNotes.length > 0 && (
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                <AlertTriangle className="size-3.5" /> مذكرات الإشراف
              </p>
              {details.modNotes.map((n) => (
                <div key={n._id} className="rounded-xl border border-amber-500/25 bg-amber-500/[0.03] p-2 text-[11px]">
                  <span className="font-bold">{n.targetName}</span> — {n.action} · {n.reason}
                  <span className="ms-2 text-[10px] text-muted-foreground">بواسطة {n.actorName}</span>
                </div>
              ))}
            </div>
          )}
          {details.state.watch && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-3 text-[11px] text-amber-800">
              <Lock className="me-1 inline size-3" /> الغرفة تحت مراقبة الإدارة — أي مخالفة تُسجَّل مباشرة.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/* شريط تقدّم صغير لحركة الغرفة — يُستخدم في القوائم */
export function RoomActivityBar({ messages, members }: { messages: number; members: number }) {
  const value = Math.min(100, messages * 2 + members);
  return <Progress value={value} className="h-1.5" />;
}
