import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Download, Check, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Student, GradeType } from '../types';

interface ExcelUploaderProps {
  onStudentsLoaded: (students: Partial<Student>[]) => void;
}

export const ExcelUploader: React.FC<ExcelUploaderProps> = ({ onStudentsLoaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const downloadSampleTemplate = () => {
    const sampleData = [
      { 'שם מלא': 'אמונה כהן', כיתה: "ט'1", שכבה: 'ט', 'שם משתמש': 'emuna', סיסמה: '123' },
      { 'שם מלא': 'תמר אברהם', כיתה: "י'1", שכבה: 'י', 'שם משתמש': 'tamar', סיסמה: '123' },
      { 'שם מלא': 'שירה גולדברג', כיתה: "י'1", שכבה: 'י', 'שם משתמש': 'shira', סיסמה: '123' },
      { 'שם מלא': 'רחלי ברק', כיתה: "יא'1", שכבה: 'יא', 'שם משתמש': 'racheli', סיסמה: '123' },
      { 'שם מלא': 'יעל מזרחי', כיתה: "יב'1", שכבה: 'יב', 'שם משתמש': 'yael', סיסמה: '123' },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'תלמידות');
    XLSX.writeFile(workbook, 'sample_ulpana_students.xlsx');
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (!jsonRows || jsonRows.length === 0) {
          setStatusMsg({ type: 'error', text: 'הקובץ שהועלה ריק או שאינו במבנה תקין' });
          return;
        }

        const parsedStudents: Partial<Student>[] = jsonRows.map((row, idx) => {
          const fullName = row['שם מלא'] || row['Name'] || row['fullName'] || `תלמידה ${idx + 1}`;
          const className = row['כיתה'] || row['Class'] || row['className'] || "ט'1";
          let grade: GradeType = 'ט';
          if (row['שכבה']) {
            grade = String(row['שכבה']).trim() as GradeType;
          } else if (className.includes('ט')) {
            grade = 'ט';
          } else if (className.includes('י') && !className.includes('יא') && !className.includes('יב')) {
            grade = 'י';
          } else if (className.includes('יא')) {
            grade = 'יא';
          } else if (className.includes('יב')) {
            grade = 'יב';
          }

          const username = row['שם משתמש'] || row['Username'] || `user_${Date.now()}_${idx}`;
          const password = row['סיסמה'] || row['Password'] || '123';

          return {
            fullName,
            className,
            grade,
            username,
            password,
            points: Number(row['נקודות'] || row['Points']) || 0,
          };
        });

        onStudentsLoaded(parsedStudents);
        setStatusMsg({
          type: 'success',
          text: `קובץ האקסל פוענח בהצלחה! יובאו ${parsedStudents.length} תלמידות.`,
        });
      } catch (err) {
        console.error(err);
        setStatusMsg({ type: 'error', text: 'שגיאה בקריאת קובץ האקסל. ודא קובץ .xlsx או .csv תקין' });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-amber-50 p-4 rounded-2xl border border-amber-200">
        <div>
          <h4 className="font-bold text-amber-950 text-sm flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-amber-700" />
            <span>העלאת רשימת תלמידות מקובץ אקסל (Excel / CSV)</span>
          </h4>
          <p className="text-xs text-amber-800">
            הקובץ צריך להכיל עמודות: "שם מלא", "כיתה", "שכבה", "שם משתמש", "סיסמה".
          </p>
        </div>

        <button
          onClick={downloadSampleTemplate}
          className="bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>הורד קובץ דוגמה (Template)</span>
        </button>
      </div>

      {/* Drag and Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          dragActive
            ? 'border-amber-600 bg-amber-100/60'
            : 'border-amber-300 hover:border-amber-500 bg-white hover:bg-amber-50/50'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".xlsx, .xls, .csv"
          className="hidden"
        />

        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 mx-auto flex items-center justify-center mb-3">
          <Upload className="w-6 h-6" />
        </div>

        <p className="font-extrabold text-amber-950 text-sm font-['Heebo']">
          לחצי כאן לבחירת קובץ אקסל או גררי לכאן
        </p>
        <p className="text-xs text-slate-500 mt-1">תומך בקבצי XLSX, XLS ו-CSV</p>
      </div>

      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}
    </div>
  );
};
