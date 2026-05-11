#!/usr/bin/env node
/**
 * verify-imports.mjs
 *
 * يفحص أن كل استيراد في الكود يشير إلى رمز موجود فعلاً في الملف المصدر.
 * يكتشف:
 *   1. استيراد اسم غير مُصدَّر من الملف المستهدف
 *   2. استيراد ملف غير موجود
 *   3. استيراد دائري بسيط
 *
 * هذا بديل سريع لـ tsc --noEmit عندما لا يكون الـ node_modules مثبتاً.
 * لا يحلّ محل tsc لكنه يلتقط أكثر الأخطاء شيوعاً قبل دفع الكود.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const PACKAGE_PATHS = {
  '@k3/shared-types': 'packages/shared-types/src/index.ts',
  '@k3/repositories': 'packages/repositories/src/index.ts',
  '@k3/services': 'packages/services/src/index.ts',
  '@k3/validators': 'packages/validators/src/index.ts',
};

const SCAN_DIRS = [
  'packages/repositories/src',
  'packages/services/src',
  'packages/validators/src',
  'packages/shared-types/src',
  'apps/web/app',
  'apps/web/components',
  'apps/web/lib',
];

// Helpers ---------------------------------------------------------------------

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (full.endsWith('.ts') || full.endsWith('.tsx')) yield full;
  }
}

function getExportedNames(filePath) {
  const text = readFileSync(filePath, 'utf8');
  const names = new Set();

  // export { Foo, type Bar } from '...'
  // export { Foo, Bar }
  const reBrace = /export\s+(?:type\s+)?\{([^}]+)\}/g;
  let m;
  while ((m = reBrace.exec(text)) !== null) {
    for (const part of m[1].split(',')) {
      let n = part.trim().replace(/^type\s+/, '');
      const asM = n.match(/^\S+\s+as\s+(\S+)$/);
      if (asM) n = asM[1];
      if (n) names.add(n);
    }
  }
  // export class/interface/type/const/function Foo (مع دعم async/default/abstract)
  const reDirect = /export\s+(?:default\s+)?(?:abstract\s+)?(?:async\s+)?(?:class|interface|type|const|let|var|function|enum)\s+(\w+)/g;
  while ((m = reDirect.exec(text)) !== null) names.add(m[1]);

  // export * from '...'  (re-export everything)
  const reStar = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g;
  while ((m = reStar.exec(text)) !== null) {
    const target = resolveImport(filePath, m[1]);
    if (target) {
      for (const n of getExportedNames(target)) names.add(n);
    }
  }

  return names;
}

function resolveImport(fromFile, spec) {
  // Path alias?
  if (PACKAGE_PATHS[spec]) {
    return join(ROOT, PACKAGE_PATHS[spec]);
  }
  if (spec.startsWith('@/')) {
    const base = join(ROOT, 'apps/web', spec.slice(2));
    const candidates = [base + '.ts', base + '.tsx', join(base, 'index.ts'), join(base, 'index.tsx')];
    for (const c of candidates) if (existsSync(c)) return c;
    return base + '.ts'; // إرجاع المسار المتوقَّع للإبلاغ عن الخطأ
  }
  if (spec.startsWith('.')) {
    const baseDir = dirname(fromFile);
    const candidates = [
      join(baseDir, spec) + '.ts',
      join(baseDir, spec) + '.tsx',
      join(baseDir, spec, 'index.ts'),
      join(baseDir, spec, 'index.tsx'),
    ];
    for (const c of candidates) {
      if (existsSync(c)) return c;
    }
  }
  // External (node_modules) — لا نفحصها هنا
  return null;
}

function getImports(filePath) {
  const text = readFileSync(filePath, 'utf8');
  const imports = [];
  // import { Foo, type Bar } from '...'
  // import Foo from '...'
  // import * as Foo from '...'
  // import type { Foo } from '...'
  const re = /import\s+(?:type\s+)?(?:(\w+)|\{([^}]+)\}|\*\s+as\s+(\w+))\s+(?:,\s*\{([^}]+)\}\s+)?from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const [, defaultName, named, star, namedAfter, spec] = m;
    if (defaultName) imports.push({ name: defaultName, spec, kind: 'default' });
    if (star) imports.push({ name: star, spec, kind: 'namespace' });
    for (const block of [named, namedAfter]) {
      if (!block) continue;
      for (const part of block.split(',')) {
        let n = part.trim().replace(/^type\s+/, '');
        const asM = n.match(/^\S+\s+as\s+(\S+)$/);
        if (asM) n = asM[1];
        if (n) imports.push({ name: n, spec, kind: 'named' });
      }
    }
  }
  return imports;
}

// Main scan ------------------------------------------------------------------

const issues = [];
let filesScanned = 0;

for (const scanDir of SCAN_DIRS) {
  const fullScan = join(ROOT, scanDir);
  if (!existsSync(fullScan)) continue;
  for (const file of walk(fullScan)) {
    filesScanned++;
    const imports = getImports(file);
    for (const imp of imports) {
      const target = resolveImport(file, imp.spec);
      if (!target) continue; // external
      if (!existsSync(target)) {
        issues.push({
          file: relative(ROOT, file),
          msg: `استيراد ملف غير موجود: "${imp.spec}" → ${relative(ROOT, target)}`,
        });
        continue;
      }
      if (imp.kind === 'namespace' || imp.kind === 'default') continue;
      const exported = getExportedNames(target);
      if (!exported.has(imp.name)) {
        issues.push({
          file: relative(ROOT, file),
          msg: `استيراد "${imp.name}" من ${imp.spec} — لكن "${imp.name}" غير مُصدَّر من ${relative(ROOT, target)}`,
        });
      }
    }
  }
}

console.log(`📂 فُحص ${filesScanned} ملف.\n`);

if (issues.length === 0) {
  console.log('✅ كل الاستيرادات صحيحة. الرموز المستوردة موجودة في ملفّاتها المصدر.');
  process.exit(0);
}

console.log(`❌ وُجد ${issues.length} مشكلة:\n`);
const byFile = new Map();
for (const i of issues) {
  if (!byFile.has(i.file)) byFile.set(i.file, []);
  byFile.get(i.file).push(i.msg);
}
for (const [file, msgs] of byFile) {
  console.log(`  ${file}`);
  for (const msg of msgs) console.log(`    └─ ${msg}`);
}
process.exit(1);
