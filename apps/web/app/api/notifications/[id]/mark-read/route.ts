import { NotificationsRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withErrorHandler, ApiErrors } from '@/lib/api/error-handler';

interface Ctx { params: { id: string } }

export const POST = withErrorHandler(async (_req: Request, { params }: any) => {
  const ctx = params as Ctx['params'];
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw ApiErrors.unauthorized();

  const repo = new NotificationsRepository(supabase);
  await repo.markRead(ctx.id);
  return Response.json({ ok: true });
});
