'use server';

import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  getFirestore,
} from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { Game, GameLobby } from '@/lib/types';

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

  // Firestore requires a plain object, not a class instance with methods.
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
  existingPlayerIds: string[]
) {
  if (existingPlayerIds.includes(playerId)) return; // Already in lobby

  const firestore = getFirestoreInstance();
  const lobbyDocRef = doc(firestore, 'gameLobbies', lobbyId);
  const updatedPlayerIds = [...existingPlayerIds, playerId];

  await updateDoc(lobbyDocRef, { playerIds: updatedPlayerIds });
}

/**
 * Creates a game document from a lobby and starts the game.
 * @param lobby - The GameLobby object.
 * @returns The ID of the newly created game.
 */
export async function createGameFromLobby(lobbyId: string, playerIds: string[]): Promise<string> {
  const firestore = getFirestoreInstance();
  const gameCollectionRef = collection(firestore, 'games');

  const newGame: Omit<Game, 'id'> = {
    lobbyId: lobbyId,
    playerIds: playerIds,
    status: 'BETTING', // First phase after lobby
    currentRound: 1,
    createdAt: serverTimestamp(),
    // ... other initial game state properties
  } as Omit<Game, 'id'>; // Casting to avoid type issues with missing properties

  const gameDocRef = await addDoc(gameCollectionRef, newGame);

  // Update lobby status to 'PLAYING'
  const lobbyDocRef = doc(firestore, 'gameLobbies', lobbyId);
  await updateDoc(lobbyDocRef, { status: 'PLAYING', gameId: gameDocRef.id });

  return gameDocRef.id;
}
