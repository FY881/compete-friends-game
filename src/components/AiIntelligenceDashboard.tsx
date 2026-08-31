import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";import { Brain,
  AlertTriangle,
  CheckCircle2,
  Settings,
  Shield,
  MessageSquare,
  BarChart3,
  Zap,
  RefreshCw,
  Clock,
  TrendingUp,
  Target,
  ChevronRight,
  Undo2,
  Radio,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Tab = "predictions" | "selfEval" | "commands" | "telegram";

export function AiIntelligenceDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("predictions");
  const [commandInput, setCommandInput] = useState("");
  const [commandParams, setCommandParams] = useState("");
  const [commandTarget, setCommandTarget] = useState("");
  const [broadcastMsg, setBroadcastMsg] = useState("");

  const predictions = useQuery(api.aiIntelligence.predictProblems);
  const selfEval = useQuery(api.aiIntelligence.getSelfEvaluation);
  const commandHistory = useQuery(api.aiIntelligence.getCommandHistory, { limit: 30 });
  const pendingTg = useQuery(api.aiIntelligence.getPendingTelegramMessages);

  const executeCommand = useMutation(api.aiIntelligence.executeOwnerCommand);
  const undoAction = useMutation(api.aiIntelligence.undoOwnerAction);
  const sendTgNotification = useMutation(api.aiIntelligence.sendTelegramNotification);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "predictions", label: "تنبؤ المشاكل", icon: <AlertTriangle className="w-4 h-4" /> },
    { key: "selfEval", label: "تقييم AI", icon: <Brain className="w-4 h-4" /> },
    { key: "commands", label: "أوامر متقدمة", icon: <Zap className="w-4 h-4" /> },
    { key: "telegram", label: "تيليجرام", icon: <Radio className="w-4 h-4" /> },
  ];

  const handleCommand = async () => {
    if (!commandInput.trim()) return;
    try {
      await executeCommand({
        command: commandInput.trim(),
        targetUserId: (commandTarget.trim() || undefined) as Id<"users"> | undefined,
        params: commandParams.trim() || undefined,
      });
      setCommandInput("");
      setCommandParams("");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "خطأ");
    }
  };

  const handleUndo = async (actionId: string) => {
    try {
      await undoAction({ actionId: actionId as never });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "خطأ");
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    try {
      await sendTgNotification({ message: broadcastMsg, priority: "high" });
      setBroadcastMsg("");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "خطأ");
    }
  };

  const severityColor = (s: string) => {
    if (s === "high") return "bg-red-500/10 text-red-400 border-red-500/30";
    if (s === "medium") return "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";
    return "bg-green-500/10 text-green-400 border-green-500/30";
  };

  return (
    <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="w-5 h-5 text-primary" />
          مركز الذكاء المتقدم
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted/40 rounded-lg">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all ${
                activeTab === t.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ─── Tab: Predictions ─── */}
        <AnimatePresence mode="wait">
          {activeTab === "predictions" && (
            <motion.div
              key="predictions"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {!predictions ? (
                <div className="text-center py-8 text-muted-foreground text-sm animate-pulse">
                  جارٍ التحليل...
                </div>
              ) : predictions.predictions.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-green-400 mb-2" />
                  <p className="text-sm font-semibold text-green-400">كل شيء يعمل بشكل ممتاز!</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {predictions.summary}
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {new Date(predictions.generatedAt).toLocaleTimeString("ar-SA")}
                    </Badge>
                  </div>
                  {predictions.predictions.map((p) => (
                    <div
                      key={p.id}
                      className={`p-3 rounded-lg border ${severityColor(p.severity)}`}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold">{p.title}</h4>
                            <Badge variant="outline" className={`text-[9px] ${severityColor(p.severity)}`}>
                              {p.severity === "high" ? "عالي" : p.severity === "medium" ? "متوسط" : "منخفض"}
                            </Badge>
                          </div>
                          <p className="text-xs mt-1 opacity-80">{p.detail}</p>
                          <p className="text-[11px] mt-1 text-green-400">💡 {p.suggestedFix}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="text-[10px] text-muted-foreground">
                              الثقة: {Math.round(p.confidence * 100)}%
                            </div>
                            <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${p.confidence * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </motion.div>
          )}

          {/* ─── Tab: Self Evaluation ─── */}
          {activeTab === "selfEval" && (
            <motion.div
              key="selfEval"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {!selfEval ? (
                <div className="text-center py-8 text-muted-foreground text-sm animate-pulse">
                  جارٍ التقييم...
                </div>
              ) : (
                <>
                  {/* Overall Score */}
                  <div className="text-center py-4">
                    <div className="relative inline-flex items-center justify-center">
                      <svg className="w-24 h-24 -rotate-90">
                        <circle cx="48" cy="48" r="42" fill="none" stroke="currentColor" className="text-muted/30" strokeWidth="6" />
                        <circle
                          cx="48" cy="48" r="42" fill="none" stroke="currentColor"
                          className="text-primary"
                          strokeWidth="6"
                          strokeDasharray={`${selfEval.overallScore * 2.64} 264`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute">
                        <div className="text-2xl font-bold text-primary">{selfEval.overallScore}</div>
                        <div className="text-[9px] text-muted-foreground">من 100</div>
                      </div>
                    </div>
                    <p className="text-xs font-semibold mt-2 text-muted-foreground">تقييم AI العام</p>
                  </div>

                  {/* Breakdown */}
                  <div className="grid grid-cols-2 gap-2">
                    {Object.values(selfEval.breakdown).map((item, i) => (
                      <div key={i} className="p-2 rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-muted-foreground">{item.label}</span>
                          <span className="text-xs font-bold">{item.score}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${item.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "إجراءات AI", value: selfEval.stats.aiActionsThisWeek, icon: <Brain className="w-3 h-3" /> },
                      { label: "إصلاحات تلقائية", value: selfEval.stats.autoFixesThisWeek, icon: <RefreshCw className="w-3 h-3" /> },
                      { label: "بلاغات مفتوحة", value: selfEval.stats.openReports, icon: <AlertTriangle className="w-3 h-3" /> },
                    ].map((s, i) => (
                      <div key={i} className="p-2 rounded-lg bg-muted/30 text-center">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                          {s.icon}
                          <span className="text-[9px]">{s.label}</span>
                        </div>
                        <div className="text-lg font-bold">{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Recommendations */}
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold flex items-center gap-1">
                      <Target className="w-3 h-3" /> توصيات
                    </h4>
                    {selfEval.recommendations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                        <ChevronRight className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                        <span className="text-xs">{rec}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ─── Tab: Commands ─── */}
          {activeTab === "commands" && (
            <motion.div
              key="commands"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {/* Quick Commands */}
              <div>
                <h4 className="text-xs font-bold mb-2 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> أوامر سريعة
                </h4>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { cmd: "clean_stale_rooms", label: "🗑️ تنظيف الغرف", color: "hover:bg-yellow-500/10" },
                    { cmd: "system_stats", label: "📊 إحصائيات النظام", color: "hover:bg-blue-500/10" },
                  ].map((q) => (
                    <button
                      key={q.cmd}
                      onClick={() => { setCommandInput(q.cmd); setCommandParams(""); setCommandTarget(""); }}
                      className={`p-2 rounded-lg border border-border/50 text-xs text-center transition-all ${q.color}`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Broadcast */}
              <div>
                <h4 className="text-xs font-bold mb-2 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> إذاعة عامة
                </h4>
                <div className="flex gap-2">
                  <input
                    value={broadcastMsg}
                    onChange={(e) => setBroadcastMsg(e.target.value)}
                    placeholder="اكتب رسالة الإذاعة..."
                    className="flex-1 px-3 py-2 text-xs rounded-lg border border-border/50 bg-muted/30"
                  />
                  <Button
                    size="sm"
                    onClick={handleSendBroadcast}
                    disabled={!broadcastMsg.trim()}
                    className="text-xs"
                  >
                    إرسال
                  </Button>
                </div>
              </div>

              {/* Custom Command */}
              <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                <h4 className="text-xs font-bold">أمر مخصص</h4>
                <input
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  placeholder="الأمر (ban/unban/mute/unmute/warn/reset_warnings/set_admin/remove_admin/backup_player/broadcast)"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border/50 bg-background"
                />
                <input
                  value={commandTarget}
                  onChange={(e) => setCommandTarget(e.target.value)}
                  placeholder="معرف المستخدم (اختياري)"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border/50 bg-background"
                />
                <input
                  value={commandParams}
                  onChange={(e) => setCommandParams(e.target.value)}
                  placeholder="معاملات إضافية (اختياري)"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border/50 bg-background"
                />
                <Button
                  size="sm"
                  onClick={handleCommand}
                  disabled={!commandInput.trim()}
                  className="w-full text-xs"
                >
                  تنفيذ الأمر
                </Button>
              </div>

              {/* Command History */}
              <div>
                <h4 className="text-xs font-bold mb-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> سجل الأوامر
                </h4>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {commandHistory?.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 text-xs">
                      <span className="font-mono text-primary shrink-0">{c.action}</span>
                      {c.targetName && (
                        <span className="text-muted-foreground truncate">→ {c.targetName}</span>
                      )}
                      {c.undone && (
                        <Badge variant="outline" className="text-[8px] bg-red-500/10 text-red-400 ml-auto">
                          ملغي
                        </Badge>
                      )}
                      {c.reversible && !c.undone && (
                        <button
                          onClick={() => handleUndo(c.id)}
                          className="ml-auto p-1 rounded hover:bg-muted/50"
                        >
                          <Undo2 className="w-3 h-3" />
                        </button>
                      )}
                      <span className="text-[9px] text-muted-foreground shrink-0">
                        {new Date(c.createdAt).toLocaleTimeString("ar-SA")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── Tab: Telegram ─── */}
          {activeTab === "telegram" && (
            <motion.div
              key="telegram"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="text-center py-4">
                <Radio className="w-10 h-10 mx-auto text-blue-400 mb-2" />
                <h3 className="text-sm font-bold">ربط تيليجرام</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  قم بإعداد بوت تيليجرام من إعدادات المالك
                </p>
              </div>

              <div className="p-3 rounded-lg bg-muted/30 space-y-2 text-xs">
                <h4 className="font-bold">كيف يعمل؟</h4>
                <ol className="space-y-1 list-decimal list-inside text-muted-foreground">
                  <li>أنشئ بوت تيليجرام عبر @BotFather</li>
                  <li>أدخل Token البوت في إعدادات المالك</li>
                  <li>أدخل معرف المحادثة (Chat ID)</li>
                  <li>ستصلك إشعارات تلقائية بالتغييرات المهمة</li>
                  <li>يمكنك إرسال أوامر من تيليجرام للتحكم</li>
                </ol>
              </div>

              {/* Pending Messages */}
              {pendingTg && pendingTg.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold mb-2 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> رسائل معلقة ({pendingTg.length})
                  </h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {pendingTg.map((msg) => (
                      <div key={msg.key} className="p-2 rounded-lg bg-muted/20 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[8px] ${
                            msg.priority === "high" ? "bg-red-500/10 text-red-400" : "bg-blue-500/10 text-blue-400"
                          }`}>
                            {msg.priority}
                          </Badge>
                          <span className="truncate">{msg.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Notifications */}
              <div>
                <h4 className="text-xs font-bold mb-2">إرسال تنبيه سريع</h4>
                <div className="flex gap-2">
                  <input
                    id="tg-msg"
                    placeholder="اكتب التنبيه..."
                    className="flex-1 px-3 py-2 text-xs rounded-lg border border-border/50 bg-muted/30"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      const input = document.getElementById("tg-msg") as HTMLInputElement;
                      if (input?.value) {
                        sendTgNotification({ message: input.value, priority: "medium" });
                        input.value = "";
                      }
                    }}
                    className="text-xs"
                  >
                    إرسال
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

export default AiIntelligenceDashboard;
