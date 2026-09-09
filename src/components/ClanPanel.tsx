/**
 * موجّة 12 — لوحة العشائر وحروبها الأسبوعية
 * عشيرتي (شعار، نقاط الحرب، الأعضاء، الدردشة) + تصفح العشائر + إنشاء عشيرة.
 */

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Shield, Swords, Users, MessageSquare, Trophy, Crown, LogOut } from "lucide-react";
import { toast } from "sonner";

const CLAN_EMOJIS = ["🛡️", "⚔️", "🔥", "🐉", "🦅", "🐺", "👑", "⚡", "🎯", "💎"];

function fmt(n: number) {
  return n.toLocaleString("ar-EG");
}

function timeAgo(t: number) {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} س`;
  return `قبل ${Math.floor(h / 24)} يوم`;
}

export function ClanPanel() {
  const myClan = useQuery(api.clans.getMyClan);
  const leaderboard = useQuery(api.clans.getClanLeaderboard, { limit: 8 });
  const browse = useQuery(api.clans.browseClans);
  const members = useQuery(
    api.clans.getClanMembers,
    myClan ? { clanId: myClan.id } : "skip"
  );
  const chat = useQuery(
    api.clans.getClanChat,
    myClan ? { clanId: myClan.id, limit: 30 } : "skip"
  );

  const createClan = useMutation(api.clans.createClan);
  const joinClan = useMutation(api.clans.joinClan);
  const leaveClan = useMutation(api.clans.leaveClan);
  const kickMember = useMutation(api.clans.kickMember);
  const sendMessage = useMutation(api.clans.sendClanMessage);

  const [tab, setTab] = useState<"mine" | "browse">("mine");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🛡️");
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.length]);

  if (myClan === undefined || leaderboard === undefined) {
    return (
      <div className="flex items-center justify-center rounded-3xl border border-border/80 bg-card p-10">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      await createClan({ name, emoji });
      toast.success(`تم تأسيس عشيرة ${emoji} ${name} 🎉`);
      setName("");
      setTab("mine");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الإنشاء");
    } finally {
      setCreating(false);
    }
  };

  const handleLeave = async () => {
    if (!myClan) return;
    try {
      const res = await leaveClan({ clanId: myClan.id });
      toast(res.dissolved ? "تم حل العشيرة" : "غادرت العشيرة");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الخروج");
    }
  };

  const handleSend = async () => {
    if (!myClan || !msg.trim()) return;
    try {
      await sendMessage({ clanId: myClan.id, content: msg });
      setMsg("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الإرسال");
    }
  };

  return (
    <section className="mt-12">
      <div className="rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <Shield className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold">العشائر وحروبها ⚔️</h2>
              <p className="text-xs text-muted-foreground">
                كوّن عشيرتك — جولات أعضائها تحسب نقاط حرب أسبوعية تلقائياً
              </p>
            </div>
          </div>
          <div className="flex gap-1 rounded-full bg-muted/50 p-1">
            <button
              onClick={() => setTab("mine")}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${tab === "mine" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              عشيرتي
            </button>
            <button
              onClick={() => setTab("browse")}
              className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${tab === "browse" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              تصفّح
            </button>
          </div>
        </div>

        {tab === "mine" &&
          (myClan ? (
            <div className="mt-5 space-y-4">
              {/* بطاقة العشيرة */}
              <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border/70 bg-card p-5">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-3xl">
                  {myClan.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-lg font-black">
                    {myClan.name}
                    {myClan.isOwner && <Crown className="size-4 text-yellow-500" />}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge className="rounded-full bg-emerald-500/10 text-[11px] text-emerald-700">
                      <Swords className="size-3" /> {fmt(myClan.pointsThisWeek)} نقطة حرب
                    </Badge>
                    <Badge variant="outline" className="rounded-full text-[10px]">
                      <Users className="size-3" /> {myClan.memberCount}/20
                    </Badge>
                    <Badge variant="outline" className="rounded-full text-[10px]">
                      المجموع: {fmt(myClan.totalPoints)}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-rose-600"
                  onClick={handleLeave}
                >
                  <LogOut className="size-3.5" />
                  {myClan.isOwner ? "ترك/الحل" : "غادر"}
                </Button>
              </div>

              {/* الأعضاء */}
              {members && (
                <div className="rounded-2xl border border-border/70 bg-card p-4">
                  <p className="mb-2 text-xs font-bold text-muted-foreground">أعضاء العشيرة</p>
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {members.map((m) => (
                      <li key={m.id} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-1.5">
                        {m.isOwner && <Crown className="size-3.5 shrink-0 text-yellow-500" />}
                        <span className="min-w-0 flex-1 truncate text-xs font-bold">{m.name}</span>
                        <span className="text-[10px] text-muted-foreground">{fmt(m.xp)} XP</span>
                        {myClan.isOwner && !m.isOwner && (
                          <button
                            className="text-[10px] font-bold text-rose-500 hover:underline"
                            onClick={async () => {
                              try {
                                await kickMember({ clanId: myClan.id, targetUserId: m.id as never });
                                toast("تم الطرد");
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : "فشل");
                              }
                            }}
                          >
                            طرد
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* الدردشة */}
              <div className="rounded-2xl border border-border/70 bg-card p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <MessageSquare className="size-3.5" /> دردشة العشيرة
                </p>
                <div className="max-h-48 space-y-1.5 overflow-y-auto pe-1">
                  {(chat ?? []).map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-lg px-3 py-1.5 text-xs ${m.mine ? "bg-emerald-500/10 ms-8" : "bg-muted/30 me-8"}`}
                    >
                      <span className="font-bold">{m.senderName}</span>
                      <span className="ms-1.5 text-[9px] text-muted-foreground">{timeAgo(m.createdAt)}</span>
                      <p className="mt-0.5 leading-relaxed">{m.content}</p>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="mt-2 flex gap-2">
                  <Input
                    dir="rtl"
                    value={msg}
                    onChange={(e) => setMsg(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="اكتب رسالة لعشيرتك…"
                    className="h-9 rounded-xl"
                    maxLength={300}
                  />
                  <Button size="sm" className="h-9 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={handleSend}>
                    إرسال
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* إنشاء عشيرة */
            <div className="mt-5 rounded-2xl border border-dashed border-emerald-500/40 bg-card p-6 text-center">
              <p className="text-sm font-bold">لست في عشيرة بعد</p>
              <p className="mt-1 text-xs text-muted-foreground">
                أسّس عشيرتك أو انضم لواحدة من تبويب «تصفّح»
              </p>
              <div className="mx-auto mt-4 flex max-w-sm flex-wrap justify-center gap-1.5">
                {CLAN_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setEmoji(e)}
                    className={`flex size-9 items-center justify-center rounded-xl border text-lg transition-all ${emoji === e ? "border-emerald-500 bg-emerald-500/10 scale-110" : "border-border/60 bg-muted/20"}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <div className="mx-auto mt-3 flex max-w-sm gap-2">
                <Input
                  dir="rtl"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="اسم العشيرة…"
                  className="rounded-xl"
                  maxLength={24}
                />
                <Button
                  className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={creating || name.trim().length < 3}
                  onClick={handleCreate}
                >
                  {creating ? <Loader2 className="size-4 animate-spin" /> : "تأسيس"}
                </Button>
              </div>
            </div>
          ))}

        {tab === "browse" && (
          <div className="mt-5 space-y-2">
            {(browse ?? []).length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center text-xs text-muted-foreground">
                لا توجد عشائر متاحة للانضمام حالياً
              </p>
            ) : (
              browse?.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3">
                  <span className="text-2xl">{c.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {c.memberCount}/20 عضو · {fmt(c.pointsThisWeek)} نقطة هذا الأسبوع
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={c.full}
                    className="rounded-full text-xs"
                    onClick={async () => {
                      try {
                        await joinClan({ clanId: c.id as never });
                        toast.success(`انضممت إلى ${c.name} 🎉`);
                        setTab("mine");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "فشل الانضمام");
                      }
                    }}
                  >
                    {c.full ? "ممتلئة" : "انضم"}
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        {/* لوحة صدارة العشائر */}
        {leaderboard.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <Trophy className="size-3.5" /> حرب الأسبوع — صدارة العشائر
            </p>
            <ul className="space-y-1.5">
              {leaderboard.map((c) => (
                <li
                  key={c.id}
                  className={`flex items-center gap-3 rounded-xl px-4 py-2.5 ${myClan?.id === c.id ? "border border-emerald-500/40 bg-emerald-500/5" : "bg-card"}`}
                >
                  <span className="w-6 text-center text-sm font-bold text-muted-foreground">
                    {c.rank <= 3 ? ["🥇", "🥈", "🥉"][c.rank - 1] : `#${c.rank}`}
                  </span>
                  <span className="text-lg">{c.emoji}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{c.name}</span>
                  <span className="text-sm font-black tabular-nums text-emerald-600">
                    {fmt(c.pointsThisWeek)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
