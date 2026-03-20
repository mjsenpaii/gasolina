export interface AppEnvironment {
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
  readonly googleMapsApiKey: string;
}

function getRequiredEnvironmentVariable(value: string | undefined, key: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable: ${key}. Check your .env file and Vite configuration.`
    );
  }

  return value;
}

export const appEnvironment: AppEnvironment = {
  supabaseUrl: getRequiredEnvironmentVariable(
    import.meta.env.VITE_SUPABASE_URL,
    'VITE_SUPABASE_URL'
  ),
  supabaseAnonKey: getRequiredEnvironmentVariable(
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    'VITE_SUPABASE_ANON_KEY'
  ),
  googleMapsApiKey: getRequiredEnvironmentVariable(
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    'VITE_GOOGLE_MAPS_API_KEY'
  ),
};