import { NextResponse, type NextRequest } from 'next/server';
import { LinePickerService } from '@k3/services';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  try {
    const svc = new LinePickerService(supabase);
    const options = await svc.listPartsForJob({
      customer_machine_id: searchParams.get('customer_machine_id'),
      search: searchParams.get('q') ?? undefined,
      limit: Number(searchParams.get('limit') ?? 100),
    });
    return NextResponse.json({ options });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
