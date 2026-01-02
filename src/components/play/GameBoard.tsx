"use client";

import { useState } from "react";
import type { GameState, Card } from "@/lib/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { UserHand } from "./UserHand";
import { GameTable } from "./GameTable";
import { PlayerDisplay } from "./PlayerDisplay";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Home, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function GameBoard({ initialState }: { initialState: GameState }) {
  const [gameState, setGameState] = useState<GameState>(initialState);
  const router = useRouter();
  const isMobile = useIsMobile();

  const you = gameState.players.find((p) => p.isYou);
  const otherPlayers = gameState.players.filter((p) => !p.isYou);

  const handleCardPlay = (card: Card) => {
    console.log("Played card:", card);
    // This is where you would update the actual game state
    // For now, we'll just remove the card from the user's hand for demo purposes
    setGameState(prev => ({
        ...prev,
        players: prev.players.map(p => 
            p.isYou ? { ...p, hand: p.hand.filter(c => !(c.rank === card.rank && c.suit === card.suit)) } : p
        ),
        currentTrick: [...prev.currentTrick, { playerId: you!.id, card }],
        currentPlayerId: otherPlayers[0]?.id || ""
    }));
  };

  // Simplified logic for playable cards
  const getPlayableCards = (): Card[] => {
    if (!you) return [];
    const leadingSuit = gameState.currentTrick[0]?.card.suit;
    if (leadingSuit) {
      const cardsInSuit = you.hand.filter(c => c.suit === leadingSuit);
      if (cardsInSuit.length > 0) {
        return cardsInSuit;
      }
    }
    return you.hand;
  };
  
  const renderDesktopLayout = () => {
    const topPlayer = otherPlayers.length > 1 ? otherPlayers[1] : null;
    const leftPlayer = otherPlayers.length > 0 ? otherPlayers[0] : null;
    const rightPlayer = otherPlayers.length > 2 ? otherPlayers[2] : null;

    return (
      <div className="relative h-screen w-full overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(103,58,183,0.1)_0%,transparent_60%)] p-4">
        
        {topPlayer && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2">
                <PlayerDisplay player={topPlayer} isCurrentPlayer={gameState.currentPlayerId === topPlayer.id} phase={gameState.phase} position="top" />
            </div>
        )}
        {leftPlayer && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <PlayerDisplay player={leftPlayer} isCurrentPlayer={gameState.currentPlayerId === leftPlayer.id} phase={gameState.phase} position="left" />
            </div>
        )}
        {rightPlayer && (
             <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <PlayerDisplay player={rightPlayer} isCurrentPlayer={gameState.currentPlayerId === rightPlayer.id} phase={gameState.phase} position="right" />
            </div>
        )}

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <GameTable trick={gameState.currentTrick} trumpSuit={gameState.trumpSuit} roundNumber={gameState.roundNumber} />
        </div>

        {you && (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl">
            <UserHand hand={you.hand} onCardPlay={handleCardPlay} playableCards={getPlayableCards()} />
          </div>
        )}

        <div className="absolute bottom-4 left-4 flex flex-col items-center gap-2">
           <Avatar className="w-16 h-16 border-2 border-background">
             <AvatarImage src={you?.avatarUrl} />
             <AvatarFallback>{you?.name.substring(0, 2)}</AvatarFallback>
           </Avatar>
           <p className="font-semibold text-sm">{you?.name}</p>
           <Badge>Puntos: {you?.score}</Badge>
        </div>
      </div>
    );
  };
  
  const renderMobileLayout = () => {
    return (
       <div className="flex h-screen w-full flex-col p-2 gap-2">
            <div className="grid grid-cols-3 gap-2">
                {otherPlayers.map(p => (
                    <div key={p.id} className="flex flex-col items-center gap-1 p-1 rounded-lg bg-card/50 border">
                        <Avatar className="w-10 h-10">
                            <AvatarImage src={p.avatarUrl} />
                            <AvatarFallback>{p.name.substring(0,2)}</AvatarFallback>
                        </Avatar>
                        <p className="text-xs font-bold truncate w-full text-center">{p.name}</p>
                        <Badge variant={gameState.currentPlayerId === p.id ? "default": "secondary"} className="text-[10px] px-1 h-4">
                          {p.bet}/{p.tricksWon}
                        </Badge>
                    </div>
                ))}
            </div>

            <div className="flex-grow flex items-center justify-center">
                 <GameTable trick={gameState.currentTrick} trumpSuit={gameState.trumpSuit} roundNumber={gameState.roundNumber} />
            </div>
            
            {you && (
                <div className="w-full">
                    <UserHand hand={you.hand} onCardPlay={handleCardPlay} playableCards={getPlayableCards()} />
                </div>
            )}
       </div>
    );
  };

  return (
    <div className="w-full min-h-screen">
      <div className="absolute top-4 left-4 z-20">
        <Button variant="outline" size="icon" onClick={() => router.push('/lobby')}>
          <Home className="w-4 h-4" />
        </Button>
      </div>
      <div className="absolute top-4 right-4 z-20">
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                    <Info className="w-4 h-4" />
                </Button>
            </SheetTrigger>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Info de la Partida</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-4">
                    <p><strong>ID Partida:</strong> {gameState.accessCode}</p>
                    <p><strong>Ronda:</strong> {gameState.roundNumber}</p>
                    <p><strong>Fase:</strong> {gameState.phase}</p>
                    <p><strong>Triunfo:</strong> <span className="capitalize">{gameState.trumpSuit}</span></p>
                    <p><strong>Turno:</strong> {gameState.players.find(p => p.id === gameState.currentPlayerId)?.name}</p>
                </div>
            </SheetContent>
        </Sheet>
      </div>
      {isMobile ? renderMobileLayout() : renderDesktopLayout()}
    </div>
  );
}
