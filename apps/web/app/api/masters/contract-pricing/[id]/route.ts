import { ContractPricingRepository } from '@k3/repositories';
import { contractPricingSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeIdHandlers } from '@/lib/api/master-handlers';

const handlers = makeIdHandlers({
  buildRepo: () => new ContractPricingRepository(createSupabaseServerClient()),
  schema: contractPricingSchema,
});
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
