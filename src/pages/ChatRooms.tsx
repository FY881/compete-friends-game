import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Send, Search, Pin, Hash, Users, ArrowRight,
  MessageSquare, Crown, ArrowLeft,
  Trash2, Reply, Copy, UserPlus,
} from "lucide-react";

const EMOJI_REACTIONS = ["👍", "❤️", "😂", "😮", "🔥", "💯"];

export default function ChatRooms() {
  const { user } = useAuth();
  const rooms = useQuery(api.chatRooms.getRooms);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);

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
        roomKey={selectedRoom}
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
          <div>
            <h1 className="text-2xl font-bold">غرف الدردشة</h1>
            <p className="text-sm text-muted-foreground">تفاعل مع المجتمع في الوقت الفعلي</p>
          </div>
        </div>

        {/* Room List */}
        <div className="space-y-3">
          {!rooms ? (
            <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>
          ) : rooms.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="mx-auto size-12 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">لا توجد غرف دردشة متاحة حالياً</p>
                <p className="text-xs text-muted-foreground/60 mt-1">يمكن للمالك إنشاء غرف من لوحة التحكم</p>
              </CardContent>
            </Card>
          ) : (
            rooms.map((room: any) => (
              <RoomCard
                key={room.id}
                room={room}
                currentUserId={user._id}
                onClick={() => setSelectedRoom(room.key)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Room Card Component
// ═══════════════════════════════════════════════════════════════

function RoomCard({
  room,
  currentUserId,
  onClick,
}: {
  room: any;
  currentUserId: string;
  onClick: () => void;
}) {
  const joinRoom = useMutation(api.chatRooms.joinRoom);
  const isJoined = room.members?.includes(currentUserId);

  const handleJoin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await joinRoom({ roomKey: room.key });
      toast("تم الانضمام للغرفة!");
      onClick();
    } catch (err: any) {
      toast.error(err.message || "فشل الانضمام");
    }
  };

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
            {room.password && <span className="text-xs">🔒</span>}
            {room.isPrivate && <Crown className="size-3 text-yellow-500" />}
          </div>
          {room.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{room.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="size-3" /> {room.members?.length ?? 0}
            </span>
            <span>{room.isPrivate ? " خاصة" : " عامة"}</span>
          </div>
        </div>
        {!isJoined ? (
          <Button size="sm" onClick={handleJoin} className="shrink-0 rounded-xl">
            <UserPlus className="size-3.5" /> انضمام
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onClick} className="shrink-0 rounded-xl">
            <ArrowLeft className="size-3.5" /> دخول
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// Room Chat Component (WhatsApp-style)
// ═══════════════════════════════════════════════════════════════

function RoomChat({
  roomKey,
  onBack,
  currentUserId,
}: {
  roomKey: string;
  onBack: () => void;
  currentUserId: string;
}) {
  const messages = useQuery(api.chatRooms.getRoomMessages, { roomKey });
  const sendMessage = useMutation(api.chatRooms.sendMessage);
  const addReaction = useMutation(api.chatRooms.addReaction);
  const togglePin = useMutation(api.chatRooms.togglePinMessage);
  const deleteMessage = useMutation(api.chatRooms.deleteMessage);

  const [input, setInput] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replyTo, setReplyTo] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredMessages = useMemo(() => {
    if (!messages) return [];
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter((m: any) => m.content?.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  const pinnedMessages = useMemo(
    () => filteredMessages.filter((m: any) => m.isPinned),
    [filteredMessages]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filteredMessages.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    try {
      await sendMessage({
        roomKey,
        content: text,
        type: "text",
        replyTo: replyTo?.id,
      });
      setInput("");
      setReplyTo(null);
      inputRef.current?.focus();
    } catch (err: any) {
      toast.error(err.message || "فشل الإرسال");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      await addReaction({ messageId: messageId as any, emoji });
    } catch {}
  };

  const handlePin = async (messageId: string, currentlyPinned: boolean) => {
    try {
      await togglePin({ messageId: messageId as any, pinned: !currentlyPinned });
      toast(currentlyPinned ? "تم إلغاء التثبيت" : "تم التثبيت");
    } catch {}
  };

  const handleDelete = async (messageId: string) => {
    try {
      await deleteMessage({ messageId: messageId as any });
      toast("تم الحذف");
    } catch {}
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  };

  // Count reactions per emoji
  const countReactions = (reactions: any): Record<string, number> => {
    if (!reactions) return {};
    const counts: Record<string, number> = {};
    for (const [emoji, users] of Object.entries(reactions)) {
      if (Array.isArray(users)) {
        counts[emoji] = users.length;
      }
    }
    return counts;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* Chat Header */}
      <div className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowRight className="size-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-sm truncate">💬 غرفة الدردشة</h2>
            <p className="text-[10px] text-muted-foreground">
              {filteredMessages.length} رسالة
              {pinnedMessages.length > 0 && ` · ${pinnedMessages.length} مثبتة`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSearch(!showSearch)}
            className="shrink-0"
          >
            <Search className="size-4" />
          </Button>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="border-t px-4 py-2">
            <Input
              placeholder="بحث في الرسائل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 rounded-xl text-sm"
              autoFocus
            />
          </div>
        )}

        {/* Pinned Messages */}
        {pinnedMessages.length > 0 && !showSearch && (
          <div className="border-t bg-yellow-500/5 px-4 py-2">
            <div className="flex items-center gap-2 text-xs text-yellow-600">
              <Pin className="size-3" />
              <span className="font-medium">رسالة مثبتة:</span>
              <span className="truncate">{pinnedMessages[0].content}</span>
            </div>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-4xl space-y-1">
          {filteredMessages.length === 0 ? (
            <div className="py-16 text-center">
              <MessageSquare className="mx-auto size-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "لا توجد نتائج" : "لا توجد رسائل بعد — كن أول من يرسل!"}
              </p>
            </div>
          ) : (
            filteredMessages.map((msg: any, idx: number) => {
              const isOwn = msg.senderId === currentUserId;
              const showAvatar =
                idx === 0 || filteredMessages[idx - 1]?.senderId !== msg.senderId;
              const isConsecutive =
                idx > 0 && filteredMessages[idx - 1]?.senderId === msg.senderId;
              const reactionCounts = countReactions(msg.reactions);

              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwn ? "justify-end" : "justify-start"} ${isConsecutive ? "mt-0.5" : "mt-3"}`}
                >
                  <div
                    className={`group relative max-w-[80%] ${
                      isOwn
                        ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md"
                        : "bg-muted rounded-2xl rounded-bl-md"
                    } px-4 py-2.5 shadow-sm`}
                  >
                    {/* Sender name */}
                    {showAvatar && !isOwn && (
                      <p className="text-[10px] font-bold text-primary mb-1">
                        {msg.senderName ?? "مستخدم"}
                      </p>
                    )}

                    {/* Reply reference */}
                    {msg.replyTo && (
                      <div className={`text-[10px] mb-1 pb-1 border-b ${isOwn ? "border-primary-foreground/20" : "border-border"}`}>
                        <span className="opacity-60">↩ رد على:</span>{" "}
                        <span className="opacity-80">رسالة سابقة</span>
                      </div>
                    )}

                    {/* Message content */}
                    <p className="text-sm leading-relaxed break-words">{msg.content}</p>

                    {/* Time + pin */}
                    <div className={`flex items-center gap-2 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                      {msg.isPinned && <Pin className="size-2.5 text-yellow-500" />}
                      <span className={`text-[9px] ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>

                    {/* Reactions */}
                    {Object.keys(reactionCounts).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(reactionCounts).map(([emoji, count]) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(msg.id, emoji)}
                            className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                              isOwn ? "bg-primary-foreground/10" : "bg-border/50"
                            } hover:scale-110 transition-transform`}
                          >
                            {emoji} <span className="text-[9px]">{count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Hover actions */}
                    <div className="absolute -top-8 left-0 hidden group-hover:flex items-center gap-0.5 rounded-lg border bg-card p-0.5 shadow-md z-20">
                      {EMOJI_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(msg.id, emoji)}
                          className="size-6 flex items-center justify-center rounded hover:bg-muted text-sm transition-transform hover:scale-125"
                        >
                          {emoji}
                        </button>
                      ))}
                      <div className="w-px h-4 bg-border mx-0.5" />
                      <button
                        onClick={() => setReplyTo(msg)}
                        className="size-6 flex items-center justify-center rounded hover:bg-muted"
                        title="رد"
                      >
                        <Reply className="size-3" />
                      </button>
                      <button
                        onClick={() => handlePin(msg.id, msg.isPinned)}
                        className="size-6 flex items-center justify-center rounded hover:bg-muted"
                        title="تثبيت"
                      >
                        <Pin className="size-3" />
                      </button>
                      {isOwn && (
                        <button
                          onClick={() => handleDelete(msg.id)}
                          className="size-6 flex items-center justify-center rounded hover:bg-red-100 text-red-500"
                          title="حذف"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Reply Preview */}
      {replyTo && (
        <div className="border-t bg-muted/30 px-4 py-2">
          <div className="mx-auto max-w-4xl flex items-center gap-2">
            <Reply className="size-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium text-primary">رد على {replyTo.senderName}</p>
              <p className="text-xs text-muted-foreground truncate">{replyTo.content}</p>
            </div>
            <Button variant="ghost" size="icon" className="size-6" onClick={() => setReplyTo(null)}>
              <Trash2 className="size-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="sticky bottom-0 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-3">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب رسالتك هنا..."
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
    </div>
  );
}
