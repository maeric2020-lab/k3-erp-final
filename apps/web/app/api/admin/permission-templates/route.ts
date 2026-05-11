import { PermissionTemplatesRepository } from '@k3/repositories';
import { permissionTemplateSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeListPostHandlers } from '@/lib/api/master-handlers';

const handlers = makeListPostHandlers({
  buildRepo: () => new PermissionTemplatesRepository(createSupabaseServerClient()),
  schema: permissionTemplateSchema,
});
export const GET = handlers.GET;
export const POST = handlers.POST;
