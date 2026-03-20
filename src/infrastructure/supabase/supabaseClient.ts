import { createClient } from '@supabase/supabase-js';
import { appEnvironment } from '../config/env';

export const supabaseClient = createClient(
  appEnvironment.supabaseUrl,
  appEnvironment.supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
