"use client";

import type { Card } from "@/lib/types";
import { PlayingCard } from "./PlayingCard";

interface UserHandProps {
  hand: Card[];
  onCardPlay: (card: Card) => void;
  playableCards: Card[];
}

export function UserHand({ hand, onCardPlay, playableCards }: UserHandProps) {
  const cardCount = hand.length;
  const isPlayable = (card: Card) =>
    playableCards.some(pc => pc.rank === card.rank && pc.suit === card.suit);

  return (
    <div
      className="relative flex justify-center items-end h-48 w-full"
      style={{ minWidth: `${cardCount * 2.5}rem` }}
    >
      {hand.map((card, i) => {
        const rotation = (i - (cardCount - 1) / 2) * 8;
        const translateY = Math.abs(i - (cardCount - 1) / 2) * 6;
        return (
          <div
            key={`${card.suit}-${card.rank}`}
            className="absolute transition-transform duration-300 ease-out hover:z-10"
            style={{
              transform: `rotate(${rotation}deg) translateY(${translateY}px)`,
              transformOrigin: "bottom center",
            }}
          >
            <PlayingCard
              card={card}
              isPlayable={isPlayable(card)}
              onClick={() => isPlayable(card) && onCardPlay(card)}
            />
          </div>
        );
      })}
    </div>
  );
}
