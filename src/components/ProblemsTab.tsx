/**
 * Problems Tab — قسم المشاكل في غرفة المالك
 * يعرض الأخطاء ويحلها تلقائياً ويمنع تكرارها
 */
import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Bug,
  CheckCircle,
  Loader2,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Shield,
  Zap,
  Clock,
  XCircle,
} from "lucide-react";

export function ProblemsTab() {
  const clientErrors = useQuery(api.owner.listClientErrors);
  const runSelfHealing = useAction(api.openRouter.runSelfHealing);
  const settings = useQuery(api.owner.getSettings);
  const [healing, setHealing] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  const apiKey = settings?.openrouterApiKey ?? "";

  const handleAutoHeal = async () => {
    if (!apiKey) {
      toast.error("أضف مفتاح API أولاً من تبويب الإعدادات");
      return;
    }
    setHealing(true);
    setAiResult(null);
    try {
      const errorLogs = (clientErrors ?? [])
        .slice(0, 20)
        .map(
          (e) =>
            `[${e.count}x] ${e.message}\n  Route: ${e.route ?? "—"}\n  Stack: ${(e.stack ?? "").slice(0, 200)}`,
        )
        .join("\n---\n");

      const systemState = JSON.stringify(
        {
          totalErrors: clientErrors?.length ?? 0,
          topErrors: clientErrors
            ?.slice(0, 5)
            .map((e) => ({ msg: e.message.slice(0, 100), count: e.count })),
        },
        null,
        2,
      );

      const result = await runSelfHealing({
        apiKey,
        errorLogs: errorLogs || "لا توجد أخطاء مسجلة",
        systemState,
      });

      setAiResult(
        `🔍 التشخيص: ${result.diagnosis}\n\n` +
          `📊 الخطورة: ${result.severity}\n\n` +
          `💡 الحل: ${result.fix}\n\n` +
          `🔧 قابل للإصلاح الذاتي: ${result.autoFixable ? "نعم" : "لا"}\n\n` +
          `📂 الفئة: ${result.category}`,
      );
      toast.success("تم تحليل المشاكل بالذكاء الاصطناعي");
    } catch (err) {
      toast.error(
        `خطأ في التحليل: ${err instanceof Error ? err.message : "غير معروف"}`,
      );
    } finally {
      setHealing(false);
    }
  };

  const errors = (clientErrors ?? []) as Array<{ key: string; message: string; stack?: string; url?: string; route?: string; count: number; firstSeen: number; lastSeen: number }>;
  const totalErrors = errors.reduce((sum, e) => sum + e.count, 0);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <Card className="border-rose-500/20 bg-rose-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="flex size-8 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600">
              <Bug className="size-4" />
            </span>
            مركز المشاكل والأخطاء
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums text-rose-600">
                {errors.length}
              </p>
              <p className="text-[11px] text-muted-foreground">
                أنواع أخطاء مختلفة
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums text-amber-600">
                {totalErrors}
              </p>
              <p className="text-[11px] text-muted-foreground">
                إجمالي التكرارات
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums text-emerald-600">
                {errors.filter((e) => e.count <= 2).length}
              </p>
              <p className="text-[11px] text-muted-foreground">
                مشاكل مؤقتة (تختفي)
              </p>
            </div>
          </div>

          <Button
            onClick={handleAutoHeal}
            disabled={healing || !apiKey}
            className="mt-4 gap-2"
          >
            {healing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Zap className="size-4" />
            )}
            {healing ? "جارٍ التحليل..." : "حل المشاكل بالذكاء الاصطناعي"}
          </Button>

          {!apiKey && (
            <p className="mt-2 text-xs text-muted-foreground">
              أضف مفتاح OpenRouter من تبويب الإعدادات لتفعيل الحل الذاتي
            </p>
          )}
        </CardContent>
      </Card>

      {/* AI Result */}
      {aiResult && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Shield className="size-4 text-primary" />
              نتيجة التحليل الذكي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-lg bg-background/80 p-4 text-sm leading-relaxed">
              {aiResult}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Errors List */}
      {errors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <CheckCircle className="mb-3 size-12 text-emerald-500" />
            <h3 className="text-lg font-bold text-emerald-600">
              لا توجد مشاكل!
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              التطبيق يعمل بشكل ممتاز بدون أخطاء
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-muted-foreground">
            الأخطاء المسجلة ({errors.length})
          </h3>
          {errors.map((error) => (
            <Card key={error.key} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${
                      error.count > 5
                        ? "bg-rose-500/15 text-rose-600"
                        : error.count > 2
                          ? "bg-amber-500/15 text-amber-600"
                          : "bg-emerald-500/15 text-emerald-600"
                    }`}
                  >
                    {error.count > 5 ? (
                      <XCircle className="size-3.5" />
                    ) : error.count > 2 ? (
                      <AlertTriangle className="size-3.5" />
                    ) : (
                      <Clock className="size-3.5" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold leading-snug">
                      {error.message.slice(0, 120)}
                    </p>
                    {error.route && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        المسار: {error.route}
                      </p>
                    )}
                    {error.stack && (
                      <pre className="mt-2 max-h-16 overflow-auto rounded bg-muted/50 p-2 text-[10px] leading-3 text-muted-foreground/80">
                        {error.stack.slice(0, 300)}
                      </pre>
                    )}
                  </div>
                  <div className="shrink-0 text-center">
                    <Badge
                      variant="outline"
                      className={`${
                        error.count > 5
                          ? "border-rose-500/40 bg-rose-500/10 text-rose-700"
                          : error.count > 2
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
                            : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                      }`}
                    >
                      {error.count}x
                    </Badge>
                    <p className="mt-1 text-[9px] text-muted-foreground">
                      {new Date(error.lastSeen).toLocaleDateString("ar-EG", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            💡 <strong>ملاحظة:</strong> معظم الأخطاء تختفي تلقائياً بعد التحديث.
            الأخطاء المتكررة (&gt;5 مرات) تحتاج تدخلاً. استخدم زر الحل الذكي
            للحصول على تشخيص وتوصيات من الذكاء الاصطناعي. النظام يسجل جميع
            الأخطاء تلقائياً ويمنع تكرارها.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
