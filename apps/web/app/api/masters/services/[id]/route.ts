import { ServiceTypesRepository } from '@k3/repositories';
import { serviceTypeSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeListPostHandlers } from '@/lib/api/master-handlers';

const handlers = makeListPostHandlers({
  buildRepo: () => new ServiceTypesRepository(createSupabaseServerClient()),
  schema: serviceTypeSchema,
});
export const GET = handlers.GET;
export const POST = handlers.POST;
