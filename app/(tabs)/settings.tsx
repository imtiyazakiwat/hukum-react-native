import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert, ActivityIndicator, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, User, LogIn } from 'lucide-react-native';
import { useAuthGuard } from '@/lib/hooks';

export default function SettingsScreen() {
  useAuthGuard();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isGuest, setIsGuest] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        if (Platform.OS === 'web') {
          const isGuest = localStorage.getItem('hukum_is_guest') === 'true';
          const guestId = localStorage.getItem('hukum_guest_id');
          if (isGuest && guestId) {
            setIsGuest(true);
            const { data: profile } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', guestId)
              .single();
            
            if (profile) {
              setUsername(profile.username);
            }
          }
          return;
        }
        return;
      }

      // Load profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, is_guest')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        setUsername(profile.username);
        setIsGuest(profile.is_guest);
        setEmail(session.user.email || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      if (Platform.OS === 'web') {
        localStorage.removeItem('hukum_guest_id');
        localStorage.removeItem('hukum_guest_username');
        localStorage.removeItem('hukum_is_guest');
      }
      router.replace('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const convertGuestAccount = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      let userId = session?.user?.id;

      if (Platform.OS === 'web') {
        userId = localStorage.getItem('hukum_guest_id');
      }

      if (!userId) {
        throw new Error('No user ID found');
      }

      // Create new permanent account
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            is_guest: false
          }
        }
      });

      if (signUpError) throw signUpError;

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          is_guest: false,
          username: username
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      // Clear guest data
      if (Platform.OS === 'web') {
        localStorage.removeItem('hukum_guest_id');
        localStorage.removeItem('hukum_guest_username');
        localStorage.removeItem('hukum_is_guest');
      }

      Alert.alert(
        'Success', 
        'Your guest account has been converted to a permanent account. Please sign in with your new credentials.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/auth')
          }
        ]
      );
    } catch (error: any) {
      console.error('Error converting account:', error);
      Alert.alert('Error', error.message || 'Failed to convert account');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
          title: "Settings",
          headerStyle: {
            backgroundColor: "#1E1E2E",
          },
          headerTintColor: "#E6B325",
        }}
      />

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <View style={styles.inputContainer}>
            <User size={18} color="#8A8A8A" />
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#8A8A8A"
              value={username}
              onChangeText={setUsername}
              editable={false}
            />
          </View>

          {isGuest && (
            <>
              <Text style={styles.guestNote}>
                You're playing as a guest. Create a permanent account to save your progress.
              </Text>

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

              <Pressable 
                style={styles.convertButton}
                onPress={convertGuestAccount}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#E6B325" />
                ) : (
                  <Text style={styles.convertButtonText}>CREATE PERMANENT ACCOUNT</Text>
                )}
              </Pressable>
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Pressable 
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutButtonText}>SIGN OUT</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1E2E',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#E6B325',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
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
  guestNote: {
    color: '#E6B325',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  convertButton: {
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(230, 179, 37, 0.2)',
    borderWidth: 1,
    borderColor: '#E6B325',
    alignItems: 'center',
    justifyContent: 'center',
  },
  convertButtonText: {
    color: '#E6B325',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 'auto',
  },
  signOutButton: {
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderWidth: 1,
    borderColor: '#F44336',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutButtonText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '600',
  },
});