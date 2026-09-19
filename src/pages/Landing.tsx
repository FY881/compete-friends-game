import { ZakaLogo } from "@/components/ZakaLogo";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BrainCircuit,
  Check,
  Crown,
  Eraser,
  Flame,
  Gamepad2,
  Gem,
  RefreshCw,
  Hourglass,
  Layers,
  Link2,
  Medal,
  Play,
  Quote,
  Scale,
  Smartphone,
  Sparkles,
  Swords,
  Timer,
  Trophy,
  Users,
  Zap,
  Shield,
  MessageSquare,
  Globe,
} from "lucide-react";
import { Link } from "react-router";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { UpdateBanner } from "@/components/UpdateBanner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/convex/questions";

const AVATAR_COLORS = [
  "bg-teal-600",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-emerald-600",
  "bg-orange-500",
];

function Avatar({ name, index }: { name: string; index: number }) {
  return (
    <div
      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${AVATAR_COLORS[index % AVATAR_COLORS.length]}`}
    >
      {name.slice(0, 1)}
    </div>
  );
}

function HeroMock() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* Glow behind the mock */}
      <div
        aria-hidden
        className="absolute -inset-8 rounded-[2.5rem] bg-gradient-to-tr from-primary/15 via-primary/5 to-amber-400/10 blur-2xl"
      />

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="relative rounded-3xl border border-border/80 bg-card p-6 shadow-2xl shadow-primary/10"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
              <Sparkles className="size-3" />
              جغرافيا · السؤال 2 من 5
            </Badge>
            <Badge
              variant="outline"
              className="gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-700"
            >
              <span className="size-1.5 rounded-full bg-amber-500" />
              متوسط
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-semibold tabular-nums text-foreground">
            <Timer className="size-3.5 text-primary" />
            0:12
          </div>
        </div>

        <p className="mt-5 text-xl font-bold leading-relaxed text-foreground">
          ما هي عاصمة اليابان؟
        </p>

        <div className="mt-5 grid gap-2.5">
          {["أوساكا", "طوكيو", "كيوتو", "هيروشيما"].map((opt, i) => {
            const isPick = i === 1;
            return (
              <div
                key={opt}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium ${
                  isPick
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/80 bg-background text-foreground"
                }`}
              >
                <span>{opt}</span>
                {isPick && (
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Floating leaderboard card */}
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        className="absolute -bottom-12 -start-4 w-60 rounded-2xl border border-border/80 bg-card p-4 shadow-xl shadow-primary/10 sm:-start-10"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-foreground">الترتيب المباشر</p>
          <span className="flex size-2 rounded-full bg-emerald-500">
            <span className="absolute size-2 animate-ping rounded-full bg-emerald-500 opacity-75" />
          </span>
        </div>
        <div className="mt-3 space-y-2.5">
          {[
            { name: "سارة", score: 185, gold: true },
            { name: "خالد", score: 100 },
            { name: "أنت", score: 95 },
          ].map((p, i) => (
            <div key={p.name} className="flex items-center gap-2.5">
              <Avatar name={p.name} index={i} />
              <span className="flex-1 truncate text-sm font-medium text-foreground">
                {p.name}
              </span>
              {p.gold && <Crown className="size-3.5 text-amber-500" />}
              <span className="text-sm font-bold tabular-nums text-primary">
                {p.score}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Floating speed-bonus chip */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
        className="absolute -top-5 -end-3 flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-3.5 py-2 text-sm font-bold text-foreground shadow-lg shadow-primary/10 sm:-end-8"
      >
        <Zap className="size-4 text-amber-500" />
        أجبت أولاً! +185
      </motion.div>

      {/* Floating streak chip */}
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute -bottom-6 -end-2 flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-card px-3.5 py-2 text-sm font-bold text-orange-600 shadow-lg shadow-primary/10 sm:-end-6"
      >
        <Flame className="size-4" />
        سلسلة 3 · +40 إضافية
      </motion.div>
    </div>
  );
}

const STEPS = [
  {
    icon: Gamepad2,
    title: "أنشئ التحدي",
    text: "اضغط زر البدء وسنولّد رمزاً خاصاً لغرفتك خلال ثانية.",
  },
  {
    icon: Link2,
    title: "شارك الرمز مع أصدقائك",
    text: "أرسل الرمز في مجموعة واتساب أو انسخ رابط الدعوة المباشر.",
  },
  {
    icon: Swords,
    title: "تنافسوا على القمة",
    text: "نفس الأسئلة، نفس الوقت، وأسرع عقل يجمع أكبر عدد من النقاط.",
  },
];

const FEATURES = [
  {
    icon: Zap,
    title: "نقاط حسب الصعوبة",
    text: "الأسئلة تصنّف سهلة ومتوسطة وصعبة، والإجابة الصحيحة السريعة تصل إلى 380 نقطة.",
  },
  {
    icon: Flame,
    title: "سلاسل تكسب أكثر",
    text: "الإجابات الصحيحة المتتالية تضاعف مكافآتك — لا تتوقف بعد أول إجابة صحيحة.",
  },
  {
    icon: Eraser,
    title: "منقّي 50/50",
    text: "في اللحظة الحاسمة امسح إجابتين خاطئتين وضيّق الخيارات قبل انتهاء الوقت.",
  },
  {
    icon: Layers,
    title: "غرف مخصصة",
    text: "اختر عدد الأسئلة (3–10) والوقت لكل سؤال، وفلتر الفئات التي تريد المنافسة فيها.",
  },
  {
    icon: Medal,
    title: "خبرة ومستويات وشارات",
    text: "كل جولة تمنح XP يرفع مستواك، وافتح 11 شارة إنجاز تعكس أسلوب لعبك.",
  },
  {
    icon: Trophy,
    title: "منصة الفائزين",
    text: "ترتيب مباشر خلال الجولة ومنصة ثلاثية في النهاية مع مراجعة كل سؤال بالتفصيل.",
  },
];


const AI_FEATURES = [
  { icon: BrainCircuit, title: "مولد الأسئلة", desc: "أسئلة مولّدة بالذكاء الاصطناعي تتجدد باستمرار" },
  { icon: Sparkles, title: "تلميحات ذكية", desc: "تلميحات أثناء اللعب تساعدك على الإجابة" },
  { icon: Zap, title: "حل ذاتي", desc: "نظام حل المشاكل الذاتي يكتشف ويصلح الأخطاء" },
  { icon: Shield, title: "تحكم بالـ AI", desc: "تحكم كامل باللعبة بأوامر ذكية من المالك" },
  { icon: MessageSquare, title: "شفافية", desc: "صراحة مطلقة — الذكاء الاصطناعي يساعدك تطوّر اللعبة" },
  { icon: Globe, title: "تحديات يومية", desc: "تحديات ذكية تتجدد كل يوم" },
  { icon: Users, title: "فرق ومقاعد", desc: "افتح فرقة وامنح أصدقاءك مستوى حقيقياً بمقعد واحد" },
  { icon: Crown, title: "رتب شرفية", desc: "أيام عضويتك تُبنى إلى رتب بمكافآت دائمة لا تنتهي" },
  { icon: Gem, title: "خزنة بنِسَب معلنة", desc: "نِسَب معلنة ونظام رحمة يضمن لك مكافأة نادرة" },
  { icon: RefreshCw, title: "رصيد أيام", desc: "ادّخر أيام عضويتك واسترد نصفها في أي تجديد" },
];

const STATS = [
  { value: "320+", label: "سؤال في البنك" },
  { value: "80", label: "لعبة مصغرة" },
  { value: "12", label: "لاعباً في الغرفة" },
  { value: "380", label: "أقصى نقطة للسؤال" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

export default function Landing() {
  return (
    <div dir="rtl" className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <AnnouncementBanner />

      {/* ── Update notice (server-driven version check) ────────── */}
      <div className="mx-auto max-w-6xl px-5 pt-5">
        <UpdateBanner />
      </div>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <ZakaLogo className="size-5 text-primary-foreground" size={20} />
            </span>
            <span className="text-lg font-bold tracking-tight">حرب العقول</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#how" className="transition-colors hover:text-foreground">
              كيف تلعب
            </a>
            <a href="#features" className="transition-colors hover:text-foreground">
              لماذا حرب العقول مختلفة
            </a>
            <a href="#cta" className="transition-colors hover:text-foreground">
              ابدأ الآن
            </a>
            <Link to="/rules" className="flex items-center gap-1 transition-colors hover:text-foreground">
              <Scale className="size-3.5" />
              القوانين
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link to="/auth">تسجيل الدخول</Link>
            </Button>
            <Button asChild variant="outline" className="hidden gap-1.5 rounded-xl md:inline-flex">
              <Link to="/download">
                <Smartphone className="size-4" />
                حمّل التطبيق
              </Link>
            </Button>
            <Button asChild className="gap-1.5">
              <Link to="/play">
                <Play className="size-4" />
                ادخل ساحة المعركة
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-primary/5 to-amber-500/5">
        {/* Decorative background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 85% 15%, color-mix(in oklab, var(--primary) 10%, transparent) 0, transparent 40%), radial-gradient(circle at 10% 75%, color-mix(in oklab, #f59e0b 8%, transparent) 0, transparent 35%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(to left, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 75%)",
          }}
        />

        <div className="mx-auto grid max-w-6xl items-center gap-16 px-5 pb-24 pt-16 md:grid-cols-2 md:pt-24">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09 } } }}
          >
            <motion.div variants={fadeUp}>
              <Badge variant="outline" className="mb-6 gap-1.5 rounded-full px-3.5 py-1.5 text-primary">
                <Sparkles className="size-3.5" />
                أقوى تحدي ذكاء بين الأصدقاء
              </Badge>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-4xl font-bold leading-[1.2] tracking-tight sm:text-5xl lg:text-[3.4rem]"
            >
              ساحة المعركة،
              <br />
              <span className="text-primary">أسرع عقل ينتصر.</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground"
            >
              معركة ذكاء سريعة تتنافسون فيها مع أصدقائك لحظة بلحظة: نفس الأسئلة، نفس
              الوقت، وسلاسل ومكافآت ومنقّي 50/50 لمن يجرؤ. أنشئ غرفة مخصصة، شارك
              الرمز، وأثبت أن عقلك هو الأقوى.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-9 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="gap-2 rounded-xl px-7 text-base">
                <Link to="/play">
                  <Play className="size-4.5" />
                  ابدأ المعركة
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2 rounded-xl px-7 text-base">
                <Link to="/play">
                  <Link2 className="size-4.5" />
                  انضم برمز
                </Link>
              </Button>
              {/* 🛡 مدخل فوري مضمون: ساحة محلية كاملة تعمل بلا خادم ولا حساب */}
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="gap-2 rounded-xl px-7 text-base"
              >
                <Link to="/arena">
                  <Gamepad2 className="size-4.5" />
                  العب فوراً بلا حساب
                </Link>
              </Button>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-muted-foreground"
            >
              <Link to="/download" className="flex items-center gap-2 transition-colors hover:text-primary">
                <Smartphone className="size-4 text-primary" />
                تطبيق أندرويد جاهز للتحميل
              </Link>
              <span className="flex items-center gap-2">
                <Hourglass className="size-4 text-primary" />
                جولة كاملة في دقيقتين
              </span>
              <span className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                من 1 إلى 12 لاعباً
              </span>
              <span className="flex items-center gap-2">
                <Medal className="size-4 text-primary" />
                خبرة وشارات لكل جولة
              </span>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="pb-10 pt-4"
          >
            <HeroMock />
          </motion.div>
        </div>
      </section>

      {/* ── Stats strip ────────────────────────────────────────── */}
      <section className="border-y border-border/70 bg-card/60">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-5 py-10 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-bold tracking-tight text-primary">{s.value}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How to play ────────────────────────────────────────── */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-24">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
          className="text-center"
        >
          <motion.p variants={fadeUp} className="text-sm font-semibold text-primary">
            كيف تلعب
          </motion.p>
          <motion.h2 variants={fadeUp} className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            ثلاث خطوات فقط
          </motion.h2>
        </motion.div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group relative rounded-2xl border border-border/80 bg-card p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <step.icon className="size-6" />
                </span>
                <span className="text-5xl font-bold text-border/70">0{i + 1}</span>
              </div>
              <h3 className="mt-6 text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section id="features" className="border-y border-border/70 bg-card/50">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.2fr]">
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-sm font-semibold text-primary">لماذا حرب العقول مختلفة؟</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                ليست مسابقة معلومات…
                <br />
                إنها معركة عقول.
              </h2>
              <p className="mt-5 max-w-md leading-relaxed text-muted-foreground">
                كل سؤال محسوب بالثواني، وكل قرار يرفعك أو يهبط بك في الترتيب.
                الفكرة بسيطة، لكن المنافسة مع الأصدقاء تشتعل في كل جولة.
              </p>
              <Button asChild size="lg" className="mt-8 gap-2 rounded-xl px-7">
                <Link to="/play">
                  جرّب معركة الآن
                  <ArrowLeft className="size-4.5" />
                </Link>
              </Button>
            </motion.div>

            <div className="grid gap-5 sm:grid-cols-2">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
                >
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <f.icon className="size-5.5" />
                  </span>
                  <h3 className="mt-4 font-bold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Categories ────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <p className="text-sm font-semibold text-primary">بنك أسئلة ضخم</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            من الفضاء إلى المطبخ…
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted-foreground">
            أكثر من 320 سؤالاً موزعة على 18 فئة. في الغرف المخصصة يمكنك تضييق
            المنافسة على الفئات المفضلة لديك، وكل جولة تُختار عشوائياً فلا
            تتكرر الأسئلة أبداً.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-10 flex flex-wrap justify-center gap-2.5"
        >
          {CATEGORIES.map((category, i) => (
            <span
              key={category}
              className="rounded-full border border-border/80 bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary"
              style={{ transitionDelay: `${(i % 6) * 20}ms` }}
            >
              {category}
            </span>
          ))}
        </motion.div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────── */}
      <section className="border-y border-border/70 bg-card/50">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <p className="text-sm font-semibold text-primary">              آراء المحاربين</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              معارك العقول لا تُنسى
            </h2>
          </motion.div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              {
                name: "سارة",
                role: "تلعب مع فريق عملها كل جمعة",
                text: "أصبحت جولات الجمعة تقليداً عندنا. أكثر شيء أستمتع به هو منقّي 50/50 في السؤال الأخير — الضغط حقيقي!",
              },
              {
                name: "خالد",
                role: "تحدّى صديقه في 12 جولة متتالية",
                text: "ظننت أني أعرف كل شيء عن أصدقائي، حتى أصبحت أطاردهم في الترتيب المباشر. السلاسل غيّرت طريقة لعبنا كلياً.",
              },
              {
                name: "نور",
                role: "جمعت 9 شارات",
                text: "الخبرة والمستويات جعلتني أستمر — كل جولة أكتشف فئة جديدة أبدع فيها. حتى الأسئلة الصعبة صارت هوايتي.",
              },
            ].map((t, i) => (
              <motion.figure
                key={t.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex flex-col rounded-2xl border border-border/80 bg-card p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <Quote className="size-5 text-primary/50" />
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-foreground">
                  {t.text}
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-border/70 pt-4">
                  <Avatar name={t.name} index={i} />
                  <div>
                    <p className="text-sm font-bold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-5 py-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <p className="text-sm font-semibold text-primary">أسئلة شائعة</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            كل ما تريد معرفته
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-10"
        >
          <Accordion type="single" collapsible className="space-y-3">
            {[
              {
                q: "كيف أبدأ جولة مع أصدقائي؟",
                a: "اضغط «ابدأ التحدي»، اختر اسمك، وستحصل على رمز غرفة من 6 أحرف. أرسل الرمز أو رابط الدعوة لأصدقائك، وابدأ الجولة فور انضمامهم.",
              },
              {
                q: "هل يمكنني تخصيص الجولة؟",
                a: "نعم — المضيف يستطيع في الغرفة اختيار عدد الأسئلة (3، 5، 7 أو 10)، والوقت لكل سؤال (10–30 ثانية)، والفئات التي ستعتمدها الأسئلة.",
              },
              {
                q: "كيف تُحتسب النقاط؟",
                a: "الإجابة الصحيحة تمنح نقاطاً حسب صعوبة السؤال (حتى 200) بالإضافة إلى مكافأة سرعة تتناقص مع مرور الوقت (حتى 180). السلاسل المتتالية تضيف مكافآت إضافية حتى 100 نقطة.",
              },
              {
                q: "ما هو منقّي 50/50؟",
                a: "أداة تُستخدم مرة واحدة في كل جولة: تمسح إجابتين خاطئتين ليتبقى أمامك خياران فقط. الخادم هو من يختار الإجابات المستبعدة، فلا يمكن التلاعب بها.",
              },
              {
                q: "ماذا تكسب من اللعب؟",
                a: "كل جولة تمنحك نقاط خبرة (XP) ترفع مستواك، وشارات إنجاز تفتحها حسب أدائك — أول فوز، سلاسل، سرعة إجابة، والكثير غيرها. كل ذلك في ملفك الشخصي.",
              },
              {
                q: "هل أحتاج تسجيل حساب؟",
                a: "نعم، عبر بريد إلكتروني برمز تحقق سريع — أو يمكنك الدخول كضيف دون أي بيانات للعب مع أصدقائك.",
              },
              {
                q: "ما هي قوانين اللعب؟ وهل هناك عقوبات؟",
                a: "اللعب النزيه إلزامي: ممنوع الإساءة والغش والمحتوى غير اللائق. يرصد النظام تلقائياً مغادرة نافذة اللعب أثناء الأسئلة، وتُطبَّق عقوبات تصاعدية (تحذير ← خصم نقاط ← حظر) تلقائياً، ويديرها رقيب آلي متقدم. اطّلع على القوانين كاملة من صفحة «القوانين».",
              },
            ].map((item) => (
              <AccordionItem
                key={item.q}
                value={item.q}
                className="rounded-2xl border border-border/80 bg-card px-5 shadow-sm"
              >
                <AccordionTrigger className="py-4 text-start text-sm font-bold">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section id="cta" className="mx-auto max-w-6xl px-5 py-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl bg-primary px-8 py-16 text-center text-primary-foreground shadow-xl shadow-primary/20"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, white 0, transparent 35%), radial-gradient(circle at 80% 80%, white 0, transparent 35%)",
            }}
          />
          <Trophy className="mx-auto size-12" />
          <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">              من سيتصدّر قائمة المعركة الليلة؟
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-primary-foreground/85">              افتح غرفة، أرسل الرمز، وشاهد المعركة تشتعل. الجولة الواحدة لا تأخذ
              أكثر من دقيقتين.
          </p>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="mt-9 gap-2 rounded-xl bg-white px-8 text-base text-primary hover:bg-white/90"
          >
            <Link to="/play">
              <Play className="size-4.5" />
              ابدأ المعركة الآن
            </Link>
          </Button>
        </motion.div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BrainCircuit className="size-4" />
            </span>
            <span className="font-semibold text-foreground">حرب العقول</span> — ساحة المعركة الذكية
          </div>
          <p>معركة العقول — العب، انتصر، واحكم.</p>
          <div className="flex items-center gap-2">
            <Medal className="size-4 text-primary" />              صُنع بحب لمحبي المعركة والذكاء
          </div>
          <div className="flex items-center gap-4">
            <Link to="/download" className="flex items-center gap-1.5 transition-colors hover:text-foreground">
              <Smartphone className="size-3.5" />
              تحميل التطبيق
            </Link>
            <Link to="/rules" className="flex items-center gap-1.5 transition-colors hover:text-foreground">
              <Scale className="size-3.5" />
              قوانين اللعب
            </Link>
            <Link to="/rules" className="transition-colors hover:text-foreground">
              السياسة والعقوبات
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
