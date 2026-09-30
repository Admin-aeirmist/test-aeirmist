import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  Sparkles, 
  TrendingUp, 
  Award, 
  User, 
  MapPin, 
  Globe, 
  Camera, 
  Image as ImageIcon, 
  ShieldCheck, 
  ChevronRight, 
  Eye, 
  Users, 
  Activity, 
  ShoppingBag,
  Heart,
  X
} from 'lucide-react';

interface ProfileCompletionCardProps {
  displayUser: any;
  postsCount?: number;
  onEditProfile?: () => void;
}

export const ProfileCompletionCard: React.FC<ProfileCompletionCardProps> = ({ 
  displayUser, 
  postsCount = 0,
  onEditProfile 
}) => {
  const userId = displayUser?.id || displayUser?.uid || 'user';
  const storageKey = `aeirmist_dismiss_profile_strength_${userId}`;

  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return localStorage.getItem(storageKey) !== 'true';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === 'true') {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
    } catch (e) {
      console.warn("Could not read profile strength state", e);
    }
  }, [storageKey]);

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      localStorage.setItem(storageKey, 'true');
    } catch (e) {
      console.warn("Could not save profile strength dismiss state", e);
    }
  };

  // Checklist calculation
  const hasPhoto = Boolean(displayUser?.photoURL);
  const hasCover = Boolean(displayUser?.coverURL);
  const hasBio = Boolean(displayUser?.bio && displayUser.bio.trim().length > 0);
  const hasUsername = Boolean(displayUser?.username);
  const hasLocation = Boolean(displayUser?.location);
  const hasWebsite = Boolean(displayUser?.website || displayUser?.socialLinks?.website);
  const hasBirthday = Boolean(displayUser?.birthday);
  const hasPrivacy = displayUser?.isPrivate !== undefined;

  const checklist = [
    { label: 'Profile Picture', done: hasPhoto, tip: 'Add a profile photo so friends can recognize you.' },
    { label: 'Cover Photo', done: hasCover, tip: 'Upload a cover photo to make your profile stand out.' },
    { label: 'Bio', done: hasBio, tip: 'Add a bio so people know more about you.' },
    { label: 'Username', done: hasUsername, tip: 'Choose a unique username.' },
    { label: 'Location', done: hasLocation, tip: 'Add your location to connect with people nearby.' },
    { label: 'Website / Social Link', done: hasWebsite, tip: 'Link your website or social media.' },
    { label: 'Birthday', done: hasBirthday, tip: 'Add your birthday for birthday greetings.' },
    { label: 'Account Preferences', done: hasPrivacy, tip: 'Configure your profile privacy settings.' }
  ];

  const completedCount = checklist.filter(item => item.done).length;
  const percentage = Math.round((completedCount / checklist.length) * 100);

  // Milestones / Achievements
  const achievements = [
    { title: 'Profile Setup', unlocked: percentage >= 50, icon: <User size={14} className="text-aeirmist-cyan" /> },
    { title: 'Community Contributor', unlocked: postsCount > 0, icon: <Activity size={14} className="text-aeirmist-lime" /> },
    { title: 'Verified Member', unlocked: displayUser?.isVerified, icon: <ShieldCheck size={14} className="text-blue-400" /> },
    { title: 'Active Creator', unlocked: displayUser?.creatorModeEnabled, icon: <Sparkles size={14} className="text-aeirmist-magenta" /> }
  ];

  const nextSuggestion = checklist.find(item => !item.done);

  if (!isVisible) return null;

  return (
    <div className="w-full my-4 rounded-3xl bg-slate-100/90 border border-slate-200/90 dark:bg-gradient-to-br dark:from-white/[0.04] dark:via-black/40 dark:to-white/[0.02] dark:border-white/10 p-5 shadow-xl backdrop-blur-xl relative overflow-hidden font-sans">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-aeirmist-cyan/5 blur-3xl rounded-full pointer-events-none" />

      {/* Header & Percentage */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-aeirmist-cyan shadow-sm shrink-0">
            <TrendingUp size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white truncate">Profile Strength</h3>
              <span className="text-[10px] font-mono font-black text-aeirmist-cyan px-2 py-0.5 rounded-full bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 shrink-0">
                {percentage}% Complete
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-white/50 font-medium mt-0.5 truncate">
              {percentage === 100 ? "Your profile looks amazing and complete!" : nextSuggestion ? nextSuggestion.tip : "Complete your profile to unlock full potential."}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          <button
            onClick={() => setIsExpanded(prev => !prev)}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-200/80 border border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-700 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:text-white/80 transition-all flex items-center gap-1 cursor-pointer shadow-sm"
          >
            {isExpanded ? 'Less' : 'Insights & Tasks'}
            <ChevronRight size={12} className={`transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
          </button>
          
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-xl bg-white hover:bg-slate-200/80 border border-slate-200 text-slate-400 hover:text-slate-700 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:text-white/50 dark:hover:text-white transition-all cursor-pointer shadow-sm"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-slate-200 dark:bg-black/60 rounded-full border border-slate-300/70 dark:border-white/5 overflow-hidden mb-4 relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full bg-gradient-to-r from-aeirmist-cyan to-aeirmist-magenta shadow-[0_0_12px_rgba(0,242,255,0.4)]"
        />
      </div>

      {/* Expandable Checklist & Achievements */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 pt-3 border-t border-slate-200 dark:border-white/5 overflow-hidden"
          >
            {/* Checklist */}
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-white/60 mb-2">Profile Checklist</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {checklist.map((item, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      item.done 
                        ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan/30 text-slate-800 dark:text-white' 
                        : 'bg-white border-slate-200 text-slate-500 dark:bg-white/[0.02] dark:border-white/5 dark:text-white/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${item.done ? 'bg-aeirmist-cyan text-black' : 'bg-slate-200 text-slate-400 dark:bg-white/10 dark:text-white/30'}`}>
                        <CheckCircle2 size={12} />
                      </div>
                      <span className="text-[11px] font-medium truncate">{item.label}</span>
                    </div>
                    <span className="text-[9px] font-mono font-bold uppercase shrink-0">
                      {item.done ? 'Done' : 'Missing'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Achievement Badges */}
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-white/60 mb-2">Milestones & Achievements</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {achievements.map((ach, idx) => (
                  <div 
                    key={idx}
                    className={`p-3 rounded-2xl border flex flex-col items-center text-center gap-1.5 transition-all ${
                      ach.unlocked 
                        ? 'bg-white border-slate-200 shadow-sm text-slate-800 dark:bg-gradient-to-b dark:from-white/[0.06] dark:to-white/[0.02] dark:border-white/15 dark:text-white' 
                        : 'bg-slate-100/60 border-slate-200 text-slate-400 dark:bg-black/20 dark:border-white/5 dark:text-white/40 opacity-50 grayscale'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center">
                      {ach.icon}
                    </div>
                    <span className="text-[10px] font-bold leading-tight">{ach.title}</span>
                    <span className="text-[8px] font-mono font-bold uppercase opacity-60">
                      {ach.unlocked ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
