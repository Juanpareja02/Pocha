"use client";

import type { Player, GamePhase } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Bot, Crown, CheckCircle, Hourglass, Target, Trophy } from "lucide-react";
import { PlayingCard } from "./PlayingCard";

interface PlayerDisplayProps {
  player: Player;
  isCurrentPlayer: boolean;
  phase: GamePhase;
  position: "top" | "left" | "right";
}

export function PlayerDisplay({ player, isCurrentPlayer, phase, position }: PlayerDisplayProps) {
  const cardCount = player.hand.length;

  const getHandRotation = () => {
    switch (position) {
      case "left":
        return "transform -rotate-90 origin-bottom-left";
      case "right":
        return "transform rotate-90 origin-bottom-right";
      default:
        return "";
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 w-48">
      <div className="relative flex justify-center w-full h-20">
        <div className={cn("absolute flex justify-center", getHandRotation())}>
            {Array.from({ length: cardCount }).map((_, i) => (
                <div key={i} className="absolute" style={{ left: `${i * 20}px` }}>
                <PlayingCard card="back" className="w-12 h-20 shadow-sm" />
                </div>
            ))}
        </div>
      </div>
      <div className={cn("relative rounded-full p-1 transition-all duration-300", isCurrentPlayer && "bg-accent ring-2 ring-accent shadow-lg shadow-accent/50")}>
        <Avatar className="w-16 h-16 border-2 border-background">
          <AvatarImage src={player.avatarUrl} alt={player.name} />
          <AvatarFallback>{player.name.substring(0, 2)}</AvatarFallback>
        </Avatar>
        {player.isHost && <Crown className="absolute -top-1 -right-1 w-5 h-5 text-yellow-400 bg-primary rounded-full p-0.5" />}
        {player.isAI && <Bot className="absolute bottom-0 -right-1 w-5 h-5 text-cyan-300 bg-secondary rounded-full p-0.5" />}
      </div>
      
      <p className="font-semibold text-sm text-center truncate w-32">{player.name}</p>

      <div className="flex gap-2 text-xs">
        <Badge variant={isCurrentPlayer ? "default" : "secondary"}>
          Puntos: {player.score}
        </Badge>
      </div>

      <div className="flex gap-2 text-xs items-center h-5">
        {phase === "BETTING" && isCurrentPlayer && <Hourglass className="w-4 h-4 animate-spin" />}
        {phase === "BETTING" && player.bet === undefined && !isCurrentPlayer && <span className="text-muted-foreground">Apostando...</span>}
        {player.bet !== undefined && (
          <>
            <Badge variant="outline" className="gap-1">
                <Target className="w-3 h-3" /> Apostó: {player.bet}
            </Badge>
            <Badge variant="outline" className="gap-1">
                <Trophy className="w-3 h-3" /> Ganó: {player.tricksWon}
            </Badge>
          </>
        )}
      </div>
    </div>
  );
}
