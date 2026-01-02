'use server';

import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  getFirestore,
  arrayUnion,
  getDoc,
} from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { Game, Player, Suit, Rank } from '@/lib/types';

// Helper to get Firestore instance on the server
function getFirestoreInstance() {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
  return getFirestore(getApp());
}

/**
 * Creates a new game lobby in Firestore.
 * @param creatorId - The UID of the user creating the lobby.
 * @returns The unique ID of the newly created lobby.
 */
export async function createLobby(creatorId: string): Promise<string> {
  const firestore = getFirestoreInstance();
  const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const lobbyCollectionRef = collection(firestore, 'gameLobbies');

  const newLobbyData = {
    accessCode,
    creatorId,
    playerIds: [creatorId], // Creator is the first player
    status: 'LOBBY',
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(lobbyCollectionRef, newLobbyData);
  return docRef.id;
}


/**
 * Adds a player to an existing game lobby.
 * @param lobbyId - The ID of the lobby to join.
 * @param playerId - The UID of the player joining.
 */
export async function joinLobby(
  lobbyId: string,
  playerId: string,
) {
  const firestore = getFirestoreInstance();
  const lobbyDocRef = doc(firestore, 'gameLobbies', lobbyId);

  // Use arrayUnion to safely add the player if they aren't already in the list
  await updateDoc(lobbyDocRef, {
    playerIds: arrayUnion(playerId)
  });
}

/**
 * Creates a game document from a lobby and starts the game.
 * @param lobbyId - The ID of the lobby.
 * @param playerIds - The array of player UIDs.
 * @returns The ID of the newly created game.
 */
export async function createGameFromLobby(lobbyId: string, playerIds: string[]): Promise<string> {
  const firestore = getFirestoreInstance();
  const gameCollectionRef = collection(firestore, 'games');

  // --- START: Game Initialization Logic ---
  const numPlayers = playerIds.length;
  const cardSetup: { [key: number]: number } = {
    3: 24, 4: 32, 5: 40, 6: 36,
  };
  const totalCards = cardSetup[numPlayers] || 40;
  const maxCards = Math.floor(totalCards / numPlayers);
  
  const roundSequence: number[] = [];
  for (let i = 1; i <= maxCards; i++) roundSequence.push(i);
  for (let i = maxCards - 1; i >= 1; i--) roundSequence.push(i);

  const dealerIndex = Math.floor(Math.random() * numPlayers);
  const dealerId = playerIds[dealerIndex];
  const currentPlayerId = playerIds[(dealerIndex + 1) % numPlayers];

  // Fetch user data to create denormalized player objects
  const playerPromises = playerIds.map(async (pid) => {
    // In a real app, you'd fetch from a 'users' collection.
    // For now, we'll create placeholder data.
    const isHost = (await getDoc(doc(firestore, "gameLobbies", lobbyId))).data()?.creatorId === pid;
    return {
      id: pid,
      name: `Jugador ${pid.substring(0, 4)}`, // Placeholder name
      isHost: isHost,
      avatarUrl: `https://picsum.photos/seed/${pid}/150/150`,
      bet: undefined,
      tricksWon: 0,
      hand: [], // Hand will be dealt in a subsequent step/function
      score: 0,
    };
  });
  
  const players: Player[] = await Promise.all(playerPromises);

  // --- END: Game Initialization Logic ---

  const newGame: Omit<Game, 'id'> = {
    lobbyId: lobbyId,
    playerIds: playerIds,
    players: players,
    status: 'BETTING',
    dealerId: dealerId,
    currentPlayerId: currentPlayerId,
    currentTrick: [],
    trumpSuit: undefined, // No trump suit until cards are dealt
    currentRound: 0, // 0-indexed
    roundSequence: roundSequence,
    createdAt: serverTimestamp(),
  };

  const gameDocRef = await addDoc(gameCollectionRef, newGame);

  // Update lobby status to 'PLAYING' and link the gameId
  const lobbyDocRef = doc(firestore, 'gameLobbies', lobbyId);
  await updateDoc(lobbyDocRef, { status: 'PLAYING', gameId: gameDocRef.id });

  return gameDocRef.id;
}