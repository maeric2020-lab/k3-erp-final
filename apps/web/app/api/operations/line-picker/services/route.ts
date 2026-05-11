import { NextResponse, type NextRequest } from 'next/server';
import { LinePickerService } from '@k3/services';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * GET /api/operations/line-picker/services?customer_machine_id=...&request_type=...&q=...
 *
 * Returns priced service options for the technician's "Add service" tab.
 * Each item includes is_covered so the UI can label them clearly.
 */
export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const requestType = searchParams.get('request_type');
  if (!requestType || !['CASH', 'CO', 'CW', 'CWC', 'UG'].includes(requestType)) {
    return NextResponse.json({ error: 'request_type required (CASH|CO|CW|CWC|UG)' }, { status: 400 });
  }
  try {
    const svc = new LinePickerService(supabase);
    const options = await svc.listServicesForJob({
      customer_machine_id: searchParams.get('customer_machine_id'),
      request_type: requestType as any,
      search: searchParams.get('q') ?? undefined,
      limit: Number(searchParams.get('limit') ?? 100),
    });
    return NextResponse.json({ options });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
