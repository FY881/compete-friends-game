import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Users, Shield, Lock, Send, Ban, Key, Eye, UserCog, MessageSquare,
  Database, Settings, Crown, AlertTriangle, Wifi, WifiOff, Clock,
  Trash2, Undo2, Star, Gift, Swords, Target, Trophy, Zap,
  Search, Plus, Copy, Check, ChevronDown, ChevronUp, Radio,
  ShieldCheck, Skull, UserMinus, UserPlus, RefreshCw, Activity,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// المكون الرئيسي — لوحة التحكم الشاملة للمالك
// ═══════════════════════════════════════════════════════════════
export function OwnerControlPanel() {
  const [subTab, setSubTab] = useState<string>("players");

  const tabs = [
    { id: "players", label: "اللاعبون", icon: <Users className="size-4" /> },
    { id: "power20", label: "20 صلاحية", icon: <Crown className="size-4" /> },
    { id: "memberships", label: "العضويات", icon: <Key className="size-4" /> },
    { id: "chat", label: "الغرف", icon: <MessageSquare className="size-4" /> },
    { id: "rules", label: "القوانين", icon: <Shield className="size-4" /> },
    { id: "reports", label: "البلاغات+", icon: <AlertTriangle className="size-4" /> },
    { id: "duels", label: "1v1", icon: <Swords className="size-4" /> },
    { id: "goals", label: "التحديات", icon: <Target className="size-4" /> },
    { id: "seasons", label: "المواسم", icon: <Trophy className="size-4" /> },
    { id: "gifts", label: "الهدايا", icon: <Gift className="size-4" /> },
    { id: "apikeys", label: "مفاتيح API", icon: <Zap className="size-4" /> },
    { id: "activity", label: "السجل", icon: <Activity className="size-4" /> },
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-1.5 min-w-max">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                subTab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        {subTab === "players" && <PlayersControl />}
        {subTab === "power20" && <Power20Features />}
        {subTab === "memberships" && <MembershipsControl />}
        {subTab === "chat" && <ChatRoomsControl />}
        {subTab === "rules" && <OnlineRulesControl />}
        {subTab === "reports" && <AdvancedReports />}
        {subTab === "duels" && <DuelsPanel />}
        {subTab === "goals" && <GoalsPanel />}
        {subTab === "seasons" && <SeasonsPanel />}
        {subTab === "gifts" && <GiftsPanel />}
        {subTab === "apikeys" && <ApiKeysPanel />}
        {subTab === "activity" && <ActivityLog />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// التحكم باللاعبين
// ═══════════════════════════════════════════════════════════════
function PlayersControl() {
  const players = useQuery(api.playerControl.getAllPlayersBrief);
  const bulkAction = useMutation(api.playerControl.bulkAction);
  const freezeAccount = useMutation(api.playerControl.freezeAccount);
  const editPlayer = useMutation(api.playerControl.editPlayerData);
  const resetProgress = useMutation(api.playerControl.resetPlayerProgress);
  const clearCache = useMutation(api.playerControl.clearPlayerCache);
  const sendNotif = useMutation(api.playerControl.sendNotification);
  const monitorPlayer = useMutation(api.playerControl.monitorPlayer as any);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [notifTarget, setNotifTarget] = useState("__all__");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  if (!players) return <div className="p-4 text-muted-foreground">جارٍ التحميل...</div>;

  const filtered = players.filter(
    (p) => p.name.includes(search) || p.email?.includes(search),
  );

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  return (
    <div className="space-y-4">
      {/* بحث + إجراءات جماعية */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="size-4" />
            لوحة تحكم اللاعبين ({players.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="بحث بالاسم أو الإيميل..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
          </div>
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2 p-2 bg-muted rounded-lg">
              <span className="text-xs font-medium">{selected.length} محدد</span>
              <Button size="sm" variant="destructive" onClick={() => { bulkAction({ userIds: selected as any, action: "warn" }); toast("تم التحذير"); }}>
                <AlertTriangle className="size-3" /> تحذير
              </Button>
              <Button size="sm" variant="destructive" onClick={() => { bulkAction({ userIds: selected as any, action: "mute" }); toast("تم الكتم"); }}>
                <Ban className="size-3" /> كتم
              </Button>
              <Button size="sm" variant="destructive" onClick={() => { bulkAction({ userIds: selected as any, action: "ban" }); toast("تم الحظر"); }}>
                <Ban className="size-3" /> حظر
              </Button>
              <Button size="sm" variant="outline" onClick={() => { bulkAction({ userIds: selected as any, action: "pardon" }); toast("تم العفو"); }}>
                <ShieldCheck className="size-3" /> عفو
              </Button>
              <Button size="sm" variant="outline" onClick={() => { bulkAction({ userIds: selected as any, action: "reset_warnings" }); toast("تمت إعادة الضبط"); }}>
                <RefreshCw className="size-3" /> إعادة ضبط
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* قائمة اللاعبين */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {filtered.map((p) => (
          <Card key={p.id} className="overflow-hidden">
            <div
              className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
              onClick={() => toggle(p.id)}
            >
              <input
                type="checkbox"
                checked={selected.includes(p.id)}
                onChange={() => toggle(p.id)}
                onClick={(e) => e.stopPropagation()}
                className="size-4"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{p.name}</span>
                  {p.banned && <Badge variant="destructive" className="text-[10px]">محظور</Badge>}
                  {p.role === "admin" && <Badge className="text-[10px]">مدير</Badge>}
                  {p.warnings > 0 && <Badge variant="secondary" className="text-[10px]">{p.warnings} تحذير</Badge>}
                  {p.cheatStrikes > 0 && <Badge variant="destructive" className="text-[10px]">{p.cheatStrikes} غش</Badge>}
                </div>
                <span className="text-xs text-muted-foreground truncate block">{p.email}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); setExpandedPlayer(expandedPlayer === p.id ? null : p.id); }}
              >
                {expandedPlayer === p.id ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </Button>
            </div>
            {expandedPlayer === p.id && (
              <div className="border-t p-3 space-y-2 bg-muted/30">
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => { editPlayer({ userId: p.id as any, name: "محظور" }); toast("تم"); }}>تعديل الاسم</Button>
                  <Button size="sm" variant="outline" onClick={() => { clearCache({ userId: p.id as any }); toast("تم مسح الكاش"); }}>مسح الكاش</Button>
                  <Button size="sm" variant="destructive" onClick={() => { resetProgress({ userId: p.id as any }); toast("تمت إعادة الضبط"); }}>إعادة ضبط</Button>
                  <Button size="sm" variant="destructive" onClick={() => { freezeAccount({ userId: p.id as any, duration: "24h", reason: "تجميد من المالك" }); toast("تم التجميد 24 ساعة"); }}>تجميد 24 ساعة</Button>
                  <Button size="sm" variant="destructive" onClick={() => { freezeAccount({ userId: p.id as any, duration: "permanent", reason: "حظر دائم" }); toast("تم الحظر الدائم"); }}>حظر دائم</Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* إرسال إشعار */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Send className="size-4" /> إرسال إشعار
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <select value={notifTarget} onChange={(e) => setNotifTarget(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-sm">
              <option value="__all__">جميع اللاعبين</option>
              {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <Input placeholder="العنوان" value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} className="flex-1" />
          </div>
          <Textarea placeholder="الرسالة" value={notifBody} onChange={(e) => setNotifBody(e.target.value)} rows={2} />
          <Button size="sm" onClick={() => {
            if (notifTitle && notifBody) {
              sendNotif({ userId: notifTarget as any, title: notifTitle, body: notifBody, type: "system" });
              toast("تم إرسال الإشعار");
              setNotifTitle(""); setNotifBody("");
            }
          }}>
            <Send className="size-3" /> إرسال
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 20 ميزة تحكم قوية
// ═══════════════════════════════════════════════════════════════
function Power20Features() {
  const toggleMaintenance = useMutation(api.playerControl.toggleMaintenance);
  const toggleSync = useMutation(api.playerControl.toggleSync);
  const totalControl = useMutation(api.playerControl.totalControl);
  const createToken = useMutation(api.playerControl.createPermissionToken);
  const createBackup = useMutation(api.playerControl.backupPlayer);

  const [confirmCode, setConfirmCode] = useState("");
  const [tokenPerm, setTokenPerm] = useState("");

  const features = [
    { num: 1, name: "التحكم بالحالة (أونلاين/أوفلاين)", desc: "تجميد أو تفعيل أي لاعب فوراً", icon: <Wifi /> },
    { num: 2, name: "قفل/فتح الأقسام", desc: "قفل أي قسم عن بُعد", icon: <Lock /> },
    { num: 3, name: "مسح الكاش", desc: "مسح البيانات المؤقتة لأي لاعب", icon: <Database /> },
    { num: 4, name: "إرسال إشعار فوري", desc: "إجباري لكل اللاعبين", icon: <Send /> },
    { num: 5, name: "تجميد الحساب", desc: "مؤقت أو دائم مع رسالة", icon: <Ban /> },
    { num: 6, name: "منح/سحب الصلاحيات", desc: " badges, XP, أدوار", icon: <Star /> },
    { num: 7, name: "مراقبة نشاط حي", desc: "تتبع أي لاعب لحظياً", icon: <Eye /> },
    { num: 8, name: "تعديل البيانات", desc: "مستوى، نقاط، تقدم", icon: <UserCog /> },
    { num: 9, name: "إنشاء/حذف غرف", desc: "rooms + تحديات + إعدادات", icon: <MessageSquare /> },
    { num: 10, name: "التحكم بالمزامنة", desc: "إجبار أو إيقاف sync", icon: <RefreshCw /> },
    { num: 11, name: "وضع الصيانة", desc: "صيانة عامة أو جزئية", icon: <Settings /> },
    { num: 12, name: "أوامر تنفيذية", desc: "تحديث، تسجيل خروج، إعادة", icon: <Zap /> },
    { num: 13, name: "إدارة المحتوى الأوفلاين", desc: "أسئلة + مراحل", icon: <Database /> },
    { num: 14, name: "نظام الاستثناءات", desc: "تجاوز مؤقت للقيود", icon: <Shield /> },
    { num: 15, name: "لوحة تحكم سريعة", desc: "جميع اللاعبين + إجراءات جماعية", icon: <Users /> },
    { num: 16, name: "حقن رسالة نظام", desc: "داخل واجهة أي لاعب", icon: <MessageSquare /> },
    { num: 17, name: "التحكم بالتخزين", desc: "مسح تقدم أي لاعب", icon: <Trash2 /> },
    { num: 18, name: "رموز صلاحيات مؤقتة", desc: "أو دائمة بصلاحيات مخصصة", icon: <Key /> },
    { num: 19, name: "نسخ احتياطي واستعادة", desc: "بيانات أي لاعب عن بُعد", icon: <Database /> },
    { num: 20, name: "السيطرة الكلية", desc: "زر واحد يفتح كل الصلاحيات", icon: <Crown /> },
  ];

  return (
    <div className="space-y-4">
      <Card className="border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-primary">
            <Crown className="size-4" /> 20 ميزة تحكم قوية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {features.map((f) => (
              <div key={f.num} className="flex items-start gap-2 rounded-lg border p-2.5 hover:bg-muted/50 transition-colors">
                <div className="flex size-6 shrink-0 items-center justify-center rounded bg-primary/10 text-primary text-xs font-bold">
                  {f.num}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium">{f.name}</p>
                  <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* إجراءات سريعة */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs">وضع الصيانة</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button size="sm" variant="destructive" onClick={() => { toggleMaintenance({ active: true, message: "التطبيق في وضع الصيانة" }); toast("تم تفعيل الصيانة"); }}>تفعيل الصيانة</Button>
            <Button size="sm" variant="outline" onClick={() => { toggleMaintenance({ active: false }); toast("تم إيقاف الصيانة"); }}>إيقاف الصيانة</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs">المزامنة</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button size="sm" onClick={() => { toggleSync({ enabled: true }); toast("تم تفعيل المزامنة"); }}>تفعيل</Button>
            <Button size="sm" variant="outline" onClick={() => { toggleSync({ enabled: false }); toast("تم إيقاف المزامنة"); }}>إيقاف</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs">�صلاحيات مؤقتة</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="الصلاحيات (مفصولة بفاصلة)" value={tokenPerm} onChange={(e) => setTokenPerm(e.target.value)} className="text-xs" />
            <Button size="sm" onClick={() => { if (tokenPerm) { createToken({ userId: "temporary" as any, permissions: tokenPerm.split(","), permanent: false, durationHours: 24 }); toast("تم إنشاء التوكن"); } }}>إنشاء توكن</Button>
          </CardContent>
        </Card>
        <Card className="border-red-500/30">
          <CardHeader className="pb-2"><CardTitle className="text-xs text-red-600">السيطرة الكلية</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="كود التأكيد" value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} className="text-xs" />
            <Button size="sm" variant="destructive" onClick={() => { totalControl({ confirmationCode: confirmCode }); toast("تم تفعيل السيطرة الكلية"); }}>تفعيل السيطرة</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// العضويات
// ═══════════════════════════════════════════════════════════════
function MembershipsControl() {
  const createCode = useMutation(api.playerControl.createMembershipCode);
  const codes = useQuery(api.playerControl.getAllMembershipCodes);
  const [tier, setTier] = useState<"bronze" | "silver" | "gold" | "diamond" | "exclusive">("silver");
  const [maxUses, setMaxUses] = useState(5);
  const [duration, setDuration] = useState(30);

  const tierColors: Record<string, string> = {
    bronze: "bg-amber-700", silver: "bg-gray-400", gold: "bg-yellow-500",
    diamond: "bg-blue-400", exclusive: "bg-purple-600",
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">إنشاء كود عضوية</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            {(["bronze", "silver", "gold", "diamond", "exclusive"] as const).map((t) => (
              <Button key={t} size="sm" variant={tier === t ? "default" : "outline"} onClick={() => setTier(t)}>
                <div className={`size-2 rounded-full ${tierColors[t]}`} />
                {t}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input type="number" placeholder="أقصى استخدام" value={maxUses} onChange={(e) => setMaxUses(+e.target.value)} className="w-24 text-xs" />
            <Input type="number" placeholder="المدة (أيام)" value={duration} onChange={(e) => setDuration(+e.target.value)} className="w-24 text-xs" />
            <Button size="sm" onClick={() => { createCode({ tier, maxUses, durationDays: duration }); toast("تم إنشاء الكود"); }}>إنشاء</Button>
          </div>
        </CardContent>
      </Card>
      {codes && codes.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">الأكواد النشطة ({codes.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {codes.map((c) => (
                <div key={c._id} className="flex items-center gap-2 p-2 rounded bg-muted/50 text-xs">
                  <div className={`size-2 rounded-full ${tierColors[c.tier]}`} />
                  <span className="font-mono">{c.code}</span>
                  <Badge variant="secondary" className="text-[10px]">{c.usedCount}/{c.maxUses}</Badge>
                  <span className="text-muted-foreground">{c.active ? "نشط" : "منتهي"}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// غرف المناقشة
// ═══════════════════════════════════════════════════════════════
function ChatRoomsControl() {
  const rooms = useQuery(api.playerControl.getChatRooms);
  const createRoom = useMutation(api.playerControl.createChatRoom);
  const [roomName, setRoomName] = useState("");
  const [roomType, setRoomType] = useState<"public" | "private" | "password" | "invite">("public");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">إنشاء غرفة مناقشة</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="اسم الغرفة" value={roomName} onChange={(e) => setRoomName(e.target.value)} />
          <div className="flex gap-1.5">
            {(["public", "private", "password", "invite"] as const).map((t) => (
              <Button key={t} size="sm" variant={roomType === t ? "default" : "outline"} onClick={() => setRoomType(t)}>
                {t === "public" ? "عامة" : t === "private" ? "خاصة" : t === "password" ? "كلمة مرور" : "دعوة"}
              </Button>
            ))}
          </div>
          <Button size="sm" onClick={() => { if (roomName) { createRoom({ name: roomName, type: roomType }); toast("تم إنشاء الغرفة"); setRoomName(""); } }}>إنشاء</Button>
        </CardContent>
      </Card>
      {rooms && (
        <div className="space-y-2">
          {rooms.map((r) => (
            <Card key={r._id}>
              <CardContent className="flex items-center gap-3 p-3">
                <MessageSquare className="size-4 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.members.length} عضو • {r.type}</p>
                </div>
                {r.type === "invite" && r.inviteCode && (
                  <Badge variant="secondary" className="text-[10px] font-mono">{r.inviteCode}</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// قوانين اللعب الأونلاين
// ═══════════════════════════════════════════════════════════════
function OnlineRulesControl() {
  const rules = useQuery(api.playerControl.getOnlineRules);
  const addRule = useMutation(api.playerControl.addOnlineRule);
  const deleteRule = useMutation(api.playerControl.deleteOnlineRule);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");
  const [autoAction, setAutoAction] = useState<"none" | "warn" | "mute" | "kick" | "ban">("warn");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">إضافة قانون جديد</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="عنوان القانون" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="الوصف" value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
          <div className="flex gap-2">
            <select value={severity} onChange={(e) => setSeverity(e.target.value as any)} className="rounded-md border bg-background px-2 py-1 text-xs">
              <option value="low">منخفض</option><option value="medium">متوسط</option><option value="high">عالي</option>
            </select>
            <select value={autoAction} onChange={(e) => setAutoAction(e.target.value as any)} className="rounded-md border bg-background px-2 py-1 text-xs">
              <option value="none">بدون</option><option value="warn">تحذير</option><option value="mute">كتم</option><option value="kick">طرد</option><option value="ban">حظر</option>
            </select>
            <Button size="sm" onClick={() => { if (title && desc) { addRule({ title, description: desc, severity, autoAction }); toast("تم"); setTitle(""); setDesc(""); } }}>إضافة</Button>
          </div>
        </CardContent>
      </Card>
      {rules && (
        <div className="space-y-1">
          {rules.map((r) => (
            <div key={r._id} className="flex items-center gap-2 p-2 rounded bg-muted/50 text-xs">
              <Badge variant={r.severity === "high" ? "destructive" : "secondary"} className="text-[10px]">{r.severity}</Badge>
              <span className="flex-1 font-medium">{r.title}</span>
              <Badge variant="outline" className="text-[10px]">{r.autoAction}</Badge>
              <Button size="sm" variant="ghost" onClick={() => { deleteRule({ ruleId: r._id }); toast("تم الحذف"); }}><Trash2 className="size-3" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// البلاغات المتقدمة
// ═══════════════════════════════════════════════════════════════
function AdvancedReports() {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">قسم البلاغات الشامل</CardTitle></CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          البلاغات تُدار تلقائياً من خلال المدير الآلي والرقابة الذكية.
          جميع البلاغات (في اللعبة، غرف المناقشة، ضد لاعبين/محتوى/غش) تظهر في تبويب البلاغات الرئيسي في غرفة المالك.
        </p>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// تحديات1v1
// ═══════════════════════════════════════════════════════════════
function DuelsPanel() {
  const duels = useQuery(api.playerControl.getAvailableDuels);
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">تحديات1v1 المتاحة</CardTitle></CardHeader>
      <CardContent>
        {!duels || duels.length === 0 ? (
          <p className="text-xs text-muted-foreground">لا توجد تحديات حالياً</p>
        ) : (
          <div className="space-y-1">
            {duels.map((d) => (
              <div key={d._id} className="flex items-center gap-2 p-2 rounded bg-muted/50 text-xs">
                <Swords className="size-3" />
                <span className="font-medium">{d.challengerName}</span>
                <span className="text-muted-foreground">vs</span>
                <span className="font-medium">{d.opponentName ?? "بانتظار منافس"}</span>
                <Badge variant="secondary" className="text-[10px]">{d.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// الأهداف الجماعية
// ═══════════════════════════════════════════════════════════════
function GoalsPanel() {
  const goals = useQuery(api.playerControl.getActiveGoals);
  const createGoal = useMutation(api.playerControl.createCollectiveGoal);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [target, setTarget] = useState(1000);
  const [reward, setReward] = useState("100 XP");
  const [days, setDays] = useState(7);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">إنشاء هدف جماعي</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="العنوان" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input placeholder="الوصف" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="flex gap-2">
            <Input type="number" placeholder="الهدف" value={target} onChange={(e) => setTarget(+e.target.value)} className="w-24 text-xs" />
            <Input placeholder="المكافأة" value={reward} onChange={(e) => setReward(e.target.value)} className="w-24 text-xs" />
            <Input type="number" placeholder="الأيام" value={days} onChange={(e) => setDays(+e.target.value)} className="w-20 text-xs" />
          </div>
          <Button size="sm" onClick={() => { if (title) { createGoal({ title, description: desc, targetScore: target, reward, deadlineDays: days }); toast("تم"); setTitle(""); setDesc(""); } }}>إنشاء</Button>
        </CardContent>
      </Card>
      {goals && goals.length > 0 && (
        <div className="space-y-2">
          {goals.map((g) => (
            <Card key={g._id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{g.title}</p>
                    <p className="text-xs text-muted-foreground">{g.description}</p>
                  </div>
                  <Badge>{g.currentScore}/{g.targetScore}</Badge>
                </div>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min((g.currentScore / g.targetScore) * 100, 100)}%` }} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// المواسم
// ═══════════════════════════════════════════════════════════════
function SeasonsPanel() {
  const season = useQuery(api.playerControl.getActiveSeason);
  const createSeason = useMutation(api.playerControl.createSeason);
  const [name, setName] = useState("");
  const [num, setNum] = useState(1);
  const [days, setDays] = useState(30);

  return (
    <div className="space-y-4">
      {season ? (
        <Card className="border-primary/30">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Trophy className="size-5 text-yellow-500" />
              <div>
                <p className="text-sm font-bold">{season.name}</p>
                <p className="text-xs text-muted-foreground">موسم #{season.number} — نشط</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">إنشاء موسم جديد</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="اسم الموسم" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="flex gap-2">
              <Input type="number" placeholder="رقم" value={num} onChange={(e) => setNum(+e.target.value)} className="w-20 text-xs" />
              <Input type="number" placeholder="المدة (أيام)" value={days} onChange={(e) => setDays(+e.target.value)} className="w-24 text-xs" />
            </div>
            <Button size="sm" onClick={() => { if (name) { createSeason({ name, number: num, durationDays: days, rewards: [{ rank: 1, badge: "gold", xp: 1000 }, { rank: 2, badge: "silver", xp: 500 }, { rank: 3, badge: "bronze", xp: 250 }] }); toast("تم إنشاء الموسم"); } }}>إنشاء</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// الهدايا
// ═══════════════════════════════════════════════════════════════
function GiftsPanel() {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">نظام الهدايا</CardTitle></CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          يمكن للاعبين إرسال هدايا (XP، شارات، إيموجي) لبعضهم البعض داخل الغرف.
          يظهر القسم في بروفايل كل لاعب.
        </p>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// مفاتيح API
// ═══════════════════════════════════════════════════════════════
function ApiKeysPanel() {
  const keys = useQuery(api.playerControl.getApiKeys);
  const addKey = useMutation(api.playerControl.addApiKey);
  const deleteKey = useMutation(api.playerControl.deleteApiKey);
  const toggleKey = useMutation(api.playerControl.toggleApiKey);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("openrouter");
  const [key, setKey] = useState("");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">إضافة مفتاح API</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1 text-xs">
            <option value="openrouter">OpenRouter</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="custom">مخصص</option>
          </select>
          <Input placeholder="المفتاح" value={key} onChange={(e) => setKey(e.target.value)} type="password" />
          <Button size="sm" onClick={() => { if (name && key) { addKey({ name, provider, key }); toast("تمت الإضافة"); setName(""); setKey(""); } }}>إضافة</Button>
        </CardContent>
      </Card>
      {keys && keys.length > 0 && (
        <div className="space-y-1">
          {keys.map((k) => (
            <div key={k._id} className="flex items-center gap-2 p-2 rounded bg-muted/50 text-xs">
              <Zap className="size-3 text-yellow-500" />
              <span className="font-medium">{k.name}</span>
              <span className="text-muted-foreground">{k.provider}</span>
              <code className="font-mono text-[10px]">{k.key}</code>
              <Button size="sm" variant={k.active ? "default" : "outline"} onClick={() => toggleKey({ apiKeyId: k._id, active: !k.active })}>
                {k.active ? "نشط" : "معطّل"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => deleteKey({ apiKeyId: k._id })}><Trash2 className="size-3" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// سجل الأنشطة
// ═══════════════════════════════════════════════════════════════
function ActivityLog() {
  const actions = useQuery(api.playerControl.getOwnerActions, { limit: 50 });
  const undoAction = useMutation(api.playerControl.undoOwnerAction);

  if (!actions) return <div className="p-4 text-muted-foreground">جارٍ التحميل...</div>;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">سجل أفعال المالك ({actions.length})</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {actions.map((a) => (
            <div key={a._id} className="flex items-center gap-2 p-2 rounded bg-muted/50 text-xs">
              {a.undone && <Badge variant="secondary" className="text-[10px]">ملغى</Badge>}
              <span className="flex-1">{a.action}: {a.details}</span>
              <span className="text-muted-foreground">{new Date(a.createdAt).toLocaleDateString("ar")}</span>
              {a.reversible && !a.undone && (
                <Button size="sm" variant="ghost" onClick={() => { undoAction({ actionId: a._id }); toast("تم التراجع"); }}>
                  <Undo2 className="size-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
