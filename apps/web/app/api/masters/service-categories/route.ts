import { ServiceCategoriesRepository } from '@k3/repositories';
import { serviceCategorySchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeListPostHandlers } from '@/lib/api/master-handlers';

const handlers = makeListPostHandlers({
  buildRepo: () => new ServiceCategoriesRepository(createSupabaseServerClient()),
  schema: serviceCategorySchema,
});
export const GET = handlers.GET;
export const POST = handlers.POST;
