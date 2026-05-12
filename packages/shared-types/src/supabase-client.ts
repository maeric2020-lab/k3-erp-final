import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * نوع موحَّد لـ Supabase client يقبل النسختين:
 *   - SupabaseClient<Database> من @supabase/supabase-js
 *   - SupabaseClient<Database, 'public', GenericSchema> من @supabase/ssr
 */
export type K3SupabaseClient = SupabaseClient<Database, 'public', any>;