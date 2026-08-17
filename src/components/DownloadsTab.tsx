import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileArchive,
  Fingerprint,
  Loader2,
  ShieldCheck,
  Smartphone,
  Weight,
} from "lucide-react";

function fmtBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  return `${(bytes / 1024 / 1024).toFixed(2)} MB (${bytes.toLocaleString("ar")} بايت)`;
}

function shortHash(hash: string | null | undefined): string {
  if (!hash) return "—";
  return `${hash.slice(0, 12)}…${hash.slice(-8)}`;
}

function fmtDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("ar-EG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * «صحة التحميل» — لوحة المالك: القيم الرسمية لملف APK (مصدر الحقيقة) +
 * كل بلاغات فشل التنزيل الواردة من اللاعبين. المدير الآلي يعالج هذه البلاغات
 * كل 15 دقيقة تلقائياً، وهنا يرى المالك ما حدث ولماذا.
 */
export function DownloadsTab() {
  const health = useQuery(api.owner.getDownloadHealth);

  if (health === undefined) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (health === null) return null;

  const { official, reports } = health;

  const copyValue = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`تم نسخ ${label}.`);
    } catch {
      toast.error("تعذّر النسخ — انسخ يدوياً من النص.");
    }
  };

  const okCount = reports.length; // كل بلاغ موجود = مشكلة رُصدت

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-bold text-primary">
          24
        </span>
        <div>
          <h3 className="font-bold text-foreground">صحة تنزيل APK</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            القيم الرسمية للملف (يُرسلها الخادم لكل أزرار التنزيل) + بلاغات الفشل
            التي أرسلها اللاعبون تلقائياً. المدير الآلي يفحص هذه البلاغات ويصلح
            الأسباب كل 15 دقيقة — دون أي تدخل يدوي.
          </p>
        </div>
      </div>

      {/* Official values */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-4" />
            </span>
            الملف الرسمي المنشور (مصدر الحقيقة)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <FileArchive className="size-3.5 text-primary" />
                اسم الملف
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-[11px]"
                onClick={() => copyValue("اسم الملف", official.fileName)}
              >
                <ClipboardCopy className="size-3" />
                نسخ
              </Button>
            </div>
            <p className="mt-1.5 truncate font-mono text-sm font-bold" dir="ltr">
              {official.fileName}
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Smartphone className="size-3.5 text-primary" />
                الإصدار
              </p>
              <Badge variant="outline" className="rounded-full text-[10px]">
                build {official.buildId}
              </Badge>
            </div>
            <p className="mt-1.5 font-mono text-sm font-bold" dir="ltr">
              v{official.version}
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Weight className="size-3.5 text-primary" />
                الحجم
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-[11px]"
                onClick={() => copyValue("الحجم", String(official.bytes))}
              >
                <ClipboardCopy className="size-3" />
                نسخ
              </Button>
            </div>
            <p className="mt-1.5 font-mono text-sm font-bold" dir="ltr">
              {fmtBytes(official.bytes)}
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Fingerprint className="size-3.5 text-primary" />
                بصمة SHA-256
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-[11px]"
                onClick={() => copyValue("البصمة", official.sha256)}
              >
                <ClipboardCopy className="size-3" />
                نسخ
              </Button>
            </div>
            <p
              className="mt-1.5 truncate font-mono text-xs font-bold text-muted-foreground"
              dir="ltr"
              title={official.sha256}
            >
              {shortHash(official.sha256)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Failure reports */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Download className="size-4" />
            </span>
            بلاغات فشل التنزيل الأخيرة
            <Badge
              variant="outline"
              className={cn(
                "rounded-full",
                okCount === 0
                  ? "bg-emerald-500/10 text-emerald-700"
                  : "bg-amber-500/10 text-amber-700",
              )}
            >
              {okCount === 0 ? (
                <>
                  <CheckCircle2 className="size-3" />
                  لا مشاكل
                </>
              ) : (
                <>
                  <AlertTriangle className="size-3" />
                  {okCount} بلاغ — يُعالجها المدير الآلي تلقائياً
                </>
              )}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center">
              <CheckCircle2 className="mx-auto size-8 text-emerald-600/60" />
              <p className="mt-3 text-sm font-semibold text-muted-foreground">
                لم يصل أي بلاغ فشل تنزيل — كل الأجهزة تحمّل الملف الرسمي بنجاح.
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                أي فشل مستقبلي (حجم/بصمة غير مطابقة، كاش قديم…) يظهر هنا فوراً
                مع التشخيص الكامل.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {reports.map((report) => {
                const sizeOk =
                  report.receivedSize == null ||
                  report.expectedSize == null ||
                  report.receivedSize === report.expectedSize;
                const hashOk =
                  !report.receivedHash ||
                  !report.expectedHash ||
                  report.receivedHash === report.expectedHash;
                return (
                  <li
                    key={report.id}
                    className="rounded-2xl border border-border/80 bg-muted/20 px-4 py-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
                          <AlertTriangle className="size-4" />
                        </span>
                        <div>
                          <p className="text-sm font-bold">{report.userName}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {fmtDate(report.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "gap-1 rounded-full text-[10px]",
                            sizeOk && hashOk
                              ? "bg-emerald-500/10 text-emerald-700"
                              : "bg-amber-500/10 text-amber-700",
                          )}
                        >
                          {sizeOk && hashOk ? (
                            <>
                              <Check className="size-3" />
                              الحجم والبصمة مطابقان
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="size-3" />
                              ملف مختلف عن الرسمي
                            </>
                          )}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-2.5 rounded-xl bg-card px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                      {report.error}
                    </p>
                    <div className="mt-2 grid gap-1.5 text-[11px] text-muted-foreground sm:grid-cols-2">
                      <p dir="ltr" className="truncate text-start" title={report.url}>
                        <span className="font-semibold">المصدر:</span> {report.url}
                      </p>
                      <p dir="ltr" className="text-start">
                        <span className="font-semibold">المستلم:</span>{" "}
                        {fmtBytes(report.receivedSize)} /{" "}
                        {shortHash(report.receivedHash)}
                      </p>
                      <p dir="ltr" className="text-start">
                        <span className="font-semibold">المتوقع:</span>{" "}
                        {fmtBytes(report.expectedSize)} /{" "}
                        {shortHash(report.expectedHash)}
                      </p>
                      <p className="truncate" title={report.userAgent ?? undefined}>
                        <span className="font-semibold">الجهاز:</span>{" "}
                        {report.userAgent ?? "—"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
