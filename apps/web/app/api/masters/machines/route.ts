import { MachinesMasterRepository } from '@k3/repositories';
import { machineMasterSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeListPostHandlers } from '@/lib/api/master-handlers';

const handlers = makeListPostHandlers({
  buildRepo: () => new MachinesMasterRepository(createSupabaseServerClient()),
  schema: machineMasterSchema,
});
export const GET = handlers.GET;
export const POST = handlers.POST;
