import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { JobsRepository } from '@k3/repositories';

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  try {
    const fd = await req.formData();
    const file = fd.get('file');
    const jobId = String(fd.get('job_id') ?? '');
    const kind = String(fd.get('kind') ?? '');
    if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 });
    if (!jobId) return NextResponse.json({ error: 'job_id required' }, { status: 400 });
    if (!['technician', 'customer'].includes(kind)) return NextResponse.json({ error: 'invalid kind' }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'file too large' }, { status: 413 });

    // Verify the user has access to this job (RLS will also enforce; this is for cleaner errors)
    const jobs = new JobsRepository(supabase);
    const job = await jobs.getById(jobId);
    if (!job) return NextResponse.json({ error: 'job not found' }, { status: 404 });

    const buffer = await file.arrayBuffer();
    const path = `${jobId}/${kind}-${Date.now()}.png`;
    const { error: upErr } = await supabase.storage
      .from('signatures')
      .upload(path, buffer, { contentType: 'image/png', upsert: false });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

    return NextResponse.json({ path });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
