import { ServicePricingRepository } from '@k3/repositories';
import { servicePricingSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeListPostHandlers } from '@/lib/api/master-handlers';

const handlers = makeListPostHandlers({
  buildRepo: () => new ServicePricingRepository(createSupabaseServerClient()),
  schema: servicePricingSchema,
});
export const GET = handlers.GET;
export const POST = handlers.POST;
