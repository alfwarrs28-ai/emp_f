import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client with the service_role key.
 * This client bypasses Row Level Security and should ONLY be used
 * on the server side (API routes, server actions). Never expose
 * the service_role key to the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
