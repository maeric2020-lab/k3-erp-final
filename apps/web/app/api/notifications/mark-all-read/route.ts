import { NotificationsRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withErrorHandler, ApiErrors } from '@/lib/api/error-handler';

export const POST = withErrorHandler(async () => {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw ApiErrors.unauthorized();

  const repo = new NotificationsRepository(supabase);
  const count = await repo.markAllRead();
  return Response.json({ marked: count });
});
