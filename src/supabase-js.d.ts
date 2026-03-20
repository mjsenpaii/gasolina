declare module '@supabase/supabase-js' {
  export interface Session {
    user?: {
      id: string;
      email?: string | null;
    };
  }

  export interface SupabaseClient {
    from(table: string): any;
    auth: {
      getSession(): Promise<{ data: { session: Session | null }; error: { message: string } | null }>;
      signInWithPassword(credentials: { email: string; password: string }): Promise<{ data: any; error: { message: string } | null }>;
      signOut(): Promise<{ data: any; error: { message: string } | null }>;
    };
  }

  export function createClient(url: string, key: string, options?: Record<string, unknown>): SupabaseClient;
}
