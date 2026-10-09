import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useAeirmist } from '../../context/AeirmistContext';
import { motion } from 'motion/react';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { logger } from '@/src/utils/logger';


export interface PollData {
  question: string;
  options: string[];
  votes: {
    [optionText: string]: string[]; // Lists of User IDs who voted for this option
  };
}

interface PollProps {
  postId: string;
  poll: PollData;
}

export const Poll: React.FC<PollProps> = ({ postId, poll }) => {
  const { db, profile } = useAeirmist();
  const [voting, setVoting] = useState(false);

  if (!poll || !poll.options) return null;

  const totalVotes = Object.values(poll.votes || {}).reduce(
    (acc, userIds) => acc + (userIds?.length || 0),
    0
  );

  const userVotedOption = profile 
    ? Object.keys(poll.votes || {}).find(option => poll.votes[option]?.includes(profile.id))
    : undefined;

  const hasVoted = !!userVotedOption;

  const handleVote = async (option: string) => {
    if (!db || !profile || voting) return;
    setVoting(true);
    
    try {
      const votesCopy = { ...(poll.votes || {}) };
      
      // Clean up user's previous votes so they can switch choice
      Object.keys(votesCopy).forEach(key => {
        if (!Array.isArray(votesCopy[key])) {
          votesCopy[key] = [];
        }
        votesCopy[key] = votesCopy[key].filter(id => id !== profile.id);
      });

      // Add vote to chosen option
      if (!Array.isArray(votesCopy[option])) {
        votesCopy[option] = [];
      }
      votesCopy[option].push(profile.id);

      await updateDoc(doc(db, 'posts', postId), {
        'poll.votes': votesCopy
      });
    } catch (e) {
      logger.error("Poll voting error", e);
    } finally {
      setVoting(false);
    }
  };

  return (
    <div className="w-full mt-3 p-4 sm:p-5 rounded-2xl bg-white/[0.02] border border-white/5 relative overflow-hidden text-left shadow-lg">
      <div className="absolute top-0 right-0 w-24 h-24 bg-aeirmist-cyan/5 blur-2xl rounded-full" />
      
      <div className="flex items-center gap-2 mb-3.5 relative z-10">
        <Sparkles size={14} className="text-aeirmist-cyan animate-pulse" />
        <span className="text-[8px] sm:text-[9.5px] font-black uppercase tracking-[0.2em] text-aeirmist-cyan font-mono">POLL</span>
      </div>

      <h4 className="text-sm font-bold text-white mb-4 tracking-tight leading-relaxed select-none">
        {poll.question}
      </h4>

      <div className="space-y-2.5 relative z-10">
        {poll.options.map((option, idx) => {
          const optionVotes = poll.votes?.[option]?.length || 0;
          const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
          const isSelected = userVotedOption === option;

          return (
            <button
              key={idx}
              disabled={!profile || voting}
              onClick={() => handleVote(option)}
              className={`w-full group text-left relative overflow-hidden rounded-xl border p-3 sm:p-3.5 transition-all outline-none ${
                isSelected 
                  ? 'border-aeirmist-cyan/40 bg-aeirmist-cyan/[0.04]' 
                  : 'border-white/5 bg-white/[0.01] hover:bg-white/[0.04] hover:border-white/10'
              }`}
            >
              {/* Dynamic neon vote percentage background bar */}
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`absolute inset-y-0 left-0 opacity-[0.06] ${
                  isSelected ? 'bg-aeirmist-cyan' : 'bg-white'
                }`}
              />

              <div className="flex justify-between items-center relative z-10 w-full select-none text-xs">
                <div className="flex items-center gap-2.5 max-w-[80%]">
                  {isSelected && <CheckCircle2 size={14} className="text-aeirmist-cyan shrink-0 animate-bounce" />}
                  <span className={`font-semibold truncate tracking-tight ${isSelected ? 'text-aeirmist-cyan font-black' : 'text-white/80'}`}>
                    {option}
                  </span>
                </div>
                
                {hasVoted && (
                  <motion.span 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`font-mono font-black text-[10px] sm:text-xs tracking-tighter shrink-0 ${
                      isSelected ? 'text-aeirmist-cyan' : 'text-white/40'
                    }`}
                  >
                    {percentage}% ({optionVotes})
                  </motion.span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 pt-3.5 border-t border-white/5 flex justify-between items-center text-[7.5px] sm:text-[9px] tracking-widest uppercase font-mono text-white/30 select-none">
        <span>{totalVotes.toLocaleString()} {totalVotes === 1 ? 'vote' : 'votes'}</span>
        {hasVoted ? (
          <span className="text-aeirmist-cyan font-semibold flex items-center gap-1">VOTED</span>
        ) : (
          <span className="text-white/40">TAP AN OPTION TO VOTE</span>
        )}
      </div>
    </div>
  );
};
