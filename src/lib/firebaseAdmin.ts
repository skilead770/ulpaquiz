import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let firestoreDb: ReturnType<typeof getFirestore> | null = null;

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!getApps().length) {
      initializeApp({
        projectId: config.projectId,
      });
    }
    const databaseId = config.firestoreDatabaseId || '(default)';
    firestoreDb = getFirestore(databaseId);
    console.log(`[Firebase] Initialized Firestore for databaseId: ${databaseId}`);
  }
} catch (e) {
  console.error('[Firebase] Error initializing Firebase Admin:', e);
}

export { firestoreDb };
