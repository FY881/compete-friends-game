#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════
 * 🔎 مدقّق استهلاك قاعدة البيانات (Database I/O Auditor)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * السبب الحقيقي لتعطّل النشر على الخطة المجانية كان **Database I/O**
 * (٣٫٥٥GB من ١GB) لا عدد استدعاءات الدوال (٨٥ ألف من مليون).
 *
 * ولماذا الاستعلامات تحديداً؟ لأن الاستعلام = **اشتراك تفاعلي**: كل كتابة
 * على أي جدول يقرأه الاستعلام تُعيد تشغيله عند **كل** مشترك — فالقراءة
 * غير المحدودة داخل استعلام تُضاعَف بعدد المشتركين وبعدد الكتابات.
 *
 * هذا السكربت يكشف تلقائياً داخل الاستعلامات فقط:
 *   • `.collect()`   → يقرأ كل الجدول (الأخطر)
 *   • `.filter(`     → يمرّ على كل الوثائق (I/O كامل بلا فائدة فهرس)
 *   • الغياب الكامل لحدّ `.take(`
 *
 * الاستخدام:
 *   node scripts/io-audit.mjs            # تقرير مرتّب (لا يُفشل البناء)
 *   node scripts/io-audit.mjs --strict   # يُفشل إن وُجد استعلام بلا أي حدّ
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONVEX = join(ROOT, "src", "convex");
const strict = process.argv.includes("--strict");

/** يقرأ كل ملفات convex غير المولّدة. */
function convexFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "_generated" || name === "node_modules") continue;
      out.push(...convexFiles(full));
    } else if (name.endsWith(".ts") && !name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

/** يستخرج كتل الاستعلامات بأقواس متوازنة: query({ ... }) */
function queryBlocks(source) {
  const blocks = [];
  const re = /=\s*query\(\{/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    const open = source.indexOf("{", match.index);
    let depth = 0;
    let i = open;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    // اسم الدالة: آخر `export const NAME` قبل الكتلة
    const before = source.slice(Math.max(0, match.index - 240), match.index);
    const names = [...before.matchAll(/export const ([A-Za-z0-9_]+)/g)];
    const name = names.length > 0 ? names[names.length - 1][1] : "(مجهول)";
    blocks.push({ name, start: open, end: i, text: source.slice(open, i) });
  }
  return blocks;
}

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length;
}

const findings = [];
for (const file of convexFiles(CONVEX)) {
  const source = readFileSync(file, "utf8");
  const rel = relative(ROOT, file);
  for (const block of queryBlocks(source)) {
    const collects = [...block.text.matchAll(/\.collect\(\)/g)].map((m) => lineOf(source, block.start + m.index));
    const filters = [...block.text.matchAll(/\.filter\(/g)].map((m) => lineOf(source, block.start + m.index));
    const takes = [...block.text.matchAll(/\.take\(/g)].length;
    if (collects.length === 0 && filters.length === 0) continue;
    findings.push({
      file: rel,
      name: block.name,
      collects: collects.length,
      filters: filters.length,
      takes,
      lines: collects.length > 0 ? collects : filters,
      // الخطر = قراءات غير محدودة بلا أي حد في الاستعلام
      risk: collects.length * 3 + filters.length * 2 + (collects.length + filters.length > 0 && takes === 0 ? 2 : 0),
    });
  }
}

findings.sort((a, b) => b.risk - a.risk);

const perFile = new Map();
for (const f of findings) {
  const cur = perFile.get(f.file) ?? { collects: 0, filters: 0, queries: 0 };
  cur.collects += f.collects;
  cur.filters += f.filters;
  cur.queries += 1;
  perFile.set(f.file, cur);
}

const totalCollects = findings.reduce((s, f) => s + f.collects, 0);
const totalFilters = findings.reduce((s, f) => s + f.filters, 0);

console.log(`\n🔎 تدقيق Database I/O داخل الاستعلامات التفاعلية`);
console.log(`   ${findings.length} استعلاماً فيه قراءة غير محدودة · ${totalCollects} collect · ${totalFilters} filter\n`);

console.log("── الأسوأ أولاً (أصلح هذه أولاً) ─────────────────────────────");
for (const f of findings.slice(0, 25)) {
  const tag = f.collects > 0 ? `collect×${f.collects}` : `filter×${f.filters}`;
  console.log(`  ⚠ ${String(f.risk).padStart(3)}  ${f.file}:${f.lines[0]}  ${f.name}  (${tag}, take=${f.takes})`);
}

console.log("\n── الملفات الأثقل ────────────────────────────────────────────");
const files = [...perFile.entries()].sort((a, b) => b[1].collects * 3 + b[1].filters * 2 - (a[1].collects * 3 + a[1].filters * 2));
for (const [file, s] of files.slice(0, 15)) {
  console.log(`  ${String(s.collects).padStart(3)} collect · ${String(s.filters).padStart(3)} filter · ${String(s.queries).padStart(3)} استعلاماً  ${file}`);
}

console.log(
  `\n💡 القاعدة: داخل أي استعلام، استبدل .collect() بـ .withIndex(...).take(n)\n` +
    `   كل استعلام غير محدود يتضاعف بعدد المشتركين × عدد الكتابات على الجدول.\n`,
);

if (strict && findings.some((f) => f.collects > 0 && f.takes === 0)) {
  console.error("✖ وضع --strict: توجد استعلامات بلا أي حدّ قراءة.\n");
  process.exit(1);
}
