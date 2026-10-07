import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Calendar, Sparkles, X, Check } from 'lucide-react';
import { triggerNativeHaptic } from '../../lib/nativeHaptics';

interface ScheduleMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText: string;
  onSchedule: (params: { text: string; scheduledTimeMs: number }) => void;
}

export const ScheduleMessageModal: React.FC<ScheduleMessageModalProps> = ({
  isOpen,
  onClose,
  initialText,
  onSchedule,
}) => {
  const [text, setText] = useState(initialText);

  // Default to +15 minutes
  const getInitialCustomTime = () => {
    const d = new Date(Date.now() + 15 * 60 * 1000);
    d.setSeconds(0, 0);
    // Format to YYYY-MM-DDTHH:mm
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const [customDateTime, setCustomDateTime] = useState(getInitialCustomTime());
  const [selectedPreset, setSelectedPreset] = useState<'15m' | '30m' | '1h' | '3h' | 'tomorrow' | 'custom'>('15m');

  // Update text when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setText(initialText);
      setSelectedPreset('15m');
    }
  }, [isOpen, initialText]);

  if (!isOpen) return null;

  const getComputedTimestamp = (): number => {
    const now = Date.now();
    switch (selectedPreset) {
      case '15m':
        return now + 15 * 60 * 1000;
      case '30m':
        return now + 30 * 60 * 1000;
      case '1h':
        return now + 60 * 60 * 1000;
      case '3h':
        return now + 3 * 60 * 60 * 1000;
      case 'tomorrow': {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        return tomorrow.getTime();
      }
      case 'custom': {
        const parsed = new Date(customDateTime).getTime();
        return isNaN(parsed) || parsed <= now ? now + 15 * 60 * 1000 : parsed;
      }
    }
  };

  const scheduledMs = getComputedTimestamp();
  const isValid = text.trim().length > 0 && scheduledMs > Date.now();

  const handleSelectPreset = (preset: typeof selectedPreset) => {
    triggerNativeHaptic('light');
    setSelectedPreset(preset);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    triggerNativeHaptic('medium');
    onSchedule({
      text: text.trim(),
      scheduledTimeMs: scheduledMs,
    });
    onClose();
  };

  const formattedDate = new Date(scheduledMs).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

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
          {/* Neon Header Accent */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400 via-aeirmist-cyan to-amber-400 opacity-80" />

          {/* Title Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
                <Clock size={17} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Schedule Message</h3>
                <p className="text-[10px] text-white/40">Automatically sends when the time arrives</p>
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
            {/* Message Content Field */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/60">Message</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type your message here..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all resize-none"
              />
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/60">Choose Timing</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: '15m', label: '+15 mins' },
                  { id: '30m', label: '+30 mins' },
                  { id: '1h', label: '+1 hour' },
                  { id: '3h', label: '+3 hours' },
                  { id: 'tomorrow', label: 'Tomorrow 9AM' },
                  { id: 'custom', label: 'Custom Time' },
                ].map((preset) => {
                  const isSelected = selectedPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id as any)}
                      className={`py-2 px-2.5 rounded-xl border text-[11px] font-bold transition-all text-center ${
                        isSelected
                          ? 'border-amber-400 bg-amber-400/20 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                          : 'border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Datetime Input */}
            {selectedPreset === 'custom' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-1"
              >
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white">
                  <Calendar size={15} className="text-amber-400" />
                  <input
                    type="datetime-local"
                    value={customDateTime}
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={(e) => setCustomDateTime(e.target.value)}
                    className="bg-transparent text-white focus:outline-none w-full text-xs [color-scheme:dark]"
                  />
                </div>
              </motion.div>
            )}

            {/* Target Delivery Preview Banner */}
            <div className="flex items-center gap-2 p-2.5 bg-amber-400/10 border border-amber-400/20 rounded-xl text-amber-300 text-xs">
              <Clock size={14} className="flex-shrink-0" />
              <span>Will send: <strong className="font-semibold">{formattedDate}</strong></span>
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
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-black shadow-[0_0_20px_rgba(251,191,36,0.35)] active:scale-95'
                    : 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'
                }`}
              >
                <Clock size={14} />
                Schedule Message
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
