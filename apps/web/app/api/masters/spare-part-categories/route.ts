import { SparePartCategoriesRepository } from '@k3/repositories';
import { sparePartCategorySchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeListPostHandlers } from '@/lib/api/master-handlers';

const handlers = makeListPostHandlers({
  buildRepo: () => new SparePartCategoriesRepository(createSupabaseServerClient()),
  schema: sparePartCategorySchema,
});
export const GET = handlers.GET;
export const POST = handlers.POST;
