import { motion } from "framer-motion";
import { BrainCircuit, Compass, Home } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      {/* Decorative background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at 80% 15%, color-mix(in oklab, var(--primary) 10%, transparent) 0, transparent 40%), radial-gradient(circle at 15% 85%, color-mix(in oklab, var(--primary) 7%, transparent) 0, transparent 35%)",
        }}
      />

      <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center"
        >
          <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Compass className="size-8" />
          </span>

          <p className="mt-8 text-6xl font-bold tracking-tight text-primary sm:text-7xl">
            404
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">
            هذه الصفحة خارج الملعب
          </h1>
          <p className="mt-3 max-w-md leading-relaxed text-muted-foreground">
            يبدو أنك ضللت الطريق بعيداً عن التحدي. الرابط غير صحيح أو أن
            الصفحة لم تعد موجودة.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="gap-2 rounded-xl px-7">
              <Link to="/">
                <Home className="size-4" />
                العودة للرئيسية
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2 rounded-xl px-7">
              <Link to="/play">
                <BrainCircuit className="size-4" />
                ابدأ التحدي
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
