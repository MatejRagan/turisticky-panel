import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

/**
 * Browser Supabase client (anon / publishable key, protected by RLS).
 *
 * Never import the service-role key here: it must only be used in Node
 * scripts (scripts/*) and GitHub Actions, never in frontend code.
 */
function readEnv(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing environment variable ${name}. Check your .env file and restart the dev server.`);
  }
  return value;
}

const supabaseUrl = readEnv(import.meta.env.VITE_SUPABASE_URL, 'VITE_SUPABASE_URL');
const supabaseAnonKey = readEnv(import.meta.env.VITE_SUPABASE_ANON_KEY, 'VITE_SUPABASE_ANON_KEY');

export const supabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseAnonKey);
