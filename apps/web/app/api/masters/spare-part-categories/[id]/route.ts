import { SparePartCategoriesRepository } from '@k3/repositories';
import { sparePartCategorySchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeIdHandlers } from '@/lib/api/master-handlers';

const handlers = makeIdHandlers({
  buildRepo: () => new SparePartCategoriesRepository(createSupabaseServerClient()),
  schema: sparePartCategorySchema,
});
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
