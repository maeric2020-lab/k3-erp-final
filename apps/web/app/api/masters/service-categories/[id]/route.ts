import { RefrigerantTypesRepository } from '@k3/repositories';
import { refrigerantTypeSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeListPostHandlers } from '@/lib/api/master-handlers';

const handlers = makeListPostHandlers({
  buildRepo: () => new RefrigerantTypesRepository(createSupabaseServerClient()),
  schema: refrigerantTypeSchema,
});
export const GET = handlers.GET;
export const POST = handlers.POST;
