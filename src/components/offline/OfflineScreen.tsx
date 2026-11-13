import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  WifiOff, 
  Wifi, 
  RefreshCw, 
  X, 
  Database, 
  FileText, 
  PenTool, 
  Trash2, 
  Copy, 
  Check, 
  Heart, 
  MessageCircle, 
  HardDrive,
  Sparkles
} from 'lucide-react';
import { LocalSqlService } from '../../services/LocalSqlService';
import { FeedPostCacheItem, OfflineDraftItem } from '../../services/CacheService';
import { getAvatarUrl, BLANK_DP } from '../../lib/avatar';

interface OfflineScreenProps {
  onClose?: () => void;
}

export const OfflineScreen: React.FC<OfflineScreenProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'drafts' | 'storage'>('feed');
  const [cachedPosts, setCachedPosts] = useState<FeedPostCacheItem[]>([]);
  const [drafts, setDrafts] = useState<OfflineDraftItem[]>([]);
  const [dbStats, setDbStats] = useState<{
    postsCount: number;
    draftsCount: number;
    messagesCount: number;
    mediaCount: number;
    engine: string;
  }>({
    postsCount: 0,
    draftsCount: 0,
    messagesCount: 0,
    mediaCount: 0,
    engine: 'SQLite / IndexedDB'
  });

  // Draft form state
  const [draftType, setDraftType] = useState<'post' | 'note'>('post');
  const [draftContent, setDraftContent] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Network check state
  const [checkingNetwork, setCheckingNetwork] = useState(false);
  const [networkStatusMsg, setNetworkStatusMsg] = useState<string | null>(null);

  // Load all local data
  const refreshLocalData = useCallback(async () => {
    const [posts, localDrafts, stats] = await Promise.all([
      LocalSqlService.getFeedPosts(40),
      LocalSqlService.getDrafts(),
      LocalSqlService.getDatabaseStats()
    ]);
    setCachedPosts(posts);
    setDrafts(localDrafts);
    setDbStats(stats);
  }, []);

  useEffect(() => {
    refreshLocalData();
  }, [refreshLocalData]);

  // Ping check
  const handleCheckConnection = async () => {
    setCheckingNetwork(true);
    setNetworkStatusMsg(null);
    try {
      if (!navigator.onLine) {
        setNetworkStatusMsg('Device reports: Offline');
        return;
      }
      // Attempt probe with cache buster
      const probe = await fetch(`/favicon.ico?_t=${Date.now()}`, { method: 'HEAD', cache: 'no-store' });
      if (probe.ok) {
        setNetworkStatusMsg('Connected! You are back online.');
        setTimeout(() => {
          if (onClose) onClose();
        }, 1200);
      } else {
        setNetworkStatusMsg('Limited connection: unable to reach server.');
      }
    } catch {
      setNetworkStatusMsg('Still offline: no response from network.');
    } finally {
      setCheckingNetwork(false);
    }
  };

  // Save draft
  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftContent.trim()) return;

    setSavingDraft(true);
    await LocalSqlService.saveDraft({
      type: draftType,
      content: draftContent.trim()
    });
    setDraftContent('');
    setSavingDraft(false);
    await refreshLocalData();
  };

  // Delete draft
  const handleDeleteDraft = async (id: string) => {
    await LocalSqlService.deleteDraft(id);
    await refreshLocalData();
  };

  // Copy draft content
  const handleCopyDraft = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Clear cached posts
  const handleClearCachedFeed = async () => {
    if (window.confirm('Are you sure you want to clear cached feed posts from local storage?')) {
      await LocalSqlService.clearFeedPosts();
      await refreshLocalData();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[99999] bg-[#09090b] text-white flex flex-col overflow-hidden font-sans select-none"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))'
      }}
    >
      {/* Top Header Bar */}
      <header className="px-4 py-3 flex items-center justify-between border-b border-white/10 bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shadow-inner">
            <WifiOff size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white">Offline Sanctuary</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Local SQL Active
              </span>
            </div>
            <p className="text-xs text-zinc-400">All data is preserved safely in your device storage</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCheckConnection}
            disabled={checkingNetwork}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-xs font-medium text-zinc-200 transition-all"
            title="Check internet connection"
          >
            <RefreshCw size={13} className={checkingNetwork ? 'animate-spin text-emerald-400' : 'text-zinc-400'} />
            <span className="hidden sm:inline">Check Connection</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10 transition-colors"
              title="Close Offline Screen"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      {/* Network Status Feedback Banner */}
      <AnimatePresence>
        {networkStatusMsg && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 text-xs font-semibold text-center bg-zinc-800/80 border-b border-white/10 text-zinc-300"
          >
            {networkStatusMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Tabs */}
      <nav className="flex px-4 py-2 gap-2 border-b border-white/10 bg-black/20">
        <button
          onClick={() => setActiveTab('feed')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'feed'
              ? 'bg-white/10 text-white shadow-sm border border-white/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
          }`}
        >
          <Database size={14} className={activeTab === 'feed' ? 'text-cyan-400' : ''} />
          <span>Cached Feed ({cachedPosts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('drafts')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'drafts'
              ? 'bg-white/10 text-white shadow-sm border border-white/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
          }`}
        >
          <PenTool size={14} className={activeTab === 'drafts' ? 'text-amber-400' : ''} />
          <span>Drafts ({drafts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('storage')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'storage'
              ? 'bg-white/10 text-white shadow-sm border border-white/20'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
          }`}
        >
          <HardDrive size={14} className={activeTab === 'storage' ? 'text-emerald-400' : ''} />
          <span>Vault Metrics</span>
        </button>
      </nav>

      {/* Main Tab Views */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* --- TAB 1: CACHED FEED --- */}
        {activeTab === 'feed' && (
          <div className="max-w-lg mx-auto space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
              <span>Showing posts saved to local SQLite vault</span>
              <span className="text-[11px] text-zinc-500 font-mono">SQLite / IndexedDB</span>
            </div>

            {cachedPosts.length === 0 ? (
              <div className="text-center py-16 px-4 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                <Database size={40} className="mx-auto text-zinc-600" />
                <h3 className="text-base font-semibold text-zinc-300">No Cached Posts Yet</h3>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                  When you browse posts while online, Aeirmist automatically persists them in your device's local database for seamless offline reading.
                </p>
              </div>
            ) : (
              cachedPosts.map((post) => (
                <div
                  key={post.id}
                  className="p-4 rounded-2xl bg-[#121214]/90 border border-white/10 shadow-lg space-y-3 backdrop-blur-sm"
                >
                  {/* Author Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={getAvatarUrl(post.authorPhoto)}
                        alt={post.authorName || 'User'}
                        className="w-8 h-8 rounded-lg object-cover border border-white/10"
                        onError={(e) => { (e.target as HTMLImageElement).src = BLANK_DP; }}
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white">
                            {post.authorName || post.authorUsername || 'Aeirmist Member'}
                          </span>
                          {post.authorTier && (
                            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
                              {post.authorTier}
                            </span>
                          )}
                        </div>
                        {post.authorUsername && (
                          <span className="text-[11px] text-zinc-400">@{post.authorUsername}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      Cached
                    </span>
                  </div>

                  {/* Content */}
                  {post.content && (
                    <p className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">
                      {post.content}
                    </p>
                  )}

                  {/* Media Grid */}
                  {post.mediaUrls && post.mediaUrls.length > 0 && (
                    <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40 max-h-72">
                      <img
                        src={post.mediaUrls[0]}
                        alt="Post media"
                        className="w-full h-auto object-cover max-h-72"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* Footer Counters */}
                  <div className="flex items-center gap-4 pt-1 text-xs text-zinc-400 border-t border-white/5">
                    <div className="flex items-center gap-1">
                      <Heart size={13} className="text-rose-400" />
                      <span>{post.likesCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle size={13} className="text-cyan-400" />
                      <span>{post.commentsCount || 0}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 ml-auto font-mono">
                      {new Date(post.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* --- TAB 2: OFFLINE DRAFTS & NOTES --- */}
        {activeTab === 'drafts' && (
          <div className="max-w-lg mx-auto space-y-4">
            {/* Draft Composer */}
            <form 
              onSubmit={handleSaveDraft}
              className="p-4 rounded-2xl bg-[#121214] border border-white/10 shadow-lg space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <PenTool size={13} className="text-amber-400" />
                  Offline Composer
                </span>
                <div className="flex rounded-lg bg-black/40 p-0.5 border border-white/10">
                  <button
                    type="button"
                    onClick={() => setDraftType('post')}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                      draftType === 'post' ? 'bg-white/20 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Post Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftType('note')}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                      draftType === 'note' ? 'bg-white/20 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Quick Note
                  </button>
                </div>
              </div>

              <textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                placeholder={draftType === 'post' ? "Write a post to publish later..." : "Save a quick offline thought or note..."}
                rows={3}
                className="w-full bg-black/40 text-xs text-white placeholder-zinc-500 p-3 rounded-xl border border-white/10 focus:outline-none focus:border-amber-400/50 resize-none transition-colors"
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-zinc-500 font-mono">
                  {draftContent.length} chars
                </span>
                <button
                  type="submit"
                  disabled={!draftContent.trim() || savingDraft}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1.5"
                >
                  <Sparkles size={13} />
                  <span>Save to Local Vault</span>
                </button>
              </div>
            </form>

            {/* Saved Drafts List */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-zinc-400 px-1">Saved Vault Drafts</h3>

              {drafts.length === 0 ? (
                <div className="text-center py-10 px-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                  <FileText size={32} className="mx-auto text-zinc-600" />
                  <p className="text-xs text-zinc-400">No saved drafts yet.</p>
                </div>
              ) : (
                drafts.map((d) => (
                  <div
                    key={d.id}
                    className="p-3.5 rounded-xl bg-[#121214] border border-white/10 space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                        d.type === 'post' 
                          ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' 
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {d.type}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(d.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">
                      {d.content}
                    </p>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
                      <button
                        onClick={() => handleCopyDraft(d.id, d.content)}
                        className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-zinc-300 text-[11px] flex items-center gap-1 transition-colors"
                        title="Copy text"
                      >
                        {copiedId === d.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        <span>{copiedId === d.id ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteDraft(d.id)}
                        className="p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                        title="Delete draft"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* --- TAB 3: STORAGE ENGINE METRICS --- */}
        {activeTab === 'storage' && (
          <div className="max-w-lg mx-auto space-y-4">
            <div className="p-4 rounded-2xl bg-[#121214] border border-white/10 shadow-lg space-y-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <Database size={16} />
                <h3 className="text-xs font-bold tracking-wide uppercase text-white">
                  Local Database Telemetry
                </h3>
              </div>
              <p className="text-xs text-zinc-400">
                Aeirmist utilizes a high-performance local database engine inside the app's Capacitor Android WebView layer to ensure zero data loss during disconnection.
              </p>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Cached Posts</span>
                  <p className="text-xl font-black text-cyan-400 font-mono">{dbStats.postsCount}</p>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Saved Drafts</span>
                  <p className="text-xl font-black text-amber-400 font-mono">{dbStats.draftsCount}</p>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Cached Messages</span>
                  <p className="text-xl font-black text-purple-400 font-mono">{dbStats.messagesCount}</p>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Stored Media</span>
                  <p className="text-xl font-black text-emerald-400 font-mono">{dbStats.mediaCount}</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase font-bold">Active Engine</span>
                <p className="text-xs text-zinc-200 font-mono">{dbStats.engine}</p>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleClearCachedFeed}
                  className="w-full py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={13} />
                  <span>Clear Cached Feed Posts</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
