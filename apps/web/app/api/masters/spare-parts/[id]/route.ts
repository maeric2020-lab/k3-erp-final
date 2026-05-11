import { SparePartsMasterRepository } from '@k3/repositories';
import { sparePartMasterSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeIdHandlers } from '@/lib/api/master-handlers';

const handlers = makeIdHandlers({
  buildRepo: () => new SparePartsMasterRepository(createSupabaseServerClient()),
  schema: sparePartMasterSchema,
});
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
