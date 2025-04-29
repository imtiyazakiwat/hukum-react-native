export type CardSuit = "Hearts" | "Diamonds" | "Clubs" | "Spades";
export type CardValue = "7" | "8" | "9" | "10" | "Jack" | "Queen" | "King" | "Ace";

export interface CardType {
  suit: string;
  value: string;
  imageUrl?: string;
}

export type PlayerType = "player" | "ai1" | "ai2" | "ai3";
export type TeamType = "A" | "B";

export interface GameHistoryItem {
  date: string;
  result: "win" | "loss";
  teamAScore: number;
  teamBScore: number;
  hukumSuit: string;
}

export interface TableCardType {
  player: PlayerType;
  card: CardType;
}