'use server';

import { 
    addDocumentNonBlocking, 
    setDocumentNonBlocking, 
    updateDocumentNonBlocking 
} from '@/firebase/non-blocking-updates';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { getSdks } from '@/firebase';
import { GameLobby, Game } from '@/lib/types';


// Helper to get Firestore instance
const { firestore } = getSdks();

/**
 * Creates a new game lobby in Firestore.
 * @param creatorId - The UID of the user creating the lobby.
 * @returns The unique ID of the newly created lobby.
 */
export async function createLobby(creatorId: string): Promise<string> {
    const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const lobbyCollectionRef = collection(firestore, 'gameLobbies');
    
    const newLobby: Omit<GameLobby, 'id'> = {
        accessCode,
        creatorId,
        playerIds: [creatorId], // Creator is the first player
        status: 'LOBBY',
        createdAt: serverTimestamp(),
    };

    const docRef = await addDocumentNonBlocking(lobbyCollectionRef, newLobby);
    return docRef.id;
}


/**
 * Adds a player to an existing game lobby.
 * @param lobbyId - The ID of the lobby to join.
 * @param playerId - The UID of the player joining.
 */
export async function joinLobby(lobbyId: string, playerId: string, existingPlayerIds: string[]) {
    if (existingPlayerIds.includes(playerId)) return; // Already in lobby

    const lobbyDocRef = doc(firestore, 'gameLobbies', lobbyId);
    const updatedPlayerIds = [...existingPlayerIds, playerId];

    await updateDocumentNonBlocking(lobbyDocRef, { playerIds: updatedPlayerIds });
}


/**
 * Creates a game document from a lobby and starts the game.
 * @param lobby - The GameLobby object.
 * @returns The ID of the newly created game.
 */
export async function createGameFromLobby(lobby: GameLobby): Promise<string> {
    const gameCollectionRef = collection(firestore, 'games');

    const newGame: Omit<Game, 'id'> = {
        lobbyId: lobby.id,
        playerIds: lobby.playerIds,
        status: 'BETTING', // First phase after lobby
        currentRound: 1,
        createdAt: serverTimestamp(),
        // ... other initial game state properties
    };

    const gameDocRef = await addDocumentNonBlocking(gameCollectionRef, newGame);
    
    // Update lobby status to 'PLAYING'
    const lobbyDocRef = doc(firestore, 'gameLobbies', lobby.id);
    await updateDocumentNonBlocking(lobbyDocRef, { status: 'PLAYING' });

    return gameDocRef.id;
}
