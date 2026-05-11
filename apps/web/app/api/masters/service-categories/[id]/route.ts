import { ServiceCategoriesRepository } from '@k3/repositories';
import { serviceCategorySchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeIdHandlers } from '@/lib/api/master-handlers';

const handlers = makeIdHandlers({
  buildRepo: () => new ServiceCategoriesRepository(createSupabaseServerClient()),
  schema: serviceCategorySchema,
});
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
