import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const saPath = 'C:\\Users\\gh7358\\Downloads\\ulpaquiz-firebase-adminsdk-fbsvc-4e51589908.json';
const sa = JSON.parse(fs.readFileSync(saPath, 'utf-8'));

const app = initializeApp({ credential: cert(sa) });
const db = getFirestore(app);

async function backup() {
  const backupDir = path.resolve(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const targetDir = path.join(backupDir, `prod-backup-${timestamp}`);
  fs.mkdirSync(targetDir, { recursive: true });

  const collections = ['students', 'publicStudents', 'managers', 'settings', 'halachot', 'invitations', 'quizAvailability'];
  console.log(`Starting backup of ${collections.length} collections from ${sa.project_id}...`);

  for (const colName of collections) {
    const snap = await db.collection(colName).get();
    const docs = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
    fs.writeFileSync(path.join(targetDir, `${colName}.json`), JSON.stringify(docs, null, 2));
    console.log(`- ${colName}: backed up ${docs.length} documents`);
  }

  console.log(`\n✅ Backup complete! Saved to:\n${targetDir}`);
}

backup().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});

