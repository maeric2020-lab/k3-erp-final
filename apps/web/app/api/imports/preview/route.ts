import { NextResponse, type NextRequest } from 'next/server';
import { createImportService, type ImportTemplate } from '@k3/services';
import { ImportsRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// App Router route segment config (يحل محل export const config القديم)
// Node.js runtime مطلوب لـ formData() مع ملفات كبيرة، و SDK supabase storage
export const runtime = 'nodejs';
// زمن أقصى للتنفيذ (Vercel Hobby = 10s، Pro = 60s)
export const maxDuration = 30;
// لا نُكاشّف هذا المسار — كل استدعاء يجب أن يُعالَج طازجاً
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  try {
    const fd = await req.formData();
    const file = fd.get('file');
    const templateRaw = String(fd.get('template') ?? 'auto');
    if (!(file instanceof File)) return NextResponse.json({ error: 'no file' }, { status: 400 });
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'file too large (max 25MB)' }, { status: 413 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const filename = file.name;
    const buffer = await file.arrayBuffer();

    // رفع للتخزين في bucket "imports"
    const path = `${user.id}/${Date.now()}-${filename}`;
    const { error: upErr } = await supabase.storage.from('imports').upload(path, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (upErr) {
      return NextResponse.json({ error: `storage upload failed: ${upErr.message}` }, { status: 400 });
    }

    const svc = createImportService(supabase);
    const result = await svc.preview({
      file: buffer,
      filename,
      storage_path: path,
      template: templateRaw === 'auto' ? 'auto' : (templateRaw as ImportTemplate),
    });

    // إعادة قراءة الصفوف من DB للعميل (السجلات المحفوظة)
    const rowsRepo = new ImportsRepository(supabase);
    const rows = await rowsRepo.listRows(result.run.id);

    return NextResponse.json({
      run: result.run,
      rows: rows.map((r) => ({
        id: r.id,
        row_number: r.row_number,
        raw_data: r.raw_data,
        resolved_data: r.resolved_data,
        validation_errors: r.validation_errors,
        action: r.action,
        target_table: r.target_table,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}