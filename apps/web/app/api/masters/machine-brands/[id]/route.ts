import { GasTypesMasterRepository } from '@k3/repositories';
import { gasTypeMasterSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeListPostHandlers } from '@/lib/api/master-handlers';

const handlers = makeListPostHandlers({
  buildRepo: () => new GasTypesMasterRepository(createSupabaseServerClient()),
  schema: gasTypeMasterSchema,
});
export const GET = handlers.GET;
export const POST = handlers.POST;
