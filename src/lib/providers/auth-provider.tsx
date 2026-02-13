'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Profile, UserRole } from '@/types/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthContextValue {
  /** The currently authenticated Supabase user, or null. */
  user: User | null;
  /** The profile row from the `profiles` table, or null. */
  profile: Profile | null;
  /** Shorthand for profile?.role */
  role: UserRole | null;
  /** True while the initial session is being resolved. */
  loading: boolean;
  /** Whether the current user has the admin role. */
  isAdmin: boolean;
  /** Whether the current user has the data_entry role. */
  isDataEntry: boolean;
  /** Sign out the current user and redirect to /login. */
  signOut: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

// Module-level supabase singleton
const supabase = createClient();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // ---- Fetch profile from the profiles table ----
  const fetchProfile = useCallback(
    async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (error) {
          console.error('Error fetching profile:', error.message);
          setProfile(null);
          return;
        }

        setProfile(data as Profile);
      } catch (err) {
        console.error('Unexpected error fetching profile:', err);
        setProfile(null);
      }
    },
    [],
  );

  // ---- Bootstrap: resolve current session on mount ----
  useEffect(() => {
    const initAuth = async () => {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        setUser(currentUser);

        if (currentUser) {
          await fetchProfile(currentUser.id);
        }
      } catch (err) {
        console.error('Error initialising auth:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [fetchProfile]);

  // ---- Subscribe to auth state changes ----
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await fetchProfile(currentUser.id);
      } else {
        setProfile(null);
      }

      // Finished loading once we get the first event
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // ---- Sign out handler ----
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    // Hard navigation to clear client state
    window.location.href = '/login';
  }, []);

  // ---- Derived helpers ----
  const role: UserRole | null = profile?.role ?? null;
  const isAdmin = role === 'admin';
  const isDataEntry = role === 'data_entry';

  return (
    <AuthContext.Provider
      value={{ user, profile, role, loading, isAdmin, isDataEntry, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
