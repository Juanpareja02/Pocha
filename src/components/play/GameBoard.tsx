"use client";

import { useState } from "react";
import type { Game, Card, GameLobby } from "@/lib/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { UserHand } from "./UserHand";
import { GameTable } from "./GameTable";
import { PlayerDisplay } from "./PlayerDisplay";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Home, Info, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useUser } from "@/firebase";
import { createGameFromLobby } from "@/lib/actions";

export function GameBoard({ initialLobby, initialGame }: { initialLobby: GameLobby | null, initialGame: Game | null }) {
  const [lobby, setLobby] = useState<GameLobby | null>(initialLobby);
  const [game, setGame] = useState<Game | null>(initialGame);
  const { user } = useUser();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [isStarting, setIsStarting] = useState(false);

  const handleStartGame = async () => {
    if (!lobby || !user || user.uid !== lobby.creatorId) return;

    setIsStarting(true);
    try {
      // This server action will create the game document and update the lobby.
      await createGameFromLobby(lobby.id, lobby.playerIds);
      // The useEffect on the page will handle the navigation.
    } catch (error) {
      console.error("Failed to start game:", error);
      setIsStarting(false);
      // Optionally, show a toast to the user
    }
  };

  // If we are in the lobby phase
  if (lobby && !game) {
    const isHost = user?.uid === lobby.creatorId;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
        <h1 className="text-4xl font-bold mb-2">Sala de Espera</h1>
        <p className="text-muted-foreground mb-6">Código de la partida:</p>
        <div className="bg-secondary px-8 py-4 rounded-lg border mb-8">
            <p className="text-4xl font-mono font-bold tracking-widest">{lobby.accessCode}</p>
        </div>

        <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Jugadores ({lobby.playerIds.length})</h2>
            <div className="flex gap-4 justify-center">
                {lobby.playerIds.map(playerId => (
                    <div key={playerId} className="flex flex-col items-center gap-2">
                        <Avatar className="w-16 h-16">
                            <AvatarImage src={`https://picsum.photos/seed/${playerId}/150/150`} />
                            <AvatarFallback>{playerId.substring(0,2)}</AvatarFallback>
                        </Avatar>
                        <p className="font-medium">{user?.uid === playerId ? "Tú" : `Jugador...`}</p>
                    </div>
                ))}
            </div>
        </div>

        {isHost && (
          <Button onClick={handleStartGame} disabled={isStarting} size="lg" className="w-full max-w-xs">
            {isStarting ? "Empezando..." : <><Play className="mr-2"/>Empezar Partida</>}
          </Button>
        )}
        {!isHost && (
            <p className="text-muted-foreground">Esperando a que el anfitrión inicie la partida...</p>
        )}
         <Button variant="link" onClick={() => router.push('/lobby')} className="mt-4">
          Salir de la sala
        </Button>
      </div>
    );
  }

  // If we have a game, render the game board
  // This part needs to be fully implemented with the actual game state
  if (game) {
    // The existing GameBoard logic would go here.
    // We need to transform the `game` object into the `gameState` object expected by the components.
    // This is a placeholder for now.
    return <div className="flex items-center justify-center min-h-screen">¡El juego ha comenzado! (ID: {game.id})</div>
  }

  return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
  
}
