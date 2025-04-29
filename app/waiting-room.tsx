import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/supabase';
import { Copy, ArrowLeft, Users, Shield, User } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useAuthGuard } from '@/lib/hooks';

type Player = {
  id: string;
  user_id: string;
  player_position: number;
  team: 'A' | 'B';
  profile?: {
    username: string;
    avatar_url: string | null;
  }
};

export default function WaitingRoomScreen() {
  useAuthGuard();  // Add auth guard hook

  const router = useRouter();
  const params = useLocalSearchParams();
  const lobbyId = params.lobbyId as string;
  const gameId = params.gameId as string;
  const fromMatchmaking = params.fromMatchmaking === 'true';
  
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [lobby, setLobby] = useState<any>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadLobbyAndPlayers();
    setupRealtime();

    // Clean up realtime subscription
    return () => {
      supabase.channel('lobby-updates').unsubscribe();
    };
  }, []);

  const setupRealtime = () => {
    supabase.channel('lobby-updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'game_players',
        filter: `game_id=eq.${gameId}`
      }, () => {
        loadPlayers();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`
      }, (payload) => {
        if (payload.new.status === 'hukum_selection') {
          // Game is starting, navigate to game screen
          router.replace({
            pathname: '/game',
            params: { gameId },
          });
        }
      })
      .subscribe();
  };

  const loadLobbyAndPlayers = async () => {
    try {
      setLoading(true);
      const user = await getCurrentUser();
      if (user) {
        setCurrentUserId(user.id);
      }

      // Fetch lobby details
      const { data: lobbyData, error: lobbyError } = await supabase
        .from('lobbies')
        .select('*, profiles:host_id(*)')
        .eq('id', lobbyId)
        .single();

      if (lobbyError) {
        console.error('Error fetching lobby:', lobbyError);
        Alert.alert('Error', 'Failed to load lobby details');
        router.back();
        return;
      }

      setLobby(lobbyData);
      setInviteCode(lobbyData.invite_code);
      setIsHost(lobbyData.host_id === user?.id);

      await loadPlayers();
    } catch (error) {
      console.error('Error loading lobby:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const loadPlayers = async () => {
    try {
      // Fetch players in this game
      const { data: playersData, error: playersError } = await supabase
        .from('game_players')
        .select('*, profile:user_id(username, avatar_url)')
        .eq('game_id', gameId)
        .order('player_position', { ascending: true });

      if (playersError) {
        console.error('Error fetching players:', playersError);
        return;
      }

      setPlayers(playersData as Player[]);
    } catch (error) {
      console.error('Error loading players:', error);
    }
  };

  const copyInviteCode = async () => {
    await Clipboard.setStringAsync(inviteCode);
    Alert.alert('Copied', 'Invite code copied to clipboard');
  };

  const startGame = async () => {
    if (players.length < 4) {
      Alert.alert('Cannot Start Game', 'Need 4 players to start the game');
      return;
    }

    try {
      setStarting(true);
      // Update game status
      const { error } = await supabase
        .from('games')
        .update({ status: 'hukum_selection' })
        .eq('id', gameId);

      if (error) {
        Alert.alert('Error', 'Failed to start game: ' + error.message);
        return;
      }

      // Navigate to game screen
      router.replace({
        pathname: '/game',
        params: { gameId },
      });
    } catch (error) {
      console.error('Error starting game:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setStarting(false);
    }
  };

  const leaveGame = async () => {
    try {
      if (isHost) {
        Alert.alert(
          'Leave Game?',
          'As the host, leaving will cancel the game for everyone.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Leave & Cancel Game', 
              style: 'destructive',
              onPress: async () => {
                // Update lobby status
                await supabase
                  .from('lobbies')
                  .update({ status: 'completed' })
                  .eq('id', lobbyId);
                
                router.replace('/(tabs)');
              }
            }
          ]
        );
      } else {
        // Just leave the game
        if (currentUserId) {
          await supabase
            .from('game_players')
            .delete()
            .eq('game_id', gameId)
            .eq('user_id', currentUserId);
        }
        
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Error leaving game:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const handleBack = () => {
    // Ask for confirmation before leaving
    Alert.alert(
      'Leave Waiting Room?',
      'Are you sure you want to leave?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: leaveGame }
      ]
    );
  };

  const getEmptyPlayerSlots = () => {
    const existingPositions = players.map(p => p.player_position);
    const emptySlots = [];
    
    for (let i = 0; i < 4; i++) {
      if (!existingPositions.includes(i)) {
        emptySlots.push(i);
      }
    }
    
    return emptySlots;
  };

  const renderPlayer = (position: number) => {
    const player = players.find(p => p.player_position === position);
    const team = position % 2 === 0 ? 'A' : 'B';
    const isCurrentUser = player?.user_id === currentUserId;
    
    return (
      <View style={[
        styles.playerCard,
        team === 'A' ? styles.teamACard : styles.teamBCard,
        isCurrentUser && styles.currentUserCard
      ]}>
        {player ? (
          <>
            <View style={styles.playerIcon}>
              <User size={24} color="#FFFFFF" />
            </View>
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>
                {player.profile?.username || 'Player'}
                {isCurrentUser && ' (You)'}
              </Text>
              <View style={styles.teamBadge}>
                <Shield size={12} color={team === 'A' ? '#4CAF50' : '#F44336'} />
                <Text style={[
                  styles.teamText,
                  team === 'A' ? styles.teamAText : styles.teamBText
                ]}>
                  Team {team}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.emptyPlayerIcon}>
              <Users size={24} color="#8A8A8A" />
            </View>
            <Text style={styles.waitingText}>Waiting for player...</Text>
            <View style={styles.teamBadge}>
              <Shield size={12} color={team === 'A' ? '#4CAF50' : '#F44336'} />
              <Text style={[
                styles.teamText,
                team === 'A' ? styles.teamAText : styles.teamBText
              ]}>
                Team {team}
              </Text>
            </View>
          </>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E6B325" />
        <Text style={styles.loadingText}>Loading waiting room...</Text>
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
          title: "Waiting Room",
          headerShown: false,
        }}
      />
      
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <ArrowLeft color="#E6B325" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>Waiting Room</Text>
        <View style={{ width: 40 }} />
      </View>
      
      <View style={styles.content}>
        <View style={styles.lobbyInfo}>
          <Text style={styles.lobbyName}>{lobby?.name || 'Game Lobby'}</Text>
          
          {lobby?.is_private && (
            <Pressable 
              style={styles.inviteCodeContainer}
              onPress={copyInviteCode}
            >
              <Text style={styles.inviteCodeLabel}>Invite Code:</Text>
              <Text style={styles.inviteCode}>{inviteCode}</Text>
              <Copy size={16} color="#8A8A8A" />
            </Pressable>
          )}
          
          <Text style={styles.hostInfo}>
            Host: {lobby?.profiles?.username || 'Unknown'}
            {isHost && ' (You)'}
          </Text>
        </View>
        
        <Text style={styles.playersTitle}>Players ({players.length}/4)</Text>
        
        <View style={styles.playersContainer}>
          <View style={styles.teamSection}>
            <Text style={styles.teamTitle}>Team A</Text>
            <View style={styles.teamPlayers}>
              {renderPlayer(0)}
              {renderPlayer(2)}
            </View>
          </View>
          
          <View style={styles.teamSection}>
            <Text style={styles.teamTitle}>Team B</Text>
            <View style={styles.teamPlayers}>
              {renderPlayer(1)}
              {renderPlayer(3)}
            </View>
          </View>
        </View>
        
        <View style={styles.footer}>
          {isHost ? (
            <Pressable 
              style={[
                styles.startButton,
                players.length < 4 && styles.disabledButton
              ]}
              onPress={startGame}
              disabled={players.length < 4 || starting}
            >
              <LinearGradient
                colors={players.length < 4 ? ["#8A8A8A", "#666666"] : ["#E6B325", "#D4A017"]}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {starting ? (
                  <ActivityIndicator color="#1E1E2E" />
                ) : (
                  <Text style={styles.startButtonText}>
                    {players.length < 4 ? `WAITING FOR PLAYERS (${players.length}/4)` : 'START GAME'}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
          ) : (
            <View style={styles.waitingForHost}>
              <ActivityIndicator color="#E6B325" size="small" />
              <Text style={styles.waitingText}>
                {players.length < 4 
                  ? `Waiting for more players (${players.length}/4)` 
                  : 'Waiting for host to start game'}
              </Text>
            </View>
          )}
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
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  lobbyInfo: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  lobbyName: {
    color: '#E6B325',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  inviteCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
  },
  inviteCodeLabel: {
    color: '#8A8A8A',
    fontSize: 14,
    marginRight: 6,
  },
  inviteCode: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  hostInfo: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  playersTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  playersContainer: {
    flex: 1,
  },
  teamSection: {
    marginBottom: 24,
  },
  teamTitle: {
    color: '#8A8A8A',
    fontSize: 16,
    marginBottom: 12,
  },
  teamPlayers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  playerCard: {
    width: '48%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    minHeight: 120,
  },
  teamACard: {
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  teamBCard: {
    borderColor: 'rgba(244, 67, 54, 0.3)',
  },
  currentUserCard: {
    borderWidth: 2,
    borderColor: '#E6B325',
  },
  playerIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E6B325',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyPlayerIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(138, 138, 138, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  waitingText: {
    color: '#8A8A8A',
    fontSize: 14,
    marginBottom: 6,
  },
  teamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
    gap: 4,
  },
  teamText: {
    fontSize: 12,
    fontWeight: '600',
  },
  teamAText: {
    color: '#4CAF50',
  },
  teamBText: {
    color: '#F44336',
  },
  footer: {
    marginTop: 'auto',
    paddingVertical: 20,
  },
  startButton: {
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonGradient: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: '#1E1E2E',
    fontSize: 16,
    fontWeight: '700',
  },
  waitingForHost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});