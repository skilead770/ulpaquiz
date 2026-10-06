import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import prodConfig from '../../firebase-applet-config.json';
import stagingConfig from '../../firebase-applet-config.staging.json';
import { FIREBASE_PROJECT_ID } from './config';

const firebaseConfig = FIREBASE_PROJECT_ID === 'ulpaquiz-staging' ? stagingConfig : prodConfig;

// Safety Check: Ensure the app is running against the correct Firebase project
if (!firebaseConfig.projectId) {
  throw new Error('[Firebase] Missing firebase config projectId.');
}

if (firebaseConfig.projectId !== FIREBASE_PROJECT_ID) {
  throw new Error(
    `[Firebase] PROJECT ID MISMATCH! Expected "${FIREBASE_PROJECT_ID}" but loaded "${firebaseConfig.projectId}". ` +
    `Please ensure you are using the correct Firebase project.`
  );
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || '(default)');
export const auth = getAuth(app);
