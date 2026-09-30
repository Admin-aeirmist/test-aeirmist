import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getAvatarUrl } from '../../lib/avatar';
import { 
  Search, 
  Mic, 
  Sparkles, 
  TrendingUp, 
  History, 
  Brain, 
  Command, 
  X,
  User,
  Zap,
  Music,
  Loader2,
  ChevronRight,
  AtSign,
  ShoppingBag,
  FileText,
  Layout,
  Tag,
  MapPin,
  Clock,
  MessageSquare,
  Target
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { EmptyState } from '../ui/EmptyState';
import { writingAssistant } from '../../services/WritingAssistantService';
import { logger } from '@/src/utils/logger';


interface SearchBarProps {
  onSearch: (query: string) => void;
  onFocusChange: (isFocused: boolean) => void;
  onUserClick?: (user: any) => void;
}

interface GlobalSearchResults {
  users: any[];
  posts: any[];
  stories: any[];
  notes: any[];
  products: any[];
  videos: any[];
  groups: any[];
  pages: any[];
  shops: any[];
  messages: any[];
}

const AI_SUGGESTIONS: any[] = [];

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onFocusChange, onUserClick }) => {
  const { 
    globalSearch, 
    recentSearches, 
    saveRecentSearch, 
    clearRecentSearches 
  } = useAeirmist();
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'all' | 'users' | 'posts' | 'stories' | 'notes' | 'products' | 'videos' | 'groups' | 'pages' | 'shops' | 'messages'>('all');
  const [searchResults, setSearchResults] = useState<GlobalSearchResults>({
    users: [],
    posts: [],
    stories: [],
    notes: [],
    products: [],
    videos: [],
    groups: [],
    pages: [],
    shops: [],
    messages: []
  });
  const [isSearching, setIsSearching] = useState(false);
  const [typoSuggestion, setTypoSuggestion] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRequestIdRef = useRef<number>(0);

  const placeholders = [
    "Search creators, reels, artifacts...",
    "Explore the Aeirmist Network...",
    "Query content & marketplace...",
    "Discover stories, shops & posts...",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isFocused && !query) {
        setPlaceholderIndex(prev => (prev + 1) % placeholders.length);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [isFocused, query]);

  useEffect(() => {
    onFocusChange(isFocused);
  }, [isFocused, onFocusChange]);

  useEffect(() => {
    const currentRequestId = ++activeRequestIdRef.current;
    const trimmed = query.trim();

    if (!trimmed) {
      setSearchResults({ 
        users: [], 
        posts: [], 
        stories: [], 
        notes: [], 
        products: [],
        videos: [], 
        groups: [], 
        pages: [], 
        shops: [], 
        messages: [] 
      });
      setTypoSuggestion(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const timer = setTimeout(async () => {
      if (currentRequestId !== activeRequestIdRef.current) return;
      try {
        const [results, typo] = await Promise.all([
          globalSearch(trimmed),
          trimmed.length > 2 ? writingAssistant.checkTypo(trimmed) : Promise.resolve(null)
        ]);

        if (currentRequestId !== activeRequestIdRef.current) return;

        setSearchResults(results || { 
          users: [], 
          posts: [], 
          stories: [], 
          notes: [], 
          products: [],
          videos: [], 
          groups: [], 
          pages: [], 
          shops: [], 
          messages: [] 
        });

        if (typo && typo.corrected && typo.corrected.toLowerCase() !== trimmed.toLowerCase()) {
          setTypoSuggestion(typo.corrected);
        } else {
          setTypoSuggestion(null);
        }
      } catch (e) {
        if (currentRequestId !== activeRequestIdRef.current) return;
        logger.error(e);
        setSearchResults({ 
          users: [], 
          posts: [], 
          stories: [], 
          notes: [], 
          products: [],
          videos: [], 
          groups: [], 
          pages: [], 
          shops: [], 
          messages: [] 
        });
        setTypoSuggestion(null);
      } finally {
        if (currentRequestId === activeRequestIdRef.current) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, globalSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      saveRecentSearch(query.trim());
      onSearch(query.trim());
    }
  };

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  const handleUserClick = (userData: any) => {
    setIsFocused(false);
    saveRecentSearch(userData.username);
    if (onUserClick) {
      onUserClick(userData);
    } else {
      onSearch(userData.username);
    }
  };

  const totalResultsCount = useMemo(() => {
    return Object.values(searchResults).reduce((acc, curr) => acc + (Array.isArray(curr) ? curr.length : 0), 0);
  }, [searchResults]);

  return (
    <div className={`relative z-50 mb-12 transition-all duration-500 ${isFocused ? 'scale-[1.02]' : ''}`}>
      {/* GLOWING BACKGROUND - Active state */}
      <AnimatePresence>
        {isFocused && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-aeirmist-bg/80 backdrop-blur-[100px] z-[-1]"
            onClick={() => setIsFocused(false)}
          />
        )}
      </AnimatePresence>

      <form 
        onSubmit={handleSearchSubmit}
        className={`relative glass-panel rounded-2xl border transition-all duration-500 flex items-center px-6 py-3.5 ${
        isFocused 
          ? 'border-aeirmist-cyan shadow-[0_0_40px_rgba(0,242,255,0.15)] bg-white dark:bg-black/60' 
          : 'bg-slate-100/90 dark:bg-black/40 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10'
      }`}>
        <Search className={`mr-4 transition-colors duration-500 ${isFocused ? 'text-aeirmist-cyan' : 'text-slate-400 dark:text-white/20'}`} size={18} />
        
        <input 
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder="Search creators, hashtags, artifacts..."
          className="flex-1 bg-transparent outline-none text-slate-900 dark:text-white text-sm font-medium placeholder:text-slate-400 dark:placeholder:text-white/20 tracking-tight"
        />

        <div className="flex items-center gap-4">
          {isSearching && <Loader2 size={16} className="text-aeirmist-cyan animate-spin" />}
          {query && (
            <button type="button" onClick={handleClear} className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/5 flex items-center justify-center text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white transition-all border border-slate-300 dark:border-white/5">
              <X size={14} />
            </button>
          )}
        </div>
      </form>

      {/* DROPDOWN SUGGESTIONS */}
      <AnimatePresence>
        {isFocused && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            className="absolute top-full left-0 right-0 mt-6 p-8 glass-panel rounded-[3.5rem] border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-black/90 backdrop-blur-3xl shadow-[0_50px_120px_rgba(0,0,0,0.12)] dark:shadow-[0_50px_120px_rgba(0,0,0,0.9)] overflow-y-auto max-h-[75vh] no-scrollbar active:scale-[0.99] transition-transform text-slate-900 dark:text-white"
          >
            {/* SEARCH TABS / PILLS */}
            {query.length > 0 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar mb-8 pb-2 border-b border-white/5">
                {[
                  { id: 'all', label: 'All', count: totalResultsCount },
                  { id: 'users', label: 'Users', count: searchResults.users.length, icon: <User size={12} /> },
                  { id: 'posts', label: 'Posts', count: searchResults.posts.length, icon: <Layout size={12} /> },
                  { id: 'videos', label: 'Videos', count: searchResults.videos.length, icon: <Zap size={12} /> },
                  { id: 'stories', label: 'Stories', count: searchResults.stories.length, icon: <History size={12} /> },
                  { id: 'products', label: 'Products', count: searchResults.products.length, icon: <ShoppingBag size={12} /> },
                  { id: 'shops', label: 'Shops', count: searchResults.shops.length, icon: <ShoppingBag size={12} /> },
                  { id: 'groups', label: 'Clusters', count: searchResults.groups.length, icon: <Target size={12} /> },
                  { id: 'pages', label: 'Pages', count: searchResults.pages.length, icon: <FileText size={12} /> },
                  { id: 'notes', label: 'Notes', count: searchResults.notes.length, icon: <FileText size={12} /> },
                  { id: 'messages', label: 'Messages', count: searchResults.messages.length, icon: <MessageSquare size={12} /> }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`whitespace-nowrap px-5 py-2 rounded-full border transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${
                      activeTab === tab.id 
                        ? 'bg-aeirmist-cyan text-black border-aeirmist-cyan shadow-[0_0_15px_rgba(0,242,255,0.3)]' 
                        : 'bg-white/[0.03] text-white/40 border-white/5 hover:border-white/20'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                    <span className={`ml-1 opacity-60 ${activeTab === tab.id ? 'text-black' : 'text-aeirmist-cyan'}`}>{tab.count}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Typo Correction Banner */}
            {query.length > 0 && typoSuggestion && (
              <div className="mb-6 p-3.5 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl flex items-center justify-between text-xs text-cyan-200 shadow-lg">
                <span className="flex items-center gap-2 font-mono">
                  <Sparkles size={14} className="text-cyan-400 shrink-0" />
                  Did you mean <strong className="text-white underline cursor-pointer hover:text-cyan-300 font-bold ml-1" onClick={() => setQuery(typoSuggestion)}>{typoSuggestion}</strong>?
                </span>
                <button
                  type="button"
                  onClick={() => setQuery(typoSuggestion)}
                  className="px-3.5 py-1.5 bg-cyan-400 text-black font-black uppercase text-[10px] tracking-wider rounded-xl transition cursor-pointer hover:bg-cyan-300 shrink-0"
                >
                  Search {typoSuggestion}
                </button>
              </div>
            )}

            {/* RESULTS RENDERING */}
            {query.length > 0 && (
              <div className="space-y-12">
                {/* 1. USERS */}
                {(activeTab === 'all' || activeTab === 'users') && searchResults.users.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-6 px-4">
                      <div className="flex items-center gap-3">
                        <User size={16} className="text-aeirmist-cyan" />
                        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/40">Identities Found</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(activeTab === 'all' ? searchResults.users.slice(0, 3) : searchResults.users).map((user, i) => (
                        <motion.button
                          key={user.id || i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          onClick={() => handleUserClick(user)}
                          className="w-full flex items-center justify-between p-5 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-aeirmist-cyan/30 hover:bg-white/[0.06] transition-all text-left group relative overflow-hidden"
                        >
                          <div className="flex items-center gap-5 relative z-10">
                            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 p-0.5 bg-gradient-to-tr from-white/10 to-transparent group-hover:from-aeirmist-cyan/40 transition-all">
                              <img src={getAvatarUrl(user.photoURL)} className="w-full h-full object-cover rounded-[calc(1rem-2px)]" alt="Profile" />
                            </div>
                            <div>
                              <div className="text-base font-bold text-white flex items-center gap-2">
                                {user.displayName}
                                {user.isVerified && (
                                  <div className="w-4 h-4 rounded-full bg-aeirmist-cyan/20 flex items-center justify-center">
                                    <Sparkles size={10} className="text-aeirmist-cyan" />
                                  </div>
                                )}
                              </div>
                              <div className="text-[10px] font-bold text-white/30 uppercase tracking-[0.25em] flex items-center mt-1">
                                <AtSign size={10} className="mr-1 text-aeirmist-magenta/40" /> {user.username}
                              </div>
                            </div>
                          </div>
                          <div className="relative z-10 opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0">
                            <ChevronRight size={20} className="text-aeirmist-cyan" />
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-r from-aeirmist-cyan/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. POSTS */}
                {(activeTab === 'all' || activeTab === 'posts') && searchResults.posts.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-6 px-4">
                      <div className="flex items-center gap-3">
                        <Layout size={16} className="text-aeirmist-magenta" />
                        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/40">Digital Assets</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(activeTab === 'all' ? searchResults.posts.slice(0, 3) : searchResults.posts).map((post, i) => (
                        <motion.button
                          key={post.id || i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="w-full flex items-center justify-between p-5 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-aeirmist-magenta/30 hover:bg-white/[0.06] transition-all text-left group relative overflow-hidden"
                        >
                          <div className="flex items-center gap-5 relative z-10">
                            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 bg-zinc-900 flex items-center justify-center">
                              {post.mediaUrls?.[0] ? (
                                <img src={post.mediaUrls[0]} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <Layout size={20} className="text-white/20" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-white truncate line-clamp-2 leading-relaxed">
                                {post.content}
                              </p>
                              <div className="flex items-center gap-3 mt-2">
                                {post.tags?.slice(0, 2).map((tag: string) => (
                                  <span key={tag} className="text-[9px] font-black text-aeirmist-cyan uppercase tracking-widest flex items-center gap-1">
                                    <Tag size={8} /> {tag}
                                  </span>
                                ))}
                                {post.location && (
                                  <span className="text-[9px] font-black text-aeirmist-magenta uppercase tracking-widest flex items-center gap-1">
                                    <MapPin size={8} /> {post.location}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. VIDEOS */}
                {(activeTab === 'all' || activeTab === 'videos') && searchResults.videos.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-6 px-4">
                      <div className="flex items-center gap-3">
                        <Zap size={16} className="text-aeirmist-cyan" />
                        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/40">Visual Frequency</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(activeTab === 'all' ? searchResults.videos.slice(0, 3) : searchResults.videos).map((video, i) => (
                        <motion.button
                          key={video.id || i}
                          className="w-full flex items-center justify-between p-5 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-aeirmist-cyan/30 hover:bg-white/[0.06] transition-all text-left group relative overflow-hidden"
                        >
                          <div className="flex items-center gap-5 relative z-10">
                            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 bg-zinc-900">
                              <img src={video.thumbnailURL} className="w-full h-full object-cover" alt="" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white line-clamp-1">{video.caption}</p>
                              <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mt-1">
                                {video.views?.toLocaleString() || 0} Synapses
                              </p>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. STORIES */}
                {(activeTab === 'all' || activeTab === 'stories') && searchResults.stories.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-6 px-4">
                      <div className="flex items-center gap-3">
                        <History size={16} className="text-aeirmist-lime" />
                        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/40">Active Memories</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(activeTab === 'all' ? searchResults.stories.slice(0, 3) : searchResults.stories).map((story, i) => (
                        <motion.button
                          key={story.id || i}
                          className="w-full flex items-center justify-between p-5 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-aeirmist-lime/30 hover:bg-white/[0.06] transition-all text-left group relative overflow-hidden"
                        >
                          <div className="flex items-center gap-5 relative z-10">
                            <div className="w-14 h-14 rounded-full p-0.5 border-2 border-aeirmist-lime bg-black overflow-hidden">
                              <img src={story.mediaUrl || story.thumbnailUrl} className="w-full h-full object-cover rounded-full" alt="" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white line-clamp-1">{story.content || "Digital Flash"}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] font-black text-white/30 uppercase tracking-widest flex items-center gap-1">
                                  <Clock size={8} /> {story.createdAt ? new Date(story.createdAt).toLocaleDateString() : 'Active'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. PRODUCTS */}
                {(activeTab === 'all' || activeTab === 'products') && searchResults.products.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-6 px-4">
                      <div className="flex items-center gap-3">
                        <ShoppingBag size={16} className="text-aeirmist-cyan" />
                        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/40">Node Inventory</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(activeTab === 'all' ? searchResults.products.slice(0, 3) : searchResults.products).map((product, i) => (
                        <motion.button
                          key={product.id || i}
                          className="w-full flex items-center justify-between p-5 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-aeirmist-cyan/30 hover:bg-white/[0.06] transition-all text-left group relative overflow-hidden"
                        >
                          <div className="flex items-center gap-5 relative z-10">
                            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10">
                              <img src={product.mediaItems?.[0]?.url} className="w-full h-full object-cover" alt="" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white line-clamp-1">{product.name}</p>
                              <p className="text-xs font-black text-aeirmist-cyan mt-1">৳{product.price.toLocaleString()}</p>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. SHOPS */}
                {(activeTab === 'all' || activeTab === 'shops') && searchResults.shops.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-6 px-4">
                      <div className="flex items-center gap-3">
                        <ShoppingBag size={16} className="text-aeirmist-magenta" />
                        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/40">Merchant Nodes</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(activeTab === 'all' ? searchResults.shops.slice(0, 3) : searchResults.shops).map((shop, i) => (
                        <motion.button
                          key={shop.id || i}
                          className="w-full flex items-center justify-between p-5 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-aeirmist-magenta/30 hover:bg-white/[0.06] transition-all text-left group relative overflow-hidden"
                        >
                          <div className="flex items-center gap-5 relative z-10">
                            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 bg-zinc-900">
                              <img src={shop.logoUrl || shop.bannerUrl} className="w-full h-full object-cover" alt="" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white line-clamp-1">{shop.name}</p>
                              <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mt-1">{shop.category}</p>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 7. GROUPS / CLUSTERS */}
                {(activeTab === 'all' || activeTab === 'groups') && searchResults.groups.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-6 px-4">
                      <div className="flex items-center gap-3">
                        <Target size={16} className="text-aeirmist-lime" />
                        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/40">Active Clusters</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(activeTab === 'all' ? searchResults.groups.slice(0, 3) : searchResults.groups).map((group, i) => (
                        <motion.button
                          key={group.id || i}
                          className="w-full flex items-center justify-between p-5 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-aeirmist-lime/30 hover:bg-white/[0.06] transition-all text-left group relative overflow-hidden"
                        >
                          <div className="flex items-center gap-5 relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-aeirmist-lime/10 flex items-center justify-center border border-aeirmist-lime/20">
                              <Target size={20} className="text-aeirmist-lime" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white line-clamp-1">{group.name}</p>
                              <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mt-1">{group.members?.length || 0} Members</p>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 8. PAGES */}
                {(activeTab === 'all' || activeTab === 'pages') && searchResults.pages.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-6 px-4">
                      <div className="flex items-center gap-3">
                        <FileText size={16} className="text-aeirmist-cyan" />
                        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/40">Verified Pages</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(activeTab === 'all' ? searchResults.pages.slice(0, 3) : searchResults.pages).map((page, i) => (
                        <motion.button
                          key={page.id || i}
                          className="w-full flex items-center justify-between p-5 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-aeirmist-cyan/30 hover:bg-white/[0.06] transition-all text-left group relative overflow-hidden"
                        >
                          <div className="flex items-center gap-5 relative z-10">
                            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 bg-zinc-900">
                              <img src={page.photoURL || page.bannerURL} className="w-full h-full object-cover" alt="" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white line-clamp-1">{page.name}</p>
                              <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mt-1">{page.category}</p>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 9. NOTES */}
                {(activeTab === 'all' || activeTab === 'notes') && searchResults.notes.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-6 px-4">
                      <div className="flex items-center gap-3">
                        <FileText size={16} className="text-amber-400" />
                        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/40">Public Thought Streams</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(activeTab === 'all' ? searchResults.notes.slice(0, 3) : searchResults.notes).map((note, i) => (
                        <motion.button
                          key={note.id || i}
                          className="w-full flex items-center justify-between p-5 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-amber-400/30 hover:bg-white/[0.06] transition-all text-left group relative overflow-hidden"
                        >
                          <div className="flex items-center gap-5 relative z-10 min-w-0 flex-1">
                            <div className="w-12 h-12 rounded-xl bg-amber-400/10 flex items-center justify-center shrink-0">
                              <FileText size={18} className="text-amber-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white line-clamp-2 leading-relaxed">{note.content}</p>
                              <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mt-2">
                                {note.category || 'Thought'} Node
                              </p>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 10. MESSAGES */}
                {(activeTab === 'all' || activeTab === 'messages') && searchResults.messages.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-6 px-4">
                      <div className="flex items-center gap-3">
                        <MessageSquare size={16} className="text-aeirmist-magenta" />
                        <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/40">Secure Conversations</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(activeTab === 'all' ? searchResults.messages.slice(0, 3) : searchResults.messages).map((msg, i) => (
                        <motion.button
                          key={msg.id || i}
                          className="w-full flex items-center justify-between p-5 rounded-3xl bg-white/[0.03] border border-white/5 hover:border-aeirmist-magenta/30 hover:bg-white/[0.06] transition-all text-left group relative overflow-hidden"
                        >
                          <div className="flex items-center gap-5 relative z-10 min-w-0 flex-1">
                            <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 bg-zinc-900 shrink-0">
                              <img src={msg.otherParticipantAvatar} className="w-full h-full object-cover" alt="" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white truncate">{msg.otherParticipantName}</p>
                              <p className="text-[10px] text-white/40 line-clamp-1 mt-1 font-medium">{msg.lastMessage}</p>
                              <p className="text-[8px] font-black text-aeirmist-magenta uppercase tracking-widest mt-2">
                                Last Sync: {msg.updatedAt ? new Date(msg.updatedAt.seconds * 1000).toLocaleDateString() : 'Recent'}
                              </p>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State for specific tabs */}
                {activeTab !== 'all' && searchResults[activeTab].length === 0 && !isSearching && (
                  <div className="p-12 text-center glass-panel rounded-[2rem] border-white/5 bg-white/[0.01]">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-6">
                       <Zap size={24} className="text-white/10" />
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/20 italic">No {activeTab} detected in this frequency.</p>
                  </div>
                )}

                {/* Global Empty State */}
                {activeTab === 'all' && Object.values(searchResults).every(arr => arr.length === 0) && !isSearching && (
                  <EmptyState 
                    icon={<Search size={24} />}
                    title="No results found"
                    description="No results found. Try adjusting your search."
                  />
                )}
              </div>
            )}

            {/* AI SUGGESTION BLOCK */}
            {!query && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4 px-2">
                  <Sparkles size={14} className="text-aeirmist-magenta animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Digital Insight</span>
                </div>
                <div className="space-y-2">
                  {AI_SUGGESTIONS.map((s, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ x: 10, scale: 1.01, backgroundColor: 'rgba(255,255,255,0.05)' }}
                      onClick={() => setQuery(s.text.replace('Ask Aeirmist: ', ''))}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 transition-all text-left group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center border border-white/5 group-hover:border-white/20 transition-all">
                        {s.icon}
                      </div>
                      <span className="text-sm font-bold text-white/80 group-hover:text-white transition-colors">{s.text}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
            
            {/* RECENT SEARCHES */}
            {recentSearches.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center justify-between mb-4 px-2">
                  <div className="flex items-center gap-2">
                    <History size={14} className="text-white/20" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Recent Uplinks</span>
                  </div>
                  <button 
                    onClick={clearRecentSearches}
                    className="text-[10px] font-black text-aeirmist-magenta uppercase tracking-widest hover:underline"
                  >
                    Clear All
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {recentSearches.map((s: any, i) => (
                    <button 
                      key={i} 
                      onClick={() => setQuery(typeof s === 'string' ? s : (s?.name || s?.displayName || s?.username || ''))}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/20 text-white/60 hover:text-white transition-all text-sm font-medium"
                    >
                      {typeof s === 'string' ? s : (s?.name || s?.displayName || s?.username || s?.id || '')}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
