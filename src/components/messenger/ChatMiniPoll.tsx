import React, { useState } from 'react';
import { motion } from 'motion/react';
import { BarChart3, CheckCircle2, Lock } from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { triggerNativeHaptic } from '../../lib/nativeHaptics';
import { logger } from '@/src/utils/logger';

export interface ChatPollOption {
  id: string;
  text: string;
  votes: string[]; // User IDs who voted
}

export interface ChatPollData {
  question: string;
  options: string[] | ChatPollOption[];
  votes?: { [optionText: string]: string[] };
  isClosed?: boolean;
}

interface ChatMiniPollProps {
  chatId?: string;
  messageId: string;
  poll: ChatPollData;
  isMe: boolean;
}

export const ChatMiniPoll: React.FC<ChatMiniPollProps> = ({ chatId, messageId, poll, isMe }) => {
  const { profile, addToast } = useAeirmist();
  const [voting, setVoting] = useState(false);
  const [localVotes, setLocalVotes] = useState<{ [key: string]: string[] }>(poll.votes || {});

  // Normalize options into consistent structure
  const rawOptions = poll.options || [];
  const pollVotes: { [key: string]: string[] } = Object.keys(localVotes).length > 0 ? localVotes : (poll.votes || {});

  const options: { text: string; voterIds: string[] }[] = rawOptions.map(opt => {
    if (typeof opt === 'string') {
      return {
        text: opt,
        voterIds: pollVotes[opt] || []
      };
    } else {
      return {
        text: opt.text,
        voterIds: opt.votes || pollVotes[opt.text] || []
      };
    }
  });

  const totalVotes = options.reduce((sum, opt) => sum + opt.voterIds.length, 0);

  const userVotedOption = profile
    ? options.find(opt => opt.voterIds.includes(profile.id))?.text
    : undefined;

  const handleVote = async (optionText: string) => {
    if (!profile || !chatId || !messageId || voting || poll.isClosed) return;
    setVoting(true);
    triggerNativeHaptic('light');

    try {
      const updatedVotes: { [key: string]: string[] } = {};
      options.forEach(opt => {
        const filtered = opt.voterIds.filter(id => id !== profile.id);
        if (opt.text === optionText) {
          if (!opt.voterIds.includes(profile.id)) {
            filtered.push(profile.id);
          }
        }
        updatedVotes[opt.text] = filtered;
      });

      setLocalVotes(updatedVotes);
    } catch (e) {
      logger.error('Failed to vote in chat poll:', e);
      addToast?.({
        title: 'Vote Failed',
        message: 'Could not record your vote. Please retry.',
        type: 'error'
      });
    } finally {
      setVoting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 p-3.5 my-1.5 bg-black/40 rounded-2xl border border-white/10 min-w-[260px] max-w-[340px] text-white">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 flex items-center justify-center text-aeirmist-cyan">
            <BarChart3 size={15} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-aeirmist-cyan">Mini Poll</span>
        </div>
        {poll.isClosed && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-white/40 uppercase bg-white/5 px-2 py-0.5 rounded-full">
            <Lock size={10} /> Closed
          </span>
        )}
      </div>

      {/* Question */}
      <h4 className="font-bold text-sm text-white/95 leading-snug">{poll.question}</h4>

      {/* Options List */}
      <div className="flex flex-col gap-2 mt-1">
        {options.map((opt, idx) => {
          const isSelected = userVotedOption === opt.text;
          const voteCount = opt.voterIds.length;
          const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;

          return (
            <button
              key={`${opt.text}-${idx}`}
              type="button"
              disabled={voting || poll.isClosed}
              onClick={() => handleVote(opt.text)}
              className={`relative overflow-hidden w-full text-left p-2.5 rounded-xl border transition-all text-xs font-medium cursor-pointer active:scale-[0.98] ${
                isSelected
                  ? 'border-aeirmist-cyan/50 bg-aeirmist-cyan/15 text-white shadow-[0_0_12px_rgba(0,242,255,0.15)]'
                  : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-white/80'
              }`}
            >
              {/* Progress bar background */}
              {totalVotes > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className={`absolute top-0 bottom-0 left-0 -z-0 opacity-25 rounded-xl ${
                    isSelected ? 'bg-aeirmist-cyan' : 'bg-white/20'
                  }`}
                />
              )}

              {/* Option content */}
              <div className="relative z-10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected
                        ? 'border-aeirmist-cyan bg-aeirmist-cyan text-black'
                        : 'border-white/30 bg-transparent'
                    }`}
                  >
                    {isSelected && <CheckCircle2 size={12} strokeWidth={3} className="text-black" />}
                  </div>
                  <span className="truncate">{opt.text}</span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0 text-[11px] font-mono font-bold text-white/60">
                  {totalVotes > 0 && <span>{percentage}%</span>}
                  <span className="text-[10px] text-white/40">({voteCount})</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer Vote Count */}
      <div className="flex items-center justify-between text-[10px] text-white/40 pt-1 font-mono">
        <span>{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} total</span>
        <span>{poll.isClosed ? 'Poll ended' : (userVotedOption ? 'Tap choice to change' : 'Tap to vote')}</span>
      </div>
    </div>
  );
};
