import { MachineCategoriesRepository } from '@k3/repositories';
import { machineCategorySchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeIdHandlers } from '@/lib/api/master-handlers';

const handlers = makeIdHandlers({
  buildRepo: () => new MachineCategoriesRepository(createSupabaseServerClient()),
  schema: machineCategorySchema,
});
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
