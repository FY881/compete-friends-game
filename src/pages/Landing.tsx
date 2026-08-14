import { motion } from "framer-motion";
import {
  ArrowLeft,
  BrainCircuit,
  Check,
  Crown,
  Gamepad2,
  Gift,
  Hourglass,
  Link2,
  Medal,
  Play,
  Sparkles,
  Swords,
  Timer,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
        <div className="flex items-center justify-between">
          <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
            <Sparkles className="size-3" />
            جغرافيا · السؤال 2 من 5
          </Badge>
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
    title: "السرعة = نقاط",
    text: "كل إجابة صحيحة تكسبك 100 نقطة، وكلما أجبت أسرع زادت المكافأة حتى 100 نقطة إضافية.",
  },
  {
    icon: BrainCircuit,
    title: "فئات متجددة",
    text: "عام، علوم، جغرافيا، رياضيات، لغة، منطق وتاريخ — جولة مختلفة في كل مرة، وأسئلة لا تتكرر.",
  },
  {
    icon: Users,
    title: "ترتيب مباشر",
    text: "شاهد تحرّك النقاط لحظة بلحظة واعرف من يتصدر قبل انتهاء الجولة.",
  },
  {
    icon: Trophy,
    title: "منصة الفائزين",
    text: "في نهاية الجولة تتوّج القمة الثلاثية مع ملخص كامل لإجابات الجميع.",
  },
];

const STATS = [
  { value: "5", label: "أسئلة في كل جولة" },
  { value: "15 ث", label: "لكل سؤال" },
  { value: "200", label: "أقصى نقطة للسؤال" },
  { value: "لانهائي", label: "أصدقاء يمكنهم اللعب" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

export default function Landing() {
  return (
    <div dir="rtl" className="min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <BrainCircuit className="size-5" />
            </span>
            <span className="text-lg font-bold tracking-tight">تحدّي العقول</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#how" className="transition-colors hover:text-foreground">
              كيف تلعب
            </a>
            <a href="#features" className="transition-colors hover:text-foreground">
              لماذا تحدّي العقول
            </a>
            <a href="#cta" className="transition-colors hover:text-foreground">
              ابدأ الآن
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link to="/auth">تسجيل الدخول</Link>
            </Button>
            <Button asChild className="gap-1.5">
              <Link to="/play">
                <Play className="size-4" />
                العب الآن
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
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
                لعبة تحديات تنافسية بين الأصدقاء
              </Badge>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-4xl font-bold leading-[1.2] tracking-tight sm:text-5xl lg:text-[3.4rem]"
            >
              نفس السؤال،
              <br />
              <span className="text-primary">أسرع عقل يفوز.</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground"
            >
              تحدٍّ سريع من خمسة أسئلة تتنافسون فيه مع أصدقائك لحظة بلحظة.
              أنشئ غرفة، شارك الرمز، وأثبت أن بديهتك هي الأسرع.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-9 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="gap-2 rounded-xl px-7 text-base">
                <Link to="/play">
                  <Play className="size-4.5" />
                  ابدأ التحدي
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2 rounded-xl px-7 text-base">
                <Link to="/play">
                  <Link2 className="size-4.5" />
                  انضم برمز
                </Link>
              </Button>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-muted-foreground"
            >
              <span className="flex items-center gap-2">
                <Gift className="size-4 text-primary" />
                لا حاجة لتحميل تطبيق
              </span>
              <span className="flex items-center gap-2">
                <Hourglass className="size-4 text-primary" />
                جولة كاملة في دقيقتين
              </span>
              <span className="flex items-center gap-2">
                <Users className="size-4 text-primary" />
                من 1 إلى 10 لاعبين
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
              <p className="text-sm font-semibold text-primary">لماذا تحدّي العقول؟</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                ليست مسابقة معلومات…
                <br />
                إنها معركة بديهة.
              </h2>
              <p className="mt-5 max-w-md leading-relaxed text-muted-foreground">
                كل سؤال محسوب بالثواني، وكل قرار يرفعك أو يهبط بك في الترتيب.
                الفكرة بسيطة، لكن المنافسة مع الأصدقاء تشتعل في كل جولة.
              </p>
              <Button asChild size="lg" className="mt-8 gap-2 rounded-xl px-7">
                <Link to="/play">
                  جرّب جولة الآن
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
          <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
            من سيتصدّر قائمة أصدقائك الليلة؟
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-primary-foreground/85">
            افتح غرفة، أرسل الرمز، وشاهد المنافسة تشتعل. الجولة الواحدة لا تأخذ
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
              ابدأ التحدي الآن
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
            <span className="font-semibold text-foreground">تحدّي العقول</span>
          </div>
          <p>معركة الأصدقاء الفكرية — العب، تحدَّ، وافز.</p>
          <div className="flex items-center gap-2">
            <Medal className="size-4 text-primary" />
            صُنع بحب لمن يحبون التحديات
          </div>
        </div>
      </footer>
    </div>
  );
}
