import { GameBoard } from "@/components/play/GameBoard";
import { mockGameState } from "@/lib/data";

export default function PlayPage({ params }: { params: { gameId: string } }) {
  // In a real app, you would fetch game state based on params.gameId
  // For now, we use mock data.
  const gameState = mockGameState;

  return (
    <div className="bg-background dark:bg-gray-900">
      <GameBoard initialState={gameState} />
    </div>
  );
}
