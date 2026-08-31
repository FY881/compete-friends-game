import React, { useState } from "react";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Radio, BarChart3, MessageSquare } from "lucide-react";

export function TelegramSettings() {
  const updateSettings = useMutation(api.owner.updateSettings);
  const sendAlert = useAction(api.telegramIntegration.sendTelegramAlert);
  const sendReport = useAction(api.telegramIntegration.sendDailyReport);
  const broadcast = useAction(api.telegramIntegration.broadcastViaTelegram);
  const config = useQuery(api.telegramIntegration.getTelegramConfig);
  const stats = useQuery(api.telegramIntegration.getDailyStats);

  const [token, setToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSave = async () => {
    if (!token.trim() || !chatId.trim()) {
      toast.error("أدخل Token البوت و Chat ID");
      return;
    }
    setSaving(true);
    try {
      await updateSettings({
        telegramBotToken: token.trim(),
        telegramChatId: chatId.trim(),
      });
      toast.success("تم حفظ إعدادات تيليجرام");
      setToken("");
      setChatId("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally {
      setSaving(false);
    }
  };

  const handleSendReport = async () => {
    setSending(true);
    try {
      await sendReport();
      toast.success("تم إرسال التقرير اليومي");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally {
      setSending(false);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    setSending(true);
    try {
      await broadcast({ message: broadcastMsg });
      toast.success("تم الإذاعة");
      setBroadcastMsg("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "خطأ");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="flex items-center gap-2">
        <Radio className="w-4 h-4" />
        <span className="text-sm font-bold">حالة الربط:</span>
        {config ? (
          <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
            ✓ متصل
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
            ✗ غير متصل
          </Badge>
        )}
      </div>

      {/* Config Inputs */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Token البوت</Label>
          <Input
            type="password"
            placeholder="1234567890:ABCdef..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="mt-1 text-xs"
          />
        </div>
        <div>
          <Label className="text-xs">Chat ID</Label>
          <Input
            placeholder="-1001234567890"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            className="mt-1 text-xs"
          />
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
        حفظ الإعدادات
      </Button>

      {/* Quick Actions */}
      {config && (
        <div className="space-y-3 pt-2 border-t border-border/50">
          <h4 className="text-xs font-bold flex items-center gap-1">
            <Send className="w-3 h-3" /> إجراءات سريعة
          </h4>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSendReport}
              disabled={sending}
              className="gap-1.5 text-xs"
            >
              <BarChart3 className="w-3 h-3" />
              تقرير يومي
            </Button>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="اكتب إذاعة..."
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              className="text-xs"
            />
            <Button
              size="sm"
              onClick={handleBroadcast}
              disabled={sending || !broadcastMsg.trim()}
              className="gap-1.5 text-xs shrink-0"
            >
              <MessageSquare className="w-3 h-3" />
              إذاعة
            </Button>
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className="text-lg font-bold">{stats.totalUsers}</div>
            <div className="text-[9px] text-muted-foreground">لاعب</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className="text-lg font-bold">{stats.gamesToday}</div>
            <div className="text-[9px] text-muted-foreground">لعبة اليوم</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className="text-lg font-bold">{stats.openReports}</div>
            <div className="text-[9px] text-muted-foreground">بلاغ مفتوح</div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground space-y-1">
        <p className="font-bold">كيف تُنشئ بوت تيليجرام:</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>افتح @BotFather في تيليجرام</li>
          <li>اكتب /newbot وأعطه اسماً</li>
          <li>انسخ الـ Token والصقه هنا</li>
          <li>أرسل رسالة للبوت واحصل على Chat ID</li>
          <li>ثم أرسل /setwebhook مع رابط Webhook</li>
        </ol>
      </div>
    </div>
  );
}

export default TelegramSettings;
