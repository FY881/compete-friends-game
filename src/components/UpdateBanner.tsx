import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { APP_VERSION, isNewerVersion, resolveApkUrl } from "@/lib/app-version";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw, Sparkles, X } from "lucide-react";

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
  const [dismissed, setDismissed] = useState(false);

  if (!info || dismissed || !isNewerVersion(info.version, APP_VERSION)) {
    return null;
  }

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

  const downloadUrl = resolveApkUrl(info.apkFileName, info.siteUrl);

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
          <Button size="sm" className="gap-1.5 rounded-xl" asChild>
            <a href={downloadUrl} target="_blank" rel="noreferrer">
              <Download className="size-3.5" />
              تنزيل APK
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
