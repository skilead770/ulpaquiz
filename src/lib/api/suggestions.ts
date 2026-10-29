import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebaseClient';
import {
  QuestionSuggestion,
  QuestionFeedback,
  Student,
} from '../../types';
import { invalidatePublicStudentSummariesCache } from './core';

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

export async function submitQuestionSuggestionApi(
  suggestionData: Omit<QuestionSuggestion, 'id' | 'status' | 'createdAt'>
): Promise<QuestionSuggestion> {
  const docRef = doc(collection(db, 'questionSuggestions'));
  const newSuggestion: QuestionSuggestion = {
    ...suggestionData,
    id: docRef.id,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await setDoc(docRef, stripUndefined(newSuggestion));
  return newSuggestion;
}

export async function submitMultipleQuestionSuggestionsApi(
  suggestionsData: Omit<QuestionSuggestion, 'id' | 'status' | 'createdAt'>[]
): Promise<QuestionSuggestion[]> {
  const results: QuestionSuggestion[] = [];
  for (const item of suggestionsData) {
    const created = await submitQuestionSuggestionApi(item);
    results.push(created);
  }
  return results;
}

export async function fetchQuestionSuggestionsApi(): Promise<QuestionSuggestion[]> {
  const snap = await getDocs(collection(db, 'questionSuggestions'));
  const list: QuestionSuggestion[] = [];
  snap.forEach((d) => {
    list.push({ id: d.id, ...(d.data() as Omit<QuestionSuggestion, 'id'>) });
  });
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function approveQuestionSuggestionApi(
  id: string,
  options: { pointsAwarded: number; targetDate?: string; adminFeedback?: string }
): Promise<void> {
  const sugRef = doc(db, 'questionSuggestions', id);
  const snap = await getDoc(sugRef);
  if (!snap.exists()) throw new Error('ההצעה לא נמצאה');
  const sug = snap.data() as QuestionSuggestion;

  const updates: Partial<QuestionSuggestion> = {
    status: 'approved',
    pointsAwarded: options.pointsAwarded || 0,
    reviewedAt: new Date().toISOString(),
    reviewedBy: auth.currentUser?.email || 'מנהל',
  };
  if (options.targetDate) updates.targetDate = options.targetDate;
  if (options.adminFeedback) updates.adminFeedback = options.adminFeedback;

  await updateDoc(sugRef, stripUndefined(updates));

  // If bonus points were awarded, update student's points in private and public collections
  if (options.pointsAwarded > 0 && sug.studentId) {
    const studentRef = doc(db, 'students', sug.studentId);
    const studentSnap = await getDoc(studentRef);
    if (studentSnap.exists()) {
      const studentData = studentSnap.data() as Student;
      const newPoints = (studentData.points || 0) + options.pointsAwarded;
      const batch = writeBatch(db);
      batch.update(studentRef, { points: newPoints });

      const publicRef = doc(db, 'publicStudents', sug.studentId);
      const publicSnap = await getDoc(publicRef);
      if (publicSnap.exists()) {
        batch.update(publicRef, { points: newPoints });
      }
      await batch.commit();
      invalidatePublicStudentSummariesCache();
    }
  }
}

export async function rejectQuestionSuggestionApi(
  id: string,
  adminFeedback?: string
): Promise<void> {
  const sugRef = doc(db, 'questionSuggestions', id);
  const updates: Partial<QuestionSuggestion> = {
    status: 'rejected',
    reviewedAt: new Date().toISOString(),
    reviewedBy: auth.currentUser?.email || 'מנהל',
  };
  if (adminFeedback) updates.adminFeedback = adminFeedback;
  await updateDoc(sugRef, stripUndefined(updates));
}

export async function submitQuestionFeedbackApi(
  feedbackData: Omit<QuestionFeedback, 'id' | 'status' | 'createdAt'>
): Promise<QuestionFeedback> {
  const docRef = doc(collection(db, 'questionFeedback'));
  const newFeedback: QuestionFeedback = {
    ...feedbackData,
    id: docRef.id,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await setDoc(docRef, stripUndefined(newFeedback));
  return newFeedback;
}

export async function fetchQuestionFeedbackApi(): Promise<QuestionFeedback[]> {
  const snap = await getDocs(collection(db, 'questionFeedback'));
  const list: QuestionFeedback[] = [];
  snap.forEach((d) => {
    list.push({ id: d.id, ...(d.data() as Omit<QuestionFeedback, 'id'>) });
  });
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function resolveQuestionFeedbackApi(
  id: string,
  adminResponse?: string
): Promise<void> {
  const feedbackRef = doc(db, 'questionFeedback', id);
  const updates: Partial<QuestionFeedback> = {
    status: 'resolved',
    resolvedAt: new Date().toISOString(),
    resolvedBy: auth.currentUser?.email || 'מנהל',
  };
  if (adminResponse) updates.adminResponse = adminResponse;
  await updateDoc(feedbackRef, stripUndefined(updates));
}
