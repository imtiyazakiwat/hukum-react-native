import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Stack } from "expo-router";
import { useRouter } from "expo-router";
import { useGameStore } from "@/store/gameStore";
import { Trophy, Users } from "lucide-react-native";
import { CARD_BACK_IMAGE } from "@/constants/cards";

export default function HomeScreen() {
  const router = useRouter();
  const { resetGame } = useGameStore();

  useEffect(() => {
    // Reset game state when returning to home screen
    resetGame();
  }, [resetGame]);

  return (
    <LinearGradient
      colors={["#1E1E2E", "#2D2D44"]}
      style={styles.container}
    >
      <Stack.Screen
        options={{
          title: "Hukum",
          headerTransparent: true,
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
      </View>
      
      <View style={styles.cardsPreview}>
        <Image
          source={{ uri: "https://raw.githubusercontent.com/VallabhKulkarni-09/hukum/2da9902f3740539db685792319a0a8f9d5d6667e/frontend/cards/hearts/King.webp" }}
          style={[styles.previewCard, { transform: [{ rotate: "-10deg" }] }]}
          contentFit="cover"
        />
        <Image
          source={{ uri: "https://raw.githubusercontent.com/VallabhKulkarni-09/hukum/2da9902f3740539db685792319a0a8f9d5d6667e/frontend/cards/spades/Ace.webp" }}
          style={[styles.previewCard, { transform: [{ rotate: "5deg" }] }]}
          contentFit="cover"
        />
      </View>
      
      <View style={styles.gameInfo}>
        <View style={styles.infoItem}>
          <Users size={20} color="#E6B325" />
          <Text style={styles.infoText}>Team-based multiplayer gameplay</Text>
        </View>
        <View style={styles.infoItem}>
          <Trophy size={20} color="#E6B325" />
          <Text style={styles.infoText}>First team to 5 points wins</Text>
        </View>
      </View>
      
      <View style={styles.buttonsContainer}>
        <Pressable 
          style={styles.playButton}
          onPress={() => router.push("/lobby")}
        >
          <LinearGradient
            colors={["#E6B325", "#D4A017"]}
            style={styles.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.playButtonText}>PLAY ONLINE</Text>
          </LinearGradient>
        </Pressable>
        
        <Pressable 
          style={styles.secondaryButton}
          onPress={() => router.push("/game")}
        >
          <View style={styles.secondaryButtonContent}>
            <Users size={18} color="#E6B325" />
            <Text style={styles.secondaryButtonText}>PLAY VS AI</Text>
          </View>
        </Pressable>
        
        <Pressable 
          style={styles.secondaryButton}
          onPress={() => router.push("/(tabs)/history")}
        >
          <View style={styles.secondaryButtonContent}>
            <Trophy size={18} color="#E6B325" />
            <Text style={styles.secondaryButtonText}>VIEW HISTORY</Text>
          </View>
        </Pressable>
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Experience the traditional Hukum Card game
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 60,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 40,
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "#E6B325",
  },
  logoText: {
    color: "#E6B325",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 16,
    letterSpacing: 1,
  },
  cardsPreview: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 20,
  },
  previewCard: {
    width: 100,
    height: 150,
    borderRadius: 8,
    marginHorizontal: -15,
    borderWidth: 1,
    borderColor: "#E6B325",
  },
  gameInfo: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 12,
    padding: 16,
    width: "80%",
    marginBottom: 20,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  infoText: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  buttonsContainer: {
    width: "100%",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 40,
  },
  playButton: {
    width: "100%",
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#E6B325",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  buttonGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  playButtonText: {
    color: "#1E1E2E",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 1,
  },
  secondaryButton: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#E6B325",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  secondaryButtonText: {
    color: "#E6B325",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    marginTop: 20,
  },
  footerText: {
    color: "#8A8A8A",
    fontSize: 14,
    textAlign: "center",
  },
});