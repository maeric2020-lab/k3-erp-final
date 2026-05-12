import { ServicesMasterRepository } from '@k3/repositories';
import { serviceMasterSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeListPostHandlers } from '@/lib/api/master-handlers';

const handlers = makeListPostHandlers({
  buildRepo: () => new ServicesMasterRepository(createSupabaseServerClient()),
  schema: serviceMasterSchema,
});
export const GET = handlers.GET;
export const POST = handlers.POST;
