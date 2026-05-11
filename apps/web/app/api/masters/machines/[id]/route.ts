import { MachinesMasterRepository } from '@k3/repositories';
import { machineMasterSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeIdHandlers } from '@/lib/api/master-handlers';

const handlers = makeIdHandlers({
  buildRepo: () => new MachinesMasterRepository(createSupabaseServerClient()),
  schema: machineMasterSchema,
});
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
