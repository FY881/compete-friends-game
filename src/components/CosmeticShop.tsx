import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Loader2, ShoppingBag, Gift, Check } from "lucide-react";

/**
 * 🛍️ متجر التجميلات 2.0 — أفاتارات، إطارات، ألقاب حقيقية.
 * تُجهَّز فعلياً على الملف، وتُهدى للأصدقاء، مع إسقاطات موسمية مرتبطة بالحزم.
 */
export function CosmeticShop() {
  const shop = useQuery(api.cosmetics.getCosmeticShop);
  const buy = useMutation(api.cosmetics.buyCosmetic);
  const equip = useMutation(api.cosmetics.equipCosmetic);
  const gift = useMutation(api.cosmetics.giftCosmetic);

  const [busy, setBusy] = useState<string | null>(null);
  const [giftTarget, setGiftTarget] = useState<{ key: string; email: string } | null>(null);
  const findUser = useQuery(
    api.cosmetics.findUserByEmail,
    giftTarget && giftTarget.email.includes("@") ? { email: giftTarget.email } : "skip",
  );

  if (!shop) return null;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(null);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التنفيذ");
    }
  };

  const KIND_LABEL: Record<string, string> = {
    avatar: "أفاتار",
    frame: "إطار",
    title: "لقب",
  };

  const grouped = (["avatar", "frame", "title"] as const).map((kind) => ({
    kind,
    items: shop.items.filter((i) => i.kind === kind),
  }));

  return (
    <div dir="rtl" className="overflow-hidden rounded-2xl border border-fuchsia-500/30 bg-gradient-to-l from-fuchsia-500/10 via-card to-fuchsia-500/10 shadow-sm">
      <div className="flex items-center gap-3 p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/15">
          <ShoppingBag className="size-5 text-fuchsia-600" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">متجر التجميلات 2.0</p>
          <p className="text-[11px] text-muted-foreground">
            أفاتارات، إطارات، وألقاب تُجهَّز فعلياً على ملفك{shop.activePack ? " — إسقاطات موسمية متاحة الآن ✨" : ""}
          </p>
        </div>
        <div className="shrink-0 text-end">
          <p className="text-lg font-black text-fuchsia-600">{shop.points}</p>
          <p className="text-[10px] text-muted-foreground">نقطة</p>
        </div>
      </div>

      <div className="space-y-4 border-t border-fuchsia-500/20 p-4 pt-3">
        {grouped.map(({ kind, items }) => (
          <div key={kind}>
            <p className="mb-2 text-[11px] font-black text-muted-foreground">{KIND_LABEL[kind]}s</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((item) => (
                <div
                  key={item.key}
                  className={cn(
                    "rounded-xl border p-3",
                    item.equipped
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : item.owned
                        ? "border-sky-500/30 bg-sky-500/5"
                        : item.limitedAvailable
                          ? "border-border/50 bg-muted/20"
                          : "border-border/30 bg-muted/10 opacity-50",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{item.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">{item.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    {item.equipped ? (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                        <Check className="size-3" /> مُجهَّز
                      </span>
                    ) : item.owned ? (
                      <button
                        type="button"
                        disabled={busy === item.key}
                        onClick={() => run(() => equip({ key: item.key, equip: true }), `جهّزت ${item.name} ✨`)}
                        className="rounded-lg bg-sky-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-sky-700"
                      >
                        {busy === item.key ? <Loader2 className="size-3 animate-spin" /> : "جهّز"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy === item.key || !item.affordable || !item.limitedAvailable}
                        onClick={() => {
                          setBusy(item.key);
                          run(() => buy({ key: item.key }), `اشتريت ${item.name} ${item.emoji}`).finally(() => setBusy(null));
                        }}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-[11px] font-bold",
                          item.affordable && item.limitedAvailable
                            ? "bg-fuchsia-600 text-white hover:bg-fuchsia-700"
                            : "cursor-not-allowed bg-muted text-muted-foreground",
                        )}
                      >
                        {item.limitedAvailable ? `${item.cost} نقطة` : "باقة غير نشطة"}
                      </button>
                    )}
                    {!item.owned && item.limitedAvailable && (
                      <button
                        type="button"
                        onClick={() => setGiftTarget({ key: item.key, email: "" })}
                        className="rounded-lg bg-muted px-2.5 py-1.5 text-[10px] font-bold text-foreground hover:bg-muted/70"
                        title="إهداء لصديق"
                      >
                        <Gift className="inline size-3" /> إهداء
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Gift dialog */}
      {giftTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setGiftTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="flex items-center gap-2 text-sm font-black">
              <Gift className="size-4 text-fuchsia-600" /> إهداء التجميلة
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              أدخل بريد صديقك — ستدفع أنت النقاط ويمتلك هو العنصر.
            </p>
            <input
              value={giftTarget.email}
              onChange={(e) => setGiftTarget({ ...giftTarget, email: e.target.value })}
              placeholder="friend@email.com"
              className="mt-3 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-fuchsia-400"
            />
            <button
              type="button"
              disabled={busy === "gift" || !giftTarget.email.includes("@")}
              onClick={async () => {
                if (!findUser) return;
                setBusy("gift");
                try {
                  const r = await gift({ key: giftTarget.key, toUserId: findUser.userId as Id<"users"> });
                  toast.success(`أُهديت ${r.name} 🎁`);
                  setGiftTarget(null);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "فشل الإهداء");
                } finally {
                  setBusy(null);
                }
              }}
              className="mt-3 w-full rounded-xl bg-fuchsia-600 py-2.5 text-xs font-black text-white hover:bg-fuchsia-700 disabled:opacity-50"
            >
              {busy === "gift" ? <Loader2 className="mx-auto size-4 animate-spin" /> : "أرسل الهدية 🎁"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
