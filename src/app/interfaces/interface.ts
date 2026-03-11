import type { Session, User } from '@supabase/supabase-js';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  initialized: boolean;
}

export interface AuthResult {
  session: Session | null;
  errorMessage: string | null;
}
