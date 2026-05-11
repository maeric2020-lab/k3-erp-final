import { MachineBrandsRepository } from '@k3/repositories';
import { machineBrandSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeIdHandlers } from '@/lib/api/master-handlers';

const handlers = makeIdHandlers({
  buildRepo: () => new MachineBrandsRepository(createSupabaseServerClient()),
  schema: machineBrandSchema,
});
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
