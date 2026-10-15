import React, { useState, useRef } from 'react';
import { Smile, Image, Film, MapPin, Users, Music, ListTodo, Link as LinkIcon, Undo, Redo, Send } from 'lucide-react';

export const TextComposer = ({ onPublish }: { onPublish: (text: string) => void }) => {
  const [text, setText] = useState('');
  const [background, setBackground] = useState('minimal');
  const [history, setHistory] = useState<string[]>(['']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const backgrounds = ['minimal', 'white', 'black', 'blue', 'purple', 'gradient', 'blur', 'glass', 'paper'];

  const handleTextChange = (val: string) => {
    setText(val);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(val);
    // Keep max 50 history steps
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setText(prev);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setText(next);
    }
  };

  const handleQuickInsert = (label: string) => {
    switch (label) {
      case 'Emoji':
        handleTextChange(text + (text ? ' ' : '') + '✨');
        break;
      case 'Photo':
      case 'Video':
        fileInputRef.current?.click();
        break;
      case 'Location':
        handleTextChange(text + (text ? ' ' : '') + '📍 ');
        break;
      case 'People':
        handleTextChange(text + (text ? ' ' : '') + '@');
        break;
      case 'Music':
        handleTextChange(text + (text ? ' ' : '') + '🎵 ');
        break;
      case 'Poll':
        handleTextChange(text + (text ? ' ' : '') + '📊 [Poll]: ');
        break;
      case 'Link':
        handleTextChange(text + (text ? ' ' : '') + 'https://');
        break;
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleTextChange(text + (text ? ' ' : '') + `[Attached: ${file.name}]`);
          }
        }}
      />

      <div className="flex justify-between items-center text-xs text-white/40">
        <span className="font-semibold uppercase tracking-wider text-[10px]">Text Pulse</span>
        <div className="flex gap-2">
          <button 
            type="button" 
            onClick={handleUndo} 
            disabled={historyIndex <= 0} 
            className="p-1 hover:text-white transition-colors disabled:opacity-20"
            title="Undo"
          >
            <Undo size={16} />
          </button>
          <button 
            type="button" 
            onClick={handleRedo} 
            disabled={historyIndex >= history.length - 1} 
            className="p-1 hover:text-white transition-colors disabled:opacity-20"
            title="Redo"
          >
            <Redo size={16} />
          </button>
        </div>
      </div>

      <div className={`p-6 rounded-2xl border border-white/10 transition-colors ${
        background === 'minimal' ? 'bg-[#06080d]' :
        background === 'white' ? 'bg-white text-black' :
        background === 'black' ? 'bg-black' :
        background === 'blue' ? 'bg-blue-950/40 border-blue-500/20' :
        background === 'purple' ? 'bg-purple-950/40 border-purple-500/20' :
        background === 'gradient' ? 'bg-gradient-to-br from-cyan-950/30 to-purple-950/30' :
        'bg-white/5'
      }`}>
        <textarea
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="What's resonating in your space?"
          className={`w-full h-36 bg-transparent text-base placeholder:text-white/20 focus:outline-none resize-none leading-relaxed ${
            background === 'white' ? 'text-black placeholder:text-black/30' : 'text-white'
          }`}
          maxLength={3000}
        />
        <div className="text-right text-[10px] text-white/30 font-mono">{text.length} / 3000</div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {backgrounds.map(bg => (
          <button
            key={bg}
            type="button"
            onClick={() => setBackground(bg)}
            className={`p-2 rounded-lg text-[9px] uppercase font-bold border transition-all ${
              background === bg ? 'border-aeirmist-cyan text-aeirmist-cyan bg-aeirmist-cyan/10' : 'border-white/5 bg-white/[0.02] text-white/50 hover:text-white'
            }`}
          >
            {bg}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2 pt-3 border-t border-white/10">
        {[
          { icon: Smile, label: 'Emoji' },
          { icon: Image, label: 'Photo' },
          { icon: Film, label: 'Video' },
          { icon: MapPin, label: 'Location' },
          { icon: Users, label: 'People' },
          { icon: Music, label: 'Music' },
          { icon: ListTodo, label: 'Poll' },
          { icon: LinkIcon, label: 'Link' },
        ].map(item => (
          <button 
            type="button"
            onClick={() => handleQuickInsert(item.label)} 
            key={item.label} 
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all active:scale-95"
          >
            <item.icon size={18} />
            <span className="text-[9px] uppercase font-medium tracking-tight">{item.label}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!text.trim()}
        onClick={() => {
          if (text.trim()) onPublish(text);
        }}
        className="w-full py-3.5 rounded-xl bg-aeirmist-cyan text-black font-extrabold text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_15px_rgba(0,242,255,0.25)]"
      >
        <Send size={14} />
        <span>Publish Pulse</span>
      </button>
    </div>
  );
};
