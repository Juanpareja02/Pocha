'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  let firebaseApp;
  if (!getApps().length) {
    // Attempt to initialize via Firebase App Hosting environment variables
    try {
      firebaseApp = initializeApp();
    } catch (e) {
      if (process.env.NODE_ENV === 'production') {
        console.warn(
          'Automatic initialization failed. Falling back to firebase config object.',
          e
        );
      }
      firebaseApp = initializeApp(firebaseConfig);
    }
  } else {
    firebaseApp = getApp();
  }

  const firestore = getFirestore(firebaseApp);
  const auth = getAuth(firebaseApp);

  // Check if we are in a browser environment before trying to connect to emulators
  if (typeof window !== 'undefined') {
    if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
      // Set up emulators
      if (location.hostname === 'localhost') {
        try {
          connectFirestoreEmulator(firestore, 'localhost', 8080);
          connectAuthEmulator(auth, 'http://localhost:9099');
          console.log('Using Firebase Emulators for Firestore and Auth');
        } catch (e) {
          console.error(
            'Error connecting to Firebase Emulators. Make sure they are running.',
            e
          );
        }
      }
    }
  }

  return { firebaseApp, auth, firestore };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
