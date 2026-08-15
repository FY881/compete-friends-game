import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { APP_VERSION, APP_VERSION_LABEL } from "@/lib/app-version";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UpdateBanner } from "@/components/UpdateBanner";
import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  Check,
  Download as DownloadIcon,
  FileWarning,
  MonitorSmartphone,
  PackageX,
  RefreshCw,
  Rocket,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Swords,
} from "lucide-react";
import { Link, useNavigate } from "react-router";

export default function Download() {
  const navigate = useNavigate();
  const info = useQuery(api.appInfo.getAppInfo);

  const apkUrl = info?.apkUrl || `/downloads/${info?.apkFileName ?? `tahadi-alouqoul-v${APP_VERSION}.apk`}`;
  const version = info?.version ?? APP_VERSION;

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <BrainCircuit className="size-5" />
            </span>
            <span className="text-lg font-bold tracking-tight">تحميل تحدّي العقول</span>
          </button>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-xl">
              <Link to="/play">
                <Swords className="size-3.5" />
                العب الآن
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 pb-24 pt-14">
        <UpdateBanner />

        {/* Hero */}
        <div className="relative mt-8 overflow-hidden rounded-3xl border border-primary/20 bg-card p-8 text-center shadow-sm sm:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 start-1/2 h-48 w-[30rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
          />
          <Badge variant="outline" className="mb-4 gap-1.5 rounded-full text-primary">
            <Sparkles className="size-3.5" />
            الإصدار {version}
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            حمّل اللعبة على هاتفك…
            <br />
            <span className="text-primary">وخذ التحدي معك أينما ذهبت.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            نسخة أندرويد أصلية عبر Capacitor، أو نسخة ويب سريعة تُثبَّت كتطبيق
            من المتصفح. نفس الحساب، نفس الأصدقاء، نفس ساحة التحدي — مع
            إشعارات تحديث تلقائية.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="rounded-full">
              أندرويد 7.0+
            </Badge>
            <Badge variant="outline" className="rounded-full">
              حجم خفيف ~4.5 MB
            </Badge>
            <Badge variant="outline" className="rounded-full">
              بلا متاجر وبلا انتظار
            </Badge>
          </div>
        </div>

        {/* APK card */}
        <section className="mt-8">
          <div className="rounded-3xl border border-primary/25 bg-card p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <Smartphone className="size-6" />
                </span>
                <div>
                  <h2 className="text-xl font-bold">تطبيق أندرويد (ملف APK)</h2>
                  <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    ملف جاهز للتثبيت مباشرة على هاتفك. بعد التحميل افتح الملف
                    واضغط «تثبيت» — واسمح بالتثبيت من مصادر خارجية إذا طُلب منك.
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="gap-1.5 rounded-full text-primary">
                <ShieldCheck className="size-3" />
                موقّع رقمياً
              </Badge>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                size="lg"
                className="w-full gap-2 rounded-xl"
                asChild
              >
                <a href={apkUrl} download>
                  <DownloadIcon className="size-4.5" />
                  تنزيل APK — الإصدار {version}
                </a>
              </Button>
              <Button size="lg" variant="outline" className="w-full gap-2 rounded-xl" asChild>
                <Link to="/rules">
                  <ShieldCheck className="size-4.5" />
                  قوانين اللعب قبل البدء
                </Link>
              </Button>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              ملاحظة: التطبيق يحتاج اتصالاً بالإنترنت (الأسئلة والترتيب يعملان عبر
              خادم Convex). عند توفر إصدار جديد ستظهر لافتة داخل التطبيق توجهك
              لتحميله من هذه الصفحة.
            </p>
          </div>
        </section>

        {/* PWA card */}
        <section className="mt-6">
          <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
                <MonitorSmartphone className="size-6" />
              </span>
              <div>
                <h2 className="text-xl font-bold">بديل فوري بدون ملفات: نسخة الويب</h2>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  افتح الموقع على هاتفك من المتصفح ثم: القائمة ← «إضافة إلى
                  الشاشة الرئيسية». يتحول الموقع لتطبيق بأيقونة خاصة ويعمل
                  بدون ملفات تثبيت، ويتحدث تلقائياً عند كل إصدار جديد.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* APK install troubleshooting */}
        <section className="mt-10">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
              <AlertTriangle className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold">صادفت مشكلة أثناء التثبيت؟</h2>
              <p className="text-xs text-muted-foreground">أغلب أخطاء التثبيت أسبابها بسيطة — إليك الحل لكل حالة</p>
            </div>
          </div>
          <div className="mt-4 space-y-2.5">
            {[
              {
                icon: ShieldAlert,
                title: "«لم يُثبَّت التطبيق» / «يوجد مشكلة في الحزمة»",
                steps: [
                  "امسح مساحة التخزين: الإعدادات ← التطبيقات ← مدير الملفات ← مسح البيانات.",
                  "أعد تحميل الملف من هذه الصفحة (تأكد من اكتمال التحميل 100% — انتبه لشريط التنزيل).",
                  "إذا استمر الخطأ: أعد تشغيل الهاتف ثم حاول التثبيت مجدداً.",
                ],
              },
              {
                icon: FileWarning,
                title: "«الملف تالف» أو «لا يمكن فتح الملف»",
                steps: [
                  "غالباً التحميل انقطع أو الملف لم يكتمل — احذفه وحمّله من جديد على اتصال مستقر.",
                  "تأكد أنك فتحت ملف .apk نفسه وليس نسخة قديمة من تحميل سابق.",
                ],
              },
              {
                icon: ShieldCheck,
                title: "تحذير «التثبيت من مصادر غير معروفة»",
                steps: [
                  "اضغط «الإعدادات» في التحذير وفعّل «السماح من هذا المصدر» (Chrome أو مدير الملفات).",
                  "ثم ارجع واضغط «تثبيت» — هذا طبيعي لأن الملف خارج متجر Play.",
                ],
              },
              {
                icon: PackageX,
                title: "«التطبيق غير مثبت» بسبب نسخة قديمة مثبتة",
                steps: [
                  "إذا كان لديك إصدار سابق مثبت، احذفه أولاً (الإعدادات ← التطبيقات ← تحدّي العقول ← إلغاء التثبيت) ثم ثبّت الجديد.",
                  "سبب ذلك أن التوقيع الرقمي للإصدار الجديد مختلف عن القديم.",
                ],
              },
              {
                icon: MonitorSmartphone,
                title: "ملاحظة Play Protect («قد يكون هذا التطبيق ضاراً»)",
                steps: [
                  "هذا فحص تلقائي من جوجل للملفات خارج المتجر — اضغط «التثبيت على أي حال».",
                  "الملف موقّع رقمياً وآمن، وجميع ملفات المشروع مفتوحة المصدر أمامك.",
                ],
              },
              {
                icon: Smartphone,
                title: "التطبيق لا يفتح أو يظهر أسود",
                steps: [
                  "تأكد أن الهاتف يعمل بنظام أندرويد 7.0 أو أحدث.",
                  "التطبيق يحتاج إنترنت لتحميل الأسئلة — جرّب إعادة فتحه بعد تأكد الاتصال.",
                ],
              },
            ].map((item) => (
              <details
                key={item.title}
                className="group rounded-2xl border border-border/80 bg-card p-4 open:shadow-sm"
              >
                <summary className="flex cursor-pointer list-none items-center gap-3 text-sm font-bold">
                  <item.icon className="size-4.5 shrink-0 text-rose-500" />
                  <span className="flex-1">{item.title}</span>
                  <span className="text-xs text-muted-foreground transition-transform group-open:rotate-180">
                    ▼
                  </span>
                </summary>
                <ul className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
                  {item.steps.map((step) => (
                    <li key={step} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                      <span className="mt-1 size-1 shrink-0 rounded-full bg-primary" />
                      {step}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            لم يحل المشكلة؟ صوّر الرسالة الظاهرة وأرسلها لنا — ونضيف حلها هنا مباشرة.
          </p>
        </section>

        {/* What's new */}
        <section className="mt-10">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Rocket className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold">ما الجديد في الإصدار {version}؟</h2>
              <p className="text-xs text-muted-foreground">ملاحظات الإصدار منشورة من الخادم — تتحدث تلقائياً</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-border/80 bg-card p-6">
            {info === undefined ? (
              <div className="flex justify-center py-8">
                <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <ul className="space-y-2.5">
                {info.notes.map((note) => (
                  <li key={note} className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                      <Check className="size-3" />
                    </span>
                    {note}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Update plan */}
        <section className="mt-10">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
              <RefreshCw className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold">كيف يتحدث التطبيق؟ (خطة التحديث)</h2>
              <p className="text-xs text-muted-foreground">ثلاث طبقات تضمن وصول كل نسخة جديدة إليك</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              {
                icon: RefreshCw,
                title: "نسخة الويب",
                text: "تتحدث تلقائياً — كل فتح للصفحة يسحب أحدث إصدار، ويُمسح كاش التحديث القديم عند إعادة التحميل.",
              },
              {
                icon: MonitorSmartphone,
                title: "نسخة PWA المثبتة",
                text: "لافتة «تحديث متاح» تظهر داخل التطبيق، وبضغطة واحدة تُمسح الذاكرة المؤقتة ويُعاد التحميل بالإصدار الجديد.",
              },
              {
                icon: Smartphone,
                title: "تطبيق أندرويد (APK)",
                text: "يقارن التطبيق إصداره بالخادم عند كل فتح. عند وجود إصدار أحدث تظهر اللافتة مع رابط تنزيل APK الجديد من هذه الصفحة.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-border/80 bg-card p-5">
                <item.icon className="size-5 text-primary" />
                <h3 className="mt-3 text-sm font-bold">{item.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer note */}
        <div className="mt-12 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Check className="size-3.5 text-primary" />
          {APP_VERSION_LABEL} — التحديثات تصل تلقائياً ولا تحتاج إعادة تثبيت يدوية.
        </div>
      </main>
    </div>
  );
}
