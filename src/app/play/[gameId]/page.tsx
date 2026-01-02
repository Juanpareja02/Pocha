"use client";

import { GameBoard } from "@/components/play/GameBoard";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useUser, useFirestore, useMemoFirebase } from "@/firebase";
import { doc, collection, query, where, getDocs } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Game, GameLobby } from "@/lib/types";

export default function PlayPage() {
  const router = useRouter();
  const params = useParams();
  const firestore = useFirestore();
  const { user } = useUser();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The ID from the URL could be a lobbyId or a gameId
  const entityId = params.gameId as string;

  // Memoize Firestore references
  const lobbyRef = useMemoFirebase(() => firestore ? doc(firestore, "gameLobbies", entityId) : null, [firestore, entityId]);
  const gameRef = useMemoFirebase(() => firestore ? doc(firestore, "games", entityId) : null, [firestore, entityId]);

  const { data: lobbyData, isLoading: isLobbyLoading } = useDoc<GameLobby>(lobbyRef);
  const { data: gameData, isLoading: isGameLoading } = useDoc<Game>(gameRef);

  useEffect(() => {
    // If we have lobby data and its status changes to PLAYING and it has a gameId,
    // it means the game has started. We should navigate to the actual game page.
    if (lobbyData?.status === 'PLAYING' && lobbyData.gameId) {
      if (entityId !== lobbyData.gameId) { // Avoid navigation loop
        router.push(`/play/${lobbyData.gameId}`);
      }
    }
  }, [lobbyData, entityId, router]);


  // Determine what to render based on the data we have.
  // The entityId could be a lobbyId or a gameId.
  const isLoading = isLobbyLoading || isGameLoading;

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Cargando partida...</div>;
  }

  // If we have gameData, we are in a game.
  if (gameData) {
    // Here you would transform gameData into the GameState expected by GameBoard
    // This is a placeholder transformation.
    const gameState = {
        // This is where the full game state transformation will happen.
        // For now, it's missing, we need to build it from `gameData`
        gameId: gameData.id,
        // ... and so on
    } as any; // Cast to any to avoid TS errors for now
    // return <GameBoard initialState={gameState} />;
    return <GameBoard initialLobby={null} initialGame={gameData} />;
  }

  // If we have lobbyData, we are in a lobby.
  if (lobbyData) {
    return <GameBoard initialLobby={lobbyData} initialGame={null} />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-2xl font-bold">Error</h1>
      <p className="text-red-500">No se encontró la partida o la sala de espera.</p>
       <p className="text-muted-foreground">ID: {entityId}</p>
      <Button onClick={() => router.push('/lobby')}>Volver a la sala de espera</Button>
    </div>
  );
}

// Dummy Button component for the error screen
const Button = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props} className="px-4 py-2 bg-primary text-primary-foreground rounded-md" />
)
