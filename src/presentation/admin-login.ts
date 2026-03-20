import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const form = document.querySelector<HTMLFormElement>('#adminLoginForm');
const emailInput = document.querySelector<HTMLInputElement>('#email');
const passwordInput = document.querySelector<HTMLInputElement>('#password');
const authMessage = document.querySelector<HTMLDivElement>('#authMessage');

function setMessage(message: string): void {
  if (authMessage) {
    authMessage.textContent = message;
  }
}

async function redirectIfLoggedIn(): Promise<void> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    setMessage(error.message);
    return;
  }

  if (data.session) {
    window.location.href = '/admin-dashboard.html';
  }
}

async function handleLogin(event: SubmitEvent): Promise<void> {
  event.preventDefault();

  const email = emailInput?.value.trim() ?? '';
  const password = passwordInput?.value ?? '';

  if (!email || !password) {
    setMessage('Email and password are required.');
    return;
  }

  setMessage('');

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    setMessage(error.message);
    return;
  }

  window.location.href = '/admin-dashboard.html';
}

void redirectIfLoggedIn();

form?.addEventListener('submit', (event) => {
  void handleLogin(event);
});