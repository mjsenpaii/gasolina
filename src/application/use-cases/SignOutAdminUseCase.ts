import { supabaseClient } from '../../infrastructure/supabase/supabaseClient';

export class SignOutAdminUseCase {
  public async execute(): Promise<void> {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      throw new Error(`Unable to sign out: ${error.message}`);
    }
  }
}
