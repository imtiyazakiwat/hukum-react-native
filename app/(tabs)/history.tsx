import React from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Stack } from "expo-router";
import { useGameStore } from "@/store/gameStore";
import { Trophy, Clock, User, Users } from "lucide-react-native";

export default function HistoryScreen() {
  const { gameHistory } = useGameStore();

  const renderHistoryItem = ({ item, index }) => {
    const isWin = item.result === "win";
    
    return (
      <Pressable style={styles.historyItem}>
        <LinearGradient
          colors={isWin ? ["#2D3A4A", "#1E2A3A"] : ["#3A2D2D", "#2A1E1E"]}
          style={styles.historyItemGradient}
        >
          <View style={styles.historyHeader}>
            <View style={styles.historyIndex}>
              <Text style={styles.historyIndexText}>{index + 1}</Text>
            </View>
            <View style={styles.resultBadge}>
              <Text style={[
                styles.resultText,
                { color: isWin ? "#4CAF50" : "#F44336" }
              ]}>
                {isWin ? "WIN" : "LOSS"}
              </Text>
            </View>
          </View>
          
          <View style={styles.historyDetails}>
            <View style={styles.detailRow}>
              <Clock size={16} color="#8A8A8A" />
              <Text style={styles.detailText}>{item.date}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Trophy size={16} color="#E6B325" />
              <Text style={styles.detailText}>Score: {item.teamAScore} - {item.teamBScore}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <User size={16} color="#8A8A8A" />
              <Text style={styles.detailText}>Hukum: {item.hukumSuit}</Text>
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    );
  };

  return (
    <LinearGradient
      colors={["#1E1E2E", "#2D2D44"]}
      style={styles.container}
    >
      <Stack.Screen
        options={{
          title: "Game History",
          headerTransparent: true,
        }}
      />
      
      <View style={styles.content}>
        {gameHistory.length > 0 ? (
          <FlatList
            data={gameHistory}
            renderItem={renderHistoryItem}
            keyExtractor={(_, index) => index.toString()}
            contentContainerStyle={styles.historyList}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyState}>
            <Users size={60} color="#8A8A8A" />
            <Text style={styles.emptyStateTitle}>No Game History</Text>
            <Text style={styles.emptyStateText}>
              Your completed games will appear here
            </Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: 100,
    paddingHorizontal: 16,
  },
  historyList: {
    paddingBottom: 20,
  },
  historyItem: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  historyItemGradient: {
    padding: 16,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  historyIndex: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(230, 179, 37, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  historyIndexText: {
    color: "#E6B325",
    fontWeight: "600",
  },
  resultBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  resultText: {
    fontWeight: "600",
    fontSize: 12,
  },
  historyDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
  },
  emptyStateTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    color: "#8A8A8A",
    fontSize: 14,
    textAlign: "center",
  },
});