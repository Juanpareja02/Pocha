'use client';

import type { Player } from '@/lib/counter-types';
import { Trophy, Crown, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';


interface ScoreboardProps {
  players: Player[];
  roundSequence: number[];
  currentRound: number;
}

const getInitials = (name: string) => (name ? name.substring(0, 2).toUpperCase() : '??');

export function Scoreboard({ players, roundSequence, currentRound }: ScoreboardProps) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
        <Trophy className="w-6 h-6 text-yellow-500" />
        Clasificación
      </h2>

      {/* Leaderboard */}
      <div className="space-y-3 mb-8">
        {sortedPlayers.map((player, idx) => (
          <Card key={player.id} className={cn(idx === 0 && 'border-yellow-400 bg-yellow-50/50')}>
             <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-muted-foreground font-mono text-xl w-6 font-bold">#{idx + 1}</div>
                    <div className="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-bold text-sm">
                        {getInitials(player.name)}
                    </div>
                    <div>
                        <div className="font-bold text-foreground text-lg flex items-center gap-2">
                            {player.name}
                            {idx === 0 && <Crown className="w-5 h-5 text-yellow-500 fill-yellow-500" />}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Última ronda:{' '}
                            <Badge variant={player.history[player.history.length - 1] >= 0 ? 'secondary' : 'destructive'}>
                                {player.history[player.history.length - 1] > 0 ? '+' : ''}
                                {player.history[player.history.length - 1]}
                            </Badge>
                        </div>
                    </div>
                </div>
                <div className="text-3xl font-bold text-primary">
                    {player.score}
                </div>
             </CardContent>
          </Card>
        ))}
      </div>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2 uppercase text-muted-foreground">
            <RotateCcw className="w-4 h-4" /> Historial de Puntos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card z-10">Ronda</TableHead>
                  {players.map(p => (
                    <TableHead key={p.id} className="text-center min-w-[6rem]">
                      {p.name.length > 8 ? `${p.name.slice(0, 6)}..` : p.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {roundSequence.slice(0, currentRound + 1).map((cards, rIdx) => (
                  <TableRow key={rIdx}>
                    <TableCell className="font-mono text-xs font-bold text-muted-foreground sticky left-0 bg-card z-10">
                      R{rIdx + 1} <span className="font-normal">({cards}c)</span>
                    </TableCell>
                    {players.map(p => {
                      const score = p.history[rIdx];
                      return (
                        <TableCell key={p.id} className={cn(
                            "text-center font-bold",
                            score === undefined ? 'text-muted-foreground' : score >= 0 ? 'text-green-600' : 'text-red-500'
                        )}>
                          {score ?? '-'}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
