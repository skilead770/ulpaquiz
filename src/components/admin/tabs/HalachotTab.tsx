import React from 'react';
import {
  FileText, ExternalLink, UploadCloud, FileUp, RefreshCw, Wand2, Sparkles,
  AlertCircle, CheckCircle2, Plus, Edit, Trash2, Save,
} from 'lucide-react';
import { DailyHalacha, Question } from '../../../types';
import { bulkImportHalachotApi, parseDocContentApi } from '../../../lib/api';

interface HalachotTabProps {
  halachot: DailyHalacha[];
  docUrlInput: string;
  setDocUrlInput: (value: string) => void;
  docRawTextInput: string;
  setDocRawTextInput: (value: string) => void;
  isImportingDoc: boolean;
  setIsImportingDoc: (value: boolean) => void;
  importDocMsg: { type: 'success' | 'error' | 'info'; text: string } | null;
  setImportDocMsg: (msg: { type: 'success' | 'error' | 'info'; text: string } | null) => void;
  showDocImportBox: boolean;
  setShowDocImportBox: (value: boolean) => void;
  handleFetchFromGoogleDrive: () => Promise<void>;
  parseAndImportHalachotText: (text: string) => Promise<void>;
  aiTopic: string;
  setAiTopic: (value: string) => void;
  aiDate: string;
  setAiDate: (value: string) => void;
  aiHebrewDate: string;
  setAiHebrewDate: (value: string) => void;
  isGeneratingAi: boolean;
  aiMsg: { type: 'success' | 'error'; text: string } | null;
  handleGenerateAiHalacha: (e: React.FormEvent) => Promise<void>;
  editingHalacha: DailyHalacha | null;
  setEditingHalacha: (halacha: DailyHalacha | null) => void;
  isSavingHalacha: boolean;
  isGeneratingQuestions: boolean;
  questionsAiError: string | null;
  renderQuestionAiProviderControls: () => React.ReactNode;
  handleGenerateQuestionsFromContent: (sourceType?: 'manual' | 'hebrew-date') => Promise<void>;
  handleToggleQuizEnabled: (halacha: DailyHalacha) => Promise<void>;
  handleSaveHalacha: () => Promise<void>;
  handleDeleteHalacha: (id: string) => Promise<void>;
  openHalachaEditor: (halacha: DailyHalacha) => void;
  createBlankHalacha: () => DailyHalacha;
  onRefreshData: () => void;
}

export const HalachotTab: React.FC<HalachotTabProps> = ({
  halachot,
  docUrlInput,
  setDocUrlInput,
  docRawTextInput,
  setDocRawTextInput,
  isImportingDoc,
  setIsImportingDoc,
  importDocMsg,
  setImportDocMsg,
  showDocImportBox,
  setShowDocImportBox,
  handleFetchFromGoogleDrive,
  parseAndImportHalachotText,
  aiTopic,
  setAiTopic,
  aiDate,
  setAiDate,
  aiHebrewDate,
  setAiHebrewDate,
  isGeneratingAi,
  aiMsg,
  handleGenerateAiHalacha,
  editingHalacha,
  setEditingHalacha,
  isSavingHalacha,
  isGeneratingQuestions,
  questionsAiError,
  renderQuestionAiProviderControls,
  handleGenerateQuestionsFromContent,
  handleToggleQuizEnabled,
  handleSaveHalacha,
  handleDeleteHalacha,
  openHalachaEditor,
  createBlankHalacha,
  onRefreshData,
}) => {
  return (
<div className="space-y-6">
  {/* Google Doc Import Card for תשפ"ז */}
  <div className="bg-white border-2 border-emerald-300 rounded-3xl p-6 shadow-md space-y-4">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-emerald-950 text-lg font-['Heebo']">
              יבוא והגדרת הלכות שנת תשפ"ז מתוך Google Docs
            </h3>
            <span className="bg-emerald-100 text-emerald-800 text-[11px] font-black px-2.5 py-0.5 rounded-full border border-emerald-200">
              חידון שנת תשפ"ז
            </span>
          </div>
          <p className="text-xs text-emerald-800 font-medium">
            טעינת קובץ ההלכות השנתי - התאריכים נקבעים לפי התאריך העברי שמופיע ככותרת משנה לכל הלכה!
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <a
          href={docUrlInput}
          target="_blank"
          rel="noreferrer"
          className="px-3 py-1.5 rounded-xl border border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>פתח מסמך ב-Drive</span>
        </a>
        <button
          type="button"
          onClick={() => setShowDocImportBox(!showDocImportBox)}
          className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition-colors"
        >
          {showDocImportBox ? 'הסתר הגדרות' : 'הצג הגדרות'}
        </button>
      </div>
    </div>

    {showDocImportBox && (
      <div className="space-y-4 pt-1">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-8">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              קישור Google Doc (קובץ שנת תשפ"ז ב-Google Drive):
            </label>
            <input
              type="text"
              value={docUrlInput}
              onChange={(e) => setDocUrlInput(e.target.value)}
              placeholder="https://docs.google.com/document/d/.../edit"
              className="w-full px-4 py-2.5 rounded-xl border border-emerald-300 bg-white text-xs font-mono font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="sm:col-span-4">
            <button
              type="button"
              onClick={handleFetchFromGoogleDrive}
              disabled={isImportingDoc}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-4 rounded-xl shadow-md transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>{isImportingDoc ? 'טוען ומנתח...' : 'סנכרן ישירות מ-Google Drive'}</span>
            </button>
          </div>
        </div>

        {/* Instant Sync from Year Halachot JSON */}
        <div className="bg-amber-500/10 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h5 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-amber-700" />
              סנכרון מיידי ממאגר ההלכות המובנה (489 הלכות לשנת תשפ״ז)
            </h5>
            <p className="text-[11px] text-amber-900 mt-0.5">
              טוען ישירות את כל ההלכות והתאריכים המנותחים מתוך data/db.json אל מסד הנתונים Firestore.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              setIsImportingDoc(true);
              setImportDocMsg({ type: 'info', text: 'טוען 489 הלכות ומסנכרן ל-Firestore...' });
              try {
                const { default: yearHalachot } = await import('../../../data/yearHalachot.json');
                const res = await bulkImportHalachotApi(yearHalachot as DailyHalacha[]);
                setImportDocMsg({
                  type: 'success',
                  text: `סונכרנו בהצלחה ${res.addedCount || yearHalachot.length} הלכות לשנת תשפ״ז ל-Firestore!`,
                });
                onRefreshData();
              } catch (err: any) {
                console.error('Sync error:', err);
                setImportDocMsg({ type: 'error', text: err?.message || 'שגיאה בסנכרון ההלכות' });
              } finally {
                setIsImportingDoc(false);
              }
            }}
            disabled={isImportingDoc}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-2 shrink-0 disabled:opacity-50 shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isImportingDoc ? 'animate-spin' : ''}`} />
            <span>{isImportingDoc ? 'מסנכרן...' : 'סנכרן את כל 489 ההלכות עכשיו'}</span>
          </button>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/80 pb-2">
            <label className="block text-xs font-bold text-emerald-950">
              העלאת קובץ Word (.docx) ישירות מהמחשב או הדבקת טקסט:
            </label>
            <label className="inline-flex items-center gap-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer transition-colors shadow-2xs">
              <FileUp className="w-4 h-4 text-emerald-700" />
              <span>העלי קובץ Word (.docx / .doc)</span>
              <input
                type="file"
                accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setIsImportingDoc(true);
                  setImportDocMsg({ type: 'info', text: `מפענח את הקובץ "${file.name}"...` });
                  try {
                    const buffer = await file.arrayBuffer();
                    const parseRes = await parseDocContentApi(buffer);
                    if (parseRes.text) {
                      setDocRawTextInput(parseRes.text);
                      await parseAndImportHalachotText(parseRes.text);
                    } else {
                      throw new Error('לא זוהה טקסט בקובץ.');
                    }
                  } catch (err: any) {
                    console.error('File upload error:', err);
                    setImportDocMsg({ type: 'error', text: err?.message || 'שגיאה בקריאת הקובץ' });
                  } finally {
                    setIsImportingDoc(false);
                    e.target.value = '';
                  }
                }}
              />
            </label>
          </div>

          <textarea
            rows={4}
            value={docRawTextInput}
            onChange={(e) => setDocRawTextInput(e.target.value)}
            placeholder="הדביקי כאן את תוכן מסמך ההלכות... המערכת תזהה אוטומטית כותרות תאריכים עבריים (לדוגמה: כ&quot;ד אלול תשפ&quot;ז, א&quot; תשרי תשפ&quot;ז) ותפצל לחידונים יומיים."
            className="w-full p-3 rounded-xl border border-emerald-300 bg-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => parseAndImportHalachotText(docRawTextInput)}
              disabled={isImportingDoc || !docRawTextInput.trim()}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 px-5 rounded-xl text-xs flex items-center gap-2 disabled:opacity-50 shadow-xs cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>יבא וצור חידונים מטקסט זה</span>
            </button>
          </div>
        </div>

        {importDocMsg && (
          <div
            className={`p-3 rounded-xl text-xs font-bold ${
              importDocMsg.type === 'success'
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                : importDocMsg.type === 'error'
                ? 'bg-rose-100 text-rose-900 border border-rose-300'
                : 'bg-amber-100 text-amber-900 border border-amber-300'
            }`}
          >
            {importDocMsg.text}
          </div>
        )}
      </div>
    )}
  </div>

  {/* AI Generator Box (Gemini API) */}
  <div className="bg-gradient-to-r from-amber-50 via-amber-100/50 to-orange-50 border border-amber-300 rounded-3xl p-6 shadow-sm space-y-4">
    <div className="flex items-center gap-2">
      <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold shadow-xs">
        <Wand2 className="w-5 h-5" />
      </div>
      <div>
        <h3 className="font-extrabold text-amber-950 text-lg font-['Heebo']">
          מחולל AI אוטומטי להלכה וחידון יומי (Gemini API)
        </h3>
        <p className="text-xs text-amber-800">
          הזיני נושא הלכתי, תאריך ותאריך עברי - והמערכת תיצור אוטומטית הלכה קריאה ו-4 שאלות אמריקאיות עם הסברים!
        </p>
      </div>
    </div>

    <form onSubmit={handleGenerateAiHalacha} className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
      <div className="sm:col-span-5">
        <input
          type="text"
          placeholder="לדוגמה: הלכות שבת - הדלקת נרות, הלכות תפילה, ברכת האילנות..."
          value={aiTopic}
          onChange={(e) => setAiTopic(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-amber-300 bg-white text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          required
        />
      </div>

      <div className="sm:col-span-2">
        <input
          type="text"
          placeholder='תאריך עברי (למשל: א&apos; תשרי)'
          value={aiHebrewDate}
          onChange={(e) => setAiHebrewDate(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-amber-300 bg-white text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-500"
        />
      </div>

      <div className="sm:col-span-2">
        <input
          type="date"
          value={aiDate}
          onChange={(e) => setAiDate(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-amber-300 bg-white text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          required
        />
      </div>

      <div className="sm:col-span-3">
        <button
          type="submit"
          disabled={isGeneratingAi || !aiTopic.trim()}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-2.5 px-4 rounded-xl shadow-md transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-yellow-300" />
          <span>{isGeneratingAi ? 'מייצר הלכה ב-AI...' : 'צור הלכה וחידון ב-AI'}</span>
        </button>
      </div>
    </form>

    {aiMsg && (
      <div
        className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
          aiMsg.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}
      >
        {aiMsg.type === 'success' ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        ) : (
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
        )}
        <span>{aiMsg.text}</span>
      </div>
    )}
  </div>

  {/* Existing Halachot List & Add Manual Button */}
  <div className="bg-white rounded-3xl p-6 border border-amber-200/80 shadow-sm space-y-4">
    <div className="flex items-center justify-between border-b border-amber-100 pb-4">
      <div>
        <h3 className="text-xl font-extrabold text-amber-950 font-['Heebo']">
          מאגר ההלכות והחידונים המתוזמנים ({halachot.length})
        </h3>
        <p className="text-xs text-amber-800">
          כל הלכה מוצגת לתלמידות לפי התאריך המוגדר.
        </p>
      </div>

      <button
        onClick={() => setEditingHalacha(createBlankHalacha())}
        className="bg-amber-600 text-white hover:bg-amber-700 font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
      >
        <Plus className="w-4 h-4" />
        <span>הוסף הלכה ידנית</span>
      </button>
    </div>

    <div className="space-y-3">
      {halachot.map((h) => (
        <div
          key={h.id}
          className="p-4 rounded-2xl border border-amber-200 bg-amber-50/20 hover:bg-amber-50/60 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-amber-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                {h.date}
              </span>
              {h.hebrewDate && (
                <span className="bg-amber-700 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs">
                  {h.hebrewDate}
                </span>
              )}
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${h.quizEnabled === false ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'}`}>
                {h.quizEnabled === false ? 'חידון מושבת' : 'חידון פעיל'}
              </span>
              <span className="text-xs font-bold text-amber-900">
                {h.topic}
              </span>
            </div>
            <h4 className="font-extrabold text-slate-900 text-base font-['Heebo']">
              {h.title}
            </h4>
            <p className="text-xs text-slate-600 line-clamp-1 max-w-xl">
              {h.content}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleToggleQuizEnabled(h)}
              className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors ${
                h.quizEnabled === false
                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                  : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900'
              }`}
            >
              <span>{h.quizEnabled === false ? 'הפעל חידון' : 'השבת חידון'}</span>
            </button>
            <button
              onClick={() => openHalachaEditor(h)}
              className="p-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs flex items-center gap-1 transition-colors"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>שאלות ותשובות</span>
            </button>
            <button
              onClick={() => handleDeleteHalacha(h.id)}
              className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>מחק</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>

  {/* Edit / Create Halacha Modal */}
  {editingHalacha && (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-amber-200 p-4 sm:p-8 space-y-4 sm:space-y-6 my-auto max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-amber-100 pb-3 sm:pb-4 shrink-0">
          <h3 className="text-lg sm:text-xl font-extrabold text-amber-950 font-['Heebo']">
            עריכת הלכה, שאלות ותשובות
          </h3>
          <button
            onClick={() => setEditingHalacha(null)}
            className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
          >
            סגור ✕
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto flex-1 pl-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">תאריך לתצוגה</label>
              <input
                type="date"
                value={editingHalacha.date}
                onChange={(e) =>
                  setEditingHalacha({ ...editingHalacha, date: e.target.value })
                }
                className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">תאריך עברי (לדוגמה: א' אלול תשפ"ז)</label>
              <input
                type="text"
                placeholder='לדוגמה: כ"ד אלול תשפ"ז'
                value={editingHalacha.hebrewDate || ''}
                onChange={(e) =>
                  setEditingHalacha({ ...editingHalacha, hebrewDate: e.target.value })
                }
                className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">נושא ההלכה</label>
              <input
                type="text"
                value={editingHalacha.topic}
                onChange={(e) =>
                  setEditingHalacha({ ...editingHalacha, topic: e.target.value })
                }
                className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-bold text-amber-950">
            <input
              type="checkbox"
              checked={editingHalacha.quizEnabled !== false}
              onChange={(e) => setEditingHalacha({ ...editingHalacha, quizEnabled: e.target.checked })}
              className="h-4 w-4 accent-amber-700"
            />
            לאפשר לתלמידות להיבחן בתאריך הזה
          </label>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">מקור בספר "אהלי הלכה" (לדוגמה: אהלי הלכה - חלק א', פרק כ')</label>
            <input
              type="text"
              value={editingHalacha.source || ''}
              onChange={(e) =>
                setEditingHalacha({ ...editingHalacha, source: e.target.value })
              }
              placeholder='סדרת אהלי הלכה - על פי פסקי הלכה של הגאון הרב יעקב אריאל שליט"א'
              className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">כותרת ההלכה</label>
            <input
              type="text"
              value={editingHalacha.title}
              onChange={(e) =>
                setEditingHalacha({ ...editingHalacha, title: e.target.value })
              }
              className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">תוכן ההלכה לקריאה</label>
            <textarea
              rows={5}
              value={editingHalacha.content}
              onChange={(e) =>
                setEditingHalacha({ ...editingHalacha, content: e.target.value })
              }
              className="w-full p-3 rounded-xl border border-slate-300 text-sm leading-relaxed"
            />
          </div>

          {renderQuestionAiProviderControls()}

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mt-1 bg-amber-50/50 p-3 rounded-2xl border border-amber-200">
            <span className="text-[11px] text-amber-900 font-medium">
              ניתן להזין או לערוך את תוכן ההלכה למעלה, ואז לחולל אוטומטית 4 שאלות חכמות מהתוכן באמצעות ה-AI.
            </span>
            <button
              type="button"
              disabled={isGeneratingQuestions || !editingHalacha.content.trim()}
              onClick={() => handleGenerateQuestionsFromContent('manual')}
              className="px-4 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-all shrink-0 self-end sm:self-auto"
            >
              {isGeneratingQuestions ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5 text-yellow-300" />
              )}
              <span>{isGeneratingQuestions ? 'מייצר שאלות...' : 'חולל שאלות מהתוכן ✨'}</span>
            </button>
          </div>
          {questionsAiError && (
            <p className="text-xs font-bold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200 mt-2">
              {questionsAiError}
            </p>
          )}

          {/* Questions Edit Block */}
          <div className="pt-4 border-t border-amber-100 space-y-4">
            <h4 className="font-extrabold text-amber-950 text-base">
              4 שאלות החידון היומי:
            </h4>
            <p className="text-xs text-slate-600">
              ערכי את השאלות והאפשרויות, וסמני בעיגול את התשובה הנכונה לכל שאלה.
            </p>

            {editingHalacha.questions.map((q, qIdx) => (
              <div key={q.id} className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-3">
                <label className="block text-xs font-bold text-amber-950">
                  שאלה {qIdx + 1}:
                </label>
                <input
                  type="text"
                  value={q.text}
                  onChange={(e) => {
                    const newQs = [...editingHalacha.questions] as [Question, Question, Question, Question];
                    newQs[qIdx].text = e.target.value;
                    setEditingHalacha({ ...editingHalacha, questions: newQs });
                  }}
                  className="w-full p-2 rounded-xl border border-amber-300 text-xs font-semibold bg-white"
                />

                {/* Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {q.options.map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name={`correct-${q.id}`}
                        checked={q.correctOptionIndex === optIdx}
                        onChange={() => {
                          const newQs = [...editingHalacha.questions] as [Question, Question, Question, Question];
                          newQs[qIdx].correctOptionIndex = optIdx;
                          setEditingHalacha({ ...editingHalacha, questions: newQs });
                        }}
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const newQs = [...editingHalacha.questions] as [Question, Question, Question, Question];
                          newQs[qIdx].options[optIdx] = e.target.value;
                          setEditingHalacha({ ...editingHalacha, questions: newQs });
                        }}
                        className={`w-full p-2 rounded-lg border text-xs ${
                          q.correctOptionIndex === optIdx
                            ? 'border-emerald-500 bg-emerald-50/80 font-bold'
                            : 'border-slate-200 bg-white'
                        }`}
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-0.5">הסבר לתשובה הנכונה:</label>
                  <input
                    type="text"
                    value={q.explanation || ''}
                    onChange={(e) => {
                      const newQs = [...editingHalacha.questions] as [Question, Question, Question, Question];
                      newQs[qIdx].explanation = e.target.value;
                      setEditingHalacha({ ...editingHalacha, questions: newQs });
                    }}
                    className="w-full p-2 rounded-lg border border-slate-200 text-xs bg-white"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-amber-100">
          <button
            onClick={() => setEditingHalacha(null)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
          >
            ביטול
          </button>
          <button
            onClick={handleSaveHalacha}
            disabled={isSavingHalacha}
            className="px-6 py-2.5 rounded-xl text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 shadow-md flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>שמור הלכה וחידון</span>
          </button>
        </div>
      </div>
    </div>
  )}
</div>
  );
};
