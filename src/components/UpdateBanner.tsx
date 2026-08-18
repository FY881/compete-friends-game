import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import {
  APP_VERSION,
  DownloadError,
  downloadApk,
  isNewerVersion,
} from "@/lib/app-version";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, Loader2, RefreshCw, Sparkles, X } from "lucide-react";

/**
 * لافتة «تحديث متاح» — قلب خطة تحديث التطبيق.
 *
 * تقرأ أحدث إصدار منشور من Convex وتقارنه بالإصدار المثبّت في هذه النسخة.
 * عند توفر نسخة أحدث تظهر اللافتة مع ملاحظات الإصدار الجديد وزرّي:
 * - «تحديث الآن» (نسخة الويب/PWA): تمسح كاش السيرفس وركر وتعيد التحميل.
 * - «تنزيل APK»: تفتح صفحة التحميل/الملف مباشرة.
 */
export function UpdateBanner() {
  const info = useQuery(api.appInfo.getAppInfo);
  const reportIssue = useMutation(api.owner.reportDownloadIssue);
  const [dismissed, setDismissed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!info || dismissed || !isNewerVersion(info.version, APP_VERSION)) {
    return null;
  }

  /** تنزيل APK عبر JavaScript (fetch + Blob) — لا يفتح أي صفحة قد تعرض خطأ. */
  const handleDownloadApk = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadApk(
        info.apkFileName,
        info.siteUrl,
        {
          sha256: info.apkSha256,
          bytes: info.apkBytes,
        },
        {
          storageUrl: info.apkStorageUrl,
          mirrorUrl: info.apkMirrorUrl,
        },
      );
      toast.success("بدأ تنزيل ملف APK — افحص شريط التنزيل في متصفحك.");
    } catch (error) {
      console.error(error);
      if (error instanceof DownloadError) {
        reportIssue({
          url: error.sourceUrl ?? info.apkUrl ?? "",
          error: error.message,
          receivedSize: error.receivedSize,
          receivedHash: error.receivedHash,
          expectedSize: info.apkBytes,
          expectedHash: info.apkSha256,
        }).catch(() => undefined);
        toast.error(
          error.healed
            ? "أصلح النظام التخزين المؤقت تلقائياً — أعد الضغط على زر التنزيل الآن."
            : error.message,
        );
      } else {
        toast.error(
          error instanceof Error ? error.message : "تعذّر التنزيل، حاول مرة أخرى.",
        );
      }
    } finally {
      setDownloading(false);
    }
  };

  const refreshWebApp = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch {
      // التحديث عبر إعادة التحميل يعمل حتى لو فشل التنظيف
    }
    window.location.reload();
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-l from-primary/10 via-card to-card p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute end-3 top-3 flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="إغلاق"
      >
        <X className="size-4" />
      </button>

      <div className="flex flex-wrap items-center gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold">نسخة جديدة متوفرة — الإصدار {info.version}</p>
            <Badge variant="secondary" className="rounded-full text-[10px]">
              لديك {APP_VERSION}
            </Badge>
          </div>
          {info.notes.length > 0 && (
            <ul className="mt-1.5 space-y-0.5 text-xs leading-relaxed text-muted-foreground">
              {info.notes.map((note) => (
                <li key={note} className="flex items-start gap-1.5">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                  {note}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={refreshWebApp}>
            <RefreshCw className="size-3.5" />
            تحديث الآن
          </Button>
          <Button
            size="sm"
            className="gap-1.5 rounded-xl"
            onClick={handleDownloadApk}
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            {downloading ? "جارٍ التجهيز…" : "تنزيل APK"}
          </Button>
        </div>
      </div>
    </div>
  );
}
