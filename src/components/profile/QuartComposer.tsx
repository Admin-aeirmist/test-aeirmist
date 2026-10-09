import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Send, Sparkles, Smile, MessageSquare, Zap } from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { getAvatarUrl } from '../../lib/avatar';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const QuartComposer = () => {
  const { db, user, profile, earnPoints, localAvatarURL, addToast } = useAeirmist();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || !user || !db || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const postPayload = {
        userId: user.uid,
        authorId: profile?.id || user.uid,
        userName: profile?.displayName || user.displayName || 'Aeirmist User',
        authorPhoto: localAvatarURL || profile?.photoURL || user.photoURL || '',
        authorName: profile?.displayName || user.displayName || 'Aeirmist User',
        author: {
          displayName: profile?.displayName || user.displayName || 'Aeirmist User',
          username: profile?.username || user.displayName?.toLowerCase().replace(/\s+/g, '_') || 'voyager',
          photoURL: localAvatarURL || profile?.photoURL || user.photoURL || '',
          isVerified: profile?.isVerified || false
        },
        content: content.trim(),
        mediaUrls: [],
        mediaType: 'text',
        likesCount: 0,
        likedBy: [],
        auraCount: 0,
        timestamp: 'Just now',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'posts'), postPayload);
      setContent('');
      await earnPoints(10); // Reward for contributing to the Networkwork
    } catch (error) {
      console.error('Error posting quart:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="w-full border-b border-white/5 p-4 bg-white/[0.01] transition-all hover:bg-white/[0.02]">
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          <img 
            src={getAvatarUrl(localAvatarURL || profile.photoURL, profile.displayName)} 
            alt="Me" 
            className="w-12 h-12 rounded-2xl object-cover border border-white/10"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="flex-grow">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's vibrating in your user?"
            className="w-full bg-transparent border-none focus:ring-0 focus:outline-none text-white placeholder-white/20 resize-none text-[18px] font-medium min-h-[120px] p-0 mb-3"
          />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => { if(addToast) addToast({ title: 'System', message: 'Feature in development.', type: 'info' }) }} className="p-2 rounded-full text-white/40 hover:text-aeirmist-cyan hover:bg-aeirmist-cyan/10 transition-all">
                <Smile size={18} />
              </button>
              <button type="button" onClick={() => { if(addToast) addToast({ title: 'System', message: 'Feature in development.', type: 'info' }) }} className="p-2 rounded-full text-white/40 hover:text-aeirmist-magenta hover:bg-aeirmist-magenta/10 transition-all">
                <MessageSquare size={18} />
              </button>
              <button type="button" onClick={() => { if(addToast) addToast({ title: 'System', message: 'Feature in development.', type: 'info' }) }} className="p-2 rounded-full text-white/40 hover:text-aeirmist-lime hover:bg-aeirmist-lime/10 transition-all">
                <Zap size={18} />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <span className={`text-[10px] font-mono ${content.length > 280 ? 'text-red-500' : 'text-white/20'}`}>
                {content.length}/280
              </span>
              <button
                onClick={handleSubmit}
                disabled={!content.trim() || content.length > 280 || isSubmitting}
                className="px-6 py-2 rounded-full bg-aeirmist-cyan text-black font-black text-[11px] uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-[0_0_15px_-3px_rgba(0,242,255,0.3)]"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={14} />
                    <span>Save</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
