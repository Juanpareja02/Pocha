"use client";

import { useState, useEffect } from "react";
import type { Game, Card, GameLobby, Player as PlayerType } from "@/lib/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { UserHand } from "./UserHand";
import { GameTable } from "./GameTable";
import { PlayerDisplay } from "./PlayerDisplay";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Home, Info, Play, Crown } from "lucide-react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useUser, useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { createGameFromLobby } from "@/lib/actions";
import { doc } from "firebase/firestore";

export function GameBoard({ initialLobby, initialGame }: { initialLobby: GameLobby | null, initialGame: Game | null }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [isStarting, setIsStarting] = useState(false);

  // Set up real-time listeners
  const lobbyRef = useMemoFirebase(() => initialLobby ? doc(firestore, "gameLobbies", initialLobby.id) : null, [firestore, initialLobby]);
  const gameRef = useMemoFirebase(() => initialGame ? doc(firestore, "games", initialGame.id) : null, [firestore, initialGame]);

  const { data: lobby } = useDoc<GameLobby>(lobbyRef);
  const { data: game } = useDoc<Game>(gameRef);

  const handleStartGame = async () => {
    if (!lobby || !user || user.uid !== lobby.creatorId) return;

    setIsStarting(true);
    try {
      // This server action will create the game document and update the lobby.
      await createGameFromLobby(lobby.id, lobby.playerIds);
      // The navigation will be handled by the page's useEffect watching the lobby status
    } catch (error) {
      console.error("Failed to start game:", error);
      setIsStarting(false);
    }
  };

  // If we are in the lobby phase
  if (lobby && lobby.status === 'LOBBY') {
    const isHost = user?.uid === lobby.creatorId;
    const currentLobby = lobby || initialLobby; // Use real-time data if available

    // Create a temporary list of players for display purposes
    const lobbyPlayers = currentLobby.playerIds.map(pid => ({
        id: pid,
        name: user?.uid === pid ? (user.displayName || "Tú") : `Jugador...`,
        avatarUrl: `https://picsum.photos/seed/${pid}/150/150`,
        isHost: lobby.creatorId === pid,
    }));


    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
        <h1 className="text-4xl font-bold mb-2">Sala de Espera</h1>
        <p className="text-muted-foreground mb-6">Código de la partida:</p>
        <div className="bg-secondary px-8 py-4 rounded-lg border mb-8">
            <p className="text-4xl font-mono font-bold tracking-widest">{currentLobby.accessCode}</p>
        </div>

        <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Jugadores ({lobbyPlayers.length})</h2>
            <div className="flex gap-4 justify-center flex-wrap">
                {lobbyPlayers.map(player => (
                    <div key={player.id} className="flex flex-col items-center gap-2">
                        <Avatar className="w-16 h-16 relative">
                            <AvatarImage src={player.avatarUrl} />
                            <AvatarFallback>{player.name.substring(0,2)}</AvatarFallback>
                            {player.isHost && <Crown className="absolute -top-1 -right-1 w-5 h-5 text-yellow-400 bg-primary rounded-full p-0.5" />}
                        </Avatar>
                        <p className="font-medium">{user?.uid === player.id ? "Tú" : player.name}</p>
                    </div>
                ))}
            </div>
        </div>

        {isHost && (
          <Button onClick={handleStartGame} disabled={isStarting || lobbyPlayers.length < 3} size="lg" className="w-full max-w-xs">
            {isStarting ? "Empezando..." : <><Play className="mr-2"/>Empezar Partida</>}
          </Button>
        )}
        {!isHost && (
            <p className="text-muted-foreground">Esperando a que el anfitrión inicie la partida...</p>
        )}
        {lobbyPlayers.length < 3 && isHost && (
            <p className="text-sm text-muted-foreground mt-2">Se necesitan al menos 3 jugadores.</p>
        )}
         <Button variant="link" onClick={() => router.push('/lobby')} className="mt-4">
          Salir de la sala
        </Button>
      </div>
    );
  }

  const activeGame = game || initialGame;

  // If we have a game, render the game board
  if (activeGame) {
    const you = activeGame.players?.find(p => p.id === user?.uid);
    if (!you) return <div className="flex items-center justify-center min-h-screen">No eres parte de esta partida.</div>;

    // This is a placeholder for the full game board UI
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center">
        <h1 className="text-3xl font-bold">¡Partida en curso!</h1>
        <p className="text-muted-foreground">ID de la partida: {activeGame.id}</p>
        <p className="mt-4">Ronda: {activeGame.currentRound + 1}</p>
        <p>Estado: {activeGame.status}</p>
        <p>Reparte: {activeGame.players?.find(p => p.id === activeGame.dealerId)?.name}</p>
        <p>Turno de: {activeGame.players?.find(p => p.id === activeGame.currentPlayerId)?.name}</p>
         <Button variant="link" onClick={() => router.push('/lobby')} className="mt-8">
          Volver al Lobby
        </Button>
      </div>
    );
  }

  // Fallback loading/error state
  return <div className="flex items-center justify-center min-h-screen">Cargando...</div>;
}