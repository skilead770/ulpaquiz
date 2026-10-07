import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbJsonPath = path.resolve(__dirname, '../data/db.json');
const dbData = JSON.parse(fs.readFileSync(dbJsonPath, 'utf-8'));
const halachot = dbData.halachot || [];

console.log(`Found ${halachot.length} Halachot in db.json.`);

// Look for service account
const credPathEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const localKeyPath = path.resolve(__dirname, '../serviceAccountKey.json');
const keyPath = credPathEnv && fs.existsSync(credPathEnv)
  ? credPathEnv
  : (fs.existsSync(localKeyPath) ? localKeyPath : null);

if (!keyPath) {
  console.error('No service account found. Please provide GOOGLE_APPLICATION_CREDENTIALS or place serviceAccountKey.json in the project root.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
console.log(`Using service account for project: ${serviceAccount.project_id}`);

const app = initializeApp({
  credential: cert(serviceAccount),
});
const db = getFirestore(app);

async function run() {
  console.log(`Beginning upload of ${halachot.length} Halachot to Firestore in chunks of 400...`);
  const chunkSize = 400;
  let count = 0;

  for (let i = 0; i < halachot.length; i += chunkSize) {
    const chunk = halachot.slice(i, i + chunkSize);
    const batch = db.batch();

    for (const item of chunk) {
      if (!item.id || !item.date) continue;
      const ref = db.collection('halachot').doc(item.id);
      batch.set(ref, item, { merge: true });
      count++;
    }

    await batch.commit();
    console.log(`Committed chunk ${Math.floor(i / chunkSize) + 1} (${count}/${halachot.length} uploaded)`);
  }

  console.log(`✅ Successfully uploaded ${count} Halachot to project ${serviceAccount.project_id}!`);
}

run().catch((err) => {
  console.error('Upload failed:', err);
  process.exit(1);
});

