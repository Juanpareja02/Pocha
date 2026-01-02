
"use client";

import type { Card } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Oros, Copas, Espadas, Bastos, Logo } from "@/components/icons";
import React from "react";

const suitIcons = {
  oros: Oros,
  copas: Copas,
  espadas: Espadas,
  bastos: Bastos,
};

const redSuits: Array<Card["suit"]> = ["copas"]; // Traditionally only cups are red in spanish deck representations
const goldSuits: Array<Card["suit"]> = ["oros"];

interface PlayingCardProps extends React.HTMLAttributes<HTMLDivElement> {
  card: Card | "back";
  isPlayable?: boolean;
  isStacked?: boolean;
}

export const PlayingCard = React.forwardRef<HTMLDivElement, PlayingCardProps>(
  ({ card, className, isPlayable, isStacked, ...props }, ref) => {
    const baseClasses = "w-20 h-28 md:w-24 md:h-36 rounded-lg shadow-md transition-all duration-300 ease-in-out";
    
    if (card === "back") {
      return (
        <div
          ref={ref}
          className={cn(
            baseClasses,
            "bg-secondary border-2 border-primary-foreground/20 p-2 flex items-center justify-center",
            isStacked && "shadow-lg",
            className
          )}
          {...props}
        >
          <div className="w-full h-full border-2 border-primary-foreground/30 rounded-md flex items-center justify-center bg-primary">
            <Logo className="w-10 h-10 text-primary-foreground/70" />
          </div>
        </div>
      );
    }

    const SuitIcon = suitIcons[card.suit];
    const isRed = redSuits.includes(card.suit);
    const isGold = goldSuits.includes(card.suit);

    return (
      <div
        ref={ref}
        className={cn(
          baseClasses,
          "bg-card border border-black/10 dark:border-white/10 flex flex-col justify-between p-1.5",
          isRed ? "text-red-500 dark:text-red-400" : isGold ? "text-yellow-500 dark:text-yellow-400" : "text-foreground",
          isPlayable
            ? "cursor-pointer hover:-translate-y-4 hover:shadow-2xl hover:shadow-primary/30 ring-2 ring-accent ring-offset-2 ring-offset-background dark:ring-offset-background"
            : "cursor-default",
          isStacked && "shadow-lg",
          className
        )}
        {...props}
      >
        <div className="flex flex-col items-start">
          <span className="text-xl md:text-2xl font-bold leading-none select-none">
            {card.rank}
          </span>
          <SuitIcon className="w-4 h-4" />
        </div>
        <div className="flex justify-center items-center">
          <SuitIcon className="w-8 h-8 md:w-10 md:h-10 opacity-80" />
        </div>
        <div className="flex flex-col items-start rotate-180">
          <span className="text-xl md:text-2xl font-bold leading-none select-none">
            {card.rank}
          </span>
          <SuitIcon className="w-4 h-4" />
        </div>
      </div>
    );
  }
);
PlayingCard.displayName = "PlayingCard";
