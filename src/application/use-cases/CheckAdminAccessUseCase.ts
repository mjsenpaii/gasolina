import { supabaseClient } from '../../infrastructure/supabase/supabaseClient';

export class CheckAdminAccessUseCase {
  public async execute(): Promise<boolean> {
    const {
      data: { session },
      error: sessionError,
    } = await supabaseClient.auth.getSession();

    if (sessionError) {
      throw new Error(`Unable to read admin session: ${sessionError.message}`);
    }

    if (!session?.user) {
      return false;
    }

    const { data, error } = await supabaseClient
      .from('admin_users')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to verify admin access: ${error.message}`);
    }

    return Boolean(data?.user_id);
  }
}
