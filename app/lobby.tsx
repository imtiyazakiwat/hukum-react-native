import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Alert, ActivityIndicator, FlatList, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { supabase, isWebGuestMode } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase';
import { Copy, Crown, Plus, RefreshCw, Users, UserPlus, Share2, ArrowLeft } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useAuthGuard } from '@/lib/hooks';

const LOBBY_CACHE_KEY = 'hukum_lobby_cache';
const LOBBY_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

export default function LobbyScreen() {
  useAuthGuard();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [lobbyName, setLobbyName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [lobbies, setLobbies] = useState<any[]>([]);
  const [creatingLobby, setCreatingLobby] = useState(false);
  const [joiningLobby, setJoiningLobby] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [matchmaking, setMatchmaking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadCachedLobbies();
    fetchLobbies();
  }, []);

  const loadCachedLobbies = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const cached = localStorage.getItem(LOBBY_CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < LOBBY_CACHE_EXPIRY) {
          setLobbies(data);
          setLoading(false);
        }
      }
    }
  };

  const fetchLobbies = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        if (!isWebGuestMode()) {
          router.replace('/auth');
          return;
        }
      }

      // First fetch active lobbies
      const { data: lobbiesData, error: lobbiesError } = await supabase
        .from('lobbies')
        .select(`
          id,
          name,
          status,
          is_private,
          host_id,
          host:profiles!lobbies_host_id_fkey(username)
        `)
        .eq('is_private', false)
        .eq('status', 'waiting')
        .limit(10);

      if (lobbiesError) {
        console.error('Error fetching lobbies:', lobbiesError);
        setLobbies([]);
        return;
      }

      // Then fetch player counts for each lobby efficiently
      const lobbyDataWithCounts = await Promise.all(
        (lobbiesData || []).map(async (lobby) => {
          const { data: games } = await supabase
            .from('games')
            .select('id, game_players(count)')
            .eq('lobby_id', lobby.id)
            .single();
            
          return {
            ...lobby,
            gameId: games?.id,
            playerCount: games?.game_players?.[0]?.count || 0
          };
        })
      );

      // Cache the results for web
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        localStorage.setItem(LOBBY_CACHE_KEY, JSON.stringify({
          data: lobbyDataWithCounts,
          timestamp: Date.now()
        }));
      }

      setLobbies(lobbyDataWithCounts);
    } catch (error) {
      console.error('Error loading lobbies:', error);
      setLobbies([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLobbies();
  };

  const createLobby = async () => {
    if (!lobbyName.trim()) {
      Alert.alert('Error', 'Please enter a lobby name');
      return;
    }

    try {
      setCreatingLobby(true);
      const user = await getCurrentUser();
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to create a lobby');
        router.replace('/auth');
        return;
      }

      // First check if the user's profile exists
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        console.error('Profile error:', profileError);
        Alert.alert('Error', 'Could not find your profile. Please try logging in again.');
        router.replace('/auth');
        return;
      }

      // Create lobby
      const { data: lobby, error } = await supabase
        .from('lobbies')
        .insert({
          name: lobbyName,
          host_id: user.id,
          is_private: isPrivate,
        })
        .select()
        .single();

      if (error) {
        Alert.alert('Error', 'Failed to create lobby: ' + error.message);
        return;
      }

      // Create a game for this lobby
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert({
          lobby_id: lobby.id,
          status: 'setup',
        })
        .select()
        .single();

      if (gameError) {
        Alert.alert('Error', 'Failed to create game: ' + gameError.message);
        return;
      }

      // Add host as player 0 (Team A)
      const { error: playerError } = await supabase
        .from('game_players')
        .insert({
          game_id: game.id,
          user_id: user.id,
          player_position: 0,
          team: 'A',
        });

      if (playerError) {
        Alert.alert('Error', 'Failed to join game: ' + playerError.message);
        return;
      }

      // Navigate to waiting room
      router.push({
        pathname: '/waiting-room',
        params: { lobbyId: lobby.id, gameId: game.id },
      });
    } catch (error) {
      console.error('Error creating lobby:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setCreatingLobby(false);
    }
  };

  const joinLobbyByCode = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    try {
      setJoiningLobby(true);
      const user = await getCurrentUser();
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to join a lobby');
        router.replace('/auth');
        return;
      }

      // Find lobby by invite code
      const { data: lobby, error } = await supabase
        .from('lobbies')
        .select('*, games:games(id)')
        .eq('invite_code', inviteCode)
        .eq('status', 'waiting')
        .single();

      if (error || !lobby) {
        Alert.alert('Error', 'Invalid or expired invite code');
        return;
      }

      // Get game for this lobby
      const gameId = lobby.games[0]?.id;
      
      if (!gameId) {
        Alert.alert('Error', 'Game not found for this lobby');
        return;
      }

      // Check if lobby is full
      const { data: players, error: playersError } = await supabase
        .from('game_players')
        .select('player_position')
        .eq('game_id', gameId);

      if (playersError) {
        Alert.alert('Error', 'Failed to check lobby capacity');
        return;
      }

      if (players && players.length >= 4) {
        Alert.alert('Error', 'This lobby is full');
        return;
      }

      // Find next available position
      const positions = players?.map(p => p.player_position) || [];
      let nextPosition = 0;
      while (positions.includes(nextPosition)) {
        nextPosition++;
      }

      // Determine team based on position
      const team = (nextPosition % 2 === 0) ? 'A' : 'B';

      // Join game
      const { error: joinError } = await supabase
        .from('game_players')
        .insert({
          game_id: gameId,
          user_id: user.id,
          player_position: nextPosition,
          team: team,
        });

      if (joinError) {
        Alert.alert('Error', 'Failed to join game: ' + joinError.message);
        return;
      }

      // Navigate to waiting room
      router.push({
        pathname: '/waiting-room',
        params: { lobbyId: lobby.id, gameId: gameId },
      });
    } catch (error) {
      console.error('Error joining lobby:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setJoiningLobby(false);
    }
  };

  const joinLobby = async (lobbyId: string) => {
    try {
      setJoiningLobby(true);
      const user = await getCurrentUser();
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to join a lobby');
        router.replace('/auth');
        return;
      }

      // Get game for this lobby
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('id')
        .eq('lobby_id', lobbyId)
        .single();

      if (gameError || !game) {
        Alert.alert('Error', 'Game not found for this lobby');
        return;
      }

      // Check if lobby is full
      const { data: players, error: playersError } = await supabase
        .from('game_players')
        .select('player_position')
        .eq('game_id', game.id);

      if (playersError) {
        Alert.alert('Error', 'Failed to check lobby capacity');
        return;
      }

      if (players && players.length >= 4) {
        Alert.alert('Error', 'This lobby is full');
        return;
      }

      // Find next available position
      const positions = players?.map(p => p.player_position) || [];
      let nextPosition = 0;
      while (positions.includes(nextPosition)) {
        nextPosition++;
      }

      // Determine team based on position
      const team = (nextPosition % 2 === 0) ? 'A' : 'B';

      // Join game
      const { error: joinError } = await supabase
        .from('game_players')
        .insert({
          game_id: game.id,
          user_id: user.id,
          player_position: nextPosition,
          team: team,
        });

      if (joinError) {
        Alert.alert('Error', 'Failed to join game: ' + joinError.message);
        return;
      }

      // Navigate to waiting room
      router.push({
        pathname: '/waiting-room',
        params: { lobbyId: lobbyId, gameId: game.id },
      });
    } catch (error) {
      console.error('Error joining lobby:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setJoiningLobby(false);
    }
  };

  const getNextPosition = async (gameId: string) => {
    const { data: players } = await supabase
      .from('game_players')
      .select('player_position')
      .eq('game_id', gameId)
      .order('player_position', { ascending: true });

    // Find first available position
    const positions = players?.map(p => p.player_position) || [];
    let nextPosition = 0;
    while (positions.includes(nextPosition)) {
      nextPosition++;
    }
    return nextPosition;
  };

  const ensureProfile = async (userId: string, username?: string) => {
    // Check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      // Create profile if it doesn't exist
      const { error: createError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          username: username || `Player_${userId.substring(0, 6)}`,
          is_guest: false,
        });

      if (createError) {
        throw new Error(`Failed to create profile: ${createError.message}`);
      }
    }

    return profile;
  };

  const joinMatchmaking = async () => {
    try {
      setMatchmaking(true);
      const user = await getCurrentUser();
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to join matchmaking');
        router.replace('/auth');
        return;
      }

      // Ensure profile exists
      await ensureProfile(user.id);

      // First check if there's an available game with less than 4 players
      const { data: availableGames } = await supabase
        .from('games')
        .select(`
          id,
          lobby_id,
          game_players (count)
        `)
        .eq('status', 'setup')
        .not('game_players.count', 'eq', 4);

      let gameId: string | undefined;
      let lobbyId: string | undefined;

      if (availableGames && availableGames.length > 0) {
        // Try to join an existing game
        for (const game of availableGames) {
          const { data: playerCount } = await supabase
            .from('game_players')
            .select('id', { count: 'exact' })
            .eq('game_id', game.id);

          if (playerCount && playerCount.length < 4) {
            gameId = game.id;
            lobbyId = game.lobby_id;
            break;
          }
        }
      }

      if (!gameId || !lobbyId) {
        // No available games, create a new one
        const { data: newLobby, error: lobbyError } = await supabase
          .from('lobbies')
          .insert({
            name: 'Matchmaking Game',
            host_id: user.id,
            is_private: false,
            status: 'waiting'
          })
          .select()
          .single();

        if (lobbyError) {
          throw new Error(`Failed to create lobby: ${lobbyError.message}`);
        }

        const { data: newGame, error: gameError } = await supabase
          .from('games')
          .insert({
            lobby_id: newLobby.id,
            status: 'setup'
          })
          .select()
          .single();

        if (gameError) {
          throw new Error(`Failed to create game: ${gameError.message}`);
        }

        gameId = newGame.id;
        lobbyId = newLobby.id;
      }

      // Join the game
      const position = await getNextPosition(gameId);
      const team = position % 2 === 0 ? 'A' : 'B';

      const { error: joinError } = await supabase
        .from('game_players')
        .insert({
          game_id: gameId,
          user_id: user.id,
          player_position: position,
          team: team
        });

      if (joinError) {
        throw new Error(`Failed to join game: ${joinError.message}`);
      }

      // Subscribe to player count changes
      const channel = supabase.channel(`game:${gameId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'game_players',
          filter: `game_id=eq.${gameId}`
        }, async () => {
          const { data: players } = await supabase
            .from('game_players')
            .select('id')
            .eq('game_id', gameId);

          // If we have 4 players, start the game
          if (players && players.length === 4) {
            // Update game status
            await supabase
              .from('games')
              .update({ status: 'playing' })
              .eq('id', gameId);

            // Update lobby status  
            await supabase
              .from('lobbies')
              .update({ status: 'in_progress' })
              .eq('id', lobbyId);

            // Navigate to game
            router.replace({
              pathname: '/game',
              params: { 
                gameId,
                lobbyId
              }
            });
          }
        })
        .subscribe();

      // Navigate to waiting room
      router.push({
        pathname: '/waiting-room',
        params: { 
          lobbyId, 
          gameId,
          fromMatchmaking: 'true'
        }
      });

      // Clean up on unmount
      return () => {
        channel.unsubscribe();
      };

    } catch (error: any) {
      console.error('Error joining matchmaking:', error);
      Alert.alert('Error', error.message || 'An unexpected error occurred');
      setMatchmaking(false);
    }
  };

  const cancelMatchmaking = async () => {
    try {
      const user = await getCurrentUser();
      if (user) {
        // Remove from queue
        await supabase
          .from('matchmaking_queue')
          .delete()
          .eq('user_id', user.id);
      }
    } catch (error) {
      console.error('Error canceling matchmaking:', error);
    } finally {
      setMatchmaking(false);
    }
  };

  const renderLobbyItem = ({ item }: { item: any }) => {
    const playerCount = item.playerCount || 0;
    
    return (
      <Pressable 
        style={styles.lobbyItem}
        onPress={() => joinLobby(item.id)}
        disabled={joiningLobby || playerCount >= 4}
      >
        <LinearGradient
          colors={["#2A2A3A", "#1E1E2E"]}
          style={styles.lobbyGradient}
        >
          <View style={styles.lobbyHeader}>
            <Text style={styles.lobbyName}>{item.name}</Text>
            <View style={styles.playerCountContainer}>
              <Users size={14} color="#8A8A8A" />
              <Text style={styles.playerCount}>{playerCount}/4</Text>
            </View>
          </View>
          
          <View style={styles.lobbyHost}>
            <Crown size={14} color="#E6B325" />
            <Text style={styles.hostText}>
              Host: {item.host?.username || 'Unknown'}
            </Text>
          </View>
          
          <Pressable 
            style={[
              styles.joinButton,
              playerCount >= 4 && styles.disabledButton
            ]}
            onPress={() => joinLobby(item.id)}
            disabled={joiningLobby || playerCount >= 4}
          >
            <Text style={styles.joinButtonText}>
              {playerCount >= 4 ? 'FULL' : 'JOIN'}
            </Text>
          </Pressable>
        </LinearGradient>
      </Pressable>
    );
  };

  const handleBack = () => {
    router.back();
  };
  
  return (
    <LinearGradient
      colors={["#1E1E2E", "#2D2D44"]}
      style={styles.container}
    >
      <Stack.Screen
        options={{
          title: "Game Lobby",
          headerShown: false,
        }}
      />
      
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <ArrowLeft color="#E6B325" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>Game Lobby</Text>
        <Pressable style={styles.refreshButton} onPress={handleRefresh}>
          <RefreshCw color="#E6B325" size={20} />
        </Pressable>
      </View>
      
      <View style={styles.content}>
        {matchmaking ? (
          <View style={styles.matchmakingContainer}>
            <ActivityIndicator size="large" color="#E6B325" />
            <Text style={styles.matchmakingText}>Finding players...</Text>
            <Pressable 
              style={styles.cancelButton}
              onPress={cancelMatchmaking}
            >
              <Text style={styles.cancelButtonText}>CANCEL</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.actions}>
              <Pressable 
                style={styles.actionButton}
                onPress={() => joinMatchmaking()}
                disabled={matchmaking}
              >
                <LinearGradient
                  colors={["#E6B325", "#D4A017"]}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Users size={18} color="#1E1E2E" />
                  <Text style={styles.actionButtonText}>QUICK MATCH</Text>
                </LinearGradient>
              </Pressable>
              
              <View style={styles.secondaryActions}>
                <Pressable 
                  style={[styles.secondaryButton, showCreateForm && styles.activeButton]}
                  onPress={() => {
                    setShowCreateForm(!showCreateForm);
                    setShowJoinForm(false);
                  }}
                >
                  <Plus size={16} color={showCreateForm ? "#E6B325" : "#8A8A8A"} />
                  <Text style={[
                    styles.secondaryButtonText,
                    showCreateForm && styles.activeButtonText
                  ]}>CREATE</Text>
                </Pressable>
                
                <Pressable 
                  style={[styles.secondaryButton, showJoinForm && styles.activeButton]}
                  onPress={() => {
                    setShowJoinForm(!showJoinForm);
                    setShowCreateForm(false);
                  }}
                >
                  <UserPlus size={16} color={showJoinForm ? "#E6B325" : "#8A8A8A"} />
                  <Text style={[
                    styles.secondaryButtonText,
                    showJoinForm && styles.activeButtonText
                  ]}>JOIN BY CODE</Text>
                </Pressable>
              </View>
            </View>
            
            {showCreateForm && (
              <View style={styles.form}>
                <Text style={styles.formTitle}>Create Lobby</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Lobby Name"
                    placeholderTextColor="#8A8A8A"
                    value={lobbyName}
                    onChangeText={setLobbyName}
                  />
                </View>
                
                <View style={styles.checkboxContainer}>
                  <Pressable 
                    style={[
                      styles.checkbox,
                      isPrivate && styles.checkboxChecked
                    ]}
                    onPress={() => setIsPrivate(!isPrivate)}
                  >
                    {isPrivate && <Text style={styles.checkmark}>✓</Text>}
                  </Pressable>
                  <Text style={styles.checkboxLabel}>Private Game (Invite Only)</Text>
                </View>
                
                <Pressable 
                  style={styles.submitButton}
                  onPress={createLobby}
                  disabled={creatingLobby}
                >
                  {creatingLobby ? (
                    <ActivityIndicator color="#E6B325" />
                  ) : (
                    <Text style={styles.submitButtonText}>CREATE LOBBY</Text>
                  )}
                </Pressable>
              </View>
            )}
            
            {showJoinForm && (
              <View style={styles.form}>
                <Text style={styles.formTitle}>Join by Invite Code</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter Invite Code"
                    placeholderTextColor="#8A8A8A"
                    value={inviteCode}
                    onChangeText={setInviteCode}
                    autoCapitalize="none"
                  />
                </View>
                
                <Pressable 
                  style={styles.submitButton}
                  onPress={joinLobbyByCode}
                  disabled={joiningLobby}
                >
                  {joiningLobby ? (
                    <ActivityIndicator color="#E6B325" />
                  ) : (
                    <Text style={styles.submitButtonText}>JOIN GAME</Text>
                  )}
                </Pressable>
              </View>
            )}
            
            <View style={styles.lobbiesContainer}>
              <Text style={styles.sectionTitle}>Available Games</Text>
              {loading ? (
                <ActivityIndicator size="large" color="#E6B325" style={styles.loader} />
              ) : lobbies.length > 0 ? (
                <FlatList
                  data={lobbies}
                  renderItem={renderLobbyItem}
                  keyExtractor={(item) => item.id}
                  style={styles.lobbyList}
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                />
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No public games available</Text>
                  <Text style={styles.emptySubtext}>Create a game or join matchmaking</Text>
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  actions: {
    marginBottom: 20,
  },
  actionButton: {
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginBottom: 10,
  },
  buttonGradient: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonText: {
    color: '#1E1E2E',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  activeButton: {
    borderColor: '#E6B325',
    backgroundColor: 'rgba(230, 179, 37, 0.1)',
  },
  secondaryButtonText: {
    color: '#8A8A8A',
    fontSize: 14,
    fontWeight: '600',
  },
  activeButtonText: {
    color: '#E6B325',
  },
  form: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  formTitle: {
    color: '#E6B325',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    marginBottom: 16,
  },
  input: {
    color: '#FFFFFF',
    padding: 12,
    fontSize: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#E6B325',
    borderColor: '#E6B325',
  },
  checkmark: {
    color: '#1E1E2E',
    fontWeight: 'bold',
  },
  checkboxLabel: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  submitButton: {
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(230, 179, 37, 0.2)',
    borderWidth: 1,
    borderColor: '#E6B325',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#E6B325',
    fontSize: 14,
    fontWeight: '600',
  },
  lobbiesContainer: {
    flex: 1,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  lobbyList: {
    flex: 1,
  },
  lobbyItem: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  lobbyGradient: {
    padding: 16,
  },
  lobbyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lobbyName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  playerCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playerCount: {
    color: '#8A8A8A',
    fontSize: 14,
  },
  lobbyHost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  hostText: {
    color: '#E6B325',
    fontSize: 14,
  },
  joinButton: {
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(230, 179, 37, 0.2)',
    borderWidth: 1,
    borderColor: '#E6B325',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: 'rgba(138, 138, 138, 0.2)',
    borderColor: '#8A8A8A',
  },
  joinButtonText: {
    color: '#E6B325',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#8A8A8A',
    fontSize: 14,
  },
  loader: {
    marginTop: 40,
  },
  matchmakingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchmakingText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 40,
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderWidth: 1,
    borderColor: '#F44336',
    borderRadius: 20,
  },
  cancelButtonText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '600',
  },
});