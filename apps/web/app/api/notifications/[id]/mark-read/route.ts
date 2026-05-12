import { z } from 'zod';
import { NotificationsRepository } from '@k3/repositories';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withErrorHandler, ApiErrors } from '@/lib/api/error-handler';

export const GET = withErrorHandler(async () => {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw ApiErrors.unauthorized();
  const repo = new NotificationsRepository(supabase);
  const prefs = await repo.getPreferences();
  return Response.json({ preferences: prefs });
});

const updateSchema = z.object({
  email_enabled: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
  push_subscription: z.any().optional(),
  enabled_types: z.array(z.string()).optional(),
});

export const PATCH = withErrorHandler(async (req: Request) => {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw ApiErrors.unauthorized();

  const body = await req.json();
  const parsed = updateSchema.parse(body);

  const repo = new NotificationsRepository(supabase);
  await repo.updatePreferences(parsed);
  return Response.json({ ok: true });
});
