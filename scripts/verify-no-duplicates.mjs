#!/usr/bin/env node
/**
 * verify-no-duplicates.mjs
 *
 * يفحص أن لا يوجد اسم مُصدَّر مرتين من نفس الـ index ضمن أي حزمة.
 * هذا يكتشف خطأ TS2308 قبل تشغيل tsc.
 *
 * يعمل على كل index.ts في packages/[الحزمة]/src/index.ts.
 *
 * يخرج بـ exit code != 0 إذا وُجد أي تكرار.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const INDEX_FILES = [
  'packages/repositories/src/index.ts',
  'packages/services/src/index.ts',
  'packages/validators/src/index.ts',
  'packages/shared-types/src/index.ts',
];

let totalIssues = 0;

console.log('🔍 فحص التصديرات المكررة في ملفات index...\n');

for (const rel of INDEX_FILES) {
  const path = join(ROOT, rel);
  if (!existsSync(path)) {
    console.log(`  ⊘ تخطّي ${rel} (غير موجود)`);
    continue;
  }
  const text = readFileSync(path, 'utf8');
  const seen = new Map(); // name -> [lines]

  // نَلتقط أنماط التصدير الشائعة:
  //   export { Foo } from '...'
  //   export { Foo, type Bar } from '...'
  //   export type { Baz } from '...'
  // كل سطر export قد يحوي عدة أسماء مفصولة بفواصل.
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // تجاهل التعليقات
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    // التقط export { ... } from '...'
    const exportBraceRe = /export\s+(?:type\s+)?\{([^}]+)\}/g;
    let m;
    while ((m = exportBraceRe.exec(line)) !== null) {
      const inside = m[1];
      // كل عنصر: قد يكون "Foo" أو "type Foo" أو "Foo as Bar"
      for (const part of inside.split(',')) {
        let name = part.trim().replace(/^type\s+/, '');
        // إذا كان "Foo as Bar"، الاسم المُصدَّر الفعلي هو Bar
        const asMatch = name.match(/^\S+\s+as\s+(\S+)$/);
        if (asMatch) name = asMatch[1];
        if (!name) continue;
        if (!seen.has(name)) seen.set(name, []);
        seen.get(name).push(i + 1);
      }
    }

    // التقط export class/interface/type/const/function Foo (مع دعم async)
    const directRe = /export\s+(?:default\s+)?(?:abstract\s+)?(?:async\s+)?(?:class|interface|type|const|let|var|function|enum)\s+(\w+)/;
    const dm = line.match(directRe);
    if (dm) {
      const name = dm[1];
      if (!seen.has(name)) seen.set(name, []);
      seen.get(name).push(i + 1);
    }
  }

  // أبلغ عن الأسماء المكررة
  const dupes = [...seen.entries()].filter(([, lines]) => lines.length > 1);
  if (dupes.length === 0) {
    console.log(`  ✅ ${rel}`);
    continue;
  }

  console.log(`  ❌ ${rel}`);
  for (const [name, lines] of dupes) {
    console.log(`     "${name}" مُصدَّر ${lines.length} مرة في الأسطر: ${lines.join(', ')}`);
    totalIssues++;
  }
}

// فحص إضافي: هل هناك أصناف بنفس الاسم معرَّفة في ملفّين منفصلين داخل نفس الحزمة؟
const PACKAGES_TO_CHECK = ['packages/repositories/src', 'packages/services/src'];
console.log('\n🔍 فحص الأصناف المعرَّفة في ملفّين منفصلين...\n');

for (const pkgPath of PACKAGES_TO_CHECK) {
  const fullPath = join(ROOT, pkgPath);
  if (!existsSync(fullPath)) continue;

  const definitions = new Map(); // ClassName -> [files]

  function scanDir(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) { scanDir(full); continue; }
      if (!entry.endsWith('.ts')) continue;
      const text = readFileSync(full, 'utf8');
      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
        // export class Foo / export type Foo / export interface Foo / export async function Foo
        const m = line.match(/export\s+(?:abstract\s+)?(?:async\s+)?(class|interface|type|function)\s+(\w+)/);
        if (m) {
          const name = m[2];
          const rel = full.replace(ROOT + '/', '');
          if (!definitions.has(name)) definitions.set(name, []);
          if (!definitions.get(name).includes(rel)) definitions.get(name).push(rel);
        }
      }
    }
  }
  scanDir(fullPath);

  let pkgIssues = 0;
  for (const [name, files] of definitions) {
    if (files.length > 1) {
      console.log(`  ❌ "${name}" معرَّف في ${files.length} ملفات داخل ${pkgPath}:`);
      for (const f of files) console.log(`       ${f}`);
      pkgIssues++;
      totalIssues++;
    }
  }
  if (pkgIssues === 0) console.log(`  ✅ ${pkgPath}`);
}

console.log('');
if (totalIssues === 0) {
  console.log('✅ لا توجد تصديرات مكررة. الـ build نظيف من ناحية التكرار.');
  process.exit(0);
} else {
  console.log(`❌ وُجد ${totalIssues} تكرار. يجب إصلاحها قبل المتابعة.`);
  process.exit(1);
}
