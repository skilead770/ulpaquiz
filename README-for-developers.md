# Ulpaquiz — Developer Documentation

Ulpaquiz is a daily Halacha study and quiz platform designed for school students and educators. Students study daily Halachot, confirm their learning, take a 4-question daily quiz, collect points, and compete on a leaderboard. School managers and teachers have administrative oversight to monitor participation and manage quiz content.

---

## 1. Tech Stack Overview

- **Frontend**: React (Vite / CRA), TypeScript/JavaScript, Tailwind CSS.
- **Backend / BaaS**: Google Firebase
  - **Cloud Firestore**: Real-time NoSQL database for students, quizzes, scores, and admin data.
  - **Firebase Hosting**: Production static hosting (`https://ulpaquiz.web.app`).
  - **Firebase Auth / Custom Auth**: Role-based access for students and managers.
- **Environment**: Node.js in Google Cloud Shell.

---

## 2. Project Directory Structure

```text
ulpaquiz/
├── public/                 # Static assets, icons, manifest
├── src/
│   ├── assets/             # Images, logos, celebration graphics
│   ├── components/         # Reusable UI & Feature modules
│   │   ├── auth/           # Registration and login forms
│   │   │   ├── StudentAuth.tsx     # Student login & registration flow
│   │   │   └── ManagerAuth.tsx     # Educator / Manager portal login
│   │   ├── quiz/           # Daily halacha study & quiz logic
│   │   │   ├── DailyHalacha.tsx    # Halacha text & "למדתי בשמחה" button
│   │   │   ├── QuizQuestion.tsx    # Single multiple-choice question item
│   │   │   └── QuizContainer.tsx   # Quiz runner, timer, and "הגש חידון" submit
│   │   ├── admin/          # Educator / Manager dashboard
│   │   │   ├── HalachaEditor.tsx   # Add/edit daily texts and 4 questions
│   │   │   └── StudentMonitor.tsx  # Track completion rates & points
│   │   └── leaderboard/    # Rankings & score tables
│   │       └── Leaderboard.tsx     # Live score breakdown by student/class
│   ├── lib/
│   │   └── firebaseClient.ts       # Firebase app, db (Firestore), and auth init
│   ├── types/
│   │   └── index.ts        # TypeScript interfaces (Student, Question, QuizResult)
│   ├── App.tsx             # Root routing, layout wrapper, active tab/role router
│   ├── main.tsx (or index.tsx)     # Application bootstrap
│   └── index.css           # Global Tailwind CSS and RTL text styling
├── firestore.rules         # Database security and permission rules
├── firebase.json           # Firebase Hosting and rewrite configuration
└── package.json            # Scripts (build, preview) and dependencies
