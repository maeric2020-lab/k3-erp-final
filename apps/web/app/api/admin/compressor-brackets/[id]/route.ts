import { CompressorBracketsRepository } from '@k3/repositories';
import { compressorBracketSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeIdHandlers } from '@/lib/api/master-handlers';

const handlers = makeIdHandlers({
  buildRepo: () => new CompressorBracketsRepository(createSupabaseServerClient()),
  schema: compressorBracketSchema,
  hardDelete: true,
});
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
