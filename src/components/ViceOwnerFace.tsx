/**
 * 👤 وجه نائب المالك الحي — أنيميشن تفاعلي يعكس قوته ومعرفته
 * عينان تتبعان، هالة تتوسع مع كل دورة عمل، وميض عند النشاط،
 * وشعاع معرفة يدور حول الوجه — كل شيء CSS خالص عالي الأداء.
 */
import { motion } from "framer-motion";

interface Props {
  active: boolean; // هل يعمل الآن؟
  turnCount: number; // عدد الدورات — يزيد الإشراق
  critical: number; // عدد الأحداث الحرجة — يغيّر لون الهالة
  size?: number;
}

export function ViceOwnerFace({ active, turnCount, critical, size = 120 }: Props) {
  const glowColor = critical > 0 ? "#f43f5e" : active ? "#f59e0b" : "#64748b";
  const intensity = Math.min(1, 0.35 + turnCount * 0.04 + (active ? 0.25 : 0));

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* الهالة الخارجية — تتنفس */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${glowColor}33 0%, transparent 70%)`,
          boxShadow: `0 0 ${20 + intensity * 40}px ${glowColor}${active ? "55" : "22"}`,
        }}
        animate={active ? { scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] } : { scale: 1, opacity: 0.5 }}
        transition={active ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.5 }}
      />

      {/* حلقة المعرفة الدوّارة */}
      <motion.div
        className="absolute inset-1 rounded-full border border-dashed"
        style={{ borderColor: `${glowColor}66` }}
        animate={active ? { rotate: 360 } : { rotate: 0 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      />

      {/* شعاع ثانٍ عكسي */}
      <motion.div
        className="absolute inset-3 rounded-full border"
        style={{ borderColor: `${glowColor}33` }}
        animate={active ? { rotate: -360 } : { rotate: 0 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />

      {/* الوجه */}
      <div
        className="absolute inset-[22%] flex items-center justify-center rounded-full border"
        style={{
          background: "linear-gradient(145deg, #1c1917 0%, #292524 60%, #1c1917 100%)",
          borderColor: `${glowColor}88`,
        }}
      >
        {/* العينان — تتبعان وتومضان */}
        <div className="flex gap-2">
          {[0, 1].map((eye) => (
            <motion.div
              key={eye}
              className="relative flex size-3 items-center justify-center rounded-full"
              style={{ background: `${glowColor}22`, border: `1px solid ${glowColor}88` }}
              animate={
                active
                  ? { scaleY: [1, 1, 0.1, 1], opacity: [0.8, 1, 1, 0.8] }
                  : { scaleY: 1, opacity: 0.4 }
              }
              transition={
                active
                  ? { duration: 3.2, repeat: Infinity, times: [0, 0.9, 0.94, 1], delay: eye * 0.05 }
                  : { duration: 0.5 }
              }
            >
              <motion.span
                className="block size-1.5 rounded-full"
                style={{ background: glowColor, boxShadow: `0 0 6px ${glowColor}` }}
                animate={active ? { x: [-1.5, 1.5, -1.5], y: [0, -0.5, 0] } : { x: 0, y: 0 }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* شرارات المعرفة — تظهر عند النشاط */}
      {active &&
        [0, 1, 2, 3, 4, 5].map((i) => (
          <motion.span
            key={i}
            className="absolute size-1 rounded-full"
            style={{ background: glowColor, top: "50%", left: "50%" }}
            animate={{
              x: [0, Math.cos((i / 6) * Math.PI * 2) * (size * 0.55)],
              y: [0, Math.sin((i / 6) * Math.PI * 2) * (size * 0.55)],
              opacity: [0.9, 0],
              scale: [1, 0.3],
            }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.3, ease: "easeOut" }}
          />
        ))}

      {/* مؤشر الحالة */}
      <span
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[9px] font-bold"
        style={{ background: `${glowColor}1a`, color: glowColor }}
      >
        {critical > 0 ? "⚠ تنبيه" : active ? "يعمل" : "خامل"}
      </span>
    </div>
  );
}
