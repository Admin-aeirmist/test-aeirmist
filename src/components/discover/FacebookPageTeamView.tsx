import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Briefcase, 
  Globe, 
  Share2, 
  Plus, 
  ChevronDown, 
  Search, 
  MoreHorizontal, 
  Send, 
  MessageCircle, 
  ThumbsUp, 
  CheckCircle2, 
  ArrowLeft,
  Camera,
  Star,
  ExternalLink,
  Mail,
  Award,
  Layers,
  Sparkles
} from 'lucide-react';
import { api } from '../../services/api/client';
import { useAeirmist } from '../../context/AeirmistContext';
import { ActiveIdentity } from './FacebookProfileSwitcherModal';

interface FacebookPageTeamViewProps {
  entity: any;
  currentUser: any;
  activeIdentity: ActiveIdentity;
  onBack?: () => void;
  onOpenApplyModal?: (entity: any) => void;
  onOpenProfileSwitcher?: () => void;
  onRefreshEntity?: () => void;
}

export const FacebookPageTeamView: React.FC<FacebookPageTeamViewProps> = ({
  entity,
  currentUser,
  activeIdentity,
  onBack,
  onOpenApplyModal,
  onOpenProfileSwitcher,
  onRefreshEntity,
}) => {
  const { addToast } = useAeirmist();
  const [activeTab, setActiveTab] = useState<'posts' | 'about' | 'roles' | 'team' | 'reviews'>('posts');
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [postSubmitting, setPostSubmitting] = useState(false);
  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null);
  const [postComments, setPostComments] = useState<{ [postId: string]: any[] }>({});
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});

  const [isFollowing, setIsFollowing] = useState(entity.isMember || false);
  const isTeam = entity.type === 'team';

  // Fetch Page/Team posts
  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoadingPosts(true);
      try {
        const res = await api.bonds.getPosts(entity.id);
        if (res && res.posts) {
          setPosts(res.posts.filter((p: any) => !String(p.id).startsWith('seed-')));
        } else {
          setPosts([]);
        }
      } catch (err) {
        setPosts([]);
      } finally {
        setIsLoadingPosts(false);
      }
    };
    fetchPosts();
  }, [entity.id]);

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return;
    setPostSubmitting(true);
    try {
      const res = await api.bonds.createPost(entity.id, {
        content: newPostContent.trim(),
        asEntity: true,
      });

      if (res?.post) {
        setPosts(prev => [res.post, ...prev]);
      } else {
        const local = {
          id: `page-post-${Date.now()}`,
          entityId: entity.id,
          authorName: entity.name,
          authorAvatarUrl: entity.logoUrl,
          authorRole: 'admin',
          content: newPostContent,
          likesCount: 0,
          commentsCount: 0,
          createdAt: new Date().toISOString(),
          hasLiked: false,
        };
        setPosts(prev => [local, ...prev]);
      }
      setNewPostContent('');
    } catch (err: any) {
      console.error('[Page Post Error]', err);
    } finally {
      setPostSubmitting(false);
    }
  };

  const handleToggleLike = async (postId: string) => {
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const nextLiked = !p.hasLiked;
        return {
          ...p,
          hasLiked: nextLiked,
          likesCount: nextLiked ? (p.likesCount || 0) + 1 : Math.max(0, (p.likesCount || 0) - 1),
        };
      }
      return p;
    }));
    try {
      await api.bonds.togglePostLike(postId);
    } catch {}
  };

  const handleAddComment = async (postId: string) => {
    const text = (commentInputs[postId] || '').trim();
    if (!text) return;
    try {
      const res = await api.bonds.createPostComment(postId, text);
      const newComment = res?.comment || {
        id: `comm-${Date.now()}`,
        authorName: activeIdentity.type !== 'user' ? activeIdentity.name : currentUser.name,
        authorAvatarUrl: activeIdentity.avatarUrl || currentUser.avatarUrl,
        authorRole: 'member',
        content: text,
        createdAt: new Date().toISOString(),
      };
      setPostComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), newComment] }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p));
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    } catch (err) {}
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-[#18191a] text-[#e4e6eb] select-none">
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
        <div className="max-w-5xl mx-auto">
          {/* Top Banner Cover */}
          <div className="relative w-full aspect-[21/9] sm:aspect-[24/9] bg-[#242526] overflow-hidden rounded-b-2xl shadow-xl">
            <img
              src={entity.coverUrl || 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1400&q=80'}
              alt={entity.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            
            {onBack && (
              <button 
                onClick={onBack}
                className="absolute top-4 left-4 py-2 px-3.5 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer shadow-lg"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Bonds</span>
              </button>
            )}
          </div>

          {/* Facebook Page Profile & Meta Header */}
          <div className="px-4 sm:px-8 pb-3 border-b border-[#393a3b] -mt-16 sm:-mt-20 relative z-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                {/* Overlapping Page Logo with Blue Ring */}
                <div className="relative">
                  <img
                    src={entity.logoUrl || entity.coverUrl || 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=200&q=80'}
                    alt={entity.name}
                    className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl object-cover ring-4 ring-[#18191a] shadow-2xl bg-[#242526]"
                  />
                  <div className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-blue-500 border-2 border-[#18191a] flex items-center justify-center text-white" title="Verified Bond">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>

                <div className="pb-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
                    {entity.name}
                  </h1>
                  <p className="text-sm text-[#b0b3b8] font-medium mt-0.5 flex items-center gap-2">
                    <span className="text-cyan-400 font-bold">{entity.category}</span> · 
                    <span>{entity.memberCount || 16} {isTeam ? 'team members' : 'followers'}</span>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 pb-2">
                {isTeam ? (
                  <button
                    onClick={() => onOpenApplyModal && onOpenApplyModal(entity)}
                    className="py-2.5 px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-black text-sm flex items-center gap-2 shadow-[0_0_20px_rgba(0,242,255,0.4)] active:scale-95 transition-all cursor-pointer"
                  >
                    <Briefcase className="w-4 h-4 stroke-[2.5]" />
                    <span>Apply for Role</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsFollowing(!isFollowing)}
                    className={`py-2.5 px-5 rounded-xl font-bold text-sm flex items-center gap-2 active:scale-95 transition-all cursor-pointer ${
                      isFollowing 
                        ? 'bg-[#3a3b3c] hover:bg-[#4e4f50] text-[#e4e6eb]' 
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isFollowing ? 'Following' : 'Follow Page'}</span>
                  </button>
                )}

                <button 
                  onClick={() => {
                    const canonical = entity.canonicalUrl || `/bonds/teams/${entity.slug || entity.id}`;
                    window.dispatchEvent(new CustomEvent('aeirmist-open-chat', {
                      detail: {
                        conversationId: entity.conversationId || entity.id,
                        name: entity.name,
                        entity,
                        type: 'bond_entity'
                      }
                    }));
                    addToast({
                      title: 'OPENING CHAT',
                      message: `Connecting to ${entity.name}...`,
                      type: 'info'
                    });
                  }}
                  className="py-2.5 px-4 rounded-xl bg-[#3a3b3c] hover:bg-[#4e4f50] text-[#e4e6eb] font-semibold text-sm flex items-center gap-2 active:scale-95 transition-all cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Message</span>
                </button>

                <button 
                  onClick={() => {
                    const canonical = entity.canonicalUrl || `/bonds/${entity.type === 'team' ? 'teams' : 'pages'}/${entity.slug || entity.id}`;
                    navigator.clipboard.writeText(`${window.location.origin}${canonical}`);
                    addToast({
                      title: 'LINK COPIED',
                      message: `${entity.name} link copied to clipboard.`,
                      type: 'success'
                    });
                  }}
                  className="p-2.5 rounded-xl bg-[#3a3b3c] hover:bg-[#4e4f50] text-[#e4e6eb] active:scale-95 transition-all cursor-pointer"
                  title="Share link"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 mt-6 overflow-x-auto scrollbar-none">
              {(['posts', 'about', ...(isTeam ? ['roles', 'team'] : []), 'reviews'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-4 py-3 font-bold text-sm capitalize relative transition-colors cursor-pointer ${
                    activeTab === tab ? 'text-blue-400' : 'text-[#b0b3b8] hover:text-[#e4e6eb]'
                  }`}
                >
                  {tab === 'roles' ? 'Open Positions' : tab}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-t-full shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Body Content */}
          <div className="p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (Posts or Open Roles) */}
            <div className="lg:col-span-7 space-y-4">
              {/* If Team Roles Tab is active OR for general feed */}
              {activeTab === 'roles' && isTeam ? (
                <div className="space-y-3">
                  <h3 className="font-bold text-base text-white">Active Recruitment Openings</h3>
                  {(entity.settings?.openRoles || [
                    { title: 'Core Distributed Systems Lead', skills: ['Rust', 'Redis', 'PostgreSQL', 'WebSockets'] },
                    { title: 'Machine Learning Infrastructure Engineer', skills: ['Python', 'Torch', 'FastAPI'] },
                    { title: 'UI/UX Interactive Spatial Engineer', skills: ['React 19', 'Tailwind', 'Motion'] }
                  ]).map((role: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-xl bg-[#242526] border border-[#393a3b] space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-cyan-400">{role.title}</h4>
                        <button
                          onClick={() => onOpenApplyModal && onOpenApplyModal(entity)}
                          className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-400 text-xs font-bold cursor-pointer transition-all"
                        >
                          Apply
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {role.skills?.map((sk: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-neutral-300 font-mono">
                            {sk}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* Page Post Composer */}
                  <div className="bg-[#242526] rounded-xl p-3.5 border border-[#393a3b] space-y-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <img
                        src={entity.logoUrl || activeIdentity.avatarUrl || currentUser.avatarUrl}
                        alt="Author"
                        className="w-10 h-10 rounded-xl object-cover"
                      />
                      <input
                        type="text"
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreatePost();
                        }}
                        placeholder={`Post an update as ${entity.name}...`}
                        className="flex-1 bg-[#3a3b3c] hover:bg-[#4e4f50] text-xs text-white placeholder-[#b0b3b8] px-4 py-2.5 rounded-full border border-transparent outline-none"
                      />
                      <button
                        onClick={handleCreatePost}
                        disabled={postSubmitting || !newPostContent.trim()}
                        className="py-2 px-4 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs cursor-pointer"
                      >
                        Publish
                      </button>
                    </div>
                  </div>

                  {/* Feed Posts */}
                  <div className="space-y-4">
                    {posts.map((post) => (
                      <div key={post.id} className="bg-[#242526] rounded-xl border border-[#393a3b] shadow-sm overflow-hidden">
                        <div className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <img
                              src={post.authorAvatarUrl || entity.logoUrl}
                              alt={post.authorName}
                              className="w-10 h-10 rounded-xl object-cover"
                            />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-sm text-white hover:underline cursor-pointer">
                                  {post.authorName}
                                </span>
                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                              </div>
                              <span className="text-xs text-[#b0b3b8]">2 hrs ago</span>
                            </div>
                          </div>
                        </div>

                        <div className="px-4 pb-3 text-sm text-[#e4e6eb] leading-relaxed">
                          {post.content}
                        </div>

                        <div className="px-4 py-2 flex items-center justify-between text-xs text-[#b0b3b8] border-b border-[#393a3b]">
                          <span>👍 {post.likesCount || 0}</span>
                          <span>{post.commentsCount || 0} comments</span>
                        </div>

                        <div className="grid grid-cols-2 gap-1 p-1 text-xs font-semibold text-[#b0b3b8]">
                          <button
                            onClick={() => handleToggleLike(post.id)}
                            className={`py-2 rounded-lg hover:bg-[#3a3b3c] flex items-center justify-center gap-2 cursor-pointer ${
                              post.hasLiked ? 'text-blue-400 font-bold' : ''
                            }`}
                          >
                            <ThumbsUp className="w-4 h-4" />
                            <span>Like</span>
                          </button>
                          <button
                            onClick={() => setOpenCommentsPostId(openCommentsPostId === post.id ? null : post.id)}
                            className="py-2 rounded-lg hover:bg-[#3a3b3c] flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <MessageCircle className="w-4 h-4" />
                            <span>Comment</span>
                          </button>
                        </div>

                        {openCommentsPostId === post.id && (
                          <div className="p-4 border-t border-[#393a3b] bg-[#1c1d1e] space-y-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={commentInputs[post.id] || ''}
                                onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAddComment(post.id);
                                }}
                                placeholder="Comment on this post..."
                                className="flex-1 bg-[#242526] text-xs text-white placeholder-[#b0b3b8] py-2 px-3 rounded-full border border-[#393a3b] outline-none"
                              />
                              <button
                                onClick={() => handleAddComment(post.id)}
                                className="text-blue-400 hover:text-blue-300 p-1 cursor-pointer"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Right Column: Page / Team Details */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-[#242526] rounded-xl p-4 border border-[#393a3b] space-y-4 shadow-sm">
                <h3 className="text-base font-bold text-white">About {isTeam ? 'Team' : 'Page'}</h3>
                <p className="text-xs text-[#b0b3b8] leading-relaxed">
                  {entity.description}
                </p>

                <div className="h-px bg-[#393a3b]" />

                <div className="space-y-3 text-xs text-[#b0b3b8]">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-white" />
                    <span>Public {isTeam ? 'Engineering Team' : 'Community Page'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-white" />
                    <span>{entity.memberCount || 16} active builders & contributors</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-white" />
                    <span>Category: <strong className="text-white">{entity.category}</strong></span>
                  </div>
                </div>

                {isTeam && (
                  <>
                    <div className="h-px bg-[#393a3b]" />
                    <div>
                      <h4 className="text-xs font-bold text-[#b0b3b8] uppercase tracking-wider mb-2">Development Stage</h4>
                      <span className="px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-bold text-xs">
                        {entity.settings?.stage || 'Active Alpha'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
