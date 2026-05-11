import { PermissionTemplatesRepository } from '@k3/repositories';
import { permissionTemplateSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeIdHandlers } from '@/lib/api/master-handlers';

const handlers = makeIdHandlers({
  buildRepo: () => new PermissionTemplatesRepository(createSupabaseServerClient()),
  schema: permissionTemplateSchema,
});
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
