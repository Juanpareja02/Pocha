'use client';

import type { Player, Variant } from '@/lib/counter-types';
import { Home, Hand } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface GameHeaderProps {
  currentRound: number;
  roundSequence: number[];
  isGoldRound: boolean;
  setIsGoldRound: (isGold: boolean) => void;
  variants: Variant;
  players: Player[];
  dealerIndex: number;
}

export function GameHeader({
  currentRound,
  roundSequence,
  isGoldRound,
  setIsGoldRound,
  variants,
  players,
  dealerIndex,
}: GameHeaderProps) {
  const router = useRouter();
  const cards = roundSequence[currentRound];

  return (
    <header className="bg-card/80 backdrop-blur-sm p-4 shadow-md sticky top-0 z-20 border-b">
        <div className="absolute top-1/2 -translate-y-1/2 left-4">
            <Button variant="outline" size="icon" onClick={() => router.push('/mode-select')}>
                <Home className="w-4 h-4" />
            </Button>
        </div>
      <div className="max-w-md mx-auto">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm text-muted-foreground font-medium">
            Ronda {currentRound + 1} de {roundSequence.length}
          </div>
          {variants.doubleGold && (
            <Button
              onClick={() => setIsGoldRound(!isGoldRound)}
              variant={isGoldRound ? 'default' : 'secondary'}
              size="sm"
              className={`transition-all ${isGoldRound ? 'bg-yellow-500 text-yellow-900 hover:bg-yellow-500/90' : ''}`}
            >
              {isGoldRound ? '✨ PINTAN OROS (x2)' : 'Otro palo'}
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary font-bold text-xl w-10 h-10 rounded-lg flex items-center justify-center">
              {cards}
            </div>
            <span className="font-medium">Cartas</span>
          </div>
          <div className="text-right flex flex-col items-end">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Reparte</div>
            <div className="font-bold flex items-center gap-2 bg-secondary px-3 py-1 rounded-lg border">
              <Hand className="w-4 h-4 text-primary" />
              {players[dealerIndex]?.name}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
