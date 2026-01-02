
"use client";

import type { Card, Suit } from "@/lib/types";
import { PlayingCard } from "./PlayingCard";
import { Card as UICard, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Oros, Copas, Espadas, Bastos } from "@/components/icons";

const suitIcons = {
  oros: Oros,
  copas: Copas,
  espadas: Espadas,
  bastos: Bastos,
};

interface GameTableProps {
  trick: { playerId: string; card: Card }[];
  trumpSuit?: Suit;
  roundNumber: number;
}

export function GameTable({ trick, trumpSuit, roundNumber }: GameTableProps) {
  const TrumpIcon = trumpSuit ? suitIcons[trumpSuit] : null;
  const redSuits = ["copas"];
  const goldSuits = ["oros"];

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <UICard className="bg-background/70 backdrop-blur-sm">
        <CardHeader className="p-2 pb-0">
          <CardTitle className="text-xs text-muted-foreground text-center">TRIUNFO / RONDA</CardTitle>
        </CardHeader>
        <CardContent className="p-2 flex items-center justify-center gap-4">
           <div className="flex items-center gap-1 min-w-[80px] justify-center">
            {TrumpIcon && trumpSuit ? (
              <>
                <TrumpIcon className={`w-6 h-6 ${redSuits.includes(trumpSuit) ? 'text-red-500' : goldSuits.includes(trumpSuit) ? 'text-yellow-500' : 'text-foreground'}`} />
                <span className="text-lg font-bold capitalize">{trumpSuit}</span>
              </>
            ) : (
                <span className="text-sm font-semibold">Ciegas</span>
            )}
           </div>
           <div className="w-px h-6 bg-border" />
           <div className="flex items-center gap-1">
             <span className="text-xl font-bold">{roundNumber}</span>
           </div>
        </CardContent>
      </UICard>

      <div className="relative h-40 w-64 flex items-center justify-center">
        {trick.length === 0 ? (
          <p className="text-muted-foreground">Esperando la primera carta...</p>
        ) : (
          trick.map(({ card }, index) => (
            <div key={index} className="absolute" style={{ transform: `translateX(${(index - (trick.length -1) / 2) * 30}px)` }}>
              <PlayingCard card={card} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
