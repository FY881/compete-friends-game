import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useState } from "react";
import {
  Bell,
  BellOff,
  CheckCheck,
  Loader2,
  Settings2,
  Trash2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

/**
 * 🔔 مركز الإشعارات الذكي — صندوق أولوية حقيقي + تفضيلات لكل فئة
 */

const CATEGORIES: { key: string; label: string }[] = [
  { key: "duels", label: "⚔️ المبارزات" },
  { key: "streaks", label: "🔥 السلاسل" },
  { key: "membership", label: "💎 العضوية" },
  { key: "events", label: "🎪 الأحداث" },
  { key: "social", label: "👥 المجتمع" },
  { key: "economy", label: "💰 الاقتصاد" },
  { key: "system", label: "🛠️ النظام" },
];

const PRIORITY_STYLE: Record<number, string> = {
  2: "border-red-500/40 bg-red-500/5",
  1: "border-amber-500/30 bg-amber-500/5",
  0: "",
};

const PRIORITY_BADGE: Record<number, { text: string; cls: string }> = {
  2: { text: "عاجل", cls: "bg-red-500/20 text-red-300" },
  1: { text: "مهم", cls: "bg-amber-500/20 text-amber-300" },
  0: { text: "عادي", cls: "bg-muted text-muted-foreground" },
};

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "الآن";
  if (diff < 3600_000) return `قبل ${Math.floor(diff / 60_000)} د`;
  if (diff < 86400_000) return `قبل ${Math.floor(diff / 3600_000)} س`;
  return `قبل ${Math.floor(diff / 86400_000)} يوم`;
}

export function NotificationCenter() {
  const inbox = useQuery(api.smartNotifications.getMyInbox);
  const prefs = useQuery(api.smartNotifications.getMyPreferences);
  const [filter, setFilter] = useState<string>("all");
  const [showSettings, setShowSettings] = useState(false);

  const markAll = useMutation(api.smartNotifications.markAllRead);
  const removeOne = useMutation(api.smartNotifications.deleteNotification);
  const setCat = useMutation(api.smartNotifications.setCategoryEnabled);
  const setQuiet = useMutation(api.smartNotifications.setQuietHours);
  const tiers = useQuery(api.smartNotifications.getMyTiers);
  const setTiers = useMutation(api.smartNotifications.updateTiers);
  const flushDeferred = useMutation(api.smartNotifications.flushMyDeferred);

  const unread = inbox?.filter((n: any) => !n.read).length ?? 0;
  const filtered =
    filter === "all" ? (inbox ?? []) : (inbox ?? []).filter((n: any) => n.category === filter);

  return (
    <div className="space-y-3">
      {/* الشريط العلوي */}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Bell className="h-4 w-4" /> مركز الإشعارات
          {unread > 0 && (
            <Badge className="bg-red-500/20 text-red-300">{unread} غير مقروء</Badge>
          )}
        </h3>
        <div className="ms-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const r = await markAll();
              toast.success(`تم تعليم ${r?.marked ?? 0} إشعاراً كمقروء`);
            }}
          >
            <CheckCheck className="h-3.5 w-3.5" /> تعليم الكل مقروء
          </Button>
          <Button
            size="sm"
            variant={showSettings ? "default" : "ghost"}
            onClick={() => setShowSettings((v) => !v)}
          >
            <Settings2 className="h-3.5 w-3.5" /> التفضيلات
          </Button>
        </div>
      </div>

      {/* فلاتر الفئات */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "rounded-full px-3 py-1 text-xs transition",
            filter === "all" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70",
          )}
        >
          الكل
        </button>
        {CATEGORIES.map((c) => {
          const count = (inbox ?? []).filter((n: any) => n.category === c.key).length;
          return (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={cn(
                "rounded-full px-3 py-1 text-xs transition",
                filter === c.key ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70",
              )}
            >
              {c.label} {count > 0 && <span className="opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* لوحة التفضيلات */}
      {showSettings && (
        <div className="rounded-xl border bg-card/60 p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">
            تفضيلات الإشعارات — تُطبَّق على الخادم فوراً: الفئة المكتومة لا تصل أصلاً
          </p>
          {CATEGORIES.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-3">
              <span className="text-sm">{c.label}</span>
              <Switch
                checked={(prefs as any)?.enabled?.[c.key] !== false}
                onCheckedChange={(v) =>
                  setCat({ category: c.key, enabled: v }).then(() =>
                    toast.success(v ? `فُعّلت ${c.label}` : `كتمت ${c.label}`),
                  )
                }
              />
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 border-t pt-3">
            <span className="text-sm">🌙 ساعات الهدوء (23:00 – 8:00)</span>
            <Switch
              checked={!!(prefs as any)?.quietHours}
              onCheckedChange={(v) =>
                setQuiet(v ? { from: 23, to: 8 } : {}).then(() =>
                  toast.success(
                    v
                      ? "فُعّلت ساعات الهدوء — الحرجة تصل فوراً والباقي يُؤجَّل للملخص"
                      : "أُلغيت ساعات الهدوء",
                  ),
                )
              }
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            الإشعارات الحرجة (حظر/إنذار) تتجاوز ساعات الهدوء دائماً لحماية حسابك.
          </p>

          {/* ═══ الطبقات الذكية — تأجيل لا إلغاء ═══ */}
          <div className="space-y-3 border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground">
              🧠 طبقات ذكية — تحكّم دقيق في ما يقاطعك الآن وما ينتظر الملخص
            </p>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">أدنى أولوية تقاطعني فوراً</span>
              <div className="flex gap-1">
                {[
                  { k: "normal", l: "الكل" },
                  { k: "important", l: "مهم فأعلى" },
                  { k: "critical", l: "حرج فقط" },
                ].map((o) => (
                  <button
                    key={o.k}
                    onClick={() =>
                      setTiers({ minPriority: o.k }).then(() => toast.success(`سيتوقف عند: ${o.l}`))
                    }
                    className={cn(
                      "rounded-full px-3 py-1 text-xs transition",
                      (tiers?.minPriority ?? "normal") === o.k
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/70",
                    )}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">🌙 تأجيل إشعارات ساعات الهدوء بدل إسقاطها</span>
              <Switch
                checked={tiers?.quietDefer ?? true}
                onCheckedChange={(v) =>
                  setTiers({ quietDefer: v }).then(() =>
                    toast.success(v ? "لن يُفقد أي إشعار — الكل يُؤجَّل ويُسلَّم في الملخص" : "إشعارات الهدوء ستُلغى"),
                  )
                }
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm">🚦 سقف الإشعارات الفورية كل ساعة</span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="size-6 rounded-lg p-0"
                  disabled={(tiers?.maxPerHour ?? 12) <= 0}
                  onClick={() =>
                    setTiers({ maxPerHour: Math.max(0, (tiers?.maxPerHour ?? 12) - 2) })
                  }
                >
                  −
                </Button>
                <span className="w-14 text-center text-xs tabular-nums">
                  {tiers?.maxPerHour ?? 12}/ساعة
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="size-6 rounded-lg p-0"
                  disabled={(tiers?.maxPerHour ?? 12) >= 60}
                  onClick={() =>
                    setTiers({ maxPerHour: Math.min(60, (tiers?.maxPerHour ?? 12) + 2) })
                  }
                >
                  +
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm">🧾 ساعة إرسال الملخص اليومي</span>
              <select
                value={String(tiers?.digestHour ?? 9)}
                onChange={(e) =>
                  setTiers({ digestHour: Number(e.target.value) }).then(() =>
                    toast.success(`سيصلك الملخص عند ${e.target.value}:00`),
                  )
                }
                className="h-8 rounded-lg border bg-background px-2 text-xs"
                aria-label="ساعة الملخص"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>

            {/* طابور الانتظار — دليل أن التأجيل لا يعني الإلغاء */}
            <div className="rounded-lg border border-dashed p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold">
                  ⏳ في طابور التأجيل الآن: {tiers?.waitingCount ?? 0}
                </span>
                {(tiers?.waitingCount ?? 0) > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const r = await flushDeferred();
                      toast.success(`سُلّم ${r?.delivered ?? 0} إشعاراً الآن`);
                    }}
                  >
                    سلّمها الآن
                  </Button>
                )}
              </div>
              {(tiers?.waiting ?? []).length > 0 && (
                <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                  {(tiers?.waiting ?? []).map((d: any) => (
                    <div key={d.id} className="flex items-center gap-2 text-[11px]">
                      <Badge variant="outline" className="shrink-0 text-[9px]">
                        {d.reason === "quiet_hours"
                          ? "ساعات هدوء"
                          : d.reason === "rate_limited"
                            ? "تجاوز السقف"
                            : "دون أولويتي"}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{d.title}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-2 text-[10px] text-muted-foreground/70">
                كل ما يُؤجَّل يبقى محفوظاً ويُسلَّم في ساعة الملخص التي اخترتها، أو خلال 12 ساعة كحد أقصى.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* الصندوق */}
      {inbox === undefined ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-muted-foreground">
          <BellOff className="h-6 w-6" />
          <p className="text-sm">لا إشعارات هنا — كل شيء هادئ</p>
        </div>
      ) : (
        <ScrollArea className="h-[420px] rounded-xl border">
          <div className="divide-y">
            {filtered.map((n: any) => (
              <div
                key={n._id}
                className={cn(
                  "group flex items-start gap-3 p-3 transition hover:bg-accent/40",
                  !n.read && "border-s-2 border-s-primary/60",
                  PRIORITY_STYLE[n.priority] ?? "",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("text-sm font-medium", !n.read && "font-semibold")}>
                      {n.title}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {n.categoryLabel}
                    </Badge>
                    <Badge className={cn("text-[10px]", PRIORITY_BADGE[n.priority]?.cls)}>
                      {n.priority === 2 ? (
                        <AlertTriangle className="me-1 h-2.5 w-2.5" />
                      ) : n.priority === 1 ? (
                        <Sparkles className="me-1 h-2.5 w-2.5" />
                      ) : null}
                      {PRIORITY_BADGE[n.priority]?.text}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                  <span className="text-[10px] text-muted-foreground/60">{timeAgo(n.createdAt)}</span>
                </div>
                <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                  {n.actionUrl && (
                    <a
                      href={n.actionUrl}
                      className="rounded-md bg-muted px-2 py-1 text-[11px] hover:bg-accent"
                    >
                      انتقل
                    </a>
                  )}
                  <button
                    onClick={() => removeOne({ id: n._id })}
                    className="rounded-md p-1 text-muted-foreground hover:text-red-400"
                    title="حذف"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
