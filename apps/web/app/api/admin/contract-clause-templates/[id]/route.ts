import { ContractClauseTemplatesRepository } from '@k3/repositories';
import { contractClauseTemplateSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeIdHandlers } from '@/lib/api/master-handlers';

const handlers = makeIdHandlers({
  buildRepo: () => new ContractClauseTemplatesRepository(createSupabaseServerClient()),
  schema: contractClauseTemplateSchema,
});
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
