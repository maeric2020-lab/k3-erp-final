#!/usr/bin/env node
/**
 * Production data-load CLI for K3 ERP master data.
 *
 * Usage (from repo root):
 *   pnpm tsx scripts/load-initial-masters.ts \
 *     --service-pricing ./uploads/قائمة_انواع_خدمات_الصيانة_واسعارها.xlsx \
 *     --contract-pricing ./uploads/قائمة_تسعيير_العقود.xlsx
 *
 * Required environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY     (used ONLY by this CLI, never by the app)
 *
 * The script:
 *   1. Reads each Excel file from disk.
 *   2. Calls ImportService.preview() through the same pipeline the UI uses.
 *   3. Logs the per-row preview summary.
 *   4. If --commit is passed, calls ImportService.commit() and prints results.
 *
 * No mock data, no shortcuts: this uses the exact same importer code as the UI.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import {
  createImportService,
  getImporterForTemplate,
  ImportService,
  type ImportTemplate,
} from '@k3/services';

interface Args {
  servicePricing?: string;
  contractPricing?: string;
  customers?: string;
  machines?: string;
  parts?: string;
  gas?: string;
  commit: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { commit: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--service-pricing':  out.servicePricing  = next(); break;
      case '--contract-pricing': out.contractPricing = next(); break;
      case '--customers':        out.customers       = next(); break;
      case '--machines':         out.machines        = next(); break;
      case '--parts':            out.parts           = next(); break;
      case '--gas':              out.gas             = next(); break;
      case '--commit':           out.commit = true; break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
    }
  }
  return out;
}

function printUsage() {
  console.log(`
Load initial master data into K3 ERP.

Options:
  --service-pricing <path>   Excel file for service pricing
  --contract-pricing <path>  Excel file for contract pricing
  --customers <path>         Excel file for customers
  --machines <path>          Excel file for machines catalog
  --parts <path>             Excel file for spare parts
  --gas <path>               Excel file for gas pricing
  --commit                   After preview, commit the import (default: preview only)

Required env:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const svc = createImportService(db as any);

  const jobs: Array<{ template: ImportTemplate; path: string }> = [];
  if (args.servicePricing)  jobs.push({ template: 'service_pricing',  path: resolve(args.servicePricing) });
  if (args.contractPricing) jobs.push({ template: 'contract_pricing', path: resolve(args.contractPricing) });
  if (args.customers)       jobs.push({ template: 'customers',        path: resolve(args.customers) });
  if (args.machines)        jobs.push({ template: 'machines',         path: resolve(args.machines) });
  if (args.parts)           jobs.push({ template: 'parts',            path: resolve(args.parts) });
  if (args.gas)             jobs.push({ template: 'gas',              path: resolve(args.gas) });

  if (jobs.length === 0) {
    printUsage();
    process.exit(1);
  }

  for (const job of jobs) {
    if (!existsSync(job.path)) {
      console.error(`File not found: ${job.path}`);
      process.exit(1);
    }
  }

  for (const job of jobs) {
    console.log(`\n=== ${job.template.toUpperCase()} ===`);
    console.log(`File: ${job.path}`);
    const buf = readFileSync(job.path);
    const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;

    // The CLI uses a synthetic storage path because we're calling through the
    // service-role key — the storage bucket isn't required for the importer to
    // run; only for the UI's audit trail. We pass a sentinel value.
    const result = await svc.preview({
      file: arrayBuf,
      filename: job.path.split('/').pop() ?? 'upload.xlsx',
      storage_path: `cli/${Date.now()}-${job.template}.xlsx`,
      template: job.template,
    });

    const counts = result.rows.reduce(
      (a, r) => ({
        total: a.total + 1,
        insert: a.insert + (r.action === 'insert' ? 1 : 0),
        update: a.update + (r.action === 'update' ? 1 : 0),
        skip:   a.skip   + (r.action === 'skip'   ? 1 : 0),
        error:  a.error  + (r.action === 'error'  ? 1 : 0),
      }),
      { total: 0, insert: 0, update: 0, skip: 0, error: 0 }
    );
    console.log(`Preview: total=${counts.total} insert=${counts.insert} update=${counts.update} skip=${counts.skip} error=${counts.error}`);

    if (counts.error > 0) {
      console.log('\nErrors:');
      for (const r of result.rows.filter((r) => r.action === 'error')) {
        console.log(`  row ${r.row_number}: ${r.errors.map((e) => `${e.field}=${e.message}`).join(', ')}`);
      }
    }

    if (args.commit) {
      console.log('Committing...');
      const importer = getImporterForTemplate(job.template);
      const cs = new ImportService(db as any);
      cs.register(importer);
      const out = await cs.commit(result.run.id, importer);
      console.log(`Committed: inserted=${out.inserted} updated=${out.updated} skipped=${out.skipped} failed=${out.failed}`);
      if (out.failures.length > 0) {
        console.log('Failures:');
        for (const f of out.failures) console.log(`  row ${f.row_number}: ${f.message}`);
      }
    } else {
      console.log('(preview only — pass --commit to apply)');
    }
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
