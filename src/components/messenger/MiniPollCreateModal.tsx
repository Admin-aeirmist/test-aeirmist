import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart3, Plus, Trash2, X, Sparkles } from 'lucide-react';
import { triggerNativeHaptic } from '../../lib/nativeHaptics';

interface MiniPollCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatePoll: (pollData: { question: string; options: string[] }) => void;
}

export const MiniPollCreateModal: React.FC<MiniPollCreateModalProps> = ({
  isOpen,
  onClose,
  onCreatePoll,
}) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length < 6) {
      triggerNativeHaptic('light');
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      triggerNativeHaptic('light');
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (text: string, index: number) => {
    const next = [...options];
    next[index] = text;
    setOptions(next);
  };

  const validOptions = options.map(o => o.trim()).filter(Boolean);
  const isValid = question.trim().length > 0 && validOptions.length >= 2;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    triggerNativeHaptic('medium');
    onCreatePoll({
      question: question.trim(),
      options: validOptions,
    });
    setQuestion('');
    setOptions(['', '']);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/75 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-md bg-[#0c0d14]/95 border border-white/15 rounded-3xl p-5 shadow-[0_25px_60px_rgba(0,0,0,0.8)] z-10 flex flex-col gap-4 overflow-hidden"
        >
          {/* Header accent */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-aeirmist-cyan via-aeirmist-magenta to-aeirmist-cyan opacity-80" />

          {/* Title row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-aeirmist-cyan/15 border border-aeirmist-cyan/30 flex items-center justify-center text-aeirmist-cyan">
                <BarChart3 size={17} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Create Mini Poll</h3>
                <p className="text-[10px] text-white/40">Ask participants for votes or opinions</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 mt-1">
            {/* Question Field */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/60">Poll Question</label>
              <input
                type="text"
                autoFocus
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. Which design do you prefer?"
                maxLength={120}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-aeirmist-cyan focus:ring-1 focus:ring-aeirmist-cyan transition-all"
              />
            </div>

            {/* Options List */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                Poll Options ({validOptions.length}/6)
              </label>

              <div className="flex flex-col gap-2 max-h-[190px] overflow-y-auto no-scrollbar pr-1">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-white/30 w-4 text-center">{i + 1}</span>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => handleOptionChange(e.target.value, i)}
                      placeholder={`Option ${i + 1}`}
                      maxLength={60}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-aeirmist-cyan transition-all"
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(i)}
                        className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {options.length < 6 && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="flex items-center gap-1.5 text-xs font-bold text-aeirmist-cyan/80 hover:text-aeirmist-cyan mt-1 px-1 transition-colors"
                >
                  <Plus size={14} /> Add Another Option
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white/50 hover:text-white hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isValid}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-300 ${
                  isValid
                    ? 'bg-gradient-to-r from-aeirmist-cyan to-aeirmist-magenta text-black shadow-[0_0_20px_rgba(0,242,255,0.4)] active:scale-95'
                    : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'
                }`}
              >
                <Sparkles size={14} />
                Send Poll
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
