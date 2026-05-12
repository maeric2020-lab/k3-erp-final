import { ContractClauseTemplatesRepository } from '@k3/repositories';
import { contractClauseTemplateSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeListPostHandlers } from '@/lib/api/master-handlers';

const handlers = makeListPostHandlers({
  buildRepo: () => new ContractClauseTemplatesRepository(createSupabaseServerClient()),
  schema: contractClauseTemplateSchema,
});
export const GET = handlers.GET;
export const POST = handlers.POST;
