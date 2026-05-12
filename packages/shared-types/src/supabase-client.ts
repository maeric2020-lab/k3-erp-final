import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type K3SupabaseClient = SupabaseClient<Database, 'public', any>;