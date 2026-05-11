import { ServicesMasterRepository } from '@k3/repositories';
import { serviceMasterSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeIdHandlers } from '@/lib/api/master-handlers';

const handlers = makeIdHandlers({
  buildRepo: () => new ServicesMasterRepository(createSupabaseServerClient()),
  schema: serviceMasterSchema,
});
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
