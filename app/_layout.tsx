import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Stack, Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { Platform, View, ActivityIndicator } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Redirect } from 'expo-router';

import { ErrorBoundary } from "./error-boundary";
import { isAuthenticated, supabase } from '@/lib/supabase';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Helper to check if we're in web guest mode
const isWebGuestMode = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return localStorage.getItem('hukum_is_guest') === 'true';
  }
  return false;
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
  });

  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        // Check web guest mode first
        if (isWebGuestMode()) {
          const guestId = localStorage.getItem('hukum_guest_id');
          if (guestId) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', guestId)
              .eq('is_guest', true)
              .single();

            if (mounted) {
              setIsAuthed(!!profile);
              setAuthChecked(true);
            }
            return;
          }
        }
        
        // Check regular auth session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', session.user.id)
            .single();

          if (mounted) {
            setIsAuthed(!!profile);
          }
        } else if (mounted) {
          setIsAuthed(false);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        if (mounted) setIsAuthed(false);
      } finally {
        if (mounted) setAuthChecked(true);
      }
    };

    checkAuth();
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        checkAuth();
      } else if (event === 'SIGNED_OUT') {
        if (mounted) {
          // Clear guest mode data if needed
          if (isWebGuestMode()) {
            localStorage.removeItem('hukum_guest_id');
            localStorage.removeItem('hukum_guest_username');
            localStorage.removeItem('hukum_is_guest');
          }
          setIsAuthed(false);
          setAuthChecked(true);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Slot>
          {!loaded ? null : !authChecked ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E1E2E' }}>
              <ActivityIndicator size="large" color="#E6B325" />
            </View>
          ) : !isAuthed ? (
            <Redirect href="/auth" />
          ) : (
            <RootLayoutNav />
          )}
        </Slot>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        headerStyle: {
          backgroundColor: "#1E1E2E",
        },
        headerTintColor: "#E6B325",
        headerTitleStyle: {
          color: "#E6B325",
        },
        contentStyle: {
          backgroundColor: "#1E1E2E",
        },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen 
        name="game" 
        options={{ 
          headerShown: false,
          presentation: Platform.OS === "ios" ? "fullScreenModal" : "card",
        }} 
      />
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
    </Stack>
  );
}