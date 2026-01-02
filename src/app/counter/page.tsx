'use client';

import React, { useState } from 'react';
import type { Player, Variant, GameState, Bet, Trick } from '@/lib/counter-types';
import { SetupScreen } from '@/components/counter/SetupScreen';
import { GameHeader } from '@/components/counter/GameHeader';
import { BettingPhase } from '@/components/counter/BettingPhase';
import { ResultsPhase } from '@/components/counter/ResultsPhase';
import { Scoreboard } from '@/components/counter/Scoreboard';
import { Button } from '@/components/ui/button';
import { Play, Trophy, ChevronRight } from 'lucide-react';

export default function CounterPage() {
  const [gameState, setGameState] = useState<GameState>('setup');
  const [players, setPlayers] = useState<Player[]>([]);
  const [variants, setVariants] = useState<Variant>({ doubleGold: false });
  const [roundSequence, setRoundSequence] = useState<number[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [dealerIndex, setDealerIndex] = useState(0);
  const [isGoldRound, setIsGoldRound] = useState(false);
  const [currentBets, setCurrentBets] = useState<Bet>({});
  const [currentTricks, setCurrentTricks] = useState<Trick>({});

  const initializeGame = (playerNames: string[], numPlayers: number) => {
    const newPlayers: Player[] = Array.from({ length: numPlayers }, (_, index) => ({
      id: index,
      name: playerNames[index]?.trim() || `Jugador ${index + 1}`,
      score: 0,
      history: [],
    }));

    const cardSetup: { [key: number]: number } = {
        3: 24, // 8 cards max
        4: 32, // 8 cards max
        5: 40, // 8 cards max
        6: 36, // 6 cards max
    };

    const totalCards = cardSetup[numPlayers] || 40;
    const maxCards = Math.floor(totalCards / newPlayers.length);
    const sequence: number[] = [];
    for (let i = 1; i <= maxCards; i++) sequence.push(i);
    for (let i = maxCards - 1; i >= 1; i--) sequence.push(i);

    setPlayers(newPlayers);
    setRoundSequence(sequence);
    setCurrentRound(0);
    setDealerIndex(Math.floor(Math.random() * newPlayers.length));
    setGameState('betting');
    setCurrentBets({});
    setCurrentTricks({});
  };

  const calculateScores = () => {
    const updatedPlayers = players.map(player => {
      const bet = currentBets[player.id] ?? 0;
      const tricks = currentTricks[player.id] ?? 0;
      const diff = Math.abs(bet - tricks);
      let roundPoints = 0;

      if (diff === 0) {
        roundPoints = 10 + 5 * tricks;
      } else {
        roundPoints = -(5 * diff);
      }

      if (variants.doubleGold && isGoldRound) {
        roundPoints *= 2;
      }

      return {
        ...player,
        score: player.score + roundPoints,
        history: [...player.history, roundPoints],
      };
    });

    setPlayers(updatedPlayers);
    setGameState('scoreboard');
  };

  const handleNextPhase = () => {
    if (gameState === 'betting') {
      if (Object.keys(currentBets).length !== players.length) return;
      // Initialize tricks for all players
      const initialTricks: Trick = {};
      players.forEach(p => {
        initialTricks[p.id] = 0;
      });
      setCurrentTricks(initialTricks);
      setGameState('results');
    } else if (gameState === 'results') {
      const totalTricks = Object.values(currentTricks).reduce((a, b) => a + b, 0);
      if (totalTricks !== roundSequence[currentRound]) {
        alert(`¡Error! Las bazas ganadas (${totalTricks}) no coinciden con las cartas repartidas (${roundSequence[currentRound]}).`);
        return;
      }
      calculateScores();
    } else if (gameState === 'scoreboard') {
      const nextRound = currentRound + 1;
      if (nextRound >= roundSequence.length) {
        setGameState('gameover');
      } else {
        setCurrentRound(nextRound);
        setDealerIndex((dealerIndex + 1) % players.length);
        setCurrentBets({});
        setCurrentTricks({});
        setIsGoldRound(false);
        setGameState('betting');
      }
    }
  };

  const isButtonDisabled = () => {
    if (gameState === 'betting') {
      return Object.keys(currentBets).length !== players.length;
    }
    if (gameState === 'results') {
      const totalTricks = Object.values(currentTricks).reduce((a, b) => a + b, 0);
      return totalTricks !== roundSequence[currentRound];
    }
    return false;
  };
  
  const restartGame = () => {
    setGameState('setup');
    setPlayers([]);
    setVariants({ doubleGold: false });
    setRoundSequence([]);
    setCurrentRound(0);
    setDealerIndex(0);
    setIsGoldRound(false);
    setCurrentBets({});
    setCurrentTricks({});
  };


  if (gameState === 'setup') {
    return <SetupScreen onInitialize={initializeGame} variants={variants} setVariants={setVariants} />;
  }

  const renderContent = () => {
    switch (gameState) {
      case 'betting':
        return (
          <BettingPhase
            players={players}
            dealerIndex={dealerIndex}
            cardsInRound={roundSequence[currentRound]}
            currentBets={currentBets}
            setCurrentBets={setCurrentBets}
          />
        );
      case 'results':
        return (
          <ResultsPhase
            players={players}
            cardsInRound={roundSequence[currentRound]}
            currentBets={currentBets}
            currentTricks={currentTricks}
            setCurrentTricks={setCurrentTricks}
          />
        );
      case 'scoreboard':
        return <Scoreboard players={players} roundSequence={roundSequence} currentRound={currentRound} />;
      case 'gameover':
        return (
          <div className="p-4 md:p-10 text-center max-w-md mx-auto">
            <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">¡Partida Finalizada!</h1>
            <p className="text-muted-foreground mb-8">Gracias por jugar.</p>
            <Scoreboard players={players} roundSequence={roundSequence} currentRound={currentRound} />
            <Button onClick={restartGame} className="mt-8 w-full" size="lg">
              Nueva Partida
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-background font-sans text-foreground pb-32 md:pb-24">
      <GameHeader
        currentRound={currentRound}
        roundSequence={roundSequence}
        isGoldRound={isGoldRound}
        setIsGoldRound={setIsGoldRound}
        variants={variants}
        players={players}
        dealerIndex={dealerIndex}
      />

      <main className="relative z-10">{renderContent()}</main>

      {gameState !== 'gameover' && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-t z-20">
          <div className="max-w-md mx-auto">
            <Button
              onClick={handleNextPhase}
              disabled={isButtonDisabled()}
              className="w-full"
              size="lg"
            >
              {gameState === 'betting' && <>Ver Resultados <ChevronRight /></>}
              {gameState === 'results' && <>Calcular Puntos <Trophy /></>}
              {gameState === 'scoreboard' && <>Siguiente Ronda <Play /></>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
