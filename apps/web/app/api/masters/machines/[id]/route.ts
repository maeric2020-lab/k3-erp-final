import { MachineCategoriesRepository } from '@k3/repositories';
import { machineCategorySchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeListPostHandlers } from '@/lib/api/master-handlers';

const handlers = makeListPostHandlers({
  buildRepo: () => new MachineCategoriesRepository(createSupabaseServerClient()),
  schema: machineCategorySchema,
});
export const GET = handlers.GET;
export const POST = handlers.POST;
