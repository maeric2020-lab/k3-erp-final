import { NextResponse, type NextRequest } from 'next/server';
import { ContractDocumentService } from '@k3/services';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface Ctx { params: { id: string } }

/**
 * Returns the full assembled contract document data for the print/render
 * page. The renderer is a server-rendered HTML page at /contracts/[id]/print
 * that the user prints/saves as PDF; this route is also useful for a future
 * server-side PDF renderer (Puppeteer/Chromium) hooked behind it.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const supabase = createSupabaseServerClient();
  try {
    const svc = new ContractDocumentService(supabase);
    const doc = await svc.assemble(params.id);
    return NextResponse.json(doc);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
