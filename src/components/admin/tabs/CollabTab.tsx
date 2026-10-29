import React from 'react';
import { MessageSquare, Check, X, RefreshCw, AlertCircle, CheckCircle2, Sparkles, Copy } from 'lucide-react';
import { QuestionSuggestion, QuestionFeedback, QuestionFeedbackType } from '../../../types';

interface CollabTabProps {
  suggestions: QuestionSuggestion[];
  feedbackItems: QuestionFeedback[];
  isLoadingCollab: boolean;
  collabSubtab: 'suggestions' | 'feedback';
  setCollabSubtab: (subtab: 'suggestions' | 'feedback') => void;
  suggestionFilterStatus: 'all' | 'pending' | 'approved' | 'rejected';
  setSuggestionFilterStatus: (value: 'all' | 'pending' | 'approved' | 'rejected') => void;
  feedbackFilterStatus: 'all' | 'pending' | 'resolved';
  setFeedbackFilterStatus: (value: 'all' | 'pending' | 'resolved') => void;
  pendingSuggestionsCount: number;
  pendingFeedbackCount: number;
  collabActionMsg: { type: 'success' | 'error'; text: string } | null;
  setCollabActionMsg: (msg: { type: 'success' | 'error'; text: string } | null) => void;
  approvingSuggestion: QuestionSuggestion | null;
  setApprovingSuggestion: (suggestion: QuestionSuggestion | null) => void;
  approvalPoints: number;
  setApprovalPoints: (points: number) => void;
  approvalTargetDate: string;
  setApprovalTargetDate: (date: string) => void;
  approvalAdminFeedback: string;
  setApprovalAdminFeedback: (feedback: string) => void;
  isSavingApproval: boolean;
  rejectingSuggestion: QuestionSuggestion | null;
  setRejectingSuggestion: (suggestion: QuestionSuggestion | null) => void;
  rejectReason: string;
  setRejectReason: (reason: string) => void;
  isSavingReject: boolean;
  resolvingFeedback: QuestionFeedback | null;
  setResolvingFeedback: (feedback: QuestionFeedback | null) => void;
  resolveResponse: string;
  setResolveResponse: (response: string) => void;
  isSavingResolve: boolean;
  loadCollabData: () => Promise<void>;
  handleApproveSuggestion: () => Promise<void>;
  handleRejectSuggestion: () => Promise<void>;
  handleResolveFeedback: () => Promise<void>;
}

export const CollabTab: React.FC<CollabTabProps> = ({
  suggestions,
  feedbackItems,
  isLoadingCollab,
  collabSubtab,
  setCollabSubtab,
  suggestionFilterStatus,
  setSuggestionFilterStatus,
  feedbackFilterStatus,
  setFeedbackFilterStatus,
  pendingSuggestionsCount,
  pendingFeedbackCount,
  collabActionMsg,
  setCollabActionMsg,
  approvingSuggestion,
  setApprovingSuggestion,
  approvalPoints,
  setApprovalPoints,
  approvalTargetDate,
  setApprovalTargetDate,
  approvalAdminFeedback,
  setApprovalAdminFeedback,
  isSavingApproval,
  rejectingSuggestion,
  setRejectingSuggestion,
  rejectReason,
  setRejectReason,
  isSavingReject,
  resolvingFeedback,
  setResolvingFeedback,
  resolveResponse,
  setResolveResponse,
  isSavingResolve,
  loadCollabData,
  handleApproveSuggestion,
  handleRejectSuggestion,
  handleResolveFeedback,
}) => {
  const totalPendingCollab = pendingSuggestionsCount + pendingFeedbackCount;
  return (
<div className="space-y-6 animate-in fade-in">
  {/* Header Card */}
  <div className="bg-white rounded-3xl p-5 sm:p-6 border border-amber-200 shadow-xs space-y-4">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-100 pb-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
          <MessageSquare className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-xl font-extrabold text-amber-950 font-['Heebo'] flex items-center gap-2">
            <span>הצעות ומשובים מהתלמידות</span>
            {totalPendingCollab > 0 && (
              <span className="text-xs bg-rose-500 text-white font-extrabold px-2.5 py-0.5 rounded-full">
                {totalPendingCollab} ממתינים לבדיקה
              </span>
            )}
          </h3>
          <p className="text-xs text-amber-800">
            אישור שאלות הלכה מקוריות שנכתבו ע"י התלמידות ותגמול בנקודות בונוס, ומענה להשגות והערות על שאלות החידון.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={loadCollabData}
        disabled={isLoadingCollab}
        className="px-4 py-2 rounded-xl text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 self-start sm:self-auto cursor-pointer"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCollab ? 'animate-spin' : ''}`} />
        <span>{isLoadingCollab ? 'מרענן...' : 'רענון רשימה'}</span>
      </button>
    </div>

    {/* Success / Error Message Banner */}
    {collabActionMsg && (
      <div
        className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in ${
          collabActionMsg.type === 'success'
            ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
            : 'bg-rose-50 border border-rose-300 text-rose-900'
        }`}
      >
        <div className="flex items-center gap-2">
          {collabActionMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{collabActionMsg.text}</span>
        </div>
        <button
          type="button"
          onClick={() => setCollabActionMsg(null)}
          className="p-1 hover:bg-black/5 rounded-lg"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )}

    {/* Sub-tab Navigation */}
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setCollabSubtab('suggestions')}
        className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
          collabSubtab === 'suggestions'
            ? 'bg-amber-600 text-white shadow-xs'
            : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
        }`}
      >
        <Sparkles className="w-4 h-4" />
        <span>הצעות שאלות הלכה ({suggestions.length})</span>
        {pendingSuggestionsCount > 0 && (
          <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black animate-pulse">
            {pendingSuggestionsCount}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => setCollabSubtab('feedback')}
        className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
          collabSubtab === 'feedback'
            ? 'bg-amber-600 text-white shadow-xs'
            : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
        }`}
      >
        <MessageSquare className="w-4 h-4" />
        <span>משובים והשגות על שאלות ({feedbackItems.length})</span>
        {pendingFeedbackCount > 0 && (
          <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black animate-pulse">
            {pendingFeedbackCount}
          </span>
        )}
      </button>
    </div>
  </div>

  {/* SUBTAB 1: QUESTION SUGGESTIONS */}
  {collabSubtab === 'suggestions' && (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-500 font-bold shrink-0">סינון לפי סטטוס:</span>
        {(
          [
            { id: 'all', label: `הכל (${suggestions.length})` },
            { id: 'pending', label: `ממתינים (${pendingSuggestionsCount})` },
            {
              id: 'approved',
              label: `אושר (${suggestions.filter((s) => s.status === 'approved').length})`,
            },
            {
              id: 'rejected',
              label: `נדחה (${suggestions.filter((s) => s.status === 'rejected').length})`,
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSuggestionFilterStatus(tab.id)}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
              suggestionFilterStatus === tab.id
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white border border-amber-200 text-amber-900 hover:bg-amber-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Suggestions List */}
      {(() => {
        const filtered = suggestions.filter((s) => {
          if (suggestionFilterStatus === 'all') return true;
          return s.status === suggestionFilterStatus;
        });

        if (filtered.length === 0) {
          return (
            <div className="bg-white rounded-3xl p-8 border border-amber-200 text-center text-slate-500 space-y-2">
              <Sparkles className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="font-bold text-sm">אין הצעות שאלות להצגה בסטטוס זה</p>
              <p className="text-xs text-slate-400">
                כאשר תלמידות יציעו שאלות הלכה דרך האפליקציה, הן יופיעו כאן לבדיקה ואישור.
              </p>
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((sug) => {
              const isPending = sug.status === 'pending';
              const isApproved = sug.status === 'approved';
              const isRejected = sug.status === 'rejected';

              return (
                <div
                  key={sug.id}
                  className={`bg-white rounded-3xl p-5 border shadow-xs space-y-4 flex flex-col justify-between transition-all ${
                    isPending
                      ? 'border-amber-300 ring-2 ring-amber-200/50'
                      : isApproved
                      ? 'border-emerald-200 bg-emerald-50/10'
                      : 'border-slate-200 bg-slate-50/40 opacity-80'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Card Top: Student details & status badge */}
                    <div className="flex items-start justify-between gap-2 border-b border-amber-100 pb-3">
                      <div>
                        <h4 className="font-extrabold text-sm text-amber-950 font-['Heebo'] flex items-center gap-1.5">
                          <span>{sug.studentName}</span>
                          <span className="text-xs text-amber-700 font-semibold">
                            (כיתה {sug.className})
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {sug.studentEmail} • {new Date(sug.createdAt).toLocaleDateString('he-IL')}
                        </p>
                      </div>

                      <span
                        className={`text-[11px] font-black px-2.5 py-1 rounded-full border shrink-0 ${
                          isPending
                            ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                            : isApproved
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : 'bg-rose-100 text-rose-900 border-rose-300'
                        }`}
                      >
                        {isPending && '⏳ ממתין לבדיקה'}
                        {isApproved && `✓ אושר (+${sug.pointsAwarded || 0} נק')`}
                        {isRejected && '✕ נדחה'}
                      </span>
                    </div>

                    {/* Topic & Source */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-0.5 rounded-lg border border-amber-200">
                        נושא: {sug.topic}
                      </span>
                      {sug.source && (
                        <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-0.5 rounded-lg border border-slate-200">
                          מקור: {sug.source}
                        </span>
                      )}
                      {sug.targetDate && (
                        <span className="bg-indigo-100 text-indigo-900 text-xs font-bold px-2.5 py-0.5 rounded-lg border border-indigo-200">
                          📅 מיועד לתאריך: {sug.targetDate}
                        </span>
                      )}
                    </div>

                    {/* Question text */}
                    <div className="bg-amber-50/40 p-3 rounded-2xl border border-amber-100 text-slate-900 font-bold text-xs sm:text-sm leading-relaxed">
                      {sug.questionText}
                    </div>

                    {/* Options with correct answer highlighted */}
                    <div className="space-y-1.5 text-xs">
                      {sug.options.map((opt, oIdx) => {
                        const isCorrect = oIdx === sug.correctOptionIndex;
                        return (
                          <div
                            key={oIdx}
                            className={`p-2 rounded-xl flex items-center gap-2 font-medium border ${
                              isCorrect
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold shadow-2xs'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {['א', 'ב', 'ג', 'ד'][oIdx]}
                            </span>
                            <span className="flex-1">{opt}</span>
                            {isCorrect && (
                              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.2 rounded-md">
                                תשובה נכונה
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation */}
                    {sug.explanation && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-0.5">
                        <span className="font-bold text-slate-700 block">💡 הסבר הלכתי:</span>
                        <p>{sug.explanation}</p>
                      </div>
                    )}

                    {/* Admin Feedback note (if reviewed) */}
                    {sug.adminFeedback && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-0.5">
                        <span className="font-bold block">💬 משוב מנהלת לתלמידה:</span>
                        <p>{sug.adminFeedback}</p>
                      </div>
                    )}
                  </div>

                  {/* Action Footer */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const copyContent = `נושא: ${sug.topic}\nשאלה: ${sug.questionText}\nא. ${sug.options[0]}\nב. ${sug.options[1]}\nג. ${sug.options[2]}\nד. ${sug.options[3]}\nתשובה נכונה: ${['א', 'ב', 'ג', 'ד'][sug.correctOptionIndex]} (${sug.options[sug.correctOptionIndex]})\nהסבר: ${sug.explanation || '—'}\nנכתב ע"י: ${sug.studentName} (${sug.className})`;
                        navigator.clipboard.writeText(copyContent);
                        alert('פרטי השאלה הועתקו ללוח בהצלחה!');
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>העתק שאלה</span>
                    </button>

                    {isPending && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setApprovingSuggestion(sug);
                            setApprovalPoints(10);
                            setApprovalTargetDate(sug.targetDate || '');
                            setApprovalAdminFeedback('');
                          }}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>אשר והענק נקודות</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRejectingSuggestion(sug);
                            setRejectReason('');
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>דחה</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  )}

  {/* SUBTAB 2: QUESTION FEEDBACK & CORRECTIONS */}
  {collabSubtab === 'feedback' && (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-500 font-bold shrink-0">סינון לפי סטטוס:</span>
        {(
          [
            { id: 'all', label: `הכל (${feedbackItems.length})` },
            { id: 'pending', label: `פתוחים (${pendingFeedbackCount})` },
            {
              id: 'resolved',
              label: `טופלו (${feedbackItems.filter((f) => f.status === 'resolved').length})`,
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFeedbackFilterStatus(tab.id)}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
              feedbackFilterStatus === tab.id
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white border border-amber-200 text-amber-900 hover:bg-amber-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Feedback List */}
      {(() => {
        const filtered = feedbackItems.filter((f) => {
          if (feedbackFilterStatus === 'all') return true;
          return f.status === feedbackFilterStatus;
        });

        if (filtered.length === 0) {
          return (
            <div className="bg-white rounded-3xl p-8 border border-amber-200 text-center text-slate-500 space-y-2">
              <MessageSquare className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="font-bold text-sm">אין משובים או השגות בסטטוס זה</p>
              <p className="text-xs text-slate-400">
                כאשר תלמידות ידווחו על טעות ניסוח, הערה הלכתית או הצעה לשאלה, הן יופיעו כאן.
              </p>
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((fb) => {
              const isPending = fb.status === 'pending';
              const isResolved = fb.status === 'resolved';

              const isGeneral = fb.questionId === 'general';
              const isHalacha = fb.questionId === 'daily-halacha';

              const typeLabels: Record<QuestionFeedbackType, { label: string; icon: string }> = {
                halachic_note: { label: isGeneral ? 'הערה על ההלכות' : 'הערה הלכתית / מקור', icon: '📜' },
                error_report: { label: isGeneral ? 'דיווח על תקלה' : 'טעות ניסוח / הגהה', icon: '✍️' },
                suggestion: { label: isGeneral ? 'הצעת שיפור / רעיון חדש' : 'הצעה לשיפור השאלה', icon: '💡' },
                other: { label: 'נושא אחר', icon: '💬' },
              };
              const typeInfo = typeLabels[fb.feedbackType] || typeLabels.other;

              return (
                <div
                  key={fb.id}
                  className={`bg-white rounded-3xl p-5 border shadow-xs space-y-4 flex flex-col justify-between transition-all ${
                    isPending
                      ? 'border-amber-300 ring-2 ring-amber-200/50'
                      : 'border-emerald-200 bg-emerald-50/10'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Card Top: Student & Status */}
                    <div className="flex items-start justify-between gap-2 border-b border-amber-100 pb-3">
                      <div>
                        <h4 className="font-extrabold text-sm text-amber-950 font-['Heebo'] flex items-center gap-1.5">
                          <span>{fb.studentName}</span>
                          <span className="text-xs text-amber-700 font-semibold">
                            (כיתה {fb.className})
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {fb.studentEmail} • {new Date(fb.createdAt).toLocaleDateString('he-IL')}
                        </p>
                      </div>

                      <span
                        className={`text-[11px] font-black px-2.5 py-1 rounded-full border shrink-0 ${
                          isPending
                            ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                            : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        }`}
                      >
                        {isPending ? '⏳ ממתין לטיפול' : '✓ טופל'}
                      </span>
                    </div>

                    {/* Type and Date Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      {isGeneral ? (
                        <span className="bg-purple-100 text-purple-900 text-xs font-bold px-2.5 py-0.5 rounded-lg border border-purple-200">
                          🌟 הצעת שיפור לאפליקציה
                        </span>
                      ) : isHalacha ? (
                        <span className="bg-blue-100 text-blue-900 text-xs font-bold px-2.5 py-0.5 rounded-lg border border-blue-200">
                          📖 משוב על ההלכה היומית
                        </span>
                      ) : (
                        <span className="bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-0.5 rounded-lg border border-amber-200">
                          ❓ שאלת חידון
                        </span>
                      )}

                      <span className="bg-amber-50 text-amber-950 text-xs font-bold px-2.5 py-0.5 rounded-lg border border-amber-200 flex items-center gap-1">
                        <span>{typeInfo.icon}</span>
                        <span>{typeInfo.label}</span>
                      </span>
                      <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-0.5 rounded-lg border border-slate-200">
                        {isGeneral ? `תאריך פנייה: ${fb.date}` : `תאריך חידון: ${fb.date}`}
                      </span>
                    </div>

                    {/* Context */}
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                      <span className="font-bold text-slate-500 block">
                        {isGeneral
                          ? 'נושא הפנייה:'
                          : isHalacha
                          ? 'ההלכה היומית אליה מתייחס המשוב:'
                          : 'השאלה אליה מתייחס המשוב:'}
                      </span>
                      <p className="font-bold text-slate-900">{fb.questionText}</p>
                    </div>

                    {/* Comment */}
                    <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200 text-xs space-y-1">
                      <span className="font-bold text-amber-900 block">תוכן המשוב / ההערה:</span>
                      <p className="text-slate-800 leading-relaxed whitespace-pre-line font-medium">
                        "{fb.comment}"
                      </p>
                    </div>

                    {/* Admin Response if resolved */}
                    {fb.adminResponse && (
                      <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs space-y-1">
                        <span className="font-bold text-emerald-900 block">מענה מנהלת:</span>
                        <p className="text-emerald-950">{fb.adminResponse}</p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  {isPending && (
                    <div className="pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setResolvingFeedback(fb);
                          setResolveResponse('');
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>סמן כטופל / הוסף מענה</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  )}
</div>
  );
};
