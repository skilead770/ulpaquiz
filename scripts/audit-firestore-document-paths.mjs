import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = 'ulpaquiz';
const app = initializeApp({
  credential: applicationDefault(),
  projectId,
});
const db = getFirestore(app, '(default)');

const [studentsSnapshot, publicStudentsSnapshot, managersSnapshot] = await Promise.all([
  db.collection('students').get(),
  db.collection('publicStudents').get(),
  db.collection('managers').get(),
]);

const allowedGrades = new Set(['ט', 'י', 'יא', 'יב']);
const allowedSummaryFields = new Set([
  'id',
  'fullName',
  'className',
  'grade',
  'points',
  'completedDates',
]);
const issues = {
  studentDocumentIdMismatch: 0,
  duplicateStudentIds: 0,
  pendingRegistrationPathMismatch: 0,
  invalidApprovedSummaryData: 0,
  missingPublicSummary: 0,
  invalidPublicSummaryData: 0,
  stalePublicSummary: 0,
  managerDocumentIdMismatch: 0,
  managerEmailNotNormalized: 0,
};
const studentIds = new Set();
const approvedSummaryIds = new Set();

function normalizeEmailForDocumentId(email) {
  return email.trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
}

function isValidSummary(data, documentId, strictFields) {
  const extraFields = Object.keys(data).some((field) => !allowedSummaryFields.has(field));
  return typeof data.id === 'string' &&
    data.id.length > 0 &&
    data.id.length <= 150 &&
    data.id === documentId &&
    typeof data.fullName === 'string' &&
    data.fullName.length > 0 &&
    data.fullName.length <= 120 &&
    typeof data.className === 'string' &&
    data.className.length > 0 &&
    data.className.length <= 40 &&
    allowedGrades.has(data.grade) &&
    Number.isInteger(data.points) &&
    data.points >= 0 &&
    data.points <= 1_000_000 &&
    Array.isArray(data.completedDates) &&
    data.completedDates.length <= 400 &&
    (!strictFields || !extraFields);
}

for (const document of studentsSnapshot.docs) {
  const student = document.data();
  if (typeof student.id === 'string') {
    if (student.id !== document.id) issues.studentDocumentIdMismatch += 1;
    if (studentIds.has(student.id)) issues.duplicateStudentIds += 1;
    studentIds.add(student.id);
  } else {
    issues.studentDocumentIdMismatch += 1;
  }

  if (
    student.status === 'pending' &&
    typeof student.email === 'string' &&
    document.id !== `s-reg-${normalizeEmailForDocumentId(student.email)}`
  ) {
    issues.pendingRegistrationPathMismatch += 1;
  }

  if (student.status === 'approved' && student.managerParticipation !== true) {
    const summaryId = typeof student.id === 'string' ? student.id : document.id;
    approvedSummaryIds.add(summaryId);
    if (!isValidSummary(student, document.id, false)) {
      issues.invalidApprovedSummaryData += 1;
    }
  }
}

const publicSummaryIds = new Set();
for (const document of publicStudentsSnapshot.docs) {
  const summary = document.data();
  publicSummaryIds.add(document.id);
  if (!isValidSummary(summary, document.id, true)) {
    issues.invalidPublicSummaryData += 1;
  }
  if (!approvedSummaryIds.has(document.id)) {
    issues.stalePublicSummary += 1;
  }
}

for (const summaryId of approvedSummaryIds) {
  if (!publicSummaryIds.has(summaryId)) {
    issues.missingPublicSummary += 1;
  }
}

for (const document of managersSnapshot.docs) {
  const managerEmail = document.data().email;
  if (typeof managerEmail !== 'string') continue;
  const normalizedEmail = managerEmail.trim().toLowerCase();
  if (managerEmail !== normalizedEmail) issues.managerEmailNotNormalized += 1;
  if (
    document.id !== 'super_admin' &&
    document.id !== normalizeEmailForDocumentId(managerEmail)
  ) {
    issues.managerDocumentIdMismatch += 1;
  }
}

console.log(`Project: ${projectId}`);
console.log(`Student documents checked: ${studentsSnapshot.size}`);
console.log(`Public summary documents checked: ${publicStudentsSnapshot.size}`);
console.log(`Manager documents checked: ${managersSnapshot.size}`);
for (const [issue, count] of Object.entries(issues)) {
  console.log(`${issue}: ${count}`);
}
console.log('\nRead-only audit completed. No personal fields or document IDs were printed; no data was changed.');
