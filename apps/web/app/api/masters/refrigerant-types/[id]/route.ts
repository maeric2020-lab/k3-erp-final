import { RefrigerantTypesRepository } from '@k3/repositories';
import { refrigerantTypeSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeIdHandlers } from '@/lib/api/master-handlers';

const handlers = makeIdHandlers({
  buildRepo: () => new RefrigerantTypesRepository(createSupabaseServerClient()),
  schema: refrigerantTypeSchema,
});
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
