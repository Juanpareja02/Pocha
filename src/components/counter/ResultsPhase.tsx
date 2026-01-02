'use client';

import type { Player, Bet, Trick } from '@/lib/counter-types';
import { Check, Plus, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ResultsPhaseProps {
  players: Player[];
  cardsInRound: number;
  currentBets: Bet;
  currentTricks: Trick;
  setCurrentTricks: (tricks: Trick) => void;
}

const getInitials = (name: string) => (name ? name.substring(0, 2).toUpperCase() : '??');

export function ResultsPhase({
  players,
  cardsInRound,
  currentBets,
  currentTricks,
  setCurrentTricks,
}: ResultsPhaseProps) {
  const totalTricksLogged = Object.values(currentTricks).reduce((a, b) => a + b, 0);

  const handleTrickChange = (playerId: number, delta: number) => {
      const currentVal = currentTricks[playerId] || 0;
      const newVal = Math.max(0, currentVal + delta);
      setCurrentTricks({ ...currentTricks, [playerId]: newVal });
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
        <Check className="w-5 h-5 text-green-500" />
        ¿Cuántas bazas ha ganado cada uno?
      </h2>

      <div className="space-y-3">
        {players.map(player => {
          const bet = currentBets[player.id];
          const tricks = currentTricks[player.id] ?? 0;
          const isSet = currentTricks[player.id] !== undefined;

          return (
            <Card key={player.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
                        {getInitials(player.name)}
                    </div>
                    <CardTitle className="text-lg">{player.name}</CardTitle>
                </div>
                <Badge variant="secondary">Apostó: {bet}</Badge>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-4">
                  <Button variant="outline" size="icon" onClick={() => handleTrickChange(player.id, -1)}>
                    <Minus />
                  </Button>
                  <div className="flex-1 text-center">
                    <span className={`text-4xl font-bold ${isSet ? 'text-primary' : 'text-muted-foreground'}`}>
                      {tricks}
                    </span>
                    <span className="text-xs text-muted-foreground block uppercase font-bold tracking-wider">Bazas</span>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => handleTrickChange(player.id, 1)}>
                    <Plus />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div
        className={`fixed bottom-24 left-0 right-0 text-center font-bold py-3 transition-all ${
          totalTricksLogged === cardsInRound
            ? 'text-green-700 bg-green-100/80'
            : 'text-red-700 bg-red-100/80'
        }`}
      >
        Bazas asignadas: {totalTricksLogged} / {cardsInRound}
      </div>
    </div>
  );
}
