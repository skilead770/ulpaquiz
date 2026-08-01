import React, { useEffect } from 'react';
import { Award, Sparkles, X, Trophy, HeartHandshake } from 'lucide-react';
import confetti from 'canvas-confetti';
import { PrizeMilestone } from '../types';

interface MilestoneModalProps {
  milestone: PrizeMilestone;
  onClose: () => void;
}

export const MilestoneModal: React.FC<MilestoneModalProps> = ({
  milestone,
  onClose,
}) => {
  useEffect(() => {
    // Fire confetti effect when milestone pop-up opens!
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.5 },
      colors: ['#f59e0b', '#fbbf24', '#10b981', '#ec4899', '#8b5cf6'],
    });
  }, [milestone]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-gradient-to-b from-amber-50 via-white to-amber-100/60 w-full max-w-md rounded-3xl shadow-2xl border-2 border-amber-300 p-6 sm:p-8 text-center space-y-6 relative overflow-hidden animate-in zoom-in-95">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 w-8 h-8 rounded-full bg-amber-200/60 hover:bg-amber-300 flex items-center justify-center text-amber-900 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Big Trophy Badge */}
        <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 text-white flex items-center justify-center shadow-xl shadow-amber-500/40 relative">
          <Trophy className="w-12 h-12 animate-bounce" />
          <div className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
            אבן דרך!
          </div>
        </div>

        {/* Milestone Message */}
        <div className="space-y-2">
          <span className="bg-amber-200 text-amber-950 text-xs font-black px-3.5 py-1 rounded-full border border-amber-300">
            הגעת ל-{milestone.points} נקודות אישיות! 🎉
          </span>

          <h3 className="text-2xl font-extrabold text-amber-950 font-['Heebo']">
            {milestone.points === 10
              ? 'כל הכבוד! הגעת ל-10 נקודות, המשיכי כך!'
              : milestone.points === 50
              ? 'ממש אלופה! 50 נקודות של לימוד והתמדה!'
              : `אלופה! הגעת ליעד של ${milestone.points} נקודות!`}
          </h3>

          <p className="text-amber-900 text-sm font-semibold leading-relaxed">
            {milestone.title}: {milestone.rewardDescription}
          </p>
        </div>

        <div className="bg-amber-100/80 border border-amber-200 p-4 rounded-2xl text-xs text-amber-900 font-bold flex items-center gap-2 text-right">
          <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            צוות האולפנה גאה בך על ההתמדה והלימוד היומי. הפרס האישי מחכה לך בחדר המורות!
          </span>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-gradient-to-r from-amber-600 to-yellow-500 text-white font-black text-sm py-3.5 rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          המשיכי בלימוד והצלחה! ✨
        </button>
      </div>
    </div>
  );
};
