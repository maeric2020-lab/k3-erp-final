import { NextResponse } from 'next/server';
import { LinePickerService } from '@k3/services';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createSupabaseServerClient();
  try {
    const svc = new LinePickerService(supabase);
    const options = await svc.listGasOptions();
    return NextResponse.json({ options });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
