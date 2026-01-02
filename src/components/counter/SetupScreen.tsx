'use client';

import React, { useState } from 'react';
import type { Variant } from '@/lib/counter-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PochaIcon } from '@/components/icons';
import { Play } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SetupScreenProps {
  onInitialize: (playerNames: string[], numPlayers: number) => void;
  variants: Variant;
  setVariants: (variants: Variant) => void;
}

const getInitials = (name: string) => (name ? name.substring(0, 2).toUpperCase() : '??');

export function SetupScreen({ onInitialize, variants, setVariants }: SetupScreenProps) {
  const router = useRouter();
  const [numPlayers, setNumPlayers] = useState(4);
  const [names, setNames] = useState<string[]>(Array(4).fill(''));

  const handleNumPlayersChange = (n: number) => {
    setNumPlayers(n);
    setNames(Array(n).fill(''));
  };

  const updateName = (idx: number, val: string) => {
    const newNames = [...names];
    newNames[idx] = val;
    setNames(newNames);
  };
  
  return (
    <div className="relative min-h-screen w-full bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]"></div>
        <main className="relative z-10 flex min-h-screen flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl backdrop-blur-sm bg-card/80">
          <CardHeader className="text-center">
            <div className="flex justify-center items-center gap-3 mb-2">
              <PochaIcon className="w-10 h-10 text-primary" />
              <CardTitle className="text-4xl font-headline tracking-tighter">Contador de Pocha</CardTitle>
            </div>
            <CardDescription>Configura una nueva partida para llevar la cuenta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Número de Jugadores</Label>
              <div className="grid grid-cols-4 gap-2">
                {[3, 4, 5, 6].map(n => (
                  <Button
                    key={n}
                    variant={numPlayers === n ? 'default' : 'outline'}
                    onClick={() => handleNumPlayersChange(n)}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Nombres de los Jugadores</Label>
              {Array.from({ length: numPlayers }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                    {names[i] ? getInitials(names[i]) : i + 1}
                  </div>
                  <Input
                    type="text"
                    placeholder={`Jugador ${i + 1}`}
                    value={names[i]}
                    onChange={e => updateName(i, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="pt-4 border-t">
              <Label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-muted rounded-lg">
                <Checkbox
                  id="doubleGold"
                  checked={variants.doubleGold}
                  onCheckedChange={checked => setVariants({ ...variants, doubleGold: !!checked })}
                />
                <div className="grid gap-1.5 leading-none">
                    <span className="font-medium">Oros valen doble</span>
                    <p className="text-xs text-muted-foreground">Los puntos se multiplican x2 si pintan oros.</p>
                </div>
              </Label>
            </div>

            <Button onClick={() => onInitialize(names, numPlayers)} size="lg" className="w-full">
              <Play /> Empezar Partida
            </Button>
            <Button onClick={() => router.push('/mode-select')} size="lg" variant="outline" className="w-full">
                Volver
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
