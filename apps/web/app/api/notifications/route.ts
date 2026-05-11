import { NotificationsRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withErrorHandler, ApiErrors } from '@/lib/api/error-handler';

export const GET = withErrorHandler(async (req: Request) => {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw ApiErrors.unauthorized();

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get('unread') === 'true';
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0);

  const repo = new NotificationsRepository(supabase);
  const result = await repo.listForCurrent({ unreadOnly, limit, offset });
  return Response.json(result);
});
