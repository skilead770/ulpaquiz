import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let firestoreDb: ReturnType<typeof getFirestore> | null = null;

try {
  if (!getApps().length) {
    const credPathEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const defaultKeyPath = path.join(process.cwd(), 'serviceAccountKey.json');
    const keyPath = credPathEnv && fs.existsSync(credPathEnv) ? credPathEnv : (fs.existsSync(defaultKeyPath) ? defaultKeyPath : null);

    if (keyPath) {
      const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
      initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
      console.log(`[Firebase Admin] Initialized with Service Account Key for project: ${serviceAccount.project_id}`);
    } else {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        initializeApp({
          projectId: config.projectId,
        });
        console.log(`[Firebase Admin] Initialized with config projectId: ${config.projectId}`);
      } else {
        initializeApp();
      }
    }
  }

  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  let databaseId = '(default)';
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)') {
      databaseId = config.firestoreDatabaseId;
    }
  }
  firestoreDb = getFirestore(databaseId);
  console.log(`[Firebase] Firestore ready for database: ${databaseId}`);
} catch (e) {
  console.error('[Firebase] Error initializing Firebase Admin:', e);
}

export { firestoreDb };

