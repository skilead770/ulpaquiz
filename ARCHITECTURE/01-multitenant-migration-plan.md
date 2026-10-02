# Multi-Tenant Architecture Migration Plan

**Target:** Transform UlpaQuiz from single-school POC to multi-tenant platform  
**Author:** Claude Code  
**Date:** 2026-10-02  
**Status:** Planning Phase

---

## Executive Summary

Transform the current single-school proof-of-concept into a white-label platform that can serve multiple Jewish girls' and boys' schools independently, with isolated data, customizable branding, and separate admin experiences.

---

## Current State

| Component | Status |
|-----------|--------|
| App Type | Single-school POC (אולפנה girls' school) |
| Database | Single Firestore database, no tenant isolation |
| Auth | Simple email/password, no school context |
| Deployment | Single hosting project |

---

## Vision

```
ulpaquiz.com/
├── /girls           → Portal for girls' schools
│   ├── /alhatora    → School A
│   ├── /yahadot     → School B
│   └── /...
├── /boys            → Portal for boys' schools
│   ├── /tzohar      → School C
│   └── /...
└── /admin           → Master admin console
```

---

## Phase 1: Foundation (Estimated: 3-5 days)

### 1.1 Tenant Infrastructure

#### New Files to Create:
```
src/types/tenant.ts
src/types/school.ts
src/lib/tenant.ts
src/components/tenant/SchoolSelector.tsx
src/components/tenant/SchoolConfigProvider.tsx
src/hooks/useSchool.ts
src/config/schools.ts (dev only)
```

#### Core Code Changes:

**src/types/tenant.ts**
```typescript
export interface School {
  id: string;
  name: string;
  type: 'girls' | 'boys';
  subdomain: string;
  branding: {
    primaryColor?: string;
    logoUrl?: string;
    schoolName?: string;
  };
  adminEmails: string[];
  createdAt: string;
  isActive: boolean;
}

export interface TenantContext {
  school: School;
  isInitialized: boolean;
}
```

**src/types/school.ts**
```typescript
export interface SchoolSettings {
  halachaTheme: 'daily' | 'weekly' | 'custom';
  pointSystem: {
    basePoints: number;
    streakBonus: number;
    milestoneThreshold: number;
  };
  startDate: string;
  customMessages: {
    welcome?: string;
    quizDayHeader?: string;
  };
}
```

**src/lib/tenant.ts**
```typescript
export function getSchoolIdFromUrl(): string | null { ... }
export function loadSchoolConfig(schoolId: string): Promise<School> { ... }
export function isUserAuthorizedForSchool(userEmail: string, school: School): boolean { ... }
```

### 1.2 Database Migration

#### Firestore Collections:
```
scholls/
  {schoolId}/
  ├── metadata: { name, type, subdomain, branding, adminEmails }
  ├── settings: { pointSystem, startDate, customMessages }
  └── status: { isActive, createdAt, updatedAt }

students/  → Add field: schoolId: string
quizzes/   → Add field: schoolId: string
dailyHalachot/  → Add field: schoolId: string
leaderboard/  → Add field: schoolId: string
submissions/  → Add field: schoolId: string
prizes/  → Add field: schoolId: string
```

#### Migration Script:
```
scripts/
└── migrate-to-multi-tenant.mjs
```

### 1.3 Security Rules Update

**firestore.rules changes:**
```firestore
function isAuthorizedForSchool(schoolId) {
  return request.auth != null &&
    get(/databases/$(database)/documents/schools/$(schoolId)).data.adminEmails has any [request.auth.token.email];
}

function studentBelongsToSchool(student, schoolId) {
  return student.schoolId == schoolId;
}
```

---

## Phase 2: School Isolation (Estimated: 2-3 days)

### 2.1 Authentication Flow Update

**New Flow:**
1. User visits `/girls` or `/boys`
2. If not logged in → redirect to school-aware login
3. On login, check if email matches school's admin list OR student list
4. Set school context in context provider

### 2.2 Data Access Patterns

All queries must include schoolId:

```typescript
// Before:
const students = await collection(db, 'students').get();

// After:
const students = await collection(db, 'students')
  .where('schoolId', '==', schoolId)
  .get();
```

---

## Phase 3: White-Label Customization (Estimated: 2-4 days)

### 3.1 Branding System

**School Configuration Screen:**
```
[ ] Enable Custom Coloring
Primary Color: [██████] # palette picker
Secondary Color: [██████]

[ ] Custom Logo Upload
Browse: [Choose File]

[ ] School Name Override
Current: "אולפנה"
Override: [___________]

Save Settings → Preview: [Open in new tab]
```

### 3.2 Content Customization

- Different Halacha themes per school
- Custom weekly messages
- School-specific point milestones

---

## Phase 4: Admin Portal (Estimated: 3-5 days)

### 4.1 Master Admin Features

- List all schools
- Activate/deactivate schools
- View usage analytics per school
- Manage global settings

### 4.2 School-Level Admin

- Add/remove teachers
- Edit school branding
- View school-specific analytics

---

## Phase 5: Deployment & Scaling (Estimated: 1-2 days)

### 5.1 Infrastructure

| Component | Recommendation |
|-----------|----------------|
| Hosting | Use Firebase Hosting redirects for subdomain routing |
| Functions | Same Cloud Functions, tenant-aware |
| Database | Single Firestore (cost-effective) |
| Auth | Single Firebase Auth project |

### 5.2 Domain Structure

```
Option A: Subdomains (Recommended)
girls.ulpaquiz.com/alhatora
boys.ulpaquiz.com/tzohar

Option B: Path-Based
ulpaquiz.com/girls/alhatora
ulpaquiz.com/boys/tzohar
```

DNS needs:
- `girls.ulpaquiz.com` → Firebase Hosting
- `boys.ulpaquiz.com` → Firebase Hosting

---

## Implementation Checklist

### Week 1
- [ ] Create tenant type definitions
- [ ] Build tenant context provider
- [ ] Create migration script
- [ ] Update Firestore security rules
- [ ] Deploy to staging

### Week 2
- [ ] Migrate existing אולפנה data with schoolId
- [ ] Implement school identification
- [ ] Test isolation with mock data
- [ ] Create master admin UI

### Week 3
- [ ] Implement white-label customization
- [ ] Create school onboarding flow
- [ ] Beta launch with 1-2 new schools
- [ ] Gather feedback

---

## Files to Create (Summary)

| Path | Purpose |
|------|---------|
| `src/types/tenant.ts` | Core tenant types |
| `src/types/school.ts` | School configuration types |
| `src/lib/tenant.ts` | Tenant identification utils |
| `src/hooks/useSchool.ts` | React hook for school context |
| `src/components/tenant/SchoolSelector.tsx` | School selection UI |
| `src/components/tenant/SchoolConfigProvider.tsx` | Context provider |
| `src/config/schools.ts` | Dev-only school registry |
| `scripts/migrate-to-multi-tenant.mjs` | Data migration script |
| `ARCHITECTURE/01-multitenant-migration-plan.md` | **This file** |

---

## Risk Mitigation

1. **Data Loss Risk** - Migration script should be tested on backup first
2. **Authentication Breakage** - Implement gradual rollout with feature flag
3. **Performance** - Index all queries with schoolId for efficiency
4. **Cost** - Monitor Firestore reads; add query limits per school

---

## Success Metrics

- 3+ new schools added in first month
- < 1 second latency for tenant-aware queries
- Zero data leakage between schools
- 100% test coverage for tenant isolation

---

## Next Actions

1. **Review this plan** - Confirm architecture direction
2. **Create tenant types** - Start with `src/types/tenant.ts`
3. **Write migration script** - Safely add schoolId to existing data
4. **Update security rules** - Implement tenant-aware access control

---

*This plan will be expanded into additional detailed design documents as implementation progresses.*