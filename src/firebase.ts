import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
console.log("Firebase App Config:", { ...firebaseConfig, apiKey: '***' });
// @ts-ignore
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
console.log("Firestore initialized with DB:", firebaseConfig.firestoreDatabaseId);
