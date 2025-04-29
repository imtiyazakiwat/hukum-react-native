import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CardType, PlayerType, GameHistoryItem, TableCardType, TeamType } from "@/types/game";
import { CARD_SUITS, CARD_VALUES, CARD_IMAGES } from "@/constants/cards";
import { supabase, getCurrentUser } from "@/lib/supabase";
import { Database } from "@/types/supabase";

interface GameState {
  gameId: string | null;
  playerId: string | null;
  playerPosition: number | null;
  deck: CardType[];
  playerHand: CardType[];
  otherPlayers: Array<{
    id: string;
    position: number;
    username: string;
    team: TeamType;
  }>;
  hukumSuit: string;
  currentPlayer: number;
  cardsOnTable: TableCardType[];
  teamAScore: number;
  teamBScore: number;
  currentRound: number;
  startingSuit: string | null;
  gameHistory: GameHistoryItem[];
  roundWinner: string | null;
  gameWinner: TeamType | null;
  gameStatus: 'setup' | 'hukum_selection' | 'playing' | 'round_end' | 'completed';
  isMyTurn: boolean;
  
  // Game actions
  joinGame: (gameId: string) => Promise<void>;
  leaveGame: () => Promise<void>;
  playCard: (cardIndex: number) => Promise<void>;
  setHukumSuit: (suit: string) => Promise<void>;
  startNewRound: () => Promise<void>;
  resetGame: () => void;
  
  // Game history
  addToHistory: (winningTeam: TeamType) => void;
  clearHistory: () => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      gameId: null,
      playerId: null,
      playerPosition: null,
      deck: [],
      playerHand: [],
      otherPlayers: [],
      hukumSuit: "",
      currentPlayer: 0,
      cardsOnTable: [],
      teamAScore: 0,
      teamBScore: 0,
      currentRound: 1,
      startingSuit: null,
      gameHistory: [],
      roundWinner: null,
      gameWinner: null,
      gameStatus: 'setup',
      isMyTurn: false,

      joinGame: async (gameId: string) => {
        try {
          const user = await getCurrentUser();
          if (!user) throw new Error('Not authenticated');

          // Join the game
          const { data: playerData, error: joinError } = await supabase
            .from('game_players')
            .insert({
              game_id: gameId,
              user_id: user.id,
            })
            .select('*, profile:profiles(*)')
            .single();

          if (joinError) throw joinError;

          // Set up real-time subscriptions
          const gameSubscription = supabase
            .channel(`game:${gameId}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'games',
                filter: `id=eq.${gameId}`
              },
              (payload) => {
                const gameData = payload.new as Database['public']['Tables']['games']['Row'];
                set({
                  currentPlayer: gameData.current_player,
                  hukumSuit: gameData.hukum_suit || "",
                  teamAScore: gameData.team_a_score,
                  teamBScore: gameData.team_b_score,
                  gameStatus: gameData.status as any,
                  roundWinner: gameData.round_winner,
                  gameWinner: gameData.game_winner as TeamType | null,
                  isMyTurn: gameData.current_player === get().playerPosition
                });
              }
            )
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'table_cards',
                filter: `game_id=eq.${gameId}`
              },
              (payload) => {
                const cardData = payload.new as Database['public']['Tables']['table_cards']['Row'];
                if (payload.eventType === 'INSERT') {
                  const card = cardData.card as unknown as CardType;
                  set((state) => ({
                    cardsOnTable: [...state.cardsOnTable, {
                      player: `player${cardData.player_id}` as PlayerType,
                      card
                    }]
                  }));
                }
              }
            )
            .subscribe();

          // Subscribe to player hands
          const handSubscription = supabase
            .channel(`hand:${gameId}:${playerData.id}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'player_hands',
                filter: `player_id=eq.${playerData.id}`
              },
              (payload) => {
                const handData = payload.new as Database['public']['Tables']['player_hands']['Row'];
                set({ playerHand: (handData.cards as unknown as CardType[]) || [] });
              }
            )
            .subscribe();

          set({
            gameId,
            playerId: playerData.id,
            playerPosition: playerData.player_position,
          });

        } catch (error) {
          console.error('Error joining game:', error);
          throw error;
        }
      },

      leaveGame: async () => {
        const { gameId, playerId } = get();
        if (!gameId || !playerId) return;

        try {
          await supabase
            .from('game_players')
            .update({ is_connected: false })
            .eq('id', playerId);

          // Remove subscriptions
          await supabase.channel(`game:${gameId}`).unsubscribe();
          await supabase.channel(`hand:${gameId}:${playerId}`).unsubscribe();

          set({
            gameId: null,
            playerId: null,
            playerPosition: null,
            playerHand: [],
            otherPlayers: [],
            cardsOnTable: [],
          });
        } catch (error) {
          console.error('Error leaving game:', error);
          throw error;
        }
      },

      playCard: async (cardIndex: number) => {
        const { gameId, playerId, playerHand, isMyTurn } = get();
        if (!gameId || !playerId || !isMyTurn) return;

        const cardToPlay = playerHand[cardIndex];
        
        try {
          // Add card to table
          await supabase
            .from('table_cards')
            .insert({
              game_id: gameId,
              player_id: playerId,
              card: cardToPlay
            });

          // Update player's hand
          const updatedHand = [
            ...playerHand.slice(0, cardIndex),
            ...playerHand.slice(cardIndex + 1)
          ];

          await supabase
            .from('player_hands')
            .update({ cards: updatedHand })
            .eq('player_id', playerId);

          set({ playerHand: updatedHand });
        } catch (error) {
          console.error('Error playing card:', error);
          throw error;
        }
      },

      setHukumSuit: async (suit: string) => {
        const { gameId } = get();
        if (!gameId) return;

        try {
          await supabase
            .from('games')
            .update({
              hukum_suit: suit,
              status: 'playing'
            })
            .eq('id', gameId);
        } catch (error) {
          console.error('Error setting hukum suit:', error);
          throw error;
        }
      },

      startNewRound: async () => {
        const { gameId } = get();
        if (!gameId) return;

        try {
          await supabase
            .from('games')
            .update({
              current_round: get().currentRound + 1,
              starting_suit: null,
              round_winner: null,
              round_start_time: new Date().toISOString()
            })
            .eq('id', gameId);

          // Clear table cards
          await supabase
            .from('table_cards')
            .delete()
            .eq('game_id', gameId);

          set({ cardsOnTable: [] });
        } catch (error) {
          console.error('Error starting new round:', error);
          throw error;
        }
      },

      resetGame: () => {
        const { gameId, playerId } = get();
        if (gameId) {
          supabase.channel(`game:${gameId}`).unsubscribe();
          if (playerId) {
            supabase.channel(`hand:${gameId}:${playerId}`).unsubscribe();
          }
        }

        set({
          gameId: null,
          playerId: null,
          playerPosition: null,
          deck: [],
          playerHand: [],
          otherPlayers: [],
          hukumSuit: "",
          currentPlayer: 0,
          cardsOnTable: [],
          teamAScore: 0,
          teamBScore: 0,
          currentRound: 1,
          startingSuit: null,
          roundWinner: null,
          gameWinner: null,
          gameStatus: 'setup',
          isMyTurn: false,
        });
      },

      addToHistory: (winningTeam: TeamType) => {
        const { teamAScore, teamBScore, hukumSuit } = get();
        const date = new Date().toLocaleDateString();
        const result = winningTeam === "A" ? "win" : "loss";
        
        set(state => ({
          gameHistory: [
            {
              date,
              result,
              teamAScore,
              teamBScore,
              hukumSuit,
            },
            ...state.gameHistory
          ]
        }));
      },

      clearHistory: () => {
        set({ gameHistory: [] });
      },
    }),
    {
      name: "indian-heritage-card-game",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        gameHistory: state.gameHistory,
      }),
    }
  )
);