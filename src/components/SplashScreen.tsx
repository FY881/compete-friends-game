/**
 * شاشة البداية الجميلة — تحدي العقول
 * صورة تحميل أنيقة مع رسم متحرك للدماغ
 */
import { motion } from "framer-motion";

export function SplashScreen() {
  return (
    <div
      dir="rtl"
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e293b 30%, #0f766e 70%, #0d9488 100%)",
      }}
    >
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white/5"
            style={{
              width: Math.random() * 60 + 20,
              height: Math.random() * 60 + 20,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.1, 0.3, 0.1],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: Math.random() * 4 + 3,
              repeat: Infinity,
              delay: Math.random() * 2,
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
            "radial-gradient(circle at 50% 40%, rgba(20,184,166,0.15) 0%, transparent 60%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 flex flex-col items-center"
      >
        {/* Brain Icon */}
        <motion.div
          animate={{
            boxShadow: [
              "0 0 20px rgba(20,184,166,0.3)",
              "0 0 60px rgba(20,184,166,0.5)",
              "0 0 20px rgba(20,184,166,0.3)",
            ],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="flex size-28 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-sm"
        >
          {/* Brain SVG */}
          <motion.svg
            width="72"
            height="72"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-teal-300"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Brain shape */}
            <path d="M12 2a4 4 0 0 0-4 4c0 .5.1 1 .3 1.4A3.5 3.5 0 0 0 5 11a3.5 3.5 0 0 0 1.2 2.6A3 3 0 0 0 6 17a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3 3 3 0 0 0-.2-3.4A3.5 3.5 0 0 0 19 11a3.5 3.5 0 0 0-3.3-3.6c.2-.4.3-.9.3-1.4a4 4 0 0 0-4-4z" />
            <path d="M12 2v20" />
            <path d="M8 6c2 1 4 1 6 0" />
            <path d="M7 12c1.5-1 3.5-1 5 0s3.5 1 5 0" />
          </motion.svg>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mt-8 text-4xl font-black tracking-tight text-white sm:text-5xl"
        >
          تحدي العقول
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-3 text-base font-medium text-teal-200/80"
        >
          اختبر عقلك... تحدَّ أصدقاءك...
        </motion.p>

        {/* Loading dots */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-10 flex items-center gap-2"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="size-2 rounded-full bg-teal-400"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut",
              }}
            />
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.7, 0] }}
          transition={{ delay: 1, duration: 2, repeat: Infinity }}
          className="mt-4 text-xs text-white/40"
        >
          جارٍ التحميل...
        </motion.p>
      </motion.div>
    </div>
  );
}
