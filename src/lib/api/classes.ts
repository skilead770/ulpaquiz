import {
  getDocs,
  getDoc,
  doc,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebaseClient';
import { DEFAULT_CLASSES, sortClasses } from '../../types';
import { getAuthHeaders, parseJsonResponse, fetchPublicStudentSummaries } from './core';

async function fetchActiveStudentClasses(): Promise<string[]> {
  try {
    const publicStudents = await fetchPublicStudentSummaries();
    return Array.from(
      new Set(
        publicStudents
          .map((s) => (s.className || '').trim())
          .filter(Boolean)
      )
    );
  } catch {
    return [];
  }
}

export async function fetchClassesApi(): Promise<string[]> {
  const activeStudentClasses = await fetchActiveStudentClasses();

  try {
    const classesSnap = await getDoc(doc(db, 'settings', 'classes'));
    if (classesSnap.exists()) {
      const cData = classesSnap.data();
      if (cData && Array.isArray(cData.list) && cData.list.length > 0) {
        return sortClasses(
          Array.from(new Set([...DEFAULT_CLASSES, ...cData.list, ...activeStudentClasses])).filter(Boolean)
        );
      }
    }

    const initialClasses = sortClasses(
      Array.from(new Set([...DEFAULT_CLASSES, ...activeStudentClasses])).filter(Boolean)
    );
    await setDoc(doc(db, 'settings', 'classes'), { list: initialClasses });
    return initialClasses;
  } catch (err) {
    console.warn('[Firestore Fallback] Error fetching classes:', err);
  }

  try {
    const res = await fetch('/api/classes');
    if (res.ok) {
      const data = await parseJsonResponse(res);
      if (Array.isArray(data.classes) && data.classes.length > 0) {
        return sortClasses(
          Array.from(new Set([...data.classes, ...activeStudentClasses])).filter(Boolean)
        );
      }
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for fetchClassesApi');
  }

  return sortClasses(
    Array.from(new Set([...DEFAULT_CLASSES, ...activeStudentClasses])).filter(Boolean)
  );
}

export async function addClassApi(name: string): Promise<string[]> {
  const clean = name.trim();
  if (!clean) throw new Error('נא להזין שם כיתה');

  try {
    const current = await fetchClassesApi();
    if (!current.includes(clean)) {
      const updated = sortClasses([...current, clean]);
      await setDoc(doc(db, 'settings', 'classes'), { list: updated });
      return updated;
    }
    return current;
  } catch (err) {
    console.warn('[Firestore Fallback] Error saving classes:', err);
  }

  try {
    const res = await fetch('/api/classes', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name: clean }),
    });
    if (res.ok) {
      const data = await parseJsonResponse(res);
      return sortClasses(data.classes);
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for addClassApi');
  }

  const current = await fetchClassesApi();
  if (!current.includes(clean)) {
    const updated = sortClasses([...current, clean]);
    await setDoc(doc(db, 'settings', 'classes'), { list: updated });
    return updated;
  }
  return current;
}

export async function deleteClassApi(name: string): Promise<string[]> {
  const clean = name.trim();

  try {
    const current = await fetchClassesApi();
    const updated = sortClasses(current.filter((c) => c !== clean));
    await setDoc(doc(db, 'settings', 'classes'), { list: updated });
    return updated;
  } catch (err) {
    console.warn('[Firestore Fallback] Error deleting class:', err);
  }

  try {
    const res = await fetch(`/api/classes/${encodeURIComponent(clean)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await parseJsonResponse(res);
      return sortClasses(data.classes);
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for deleteClassApi');
  }

  const current = await fetchClassesApi();
  const updated = sortClasses(current.filter((c) => c !== clean));
  await setDoc(doc(db, 'settings', 'classes'), { list: updated });
  return updated;
}

export async function updateClassesApi(classes: string[]): Promise<string[]> {
  const sorted = sortClasses(classes);
  try {
    await setDoc(doc(db, 'settings', 'classes'), { list: sorted });
    return sorted;
  } catch (err) {
    console.warn('[Firestore Fallback] Error updating classes:', err);
  }

  try {
    const res = await fetch('/api/classes', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ classes: sorted }),
    });
    if (res.ok) {
      const data = await parseJsonResponse(res);
      return sortClasses(data.classes);
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for updateClassesApi');
  }

  await setDoc(doc(db, 'settings', 'classes'), { list: sorted });
  return sorted;
}
