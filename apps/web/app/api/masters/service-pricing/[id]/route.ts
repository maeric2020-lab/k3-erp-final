import { ServicePricingRepository } from '@k3/repositories';
import { servicePricingSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeIdHandlers } from '@/lib/api/master-handlers';

const handlers = makeIdHandlers({
  buildRepo: () => new ServicePricingRepository(createSupabaseServerClient()),
  schema: servicePricingSchema,
});
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
