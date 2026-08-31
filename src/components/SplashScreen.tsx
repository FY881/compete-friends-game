/**
 * شاشة البداية — حرب العقول
 * تجربة افتتاحية مذهلة مع أنيمشن عالي الجودة
 */
import { motion } from "framer-motion";

export function SplashScreen() {
  return (
    <div
      dir="rtl"
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #050a18 0%, #0B1121 20%, #111827 40%, #1a2744 60%, #1E3A5F 80%, #2563EB 100%)",
      }}
    >
      {/* Animated grid background */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Animated particles */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: Math.random() * 4 + 1,
              height: Math.random() * 4 + 1,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background:
                i % 4 === 0
                  ? "rgba(245,158,11,0.5)"
                  : i % 3 === 0
                    ? "rgba(96,165,250,0.4)"
                    : "rgba(59,130,246,0.25)",
            }}
            animate={{
              y: [0, -(Math.random() * 120 + 30), 0],
              x: [0, (Math.random() - 0.5) * 40, 0],
              opacity: [0.1, 0.7, 0.1],
              scale: [1, 1.8, 1],
            }}
            transition={{
              duration: Math.random() * 6 + 3,
              repeat: Infinity,
              delay: Math.random() * 4,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Multiple radial glows */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 35%, rgba(37,99,235,0.3) 0%, transparent 45%), radial-gradient(circle at 30% 70%, rgba(245,158,11,0.12) 0%, transparent 35%), radial-gradient(circle at 70% 60%, rgba(96,165,250,0.1) 0%, transparent 30%)",
        }}
      />

      {/* Rotating ring decoration */}
      <motion.div
        className="absolute size-[28rem] rounded-full border border-white/[0.04]"
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute size-[22rem] rounded-full border border-white/[0.06]"
        animate={{ rotate: -360 }}
        transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center"
      >
        {/* War Brain Icon — Premium glow */}
        <motion.div
          animate={{
            boxShadow: [
              "0 0 30px rgba(37,99,235,0.3), 0 0 60px rgba(245,158,11,0.08)",
              "0 0 50px rgba(37,99,235,0.5), 0 0 100px rgba(245,158,11,0.15), 0 0 150px rgba(37,99,235,0.1)",
              "0 0 30px rgba(37,99,235,0.3), 0 0 60px rgba(245,158,11,0.08)",
            ],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="flex size-36 items-center justify-center rounded-[2.2rem] border border-white/10 bg-white/5 backdrop-blur-xl"
        >
          {/* Rotating inner ring */}
          <motion.div
            className="absolute size-28 rounded-full border border-blue-400/10"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />

          {/* Brain SVG */}
          <motion.svg
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="relative z-10 text-blue-300"
            animate={{ rotate: [0, 2, -2, 0], scale: [1, 1.02, 1] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <path d="M12 2a4 4 0 0 0-4 4c0 .5.1 1 .3 1.4A3.5 3.5 0 0 0 5 11a3.5 3.5 0 0 0 1.2 2.6A3 3 0 0 0 6 17a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3 3 3 0 0 0-.2-3.4A3.5 3.5 0 0 0 19 11a3.5 3.5 0 0 0-3.3-3.6c.2-.4.3-.9.3-1.4a4 4 0 0 0-4-4z" />
            <path d="M12 2v20" />
            <path d="M8 6c2 1 4 1 6 0" />
            <path d="M7 12c1.5-1 3.5-1 5 0s3.5 1 5 0" />
            {/* Lightning bolts for "war" theme */}
            <path d="M10 8l1.5-2L10 5" stroke="#F59E0B" strokeWidth="1.5" />
            <path d="M14 8l1.5-2L14 5" stroke="#F59E0B" strokeWidth="1.5" />
          </motion.svg>
        </motion.div>

        {/* Title — حرب العقول */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl"
        >
          <span className="animate-war-text-glow bg-gradient-to-l from-blue-300 via-white to-amber-300 bg-clip-text text-transparent">
            حرب العقول
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="mt-5 text-lg font-medium text-blue-200/60"
        >
          ساحة المعركة الذكية — تحدَّ، انتصر، واحكم
        </motion.p>

        {/* Loading dots with gold accent */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="mt-14 flex items-center gap-3"
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="rounded-full"
              style={{
                width: i === 2 ? 10 : 6,
                height: i === 2 ? 10 : 6,
                background:
                  i === 2
                    ? "#F59E0B"
                    : `rgba(59,130,246,${0.25 + i * 0.15})`,
              }}
              animate={{
                scale: [1, 1.8, 1],
                opacity: [0.2, 1, 0.2],
              }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                delay: i * 0.18,
                ease: "easeInOut",
              }}
            />
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ delay: 1.8, duration: 3, repeat: Infinity }}
          className="mt-5 text-xs text-white/25"
        >
          جارٍ تجهيز ساحة المعركة...
        </motion.p>
      </motion.div>
    </div>
  );
}
