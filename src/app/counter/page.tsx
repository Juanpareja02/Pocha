'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Minus, UserPlus, Trash2, Home, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Player {
  id: number;
  name: string;
  score: number;
}

export default function CounterPage() {
  const [players, setPlayers] = useState<Player[]>([
    { id: 1, name: 'Jugador 1', score: 0 },
    { id: 2, name: 'Jugador 2', score: 0 },
  ]);
  const router = useRouter();

  const addPlayer = () => {
    setPlayers([...players, { id: Date.now(), name: `Jugador ${players.length + 1}`, score: 0 }]);
  };

  const removePlayer = (id: number) => {
    setPlayers(players.filter(p => p.id !== id));
  };

  const updateScore = (id: number, delta: number) => {
    setPlayers(players.map(p => (p.id === id ? { ...p, score: p.score + delta } : p)));
  };

  const updateName = (id: number, name: string) => {
    setPlayers(players.map(p => (p.id === id ? { ...p, name } : p)));
  };

  return (
    <div className="relative min-h-screen w-full bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]"></div>
      <main className="relative z-10 flex flex-col items-center p-4">
        <div className="w-full max-w-4xl">
           <div className="flex justify-between items-center mb-6">
             <Button variant="outline" size="icon" onClick={() => router.push('/mode-select')}>
                <Home className="w-4 h-4" />
            </Button>
            <h1 className="text-3xl font-bold font-headline flex items-center gap-2"><Users /> Contador de Pocha</h1>
            <Button variant="outline" onClick={addPlayer} size="icon">
              <UserPlus className="w-4 h-4" />
              <span className="sr-only">Añadir Jugador</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {players.map(player => (
              <Card key={player.id} className="shadow-lg bg-card/80 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Input
                    className="text-lg font-bold border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto"
                    value={player.name}
                    onChange={(e) => updateName(player.id, e.target.value)}
                  />
                   <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removePlayer(player.id)}>
                      <Trash2 className="h-4 w-4" />
                   </Button>
                </CardHeader>
                <CardContent>
                  <div className="text-5xl font-bold text-center py-4">{player.score}</div>
                  <div className="flex items-center justify-center space-x-2">
                    <Button variant="outline" size="icon" onClick={() => updateScore(player.id, -1)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => updateScore(player.id, 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
