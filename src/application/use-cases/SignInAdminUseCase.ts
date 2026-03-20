import { supabaseClient } from '../../infrastructure/supabase/supabaseClient';

export class SignInAdminUseCase {
  public async execute(email: string, password: string): Promise<void> {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      throw new Error(`Unable to sign in: ${error.message}`);
    }
  }
}
