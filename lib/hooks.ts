import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { supabase } from './supabase';
import { Platform } from 'react-native';

export const useAuthGuard = () => {
  const router = useRouter();

  useEffect(() => {
    const checkAuthAndProfile = async () => {
      try {
        // Check if we're in web guest mode
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const isGuest = localStorage.getItem('hukum_is_guest') === 'true';
          const guestId = localStorage.getItem('hukum_guest_id');
          
          if (isGuest && guestId) {
            // Verify the guest profile exists
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', guestId)
              .eq('is_guest', true)
              .single();

            if (profile) return true; // Guest profile exists
          }
        }

        // Check regular auth session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          Alert.alert('Authentication Required', 'Please log in to continue');
          router.replace('/auth');
          return false;
        }

        // Check if profile exists
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, is_guest')
          .eq('id', session.user.id)
          .single();

        if (profileError || !profile) {
          Alert.alert('Profile Required', 'Please complete your profile setup');
          router.replace('/auth');
          return false;
        }

        return true;
      } catch (error) {
        console.error('Auth check error:', error);
        Alert.alert('Error', 'Unable to verify authentication');
        router.replace('/auth');
        return false;
      }
    };

    checkAuthAndProfile();
  }, [router]);
};