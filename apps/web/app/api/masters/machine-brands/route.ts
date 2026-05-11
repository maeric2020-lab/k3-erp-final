import { MachineBrandsRepository } from '@k3/repositories';
import { machineBrandSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeListPostHandlers } from '@/lib/api/master-handlers';

const handlers = makeListPostHandlers({
  buildRepo: () => new MachineBrandsRepository(createSupabaseServerClient()),
  schema: machineBrandSchema,
});
export const GET = handlers.GET;
export const POST = handlers.POST;
