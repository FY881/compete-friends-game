import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Search, Pin, Hash, Users, ArrowRight, ArrowLeft,
  MessageSquare, Crown, Trash2, Reply, Copy, UserPlus, X, Check,
  Settings, Bell, BellOff, MoreVertical, AlertTriangle, UserMinus,
  PinIcon, Volume2, VolumeX, LogOut, Info, Flag,
} from "lucide-react";

const EMOJI_REACTIONS = ["👍", "❤️", "😂", "😮", "🔥", "💯", "👏", "🤔"];

// ═══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════

export default function ChatRooms() {
  const { user } = useAuth();
  const rooms = useQuery(api.chatRooms.getUserRooms);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"all" | "joined" | "public">("all");

  const filteredRooms = useMemo(() => {
    if (!rooms) return [];
    if (filterTab === "joined") return rooms.filter((r: any) => r.isMember);
    if (filterTab === "public") return rooms.filter((r: any) => r.type === "public");
    return rooms;
  }, [rooms, filterTab]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">يجب تسجيل الدخول أولاً</p>
      </div>
    );
  }

  if (selectedRoom) {
    return (
      <RoomChat
        roomId={selectedRoom}
        onBack={() => setSelectedRoom(null)}
        currentUserId={user._id}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
            <MessageSquare className="size-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">غرف الدردشة</h1>
            <p className="text-sm text-muted-foreground">تفاعل مع المجتمع في الوقت الفعلي</p>
          </div>
          <Badge variant="outline" className="rounded-full">
            {rooms?.length ?? 0} غرفة
          </Badge>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4">
          {[
            { id: "all" as const, label: "الكل", icon: Hash },
            { id: "joined" as const, label: "عضو فيها", icon: Check },
            { id: "public" as const, label: "عامة", icon: Users },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                filterTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <tab.icon className="size-3" />
              {tab.label}
              {tab.id === "joined" && rooms && (
                <span className="text-[10px]">({rooms.filter((r: any) => r.isMember).length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Room List */}
        <div className="space-y-2">
          {!rooms ? (
            <div className="text-center py-12 text-muted-foreground animate-pulse">جارٍ التحميل...</div>
          ) : filteredRooms.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="mx-auto size-12 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">
                  {filterTab === "joined" ? "لم تنضم لأي غرفة بعد" : "لا توجد غرف"}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">يمكن للمالك إنشاء غرف من لوحة التحكم</p>
              </CardContent>
            </Card>
          ) : (
            <AnimatePresence>
              {filteredRooms.map((room: any, i: number) => (
                <motion.div
                  key={room._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <RoomCard
                    room={room}
                    currentUserId={user._id}
                    onClick={() => setSelectedRoom(room._id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Create Room Button */}
        <div className="mt-6 text-center">
          <CreateRoomDialog />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ROOM CARD
// ═══════════════════════════════════════════════════════════════════════

function RoomCard({ room, currentUserId, onClick }: { room: any; currentUserId: string; onClick: () => void }) {
  const joinRoom = useMutation(api.chatRooms.joinRoom);
  const isMember = room.isMember;

  const handleJoin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await joinRoom({ roomId: room._id });
      toast.success("تم الانضمام للغرفة!");
      onClick();
    } catch (err: any) {
      toast.error(err.message || "فشل الانضمام");
    }
  };

  const typeLabel = room.type === "private" ? "🔒 خاصة" : room.type === "password" ? "🔑 بكلمة مرور" : room.type === "invite" ? "📨 بدعوة" : "🌍 عامة";

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 active:scale-[0.98]"
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xl shadow-md">
          💬
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm truncate">{room.name}</h3>
            {room.isOwner && <Crown className="size-3 text-yellow-500" />}
          </div>
          {room.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{room.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="size-3" /> {room.memberCount}
            </span>
            <span>{typeLabel}</span>
            {room.archived && <Badge variant="secondary" className="text-[9px] px-1.5">مؤرشفة</Badge>}
          </div>
        </div>
        {!isMember ? (
          <Button size="sm" onClick={handleJoin} className="shrink-0 rounded-xl gap-1">
            <UserPlus className="size-3.5" /> انضمام
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onClick} className="shrink-0 rounded-xl gap-1">
            <ArrowLeft className="size-3.5" /> دخول
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ROOM CHAT — Telegram-level
// ═══════════════════════════════════════════════════════════════════════

function RoomChat({ roomId, onBack, currentUserId }: { roomId: string; onBack: () => void; currentUserId: string }) {
  const messages = useQuery(api.chatRooms.getMessages, { roomId: roomId as any });
  const roomStats = useQuery(api.chatRooms.getRoomStats, { roomId: roomId as any });
  const sendMessage = useMutation(api.chatRooms.sendMessage);
  const toggleReaction = useMutation(api.chatRooms.toggleReaction);
  const togglePin = useMutation(api.chatRooms.togglePin);
  const deleteMessage = useMutation(api.chatRooms.deleteMessage);
  const muteMember = useMutation(api.chatRooms.muteMember);
  const kickMember = useMutation(api.chatRooms.kickMember);
  const leaveRoom = useMutation(api.chatRooms.leaveRoom);
  // موجّة 6.3 — صلاحيات العُريف
  const moderatorWarn = useMutation(api.chatAdvanced.moderatorWarn);
  const moderatorMute = useMutation(api.chatAdvanced.moderatorMute);
  const [warnTarget, setWarnTarget] = useState<{ id: string; name: string } | null>(null);
  void warnTarget; void setWarnTarget; // محجوز لتوسيع حوار التحذير المخصص
  const searchMessages = useQuery(
    api.chatRooms.searchMessages,
    { roomId: roomId as any, query: "" }
  );

  const [input, setInput] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replyTo, setReplyTo] = useState<any>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reportDialog, setReportDialog] = useState<{ targetId: string; targetName: string; messageContent?: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchResults = useQuery(
    api.chatRooms.searchMessages,
    searchQuery.length > 1 ? { roomId: roomId as any, query: searchQuery } : "skip"
  );

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  // Report dialog listener
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setReportDialog(detail);
    };
    window.addEventListener("open-report", handler);
    return () => window.removeEventListener("open-report", handler);
  }, []);

  // Filter messages
  const displayMessages = useMemo(() => {
    if (!messages) return [];
    return messages.filter((m: any) => !m.deleted || m.type === "system");
  }, [messages]);

  // Pinned message
  const pinnedMessage = useMemo(() => {
    return displayMessages.find((m: any) => m.pinned);
  }, [displayMessages]);

  // Group consecutive messages
  const groupedMessages = useMemo(() => {
    return displayMessages.map((msg: any, idx: number) => {
      const prev = idx > 0 ? displayMessages[idx - 1] : null;
      const isConsecutive = prev && prev.senderId === msg.senderId && (msg.createdAt - prev.createdAt) < 120000;
      return { ...msg, isConsecutive: !isConsecutive };
    });
  }, [displayMessages]);

  // Send message
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    try {
      await sendMessage({
        roomId: roomId as any,
        content: text,
        replyTo: replyTo?._id,
      });
      setInput("");
      setReplyTo(null);
      inputRef.current?.focus();
    } catch (err: any) {
      toast.error(err.message || "فشل الإرسال");
    }
  }, [input, roomId, replyTo, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Reactions
  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      await toggleReaction({ messageId, emoji });
      setShowEmojiPicker(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Pin
  const handlePin = async (messageId: string) => {
    try {
      await togglePin({ roomId: roomId as any, messageId });
      toast("تم تحديث التثبيت");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Delete
  const handleDelete = async (messageId: string) => {
    try {
      await deleteMessage({ messageId });
      toast("تم الحذف");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Copy
  const handleCopy = (text: string, msgId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    toast.success("تم النسخ");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Time formatting
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("ar", { month: "short", day: "numeric" }) + " " +
      d.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
  };

  // Count reactions from schema format: [{emoji, userId}]
  const getReactionCounts = (reactions: any[]): Record<string, { count: number; hasOwn: boolean }> => {
    if (!reactions || !Array.isArray(reactions)) return {};
    const counts: Record<string, { count: number; hasOwn: boolean }> = {};
    for (const r of reactions) {
      if (!counts[r.emoji]) counts[r.emoji] = { count: 0, hasOwn: false };
      counts[r.emoji].count++;
      if (r.userId === currentUserId) counts[r.emoji].hasOwn = true;
    }
    return counts;
  };

  return (
    <div className="h-screen flex flex-col bg-background" dir="rtl">
      {/* ── Chat Header ── */}
      <div className="shrink-0 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 z-10">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowRight className="size-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-sm truncate">💬 غرفة الدردشة</h2>
            <p className="text-[10px] text-muted-foreground">
              {displayMessages.length} رسالة
              {pinnedMessage && " · "}
              {pinnedMessage && <Pin className="inline size-2.5 text-yellow-500" />}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setShowSearch(!showSearch)} className="shrink-0">
            <Search className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowMembers(!showMembers)} className="shrink-0">
            <Users className="size-4" />
          </Button>
        </div>

        {/* Search Bar */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t"
            >
              <div className="px-4 py-2 flex gap-2">
                <Input
                  placeholder="بحث في الرسائل..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 rounded-xl text-sm flex-1"
                  autoFocus
                />
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => { setShowSearch(false); setSearchQuery(""); }}>
                  <X className="size-4" />
                </Button>
              </div>
              {/* Search Results */}
              {searchResults && searchResults.length > 0 && (
                <div className="border-t max-h-48 overflow-y-auto px-4 py-2 space-y-1">
                  <p className="text-[10px] text-muted-foreground mb-1">{searchResults.length} نتيجة</p>
                  {searchResults.slice(0, 10).map((r: any) => (
                    <div key={r._id} className="rounded-lg bg-muted/50 p-2 text-xs">
                      <span className="font-medium text-primary">{r.senderName}</span>
                      <span className="mx-1 text-muted-foreground">·</span>
                      <span>{r.content}</span>
                      <span className="mr-2 text-[9px] text-muted-foreground">{formatTime(r.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pinned Message Banner */}
        {pinnedMessage && !showSearch && (
          <div className="border-t bg-yellow-500/5 px-4 py-2 cursor-pointer hover:bg-yellow-500/10 transition-colors">
            <div className="flex items-center gap-2 text-xs text-yellow-600">
              <Pin className="size-3 shrink-0" />
              <span className="font-medium shrink-0">مثبتة:</span>
              <span className="truncate">{pinnedMessage.content}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Messages Area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 relative">
        <div className="mx-auto max-w-4xl space-y-0.5">
          {groupedMessages.length === 0 ? (
            <div className="py-16 text-center">
              <MessageSquare className="mx-auto size-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "لا توجد نتائج" : "لا توجد رسائل بعد — كن أول من يرسل!"}
              </p>
            </div>
          ) : (
            groupedMessages.map((msg: any) => {
              const isOwn = msg.senderId === currentUserId;
              const isSystem = msg.type === "system";
              const reactions = getReactionCounts(msg.reactions);

              if (isSystem) {
                return (
                  <div key={msg._id} className="flex justify-center my-2">
                    <span className="text-[10px] text-muted-foreground bg-muted/50 rounded-full px-3 py-1">
                      {msg.content}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={msg._id}
                  className={`flex ${isOwn ? "justify-end" : "justify-start"} ${msg.isConsecutive ? "mt-3" : "mt-0.5"}`}
                >
                  <div className="group relative max-w-[80%]">
                    {/* Message bubble */}
                    <div
                      className={`relative px-4 py-2.5 shadow-sm ${
                        isOwn
                          ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md"
                          : "bg-muted rounded-2xl rounded-bl-md"
                      }`}
                    >
                      {/* Sender name */}
                      {msg.isConsecutive && !isOwn && (
                        <p className="text-[10px] font-bold text-primary mb-0.5">{msg.senderName}</p>
                      )}

                      {/* Reply reference */}
                      {msg.replyTo && (
                        <div className={`text-[10px] mb-1 pb-1 border-b ${isOwn ? "border-primary-foreground/20" : "border-border"}`}>
                          <span className="opacity-60">↩ رد على رسالة سابقة</span>
                        </div>
                      )}

                      {/* Pinned indicator */}
                      {msg.pinned && (
                        <div className="flex items-center gap-1 text-[9px] text-yellow-500 mb-1">
                          <Pin className="size-2.5" /> مثبتة
                        </div>
                      )}

                      {/* Content */}
                      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{msg.content}</p>

                      {/* Time + status */}
                      <div className={`flex items-center gap-1.5 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                        <span className={`text-[9px] ${isOwn ? "text-primary-foreground/50" : "text-muted-foreground"}`}>
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Reactions display */}
                    {Object.keys(reactions).length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-0.5 ${isOwn ? "justify-end" : "justify-start"}`}>
                        {Object.entries(reactions).map(([emoji, data]) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(msg._id, emoji)}
                            className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] transition-all hover:scale-110 ${
                              data.hasOwn
                                ? "bg-primary/20 border border-primary/30"
                                : "bg-muted border border-border/50"
                            }`}
                          >
                            {emoji} <span className="text-[9px] font-medium">{data.count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Hover action bar */}
                    <div className="absolute -top-9 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-0.5 rounded-xl border bg-card px-1 py-0.5 shadow-lg z-30">
                      {/* Emoji reactions */}
                      {EMOJI_REACTIONS.slice(0, 4).map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(msg._id, emoji)}
                          className="size-7 flex items-center justify-center rounded-lg hover:bg-muted text-sm transition-transform hover:scale-125"
                        >
                          {emoji}
                        </button>
                      ))}
                      {/* More reactions */}
                      <button
                        onClick={() => setShowEmojiPicker(showEmojiPicker === msg._id ? null : msg._id)}
                        className="size-7 flex items-center justify-center rounded-lg hover:bg-muted text-xs text-muted-foreground"
                      >
                        +
                      </button>
                      <div className="w-px h-5 bg-border mx-0.5" />
                      {/* Reply */}
                      <button
                        onClick={() => setReplyTo(msg)}
                        className="size-7 flex items-center justify-center rounded-lg hover:bg-muted"
                        title="رد"
                      >
                        <Reply className="size-3.5" />
                      </button>
                      {/* Copy */}
                      <button
                        onClick={() => handleCopy(msg.content, msg._id)}
                        className="size-7 flex items-center justify-center rounded-lg hover:bg-muted"
                        title="نسخ"
                      >
                        {copiedId === msg._id ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
                      </button>
                      {/* Pin */}
                      <button
                        onClick={() => handlePin(msg._id)}
                        className="size-7 flex items-center justify-center rounded-lg hover:bg-muted"
                        title={msg.pinned ? "إلغاء التثبيت" : "تثبيت"}
                      >
                        <Pin className={`size-3.5 ${msg.pinned ? "text-yellow-500" : ""}`} />
                      </button>
                      {/* Report */}
                      {!isOwn && (
                        <button
                          onClick={() => window.dispatchEvent(new CustomEvent("open-report", { detail: { targetId: msg.senderId, targetName: msg.senderName, messageId: msg._id, messageContent: msg.content } }))}
                          className="size-7 flex items-center justify-center rounded-lg hover:bg-orange-100 text-orange-500"
                          title="إبلاغ"
                        >
                          <Flag className="size-3.5" />
                        </button>
                      )}
                      {/* أدوات العُريف (موجّة 6.3): تحذير / كتم سريع */}
                      {!isOwn && roomStats?.isModerator && (
                        <>
                          <button
                            onClick={async () => {
                              try {
                                const reason = window.prompt("سبب التحذير:") || "مخالفة قوانين الغرفة";
                                await moderatorWarn({ roomId: roomId as any, targetUserId: msg.senderId, reason });
                                toast.success(`تم تحذير ${msg.senderName}`);
                              } catch (err: any) {
                                toast.error(err.message || "تعذّر التحذير");
                              }
                            }}
                            className="size-7 flex items-center justify-center rounded-lg hover:bg-amber-100 text-amber-600"
                            title="تحذير كعُريف"
                          >
                            ⚠️
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const r = await moderatorMute({ roomId: roomId as any, targetUserId: msg.senderId, minutes: 15, reason: "كتم سريع من العُريف" });
                                toast.success(`تم كتم ${msg.senderName} لمدة ${r.minutes} دقيقة`);
                              } catch (err: any) {
                                toast.error(err.message || "تعذّر الكتم");
                              }
                            }}
                            className="size-7 flex items-center justify-center rounded-lg hover:bg-sky-100 text-sky-600"
                            title="كتم 15 دقيقة كعُريف"
                          >
                            🔇
                          </button>
                        </>
                      )}
                      {/* Delete (own or admin) */}
                      {(isOwn || true) && (
                        <button
                          onClick={() => handleDelete(msg._id)}
                          className="size-7 flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500"
                          title="حذف"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Extended emoji picker */}
                    {showEmojiPicker === msg._id && (
                      <div className="absolute -top-16 left-0 bg-card border rounded-xl shadow-xl p-2 flex gap-1 z-40">
                        {EMOJI_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(msg._id, emoji)}
                            className="size-8 flex items-center justify-center rounded-lg hover:bg-muted text-lg transition-transform hover:scale-125"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Room Settings Panel (slide from right) ── */}
      <AnimatePresence>
        {showMembers && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute inset-y-0 left-0 z-20 w-80 max-w-full border-r bg-card shadow-xl overflow-y-auto"
            dir="rtl"
          >
            <div className="sticky top-0 bg-card/95 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
              <h3 className="font-bold text-sm">⚙️ إعدادات الغرفة</h3>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setShowMembers(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="p-4 space-y-4">
              {/* Room Stats */}
              {roomStats && (
                <div className="rounded-xl bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-bold text-muted-foreground">📊 إحصائيات</p>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div><p className="text-lg font-bold text-primary">{roomStats.totalMessages}</p><p className="text-[10px] text-muted-foreground">رسالة</p></div>
                    <div><p className="text-lg font-bold text-emerald-600">{roomStats.memberCount}</p><p className="text-[10px] text-muted-foreground">عضو</p></div>
                    <div><p className="text-lg font-bold text-amber-600">{roomStats.todayMessages}</p><p className="text-[10px] text-muted-foreground">اليوم</p></div>
                    <div><p className="text-lg font-bold text-purple-600">{roomStats.pinnedCount}</p><p className="text-[10px] text-muted-foreground">مثبتة</p></div>
                  </div>
                </div>
              )}
              {/* Top Senders */}
              {roomStats && roomStats.topSenders.length > 0 && (
                <div className="rounded-xl bg-muted/30 p-3">
                  <p className="text-xs font-bold text-muted-foreground mb-2">🏆 الأكثر نشاطاً</p>
                  <div className="space-y-1.5">
                    {roomStats.topSenders.map((s: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">{i + 1}.</span>
                          <span className="font-medium">{s.name}</span>
                        </div>
                        <Badge variant="outline" className="text-[9px] rounded-full">{s.count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Admin Tools */}
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="text-xs font-bold text-muted-foreground mb-2">🛠️ أدوات الإدارة</p>
                <p className="text-[10px] text-muted-foreground">اضغط على اسم عضو في الرسائل لإدارة صلاحياته</p>
                {roomStats?.isModerator && (
                  <p className="mt-2 rounded-lg bg-amber-500/10 px-2 py-1.5 text-[10px] font-semibold text-amber-700">
                    ⭐ أنت عُريف هذه الغرفة — لديك أزرار تحذير ⚠️ وكتم 🔇 على رسائل الأعضاء.
                  </p>
                )}
              </div>
              {/* Leave Room */}
              <button
                onClick={async () => {
                  try {
                    await leaveRoom({ roomId: roomId as any });
                    toast.success("تم مغادرة الغرفة");
                    onBack();
                  } catch (err: any) {
                    toast.error(err.message || "فشل المغادرة");
                  }
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="size-4" />
                مغادرة الغرفة
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Reply Preview ── */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="shrink-0 overflow-hidden border-t bg-primary/5"
          >
            <div className="mx-auto max-w-4xl flex items-center gap-2 px-4 py-2">
              <Reply className="size-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium text-primary">رد على {replyTo.senderName}</p>
                <p className="text-xs text-muted-foreground truncate">{replyTo.content}</p>
              </div>
              <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => setReplyTo(null)}>
                <X className="size-3" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input Area ── */}
      <div className="shrink-0 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-3">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={replyTo ? `رد على ${replyTo.senderName}...` : "اكتب رسالتك هنا..."}
            className="flex-1 h-11 rounded-2xl text-sm"
            dir="rtl"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim()}
            size="icon"
            className="h-11 w-11 rounded-2xl shrink-0 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md"
          >
            <Send className="size-5" />
          </Button>
        </div>
      </div>

      {/* Report Dialog */}
      {reportDialog && (
        <ReportDialog
          targetId={reportDialog.targetId}
          targetName={reportDialog.targetName}
          messageContent={reportDialog.messageContent}
          onClose={() => setReportDialog(null)}
        />
      )}
    </div>
  );
}

// Report Dialog - triggered via custom event
// Create Room Dialog
function CreateRoomDialog() {
  const createRoom = useMutation(api.chatRooms.createRoom);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState<"public" | "private" | "password">("public");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("أدخل اسم الغرفة"); return; }
    setBusy(true);
    try {
      const result = await createRoom({ name: name.trim(), description: desc.trim() || undefined, type });
      toast.success(`تم إنشاء غرفة "${name}" بنجاح!`);
      setOpen(false);
      setName("");
      setDesc("");
    } catch (err: any) {
      toast.error(err.message || "فشل الإنشاء");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="rounded-xl gap-2">
        <span className="text-lg">+</span> إنشاء غرفة جديدة
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" dir="rtl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md mx-4 bg-card rounded-2xl border shadow-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">إنشاء غرفة جديدة</h3>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setOpen(false)}><X className="size-4" /></Button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">اسم الغرفة *</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: غرفة المعرفة" className="mt-1 rounded-xl" maxLength={30} dir="rtl" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">الوصف (اختياري)</label>
                <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="وصف مختصر للغرفة" className="mt-1 rounded-xl" maxLength={100} dir="rtl" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">نوع الغرفة</label>
                <div className="flex gap-2 mt-1">
                  {[{ v: "public" as const, l: "🌍 عامة" }, { v: "private" as const, l: "🔒 خاصة" }, { v: "password" as const, l: "🔑 بكلمة مرور" }].map((opt) => (
                    <button
                      key={opt.v}
                      onClick={() => setType(opt.v)}
                      className={`flex-1 rounded-xl border p-2 text-xs font-medium transition-all ${type === opt.v ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                    >{opt.l}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)} className="flex-1 rounded-xl">إلغاء</Button>
                <Button onClick={handleCreate} disabled={!name.trim() || busy} className="flex-1 rounded-xl">
                  {busy ? "جارٍ الإنشاء..." : "إنشاء"}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}

const REPORT_CATEGORIES = [
  { id: "spam", name: "سبام", icon: "📢" },
  { id: "abuse", name: "إساءة", icon: "🤬" },
  { id: "harassment", name: "تنمر", icon: "😈" },
  { id: "cheating", name: "غش", icon: "🚫" },
  { id: "inappropriate", name: "محتوى غير لائق", icon: "⛔" },
  { id: "threat", name: "تهديد", icon: "⚠️" },
  { id: "other", name: "أخرى", icon: "📝" },
];

function ReportDialog({
  targetId,
  targetName,
  messageContent,
  onClose,
}: {
  targetId: string;
  targetName: string;
  messageContent?: string;
  onClose: () => void;
}) {
  const submitReport = useMutation(api.reportsSmart.submitReport);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!reason) { toast.error("اختر سبب البلاغ"); return; }
    setBusy(true);
    try {
      await submitReport({
        targetUserId: targetId,
        targetName,
        category: reason,
        reason: details || (REPORT_CATEGORIES.find((c) => c.id === reason)?.name ?? reason),
        details: messageContent ? `الرسالة المبلّغ عنها: ${messageContent}` : undefined,
      });
      toast.success("تم إرسال البلاغ بنجاح");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "فشل الإرسال");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md mx-4 bg-card rounded-2xl border shadow-xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flag className="size-5 text-orange-500" />
            <h3 className="font-bold">إبلاغ عن {targetName}</h3>
          </div>
          <Button variant="ghost" size="icon" className="size-7" onClick={onClose}><X className="size-4" /></Button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {REPORT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setReason(cat.id)}
                className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-medium transition-all text-right ${
                  reason === cat.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                }`}
              >
                <span className="text-lg">{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="تفاصيل إضافية (اختياري)..."
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm resize-none h-20"
            dir="rtl"
          />
          {messageContent && (
            <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
              <span className="font-medium">الرسالة:</span> {messageContent.slice(0, 100)}{messageContent.length > 100 ? "..." : ""}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">إلغاء</Button>
            <Button
              onClick={handleSubmit}
              disabled={!reason || busy}
              className="flex-1 rounded-xl bg-orange-500 hover:bg-orange-600 text-white"
            >
              {busy ? "جارٍ الإرسال..." : "إرسال البلاغ"}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
