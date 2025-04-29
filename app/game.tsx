import React, { useEffect, useState, useRef } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  Dimensions, 
  Alert,
  Platform,
  ActivityIndicator
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { useGameStore } from "@/store/gameStore";
import { ArrowLeft, Trophy, Users } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { CARD_BACK_IMAGE } from "@/constants/cards";
import { CardType, TeamType } from "@/types/game";
import { useAuthGuard } from "@/lib/hooks";

const { width, height } = Dimensions.get("window");

export default function GameScreen() {
  useAuthGuard();  // Add auth guard hook

  const router = useRouter();
  const params = useLocalSearchParams();
  const gameId = params.gameId as string;
  
  const { 
    playerHand,
    otherPlayers,
    hukumSuit,
    currentPlayer,
    playerPosition,
    cardsOnTable,
    teamAScore,
    teamBScore,
    currentRound,
    startingSuit,
    roundWinner,
    gameWinner,
    gameStatus,
    isMyTurn,
    
    joinGame,
    leaveGame,
    playCard,
    setHukumSuit,
    startNewRound,
    addToHistory,
  } = useGameStore();
  
  const [selectedHukum, setSelectedHukum] = useState<string | null>(null);
  const [animatingCard, setAnimatingCard] = useState<boolean>(false);
  const [initializing, setInitializing] = useState(true);
  
  // Join game on mount
  useEffect(() => {
    async function initializeGame() {
      if (!gameId) {
        router.replace('/(tabs)');
        return;
      }

      try {
        await joinGame(gameId);
        setInitializing(false);
      } catch (error) {
        console.error('Error joining game:', error);
        Alert.alert('Error', 'Failed to join game');
        router.replace('/(tabs)');
      }
    }

    initializeGame();
    return () => {
      leaveGame();
    };
  }, [gameId]);

  const handleHukumSelection = (suit: string) => {
    setSelectedHukum(suit);
    setHukumSuit(suit);
    
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };
  
  const handleCardPlay = (cardIndex: number) => {
    if (!isMyTurn || animatingCard || gameStatus !== 'playing') return;
    
    const card = playerHand[cardIndex];
    
    // Check if the card follows suit rules
    if (startingSuit && card.suit !== startingSuit) {
      // Check if player has any cards of the starting suit
      const hasSuit = playerHand.some(c => c.suit === startingSuit);
      
      if (hasSuit) {
        Alert.alert(
          "Invalid Move",
          "You must play a card of the starting suit if you have one."
        );
        return;
      }
    }
    
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    setAnimatingCard(true);
    playCard(cardIndex).catch(console.error);
    
    setTimeout(() => {
      setAnimatingCard(false);
    }, 800);
  };
  
  const handleStartNewRound = () => {
    startNewRound().catch(console.error);
  };
  
  const handleExitGame = () => {
    Alert.alert(
      "Exit Game",
      "Are you sure you want to exit the current game?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Exit", 
          style: "destructive", 
          onPress: () => {
            leaveGame().then(() => {
              router.replace("/(tabs)");
            });
          }
        }
      ]
    );
  };

  // Helper to render a player's cards (either face up for current player or face down for others)
  const renderPlayerCards = (position: number, isCurrent: boolean) => {
    if (isCurrent) {
      return playerHand.map((card, index) => (
        <Pressable 
          key={`player-card-${index}`}
          style={[
            styles.card, 
            styles.playerCard,
            canPlayCard(card) && isMyTurn && styles.playableCard
          ]}
          onPress={() => handleCardPlay(index)}
          disabled={animatingCard || !isMyTurn || !canPlayCard(card)}
        >
          <Image
            source={{ uri: card.imageUrl }}
            style={styles.cardImage}
            contentFit="cover"
            transition={300}
          />
        </Pressable>
      ));
    }

    // Get the player at this position
    const player = otherPlayers.find(p => p.position === position);
    if (!player) return null;

    // Render face down cards
    return Array(8).fill(0).map((_, index) => (
      <View 
        key={`player-${position}-card-${index}`}
        style={[
          styles.card,
          getCardPositionStyle(position)
        ]}
      >
        <Image
          source={{ uri: CARD_BACK_IMAGE }}
          style={styles.cardBackImage}
          contentFit="cover"
        />
      </View>
    ));
  };

  // Helper to get player position style
  const getCardPositionStyle = (position: number) => {
    const currentPosition = playerPosition || 0;
    switch ((position - currentPosition + 4) % 4) {
      case 1: return styles.rightCardStyle;
      case 2: return styles.topCardStyle;
      case 3: return styles.leftCardStyle;
      default: return styles.playerCard;
    }
  };

  // Helper to check if a card can be played
  const canPlayCard = (card: CardType): boolean => {
    if (!startingSuit) return true;
    
    const hasSuit = playerHand.some(c => c.suit === startingSuit);
    if (hasSuit) {
      return card.suit === startingSuit;
    }
    
    return true;
  };

  // Helper to get table card position
  function getTableCardPosition(playerPosition: number) {
    switch (playerPosition) {
      case 0: return styles.bottomTableCard;
      case 1: return styles.rightTableCard;
      case 2: return styles.topTableCard;
      case 3: return styles.leftTableCard;
      default: return {};
    }
  }

  // Helper to get position style with null safety
  const getPositionStyle = (relativePosition: number) => {
    const currentPosition = playerPosition || 0;
    const actualPos = (relativePosition - currentPosition + 4) % 4;
    switch (actualPos) {
      case 0: return styles.bottomPosition;
      case 1: return styles.rightPosition;
      case 2: return styles.topPosition;
      case 3: return styles.leftPosition;
      default: return {};
    }
  };

  // Helper to map string player to position number
  const playerToPosition = (player: string): number => {
    const pos = parseInt(player.replace('player', ''));
    return isNaN(pos) ? 0 : pos;
  };

  const renderHukumSelection = () => {
    return (
      <View style={styles.hukumSelectionContainer}>
        <LinearGradient
          colors={["rgba(0,0,0,0.7)", "rgba(0,0,0,0.85)"]}
          style={styles.hukumSelectionModal}
        >
          <Text style={styles.hukumSelectionTitle}>Select Hukum Suit</Text>
          
          <View style={styles.suitContainer}>
            {["Hearts", "Diamonds", "Clubs", "Spades"].map((suit) => (
              <Pressable
                key={suit}
                style={[
                  styles.suitButton,
                  selectedHukum === suit && styles.selectedHukum
                ]}
                onPress={() => handleHukumSelection(suit)}
              >
                <Text style={[
                  styles.suitSymbol,
                  suit === "Hearts" || suit === "Diamonds"
                    ? {color: "#FF5252"}
                    : {color: "#1E1E1E"}
                ]}>
                  {getSuitSymbol(suit)}
                </Text>
                <Text style={styles.suitName}>{suit}</Text>
              </Pressable>
            ))}
          </View>
        </LinearGradient>
      </View>
    );
  };

  const renderRoundEnd = () => {
    const isPlayerTeamWinner = roundWinner === playerPosition?.toString();
    
    return (
      <View style={styles.roundEndContainer}>
        <View style={styles.roundEndContent}>
          <Text style={styles.roundEndTitle}>
            {isPlayerTeamWinner ? "Your Team Won" : "Opponent Team Won"}
          </Text>
          <Text style={styles.roundEndSubtitle}>Round {currentRound}</Text>
          
          <View style={styles.scoreDisplay}>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreLabel}>Team A</Text>
              <Text style={[
                styles.scoreValue,
                isPlayerTeamWinner && styles.winningScore
              ]}>
                {teamAScore}
              </Text>
            </View>
            <View style={styles.roundScoreDivider} />
            <View style={styles.scoreItem}>
              <Text style={styles.scoreLabel}>Team B</Text>
              <Text style={[
                styles.scoreValue,
                !isPlayerTeamWinner && styles.winningScore
              ]}>
                {teamBScore}
              </Text>
            </View>
          </View>
          
          <Pressable 
            style={styles.continueButton}
            onPress={handleStartNewRound}
          >
            <LinearGradient
              colors={["#E6B325", "#D4A017"]}
              style={styles.gradientButton}
            >
              <Text style={styles.actionButtonText}>CONTINUE</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderGameEnd = () => {
    const isPlayerTeamWinner = gameWinner === "A";
    
    return (
      <View style={styles.gameEndContainer}>
        <LinearGradient
          colors={isPlayerTeamWinner ? ["#2D4A3A", "#1E3A2E"] : ["#4A2D2D", "#3A1E1E"]}
          style={styles.gameEndContent}
        >
          <View style={styles.trophyContainer}>
            {isPlayerTeamWinner ? (
              <Trophy size={60} color="#E6B325" />
            ) : (
              <Users size={60} color="#E6B325" />
            )}
          </View>
          
          <Text style={styles.gameEndTitle}>
            {isPlayerTeamWinner ? "Victory!" : "Defeat!"}
          </Text>
          <Text style={styles.gameEndSubtitle}>
            {isPlayerTeamWinner 
              ? "Congratulations! Your team has won the game." 
              : "Better luck next time!"}
          </Text>
          
          <View style={styles.finalScoreDisplay}>
            <View style={styles.finalScoreItem}>
              <Text style={styles.finalScoreLabel}>Team A</Text>
              <Text style={[
                styles.finalScoreValue,
                isPlayerTeamWinner && styles.winningScore
              ]}>
                {teamAScore}
              </Text>
            </View>
            <View style={styles.finalScoreDivider} />
            <View style={styles.finalScoreItem}>
              <Text style={styles.finalScoreLabel}>Team B</Text>
              <Text style={[
                styles.finalScoreValue,
                !isPlayerTeamWinner && styles.winningScore
              ]}>
                {teamBScore}
              </Text>
            </View>
          </View>
          
          <View style={styles.gameEndButtons}>
            <Pressable 
              style={styles.gameEndButton}
              onPress={() => router.replace("/(tabs)")}
            >
              <Text style={styles.gameEndButtonText}>EXIT</Text>
            </Pressable>
            <Pressable 
              style={[styles.gameEndButton, styles.newGameButton]}
              onPress={() => router.replace("/lobby")}
            >
              <LinearGradient
                colors={["#E6B325", "#D4A017"]}
                style={styles.buttonGradient}
              >
                <Text style={styles.newGameButtonText}>NEW GAME</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </LinearGradient>
      </View>
    );
  };

  // Show loading state while initializing
  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E6B325" />
        <Text style={styles.loadingText}>Joining game...</Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={["#1E1E2E", "#2D2D44"]}
      style={styles.container}
    >
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Game header with scores */}
      <View style={styles.header}>
        <Pressable 
          style={styles.backButton}
          onPress={handleExitGame}
        >
          <ArrowLeft size={24} color="#E6B325" />
        </Pressable>
        
        <View style={styles.scoreBoard}>
          <View style={styles.teamScore}>
            <Text style={styles.teamLabel}>Team A</Text>
            <Text style={styles.scoreText}>{teamAScore}</Text>
          </View>
          <Text style={styles.scoreDividerText}>-</Text>
          <View style={styles.teamScore}>
            <Text style={styles.teamLabel}>Team B</Text>
            <Text style={styles.scoreText}>{teamBScore}</Text>
          </View>
        </View>
        
        <View style={styles.roundIndicator}>
          <Text style={styles.roundText}>Round {currentRound}</Text>
        </View>
      </View>

      {/* Render players based on their relative positions */}
      {[0, 1, 2, 3].map(pos => {
        const relativePos = (pos - playerPosition + 4) % 4;
        const positionStyle = getPositionStyle(relativePos);
        const player = otherPlayers.find(p => p.position === pos) || 
                      (pos === playerPosition ? { team: 'A' as TeamType } : null);
        
        if (!player) return null;

        return (
          <View 
            key={`position-${pos}`} 
            style={[
              styles.playerSection,
              positionStyle,
              currentPlayer === pos && styles.activePlayer
            ]}
          >
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>
                {pos === playerPosition ? 'You' : `Player ${pos + 1}`}
              </Text>
              <Text style={[
                styles.teamLabel,
                player.team === 'A' ? styles.teamALabel : styles.teamBLabel
              ]}>
                Team {player.team}
              </Text>
            </View>
            <View style={styles.cardsContainer}>
              {renderPlayerCards(pos, pos === playerPosition)}
            </View>
          </View>
        );
      })}

      {/* Game table with played cards */}
      <View style={styles.gameTable}>
        <LinearGradient
          colors={["#1E3A2E", "#2D4A3A"]}
          style={styles.tableGradient}
        >
          {cardsOnTable.map((tableCard, index) => (
            <View 
              key={`table-card-${index}`}
              style={[
                styles.tableCard,
                getTableCardPosition(playerToPosition(tableCard.player))
              ]}
            >
              <Image
                source={{ uri: tableCard.card.imageUrl }}
                style={styles.cardImage}
                contentFit="cover"
                transition={300}
              />
            </View>
          ))}
          
          {hukumSuit && (
            <View style={styles.hukumIndicator}>
              <Text style={styles.hukumLabel}>Hukum:</Text>
              <Text style={[
                styles.hukumSuit,
                hukumSuit === "Hearts" || hukumSuit === "Diamonds"
                  ? {color: "#FF5252"}
                  : {color: "#1E1E1E"}
              ]}>
                {getSuitSymbol(hukumSuit)}
              </Text>
            </View>
          )}
        </LinearGradient>
      </View>

      {/* Render game phase overlays */}
      {gameStatus === 'hukum_selection' && playerPosition === 0 && renderHukumSelection()}
      {gameStatus === 'round_end' && renderRoundEnd()}
      {gameStatus === 'completed' && renderGameEnd()}
    </LinearGradient>
  );
}

// Helper functions remain the same
function getSuitSymbol(suit: string): string {
  switch (suit) {
    case "Hearts": return "♥";
    case "Diamonds": return "♦";
    case "Clubs": return "♣";
    case "Spades": return "♠";
    default: return "";
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreBoard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  teamScore: {
    alignItems: "center",
  },
  teamLabel: {
    color: "#8A8A8A",
    fontSize: 12,
    marginBottom: 4,
  },
  scoreText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  scoreDividerText: {
    color: "#8A8A8A",
    fontSize: 16,
    marginHorizontal: 12,
  },
  roundIndicator: {
    backgroundColor: "rgba(230, 179, 37, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roundText: {
    color: "#E6B325",
    fontSize: 14,
    fontWeight: "600",
  },
  gameTable: {
    position: "absolute",
    top: height * 0.3,
    left: width * 0.15,
    width: width * 0.7,
    height: height * 0.3,
    borderRadius: 20,
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  tableGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#E6B325",
  },
  hukumIndicator: {
    position: "absolute",
    top: 70,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 10,
  },
  hukumLabel: {
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 8,
  },
  hukumSuit: {
    fontSize: 20,
    fontWeight: "bold",
  },
  bottomPosition: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  rightPosition: {
    position: 'absolute',
    right: 20,
    top: height * 0.3,
    alignItems: 'center',
  },
  topPosition: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  leftPosition: {
    position: 'absolute',
    left: 20,
    top: height * 0.3,
    alignItems: 'center',
  },
  playerSection: {
    alignItems: 'center',
  },
  cardsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  teamALabel: {
    color: '#4CAF50',
  },
  teamBLabel: {
    color: '#F44336',
  },
  card: {
    width: 60,
    height: 90,
    borderRadius: 6,
    marginHorizontal: -5,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  playerCard: {
    width: 70,
    height: 105,
    marginHorizontal: -10,
    transform: [{ translateY: 0 }],
  },
  playableCard: {
    borderWidth: 2,
    borderColor: "#4CAF50",
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 5,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardBackImage: {
    width: "100%",
    height: "100%",
  },
  tableCard: {
    position: "absolute",
    width: 70,
    height: 105,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  bottomTableCard: {
    bottom: 20,
    left: "50%",
    marginLeft: -35,
  },
  leftTableCard: {
    left: 20,
    top: "50%",
    marginTop: -52.5,
  },
  topTableCard: {
    top: 20,
    left: "50%",
    marginLeft: -35,
  },
  rightTableCard: {
    right: 20,
    top: "50%",
    marginTop: -52.5,
  },
  activePlayer: {
    borderRadius: 16,
    backgroundColor: "rgba(230, 179, 37, 0.2)",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  rightCardStyle: {
    transform: [{ rotate: "90deg" }],
  },
  topCardStyle: {
    transform: [{ rotate: "180deg" }],
  },
  leftCardStyle: {
    transform: [{ rotate: "-90deg" }],
  },
  playerInfo: {
    alignItems: "center",
    marginBottom: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  playerName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  hukumSelectionContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  hukumSelectionModal: {
    width: "80%",
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
  },
  hukumSelectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 24,
  },
  suitContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
  },
  suitButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  selectedHukum: {
    backgroundColor: "#007BFF",
    transform: [{ scale: 1.1 }],
  },
  suitSymbol: {
    fontSize: 40,
    fontWeight: "bold",
  },
  suitName: {
    fontSize: 16,
    color: "#333",
    marginTop: 8,
  },
  roundEndContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  roundEndContent: {
    width: "80%",
    backgroundColor: "#2D2D44",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  roundEndTitle: {
    color: "#E6B325",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },
  roundEndSubtitle: {
    color: "#FFFFFF",
    fontSize: 16,
    marginBottom: 24,
  },
  scoreDisplay: {
    flexDirection: "row",
    width: "100%",
    marginBottom: 30,
  },
  scoreItem: {
    flex: 1,
    alignItems: "center",
  },
  scoreLabel: {
    color: "#8A8A8A",
    fontSize: 14,
    marginBottom: 8,
  },
  scoreValue: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "bold",
  },
  winningScore: {
    color: "#E6B325",
  },
  continueButton: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    overflow: "hidden",
  },
  gradientButton: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    color: "#1E1E2E",
    fontSize: 16,
    fontWeight: "bold",
  },
  roundScoreDivider: {
    width: 1,
    height: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  gameEndContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  gameEndContent: {
    width: "85%",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  trophyContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(230, 179, 37, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  gameEndTitle: {
    color: "#E6B325",
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
  },
  gameEndSubtitle: {
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
  },
  finalScoreDisplay: {
    flexDirection: "row",
    width: "100%",
    marginBottom: 30,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 16,
    padding: 16,
  },
  finalScoreItem: {
    flex: 1,
    alignItems: "center",
  },
  finalScoreLabel: {
    color: "#8A8A8A",
    fontSize: 14,
    marginBottom: 8,
  },
  finalScoreValue: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "bold",
  },
  finalScoreDivider: {
    width: 1,
    height: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  gameEndButtons: {
    flexDirection: "row",
    width: "100%",
    gap: 16,
  },
  gameEndButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  gameEndButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  newGameButton: {
    borderWidth: 0,
    overflow: "hidden",
  },
  newGameButtonText: {
    color: "#1E1E2E",
    fontSize: 16,
    fontWeight: "bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1E1E2E",
  },
  loadingText: {
    marginTop: 16,
    color: "#E6B325",
    fontSize: 16,
    fontWeight: "600",
  },
});