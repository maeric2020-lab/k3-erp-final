import { SparePartsMasterRepository } from '@k3/repositories';
import { sparePartMasterSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeListPostHandlers } from '@/lib/api/master-handlers';

const handlers = makeListPostHandlers({
  buildRepo: () => new SparePartsMasterRepository(createSupabaseServerClient()),
  schema: sparePartMasterSchema,
});
export const GET = handlers.GET;
export const POST = handlers.POST;
