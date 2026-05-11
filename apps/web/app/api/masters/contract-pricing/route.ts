import { ContractPricingRepository } from '@k3/repositories';
import { contractPricingSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeListPostHandlers } from '@/lib/api/master-handlers';

const handlers = makeListPostHandlers({
  buildRepo: () => new ContractPricingRepository(createSupabaseServerClient()),
  schema: contractPricingSchema,
});
export const GET = handlers.GET;
export const POST = handlers.POST;
