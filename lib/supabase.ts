import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { Database } from '@/types/supabase';

const supabaseUrl = "YOUR_SUPABASE_URL_HERE";
const supabaseAnonKey = "YOUR_SUPABASE_ANON_KEY_HERE";

class CustomStorage {
  private isGuest: boolean = false;

  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        const item = localStorage.getItem(key);
        if (key === 'supabase-auth-token' && localStorage.getItem('hukum_is_guest') === 'true') {
          this.isGuest = true;
        }
        return item;
      }
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.error('Error reading from storage:', e);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      console.error('Error saving to storage:', e);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
        if (this.isGuest) {
          localStorage.removeItem('hukum_is_guest');
          localStorage.removeItem('hukum_guest_id');
          localStorage.removeItem('hukum_guest_username');
        }
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.error('Error removing from storage:', e);
    }
  }
}

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: new CustomStorage(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  }
);

export const isAuthenticated = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;
  
  // Check if profile exists
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, is_guest')
    .eq('id', session.user.id)
    .single();
  
  return !!profile;
};

export const getCurrentUser = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
};

export const isGuestUser = () => {
  if (Platform.OS === 'web') {
    return localStorage.getItem('hukum_is_guest') === 'true';
  }
  return false;
};

export const isWebGuestMode = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return localStorage.getItem('hukum_is_guest') === 'true';
  }
  return false;
};