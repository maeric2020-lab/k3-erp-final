import { GasTypesMasterRepository } from '@k3/repositories';
import { gasTypeMasterSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeIdHandlers } from '@/lib/api/master-handlers';

const handlers = makeIdHandlers({
  buildRepo: () => new GasTypesMasterRepository(createSupabaseServerClient()),
  schema: gasTypeMasterSchema,
});
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
