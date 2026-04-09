import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

type FirebaseEnv = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
};

const firebaseEnv: FirebaseEnv = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
};

const hasRequiredConfig =
  Boolean(firebaseEnv.apiKey) &&
  Boolean(firebaseEnv.authDomain) &&
  Boolean(firebaseEnv.projectId) &&
  Boolean(firebaseEnv.appId);

let firebaseAuthInstance: ReturnType<typeof getAuth> | null = null;

function getFirebaseAuth() {
  if (!hasRequiredConfig) {
    throw new Error('Firebase config is missing. Please set VITE_FIREBASE_* env values.');
  }
  if (!firebaseAuthInstance) {
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseEnv);
    firebaseAuthInstance = getAuth(app);
  }
  return firebaseAuthInstance;
}

export const firebaseGoogleAuth = {
  isConfigured: hasRequiredConfig,

  signIn: async () => {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();

    return {
      idToken,
      email: result.user.email,
      name: result.user.displayName,
      picture: result.user.photoURL,
    };
  },
};

