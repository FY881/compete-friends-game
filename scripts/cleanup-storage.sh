#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# 🧹 تنظيف التخزين — حرب العقول
# ═══════════════════════════════════════════════════════════════════════
#
# السبب الجذري لامتلاء قرص الـ VM: ملفات APK والنسخ المكررة منها.
# ملف APK واحد (~26MB) كان يتضاعف حتى 6 مرات داخل المشروع:
#
#   android/release-artifacts/  →  الأصل المبني (يُحتفظ به)
#   src/assets/*.apk            →  نسخ قديمة لا يستوردها أي كود  ← يُحذف
#   public/downloads/*.apk      →  نسخة الخدمة (يُحتفظ بها)
#   isolate/                    →  نسخة كاملة مكررة من public/   ← يُحذف
#   dist/                       →  نسخة البناء من public/         ← يُحذف
#   android/app/src/main/assets →  نسخة Capacitor من dist/        ← يُحذف
#   android/app/build/          →  مخرجات Gradle                 ← يُحذف
#
# كل ما يُحذفه هذا السكربت قابل لإعادة التوليد بالكامل:
#   dist/                        →  bun run build
#   android/app/src/main/assets  →  npx cap sync android
#   android/app/build/           →  gradle assembleRelease
#
# الاستخدام:  bash scripts/cleanup-storage.sh
# ═══════════════════════════════════════════════════════════════════════
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

before=$(du -sm . 2>/dev/null | cut -f1)

echo "🧹 قبل التنظيف: ${before}MB"

# ── 1) نسخ مكررة ومخرجات بناء (قابلة لإعادة التوليد 100%) ──
rm -rf isolate               # نسخة مكررة من public/ لا يستخدمها أي كود
rm -rf dist                  # مخرجات Vite — تُبنى بـ bun run build
rm -rf android/app/build     # مخرجات Gradle — تُبنى من جديد
rm -rf android/app/src/main/assets  # نسخة Capacitor — تُستعاد بـ npx cap sync android
rm -rf .vite node_modules/.vite     # كاش Vite الوسيط

# ── 2) APKs ميتة داخل الكود (لا يستوردها أي ملف) ──
# ⚠️ لا نحذف public/downloads — تلك نسخة الخدمة الفعلية.
find src/assets -maxdepth 1 -type f -name '*.apk' -delete 2>/dev/null || true

# ── 3) مخرجات بناء قديمة للأندرويد (تُبنى من جديد) ──
rm -rf android/app/.cxx android/.gradle 2>/dev/null || true

# ── 4) سجلات وكاشات مؤقتة ──
rm -rf .turbo .cache 2>/dev/null || true

after=$(du -sm . 2>/dev/null | cut -f1)
freed=$((before - after))

echo "✅ بعد التنظيف: ${after}MB  (حُرِّر ${freed}MB)"
echo ""
echo "ℹ️  قبل أي بناء أندرويد جديد نفّذ:  npx cap sync android"
echo "ℹ️  لتوليد نسخة الويب فقط:          bun run build"
