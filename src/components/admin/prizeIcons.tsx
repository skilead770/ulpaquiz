import React from 'react';
import { Crown, Trophy, Gift, Star, Sparkles, BookOpen, Bookmark, Heart, Award } from 'lucide-react';

export const renderAdminPrizeIcon = (iconName?: string, className: string = 'w-4 h-4') => {
  switch (iconName) {
    case 'Crown': return <Crown className={className} />;
    case 'Trophy': return <Trophy className={className} />;
    case 'Gift': return <Gift className={className} />;
    case 'Star': return <Star className={className} />;
    case 'Sparkles': return <Sparkles className={className} />;
    case 'BookOpen': return <BookOpen className={className} />;
    case 'Bookmark': return <Bookmark className={className} />;
    case 'Heart': return <Heart className={className} />;
    case 'Award':
    default:
      return <Award className={className} />;
  }
};
