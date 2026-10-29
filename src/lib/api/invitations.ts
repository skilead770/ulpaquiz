import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebaseClient';
import { GradeType, Invitation } from '../../types';
import { INITIAL_INVITATIONS } from '../../data/seedData';
import { getAuthHeaders, parseJsonResponse } from './core';

export async function fetchInvitationsApi(): Promise<Invitation[]> {
  try {
    const snap = await getDocs(collection(db, 'invitations'));
    if (!snap.empty) {
      const list: Invitation[] = [];
      snap.forEach((d) => list.push(d.data() as Invitation));
      return list;
    }
    for (const inv of INITIAL_INVITATIONS) {
      await setDoc(doc(db, 'invitations', inv.id), inv);
    }
    return INITIAL_INVITATIONS;
  } catch (err) {
    console.warn('[Firestore Fallback] Error fetching invitations:', err);
  }

  try {
    const res = await fetch('/api/invitations', {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for fetchInvitationsApi');
  }

  return INITIAL_INVITATIONS;
}

export async function createInvitationApi(invitationData: {
  className: string;
  grade: GradeType;
  maxUses: number;
  code: string;
}) {
  const cleanCode = invitationData.code.trim().toUpperCase();
  const cleanClass = invitationData.className.trim();
  const maxUses = Number(invitationData.maxUses) || 50;

  try {
    const snap = await getDocs(collection(db, 'invitations'));
    const duplicate = snap.docs.find((d) => {
      const item = d.data() as Invitation;
      return item.code.trim().toUpperCase() === cleanCode;
    });

    if (duplicate) {
      throw new Error('קוד הזמנה זה כבר קיים במערכת');
    }

    const inv: Invitation = {
      id: `inv-${Date.now()}`,
      code: cleanCode,
      className: cleanClass,
      grade: invitationData.grade,
      maxUses,
      usedCount: 0,
      createdAt: new Date().toISOString().split('T')[0],
      active: true,
    };

    await setDoc(doc(db, 'invitations', inv.id), inv);
    const invitations = await fetchInvitationsApi();
    return { success: true, invitation: inv, invitations };
  } catch (e: any) {
    if (e.message && e.message.includes('כבר קיים')) {
      throw e;
    }
    console.info('[Firestore] Direct invitation creation failed, trying legacy API:', e);
  }

  try {
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(invitationData),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for createInvitationApi');
  }

  const inv: Invitation = {
    id: `inv-${Date.now()}`,
    code: cleanCode,
    className: cleanClass,
    grade: invitationData.grade,
    maxUses,
    usedCount: 0,
    createdAt: new Date().toISOString().split('T')[0],
    active: true,
  };

  await setDoc(doc(db, 'invitations', inv.id), inv);
  const invitations = await fetchInvitationsApi();
  return { success: true, invitation: inv, invitations };
}

export async function deleteInvitationApi(id: string) {
  try {
    await deleteDoc(doc(db, 'invitations', id));
    const invitations = await fetchInvitationsApi();
    return { success: true, invitations };
  } catch (e) {
    console.info('[Firestore] Direct invitation delete failed, trying legacy API:', e);
  }

  try {
    const res = await fetch(`/api/invitations/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for deleteInvitationApi');
  }

  const invitations = await fetchInvitationsApi();
  return { success: true, invitations };
}

export async function validateInvitationCodeApi(code: string): Promise<{ valid: boolean; invitation?: Invitation; error?: string }> {
  try {
    const cleanCode = code.trim().toUpperCase();
    const invitations = await fetchInvitationsApi();
    const inv = invitations.find((i) => i.code.trim().toUpperCase() === cleanCode && i.active);

    if (!inv) {
      return { valid: false, error: 'קוד הזמנה לא קיים או שאינו פעיל' };
    }
    if (inv.maxUses > 0 && inv.usedCount >= inv.maxUses) {
      return { valid: false, error: 'קוד ההזמנה הגיע למכסת השימושים המרבית' };
    }
    return { valid: true, invitation: inv };
  } catch (e) {
    console.info('[Firestore] Direct invitation validation failed, trying legacy API:', e);
  }

  try {
    const res = await fetch(`/api/invitations/validate/${encodeURIComponent(code)}`);
    if (res.ok) {
      return await parseJsonResponse(res);
    } else {
      const data = await parseJsonResponse(res).catch(() => ({ valid: false }));
      return data;
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for validateInvitationCodeApi');
  }

  const invitations = await fetchInvitationsApi();
  const cleanCode = code.trim().toUpperCase();
  const inv = invitations.find((i) => i.code.trim().toUpperCase() === cleanCode && i.active);

  if (!inv) {
    return { valid: false, error: 'קוד הזמנה לא קיים או שאינו פעיל' };
  }
  if (inv.maxUses > 0 && inv.usedCount >= inv.maxUses) {
    return { valid: false, error: 'קוד ההזמנה הגיע למכסת השימושים המרבית' };
  }
  return { valid: true, invitation: inv };
}
