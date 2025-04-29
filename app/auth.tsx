import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, ActivityIndicator, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Image } from 'expo-image';
import { Mail, Lock, User, LogIn } from 'lucide-react-native';

type AuthMode = 'sign-in' | 'sign-up' | 'guest';

export default function AuthScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Error checking session:', error);
    } finally {
      setCheckingSession(false);
    }
  };

  const handleAuth = async () => {
    setLoading(true);
    try {
      if (mode === 'guest') {
        await handleGuestLogin();
      } else if (mode === 'sign-in') {
        await handleSignIn();
      } else {
        await handleSignUp();
      }
    } catch (error) {
      console.error('Auth error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      Alert.alert('Sign in error', error.message);
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleSignUp = async () => {
    if (!email || !password || !username) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    try {
      // Check if username is available
      const { data: existingUsers, error: usernameError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle();
      if (usernameError) {
        throw new Error(`Username check failed: ${usernameError.message}`);
      }
      if (existingUsers) {
        Alert.alert('Error', 'Username is already taken');
        return;
      }
      // Sign up the user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username, is_guest: false }
        }
      });
      if (error) {
        Alert.alert('Sign up error', error.message);
        return;
      }
      let userId = data.user?.id;
      // If no session, sign in to get a session
      if (!userId) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          Alert.alert('Sign in error', signInError.message);
          return;
        }
        userId = signInData.user?.id;
      }
      if (!userId) {
        Alert.alert('Error', 'Could not get user id after signup');
        return;
      }
      // Insert into profiles (after authentication)
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ id: userId, username, is_guest: false });
      if (profileError) {
        console.error('Error creating profile:', profileError);
        Alert.alert('Error', `Failed to create profile: ${profileError.message}`);
        return;
      }
      // Create user stats
      const { error: statsError } = await supabase
        .from('user_stats')
        .insert({ user_id: userId });
      if (statsError) {
        console.error('Error creating user stats:', statsError);
      }
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Signup process error:', error);
      Alert.alert('Error', error.message || 'An unexpected error occurred during signup');
    }
  };

  const handleGuestLogin = async () => {
    if (!username) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }

    try {
      // Generate unique guest identifiers
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      const guestEmail = `guest${timestamp}${randomId}@temp.hukum.app`;
      const guestPassword = `Guest${timestamp}${randomId}`;
      const guestUsername = `${username}_${randomId}`;
      
      // Web platform uses localStorage
      if (Platform.OS === 'web') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: guestEmail,
          password: guestPassword,
          options: {
            data: {
              is_guest: true,
              username: guestUsername
            }
          }
        });

        if (signUpError || !data?.user?.id) {
          throw new Error(`Guest signup failed: ${signUpError?.message}`);
        }

        // Store guest info in localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('hukum_guest_id', data.user.id);
          localStorage.setItem('hukum_guest_username', guestUsername);
          localStorage.setItem('hukum_is_guest', 'true');
        }

        // Create guest profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            username: guestUsername,
            is_guest: true
          })
          .single();

        if (profileError) {
          console.error('Guest profile creation failed:', profileError);
          // Don't block on profile creation error
        }

        // Create empty stats
        await supabase
          .from('user_stats')
          .insert({
            user_id: data.user.id,
            games_played: 0,
            games_won: 0,
            rating: 1000
          })
          .single();

        router.replace('/(tabs)');
        return;
      }

      // Native platforms use Supabase auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: guestEmail,
        password: guestPassword,
        options: {
          data: {
            is_guest: true,
            username: guestUsername
          }
        }
      });

      if (signUpError || !data?.user?.id) {
        throw new Error(`Guest signup failed: ${signUpError?.message}`);
      }

      // Sign in immediately after signup
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: guestEmail,
        password: guestPassword
      });

      if (signInError) {
        throw new Error(`Guest sign in failed: ${signInError.message}`);
      }

      // Create guest profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          username: guestUsername,
          is_guest: true
        })
        .single();

      if (profileError) {
        console.error('Guest profile creation failed:', profileError);
        // Don't block on profile creation error, we can try again later
      }

      // Create empty stats
      await supabase
        .from('user_stats')
        .insert({
          user_id: data.user.id,
          games_played: 0,
          games_won: 0,
          rating: 1000
        })
        .single();

      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Guest login process failed:', error);
      Alert.alert('Error', 'Failed to create guest account. Please try again.');
    }
  };

  if (checkingSession) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E6B325" />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={["#1E1E2E", "#2D2D44"]}
      style={styles.container}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={styles.logoContainer}>
        <Image
          source={{ uri: "https://raw.githubusercontent.com/VallabhKulkarni-09/hukum/main/img/card%20back%20side.jpeg" }}
          style={styles.logoImage}
          contentFit="cover"
          transition={1000}
        />
        <Text style={styles.logoText}>HUKUM</Text>
        <Text style={styles.tagline}>Multiplayer Card Game</Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.tabContainer}>
          <Pressable 
            style={[
              styles.tabButton, 
              mode === 'sign-in' && styles.activeTab
            ]}
            onPress={() => setMode('sign-in')}
          >
            <Text style={[
              styles.tabText,
              mode === 'sign-in' && styles.activeTabText
            ]}>SIGN IN</Text>
          </Pressable>
          <Pressable 
            style={[
              styles.tabButton, 
              mode === 'sign-up' && styles.activeTab
            ]}
            onPress={() => setMode('sign-up')}
          >
            <Text style={[
              styles.tabText,
              mode === 'sign-up' && styles.activeTabText
            ]}>SIGN UP</Text>
          </Pressable>
          <Pressable 
            style={[
              styles.tabButton, 
              mode === 'guest' && styles.activeTab
            ]}
            onPress={() => setMode('guest')}
          >
            <Text style={[
              styles.tabText,
              mode === 'guest' && styles.activeTabText
            ]}>GUEST</Text>
          </Pressable>
        </View>

        {(mode === 'sign-up' || mode === 'guest') && (
          <View style={styles.inputContainer}>
            <User size={18} color="#8A8A8A" />
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#8A8A8A"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>
        )}

        {(mode === 'sign-in' || mode === 'sign-up') && (
          <>
            <View style={styles.inputContainer}>
              <Mail size={18} color="#8A8A8A" />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#8A8A8A"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputContainer}>
              <Lock size={18} color="#8A8A8A" />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#8A8A8A"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
          </>
        )}
        
        <View style={styles.actionContainer}>
          <Pressable 
            style={styles.actionButton}
            onPress={handleAuth}
            disabled={loading}
          >
            <LinearGradient
              colors={["#E6B325", "#D4A017"]}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {loading ? (
                <ActivityIndicator color="#1E1E2E" />
              ) : (
                <>
                  <LogIn size={20} color="#1E1E2E" />
                  <Text style={styles.actionButtonText}>
                    {mode === 'sign-in' ? 'SIGN IN' : mode === 'sign-up' ? 'SIGN UP' : 'CONTINUE AS GUEST'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1E2E',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#E6B325',
  },
  logoText: {
    color: '#E6B325',
    fontSize: 32,
    fontWeight: '700',
    marginTop: 16,
    letterSpacing: 1,
  },
  tagline: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 8,
  },
  formContainer: {
    width: '85%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#E6B325',
  },
  tabText: {
    color: '#8A8A8A',
    fontWeight: '600',
    fontSize: 14,
  },
  activeTabText: {
    color: '#E6B325',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    marginLeft: 12,
    fontSize: 16,
  },
  actionContainer: {
    marginTop: 10,
  },
  actionButton: {
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginTop: 10,
  },
  buttonGradient: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 10,
  },
  actionButtonText: {
    color: '#1E1E2E',
    fontSize: 16,
    fontWeight: '700',
  },
});