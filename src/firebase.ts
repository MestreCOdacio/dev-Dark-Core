import { initializeApp } from "firebase/app";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAm47x60Fhswp0YWlSKD-DXJR7gt6UHaSI",
  authDomain: "dark-core-f6962.firebaseapp.com",
  projectId: "dark-core-f6962",
  storageBucket: "dark-core-f6962.firebasestorage.app",
  messagingSenderId: "696185266151",
  appId: "1:696185266151:web:f44985bdf5c7cc6d9a6742",
  measurementId: "G-SEL2WTXCZL"
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
export const auth = getAuth(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
