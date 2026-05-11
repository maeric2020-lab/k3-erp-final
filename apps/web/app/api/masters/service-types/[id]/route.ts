import { ServiceTypesRepository } from '@k3/repositories';
import { serviceTypeSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeIdHandlers } from '@/lib/api/master-handlers';

const handlers = makeIdHandlers({
  buildRepo: () => new ServiceTypesRepository(createSupabaseServerClient()),
  schema: serviceTypeSchema,
});
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
