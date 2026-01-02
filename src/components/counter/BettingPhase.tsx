'use client';

import type { Player, Bet } from '@/lib/counter-types';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface BettingPhaseProps {
  players: Player[];
  dealerIndex: number;
  cardsInRound: number;
  currentBets: Bet;
  setCurrentBets: (bets: Bet) => void;
}

const getInitials = (name: string) => (name ? name.substring(0, 2).toUpperCase() : '??');

export function BettingPhase({
  players,
  dealerIndex,
  cardsInRound,
  currentBets,
  setCurrentBets,
}: BettingPhaseProps) {
  const bettingOrder: number[] = [];
  for (let i = 1; i <= players.length; i++) {
    bettingOrder.push((dealerIndex + i) % players.length);
  }

  const currentTotalBets = Object.values(currentBets).reduce((a, b) => a + b, 0);

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-primary" />
        Hagan sus apuestas
      </h2>

      <div className="space-y-3">
        {bettingOrder.map((playerIdx, i) => {
          const player = players[playerIdx];
          const isLast = i === players.length - 1;
          const myBet = currentBets[player.id];
          const forbiddenBet = isLast ? cardsInRound - currentTotalBets : -1;

          return (
            <Card
              key={player.id}
              className={`transition-all ${
                myBet !== undefined ? 'border-primary bg-primary/5' : 'shadow-sm'
              }`}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                    {getInitials(player.name)}
                  </div>
                  <CardTitle className="text-lg">{player.name}</CardTitle>
                </div>
                {myBet !== undefined && (
                  <span className="bg-primary/20 text-primary-foreground px-3 py-1 rounded-md text-sm font-bold">
                    Apuesta: {myBet}
                  </span>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
                  {[...Array(cardsInRound + 1)].map((_, n) => {
                    const isForbidden = isLast && n === forbiddenBet;
                    return (
                      <Button
                        key={n}
                        disabled={isForbidden}
                        variant={myBet === n ? 'default' : 'outline'}
                        size="icon"
                        onClick={() => setCurrentBets({ ...currentBets, [player.id]: n })}
                        className={`
                          flex-shrink-0 w-12 h-12 text-xl transition-all
                          ${myBet === n && 'scale-105'}
                          ${isForbidden && 'bg-destructive/20 text-destructive-foreground cursor-not-allowed border-destructive'}
                        `}
                      >
                        {n}
                      </Button>
                    );
                  })}
                </div>
                {isLast && forbiddenBet >=0 && (
                  <div className="text-xs text-destructive bg-destructive/10 p-2 rounded-md mt-3 flex items-center gap-2 border border-destructive/20">
                    <AlertCircle className="w-4 h-4" />
                    Prohibido apostar <strong>{forbiddenBet}</strong> (Puente)
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
