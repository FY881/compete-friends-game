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
          "linear-gradient(135deg, #0B1121 0%, #111827 25%, #1E3A5F 50%, #2563EB 75%, #1E40AF 100%)",
      }}
    >
      {/* Animated grid background */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Animated particles */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: Math.random() * 4 + 2,
              height: Math.random() * 4 + 2,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: i % 3 === 0
                ? "rgba(245,158,11,0.4)"
                : "rgba(59,130,246,0.3)",
            }}
            animate={{
              y: [0, -(Math.random() * 80 + 20), 0],
              opacity: [0.2, 0.8, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: Math.random() * 5 + 3,
              repeat: Infinity,
              delay: Math.random() * 3,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Radial glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, rgba(37,99,235,0.25) 0%, transparent 50%), radial-gradient(circle at 30% 70%, rgba(245,158,11,0.1) 0%, transparent 40%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center"
      >
        {/* War Brain Icon — Premium glow */}
        <motion.div
          animate={{
            boxShadow: [
              "0 0 30px rgba(37,99,235,0.4), 0 0 60px rgba(245,158,11,0.1)",
              "0 0 60px rgba(37,99,235,0.6), 0 0 100px rgba(245,158,11,0.2)",
              "0 0 30px rgba(37,99,235,0.4), 0 0 60px rgba(245,158,11,0.1)",
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="flex size-32 items-center justify-center rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md"
        >
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
            className="text-blue-300"
            animate={{ rotate: [0, 3, -3, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
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
          transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
          className="mt-10 text-5xl font-black tracking-tight sm:text-6xl"
        >
          <span className="bg-gradient-to-l from-blue-300 via-white to-amber-300 bg-clip-text text-transparent">
            حرب العقول
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.7 }}
          className="mt-4 text-lg font-medium text-blue-200/70"
        >
          ساحة المعركة الذكية — تحدَّ، انتصر، واحكم
        </motion.p>

        {/* Loading dots with gold accent */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-12 flex items-center gap-3"
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="rounded-full"
              style={{
                width: i === 2 ? 10 : 6,
                height: i === 2 ? 10 : 6,
                background: i === 2
                  ? "#F59E0B"
                  : `rgba(59,130,246,${0.3 + i * 0.15})`,
              }}
              animate={{
                scale: [1, 1.6, 1],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "easeInOut",
              }}
            />
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.6, 0] }}
          transition={{ delay: 1.5, duration: 2.5, repeat: Infinity }}
          className="mt-5 text-xs text-white/30"
        >
          جارٍ التحميل...
        </motion.p>
      </motion.div>
    </div>
  );
}
