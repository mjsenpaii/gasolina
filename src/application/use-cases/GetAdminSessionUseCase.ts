import type { Session } from '@supabase/supabase-js';
import { supabaseClient } from '../../infrastructure/supabase/supabaseClient';

export class GetAdminSessionUseCase {
  public async execute(): Promise<Session | null> {
    const {
      data: { session },
      error,
    } = await supabaseClient.auth.getSession();

    if (error) {
      throw new Error(`Unable to get admin session: ${error.message}`);
    }

    return session;
  }
}
