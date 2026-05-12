import { CompressorBracketsRepository } from '@k3/repositories';
import { compressorBracketSchema } from '@k3/validators';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { makeListPostHandlers } from '@/lib/api/master-handlers';

const handlers = makeListPostHandlers({
  buildRepo: () => new CompressorBracketsRepository(createSupabaseServerClient()),
  schema: compressorBracketSchema,
});
export const GET = handlers.GET;
export const POST = handlers.POST;
