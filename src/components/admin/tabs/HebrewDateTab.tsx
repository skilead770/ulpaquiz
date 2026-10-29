import React from 'react';
import { Calendar, Edit, Wand2, RefreshCw, Save } from 'lucide-react';
import { DailyHalacha, Question } from '../../../types';
import { HebrewCalendarDayEntry } from '../hebrewCalendarUtils';

interface HebrewDateTabProps {
  selectedMonthKey: string;
  setSelectedMonthKey: (key: string) => void;
  monthOptions: { key: string; label: string }[];
  selectedMonthDays: HebrewCalendarDayEntry[];
  hebrewDateTableScrollRef: React.RefObject<HTMLDivElement>;
  selectedHebrewDateRowRef: React.RefObject<HTMLTableRowElement>;
  selectedHebrewDateAbs: number | null;
  setSelectedHebrewDateAbs: (abs: number | null) => void;
  currentHebrewDateAbs: number;
  selectedEntry: HebrewCalendarDayEntry | null;
  selectedHalacha: DailyHalacha | null;
  handleJumpToToday: () => void;
  openCalendarAnnotationModal: (entry: HebrewCalendarDayEntry) => void;
  editingHebrewDateQuiz: DailyHalacha | null;
  setEditingHebrewDateQuiz: (halacha: DailyHalacha | null) => void;
  hebrewDateQuizError: string | null;
  setHebrewDateQuizError: (error: string | null) => void;
  isSavingHebrewDateQuiz: boolean;
  isGeneratingQuestions: boolean;
  questionsAiError: string | null;
  handleSaveHebrewDateQuiz: () => Promise<void>;
  handleGenerateQuestionsFromContent: (sourceType?: 'manual' | 'hebrew-date') => Promise<void>;
  updateHebrewDateQuestion: (questionIndex: number, update: (question: Question) => Question) => void;
  cloneHalachaForEditing: (halacha: DailyHalacha) => DailyHalacha;
  renderQuestionAiProviderControls: () => React.ReactNode;
}

export const HebrewDateTab: React.FC<HebrewDateTabProps> = ({
  selectedMonthKey,
  setSelectedMonthKey,
  monthOptions,
  selectedMonthDays,
  hebrewDateTableScrollRef,
  selectedHebrewDateRowRef,
  selectedHebrewDateAbs,
  setSelectedHebrewDateAbs,
  currentHebrewDateAbs,
  selectedEntry,
  selectedHalacha,
  handleJumpToToday,
  openCalendarAnnotationModal,
  editingHebrewDateQuiz,
  setEditingHebrewDateQuiz,
  hebrewDateQuizError,
  setHebrewDateQuizError,
  isSavingHebrewDateQuiz,
  isGeneratingQuestions,
  questionsAiError,
  handleSaveHebrewDateQuiz,
  handleGenerateQuestionsFromContent,
  updateHebrewDateQuestion,
  cloneHalachaForEditing,
  renderQuestionAiProviderControls,
}) => {
  return (
<div className="bg-white border border-amber-200 rounded-3xl shadow-lg p-5 sm:p-6 space-y-5">
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-100">
    <div className="flex items-center gap-3">
      <div className="w-11 h-11 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-sm">
        <Calendar className="w-5 h-5" />
      </div>
      <div>
        <h3 className="text-lg font-black text-amber-950 font-['Heebo']">בחירת השאלה היומית</h3>
        <p className="text-xs text-amber-800">בחרי יום בלוח העברי לצפייה ולעריכת החידון היומי</p>
      </div>
    </div>

    <div className="flex flex-col sm:flex-row sm:items-end gap-2 min-w-[280px]">
      <div className="flex-1">
        <label className="block text-[11px] font-black text-slate-700 mb-1">בחרי חודש</label>
        <select
          value={selectedMonthKey}
          onChange={(e) => setSelectedMonthKey(e.target.value)}
          className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          {monthOptions.length === 0 ? (
            <option value="">אין תאריכים עבריים זמינים</option>
          ) : (
            monthOptions.map((month) => (
              <option key={month.key} value={month.key}>
                {month.label}
              </option>
            ))
          )}
        </select>
      </div>
      <button
        type="button"
        onClick={handleJumpToToday}
        title="חזרה לתאריך של היום"
        className="px-3.5 py-2.5 rounded-xl border border-amber-300 bg-amber-100 hover:bg-amber-200 text-amber-950 font-black text-xs flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-xs cursor-pointer"
      >
        <Calendar className="w-3.5 h-3.5 text-amber-700" />
        <span>עבור להיום</span>
      </button>
    </div>
  </div>

  <div className="overflow-hidden rounded-2xl border border-amber-200">
    <div className="flex items-center justify-between gap-3 bg-amber-50 px-4 py-3 border-b border-amber-200">
      <h4 className="text-sm font-black text-amber-950">
        {monthOptions.find((month) => month.key === selectedMonthKey)?.label || 'תאריכים בחודש'}
      </h4>
      <span className="text-xs font-bold text-amber-800">
        {selectedMonthDays.length} ימים
      </span>
    </div>

    {selectedMonthDays.length === 0 ? (
      <p className="p-5 text-center text-sm font-bold text-slate-600">לא ניתן להציג את ימי החודש.</p>
    ) : (
      <div ref={hebrewDateTableScrollRef} className="max-h-72 overflow-y-auto">
        <table className="w-full text-right text-sm">
          <thead className="sticky top-0 bg-white text-[11px] font-black text-slate-600 shadow-sm z-10">
            <tr>
              <th className="px-4 py-2">תאריך</th>
              <th className="px-4 py-2">יום בשבוע</th>
              <th className="px-4 py-2">פרשה / חג</th>
              <th className="px-3 py-2 text-center w-20">עריכה</th>
            </tr>
          </thead>
          <tbody>
            {selectedMonthDays.map((entry) => {
              const isSelected = entry.date.abs() === selectedHebrewDateAbs;
              const isToday = entry.date.abs() === currentHebrewDateAbs;
              const hasCustom = Boolean(entry.customAnnotation?.text);

              return (
                <tr
                  key={entry.date.abs()}
                  ref={isSelected ? selectedHebrewDateRowRef : null}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedHebrewDateAbs(entry.date.abs())}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedHebrewDateAbs(entry.date.abs());
                    }
                  }}
                  className={`border-t border-amber-100 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500 ${
                    isSelected
                      ? 'bg-amber-100'
                      : isToday
                      ? 'bg-amber-50/70 hover:bg-amber-100/70'
                      : 'hover:bg-amber-50'
                  }`}
                >
                  <td className="px-4 py-3 font-black text-amber-950">
                    <div className="flex items-center gap-1.5">
                      <span>{entry.dayLabel}</span>
                      {isToday && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-600 text-white shadow-xs">
                          היום
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">
                    {entry.weekday}{entry.weekday === 'שבת' ? ' קודש' : ''}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>
                        {entry.annotations.length > 0
                          ? entry.annotations.join(' • ')
                          : entry.halacha
                          ? '—'
                          : 'אין הלכה שמורה'}
                      </span>
                      {hasCustom && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-200/80 text-amber-900 border border-amber-300">
                          מותאם
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      type="button"
                      title={hasCustom ? 'עריכת הערה מותאמת' : 'הוספת הערה / חג לתאריך'}
                      onClick={(event) => {
                        event.stopPropagation();
                        openCalendarAnnotationModal(entry);
                      }}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        hasCustom
                          ? 'bg-amber-200/80 text-amber-900 hover:bg-amber-300'
                          : 'text-slate-400 hover:text-amber-800 hover:bg-amber-100'
                      }`}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>

  {!selectedHalacha ? (
    <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-6 text-center space-y-3">
      <p className="text-sm text-amber-900 font-bold">
        אין הלכה שמורה ליום {selectedEntry?.dayLabel} בחודש {monthOptions.find((month) => month.key === selectedMonthKey)?.label}.
      </p>
      {selectedEntry && (
        <div className="flex items-center justify-center gap-3 pt-1 flex-wrap">
          <span className="text-xs text-slate-700 font-medium">
            {selectedEntry.annotations.length > 0
              ? `אירוע / חג: ${selectedEntry.annotations.join(' • ')}`
              : 'לא הוגדר אירוע או חג לתאריך זה'}
          </span>
          <button
            type="button"
            onClick={() => openCalendarAnnotationModal(selectedEntry)}
            className="inline-flex items-center gap-1 text-xs font-bold text-amber-900 hover:text-amber-950 bg-white border border-amber-300 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <Edit className="w-3 h-3" />
            <span>{selectedEntry.customAnnotation?.text ? 'עריכת הערת חג' : 'הוספת הערת חג לתאריך'}</span>
          </button>
        </div>
      )}
    </div>
  ) : (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 mb-2">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="inline-flex items-center rounded-full bg-amber-600 px-2.5 py-1 text-[10px] font-black text-white shadow-sm">
              {selectedHalacha.hebrewDate || 'ללא תאריך עברי'}
            </span>
            <span className="text-xs text-slate-600 font-bold">{selectedHalacha.date}</span>
            {selectedEntry?.annotations && selectedEntry.annotations.length > 0 && (
              <span className="text-xs font-bold text-amber-900 bg-amber-200/70 border border-amber-300 px-2.5 py-0.5 rounded-full">
                {selectedEntry.annotations.join(' • ')}
              </span>
            )}
          </div>
          {selectedEntry && (
            <button
              type="button"
              onClick={() => openCalendarAnnotationModal(selectedEntry)}
              className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 cursor-pointer shadow-xs transition-colors"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>{selectedEntry.customAnnotation?.text ? 'עריכת הערת חג' : 'הוספת הערת חג לתאריך'}</span>
            </button>
          )}
        </div>

        <h4 className="text-xl sm:text-2xl font-black text-amber-950 font-['Heebo']">{selectedHalacha.title}</h4>

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-700">
          {selectedHalacha.topic && (
            <span className="rounded-full bg-white border border-amber-200 px-2.5 py-1 font-bold">נושא: {selectedHalacha.topic}</span>
          )}
          {selectedHalacha.source && (
            <span className="rounded-full bg-white border border-amber-200 px-2.5 py-1 font-bold">מקור: {selectedHalacha.source}</span>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <h5 className="text-sm font-black text-slate-800 mb-3">תוכן ההלכה</h5>
        <div className="whitespace-pre-wrap text-sm leading-7 text-slate-800 font-medium">
          {selectedHalacha.content || 'לא הוזן תוכן להלכה זו.'}
        </div>
      </div>

      {renderQuestionAiProviderControls()}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h5 className="text-sm font-black text-slate-800">שאלות החידון</h5>
          {editingHebrewDateQuiz?.id !== selectedHalacha.id && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setHebrewDateQuizError(null);
                  setEditingHebrewDateQuiz(cloneHalachaForEditing(selectedHalacha));
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100 cursor-pointer transition-all"
              >
                <Edit className="h-3.5 w-3.5" />
                עריכה ידנית
              </button>
              <button
                type="button"
                disabled={isGeneratingQuestions || !selectedHalacha.content || !selectedHalacha.content.trim()}
                onClick={() => handleGenerateQuestionsFromContent('hebrew-date')}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-black text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 px-3.5 py-2 disabled:opacity-50 cursor-pointer shadow-xs transition-all"
              >
                {isGeneratingQuestions ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wand2 className="w-3.5 h-3.5 text-yellow-300" />
                )}
                <span>{isGeneratingQuestions ? 'מייצר שאלות...' : 'חולל שאלות ב-AI ✨'}</span>
              </button>
            </div>
          )}
        </div>

        {questionsAiError && editingHebrewDateQuiz?.id !== selectedHalacha.id && (
          <p role="alert" className="text-xs font-bold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200 mb-4">
            {questionsAiError}
          </p>
        )}

        {editingHebrewDateQuiz?.id === selectedHalacha.id ? (
          <div className="space-y-4">
            <p className="text-xs text-slate-600">עדכני את נוסח השאלות והאפשרויות, וסמני בעיגול את התשובה הנכונה.</p>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mt-1 bg-amber-50/50 p-3 rounded-2xl border border-amber-200">
              <span className="text-[11px] text-amber-900 font-medium">
                ניתן לחולל אוטומטית 4 שאלות חכמות מתוכן ההלכה המוצג באמצעות ה-AI.
              </span>
              <button
                type="button"
                disabled={isGeneratingQuestions || !editingHebrewDateQuiz.content.trim()}
                onClick={() => handleGenerateQuestionsFromContent('hebrew-date')}
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
            {editingHebrewDateQuiz.questions.map((question, questionIndex) => (
              <fieldset key={question.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
                <legend className="px-1 text-xs font-black text-amber-950">שאלה {questionIndex + 1}</legend>
                <label className="block text-xs font-bold text-slate-700">
                  נוסח השאלה
                  <input
                    type="text"
                    value={question.text}
                    onChange={(event) => updateHebrewDateQuestion(questionIndex, (current) => ({ ...current, text: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
                  />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {question.options.map((option, optionIndex) => (
                    <label key={`${question.id}-${optionIndex}`} className={`flex items-center gap-2 rounded-lg border p-2 ${question.correctOptionIndex === optionIndex ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                      <input
                        type="radio"
                        name={`hebrew-date-correct-${editingHebrewDateQuiz.id}-${question.id}`}
                        checked={question.correctOptionIndex === optionIndex}
                        onChange={() => updateHebrewDateQuestion(questionIndex, (current) => ({ ...current, correctOptionIndex: optionIndex }))}
                        aria-label={`סמני אפשרות ${optionIndex + 1} כתשובה הנכונה`}
                      />
                      <input
                        type="text"
                        value={option}
                        onChange={(event) => updateHebrewDateQuestion(questionIndex, (current) => {
                          const options = [...current.options] as Question['options'];
                          options[optionIndex] = event.target.value;
                          return { ...current, options };
                        })}
                        aria-label={`אפשרות ${optionIndex + 1} לשאלה ${questionIndex + 1}`}
                        className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
                      />
                    </label>
                  ))}
                </div>
                <label className="block text-xs font-bold text-slate-700">
                  הסבר לתשובה הנכונה
                  <input
                    type="text"
                    value={question.explanation || ''}
                    onChange={(event) => updateHebrewDateQuestion(questionIndex, (current) => ({ ...current, explanation: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
                  />
                </label>
              </fieldset>
            ))}
            {hebrewDateQuizError && (
              <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">
                {hebrewDateQuizError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingHebrewDateQuiz(null)}
                disabled={isSavingHebrewDateQuiz}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleSaveHebrewDateQuiz}
                disabled={isSavingHebrewDateQuiz}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {isSavingHebrewDateQuiz ? 'שומר...' : 'שמור שאלות ותשובות'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {selectedHalacha.questions?.map((question, index) => (
              <div key={question.id} className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-sm font-black text-slate-800">שאלה {index + 1}</p>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-1 rounded-full">
                    תשובה נכונה: {question.correctOptionIndex + 1}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-800 mb-3">{question.text}</p>
                <div className="space-y-2">
                  {question.options.map((option, optionIndex) => (
                    <div
                      key={`${question.id}-${optionIndex}`}
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        optionIndex === question.correctOptionIndex
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-900 font-bold'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <span className="font-black ml-2">{String.fromCharCode(65 + optionIndex)}.</span>
                      {option}
                    </div>
                  ))}
                </div>
                {question.explanation && (
                  <div className="mt-3 rounded-xl bg-white border border-amber-200 px-3 py-2 text-xs text-slate-700">
                    <span className="font-black text-amber-900">הסבר:</span> {question.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )}
</div>
  );
};
