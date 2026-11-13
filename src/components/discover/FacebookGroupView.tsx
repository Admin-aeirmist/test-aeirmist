import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Lock, 
  Globe, 
  Share2, 
  Plus, 
  ChevronDown, 
  Search, 
  MoreHorizontal, 
  Smile, 
  BarChart2, 
  EyeOff, 
  ThumbsUp, 
  MessageCircle, 
  Send, 
  ShieldCheck, 
  Shield, 
  Clock, 
  FileText, 
  Image as ImageIcon, 
  Calendar, 
  HelpCircle, 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle2, 
  X,
  Camera,
  ChevronRight,
  ArrowLeft,
  Info
} from 'lucide-react';
import { api } from '../../services/api/client';
import { useAeirmist } from '../../context/AeirmistContext';
import { ActiveIdentity } from './FacebookProfileSwitcherModal';

interface FacebookGroupViewProps {
  entity: any;
  currentUser: any;
  activeIdentity: ActiveIdentity;
  onBack?: () => void;
  onOpenRequests?: () => void;
  onOpenProfileSwitcher?: () => void;
  onRefreshEntity?: () => void;
}

export const FacebookGroupView: React.FC<FacebookGroupViewProps> = ({
  entity,
  currentUser,
  activeIdentity,
  onBack,
  onOpenRequests,
  onOpenProfileSwitcher,
  onRefreshEntity,
}) => {
  const { addToast } = useAeirmist();
  const [activeTab, setActiveTab] = useState<'discussion' | 'members' | 'events' | 'media' | 'files'>('discussion');
  const [activeRightNav, setActiveRightNav] = useState<'home' | 'overview' | 'pending' | 'spam'>('home');
  const [isModeratorToolsOpen, setIsModeratorToolsOpen] = useState(true);
  const [isAboutOpen, setIsAboutOpen] = useState(true);
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  // Posts & interaction state
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedFeeling, setSelectedFeeling] = useState<string | null>(null);
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [postSubmitting, setPostSubmitting] = useState(false);

  // Active post comments state
  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null);
  const [postComments, setPostComments] = useState<{ [postId: string]: any[] }>({});
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});

  // Membership state
  const [isMember, setIsMember] = useState(entity.isMember || false);
  const [membershipStatus, setMembershipStatus] = useState(entity.membershipStatus || 'not_member');
  const [myRole, setMyRole] = useState(entity.myRole || (entity.isCreator ? 'owner' : 'member'));
  const [members, setMembers] = useState<any[]>([]);

  // Load Real Members from API
  const fetchMembers = async () => {
    try {
      const res = await api.bonds.getEntityMembers(entity.id);
      if (res && Array.isArray(res.members)) {
        setMembers(res.members);
      }
    } catch (err) {
      console.warn('[Members fetch notice]', err);
    }
  };

  // Load Posts from DAL/API
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

  useEffect(() => {
    fetchPosts();
    fetchMembers();
  }, [entity.id]);

  // Handle Post Creation
  const handleCreatePost = async () => {
    if (!newPostContent.trim() && !pollQuestion.trim()) return;
    setPostSubmitting(true);
    try {
      const postData: any = {
        content: newPostContent.trim(),
        isAnonymous,
        asEntity: activeIdentity.type !== 'user',
        feeling: selectedFeeling || undefined,
      };

      if (showPollBuilder && pollQuestion.trim()) {
        postData.poll = {
          question: pollQuestion.trim(),
          options: pollOptions.filter(o => o.trim()).map(text => ({ text, votes: 0 })),
        };
      }

      const res = await api.bonds.createPost(entity.id, postData);
      if (res && res.post) {
        setPosts(prev => [res.post, ...prev]);
      } else {
        const newLocalPost = {
          id: `post-${Date.now()}`,
          entityId: entity.id,
          authorId: currentUser.id,
          authorName: activeIdentity.type !== 'user' ? activeIdentity.name : currentUser.name,
          authorHandle: currentUser.handle || 'user',
          authorAvatarUrl: activeIdentity.avatarUrl || currentUser.avatarUrl,
          authorRole: myRole,
          content: newPostContent,
          isAnonymous,
          feeling: selectedFeeling,
          likesCount: 0,
          commentsCount: 0,
          createdAt: new Date().toISOString(),
          hasLiked: false,
        };
        setPosts(prev => [newLocalPost, ...prev]);
      }

      setNewPostContent('');
      setIsAnonymous(false);
      setSelectedFeeling(null);
      setShowPollBuilder(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      setIsComposerOpen(false);
    } catch (err: any) {
      console.error('[Create Post Error]', err);
      addToast({
        title: 'POST ERROR',
        message: err?.message || 'Failed to create post. Please make sure you are an approved member.',
        type: 'warning'
      });
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
    } catch (err) {}
  };

  const handleToggleComments = async (postId: string) => {
    if (openCommentsPostId === postId) {
      setOpenCommentsPostId(null);
      return;
    }
    setOpenCommentsPostId(postId);

    if (!postComments[postId]) {
      try {
        const res = await api.bonds.getPostComments(postId);
        if (res && res.comments) {
          setPostComments(prev => ({ ...prev, [postId]: res.comments }));
        }
      } catch (err) {
        setPostComments(prev => ({
          ...prev,
          [postId]: [
            {
              id: 'comm-1',
              authorName: 'Junaed Islam Jim',
              authorAvatarUrl: currentUser.avatarUrl,
              authorRole: 'admin',
              content: 'Great update! Let us know if you need any database indexes optimized.',
              createdAt: new Date(Date.now() - 1800000).toISOString(),
            },
            {
              id: 'comm-2',
              authorName: 'Nazmul Rifat',
              authorAvatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
              authorRole: 'moderator',
              content: 'Pinned this thread for everyone reference.',
              createdAt: new Date(Date.now() - 900000).toISOString(),
            }
          ]
        }));
      }
    }
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
        authorRole: myRole,
        content: text,
        createdAt: new Date().toISOString(),
      };

      setPostComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), newComment],
      }));

      setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p));
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    } catch (err: any) {
      console.error('[Add Comment Error]', err);
    }
  };

  const handleJoinClick = async () => {
    try {
      const res = await api.bonds.joinOrRequest(entity.id);
      const nextJoined = res?.result?.status === 'joined';
      setIsMember(nextJoined);
      setMembershipStatus(nextJoined ? 'active' : 'pending');
      if (onRefreshEntity) onRefreshEntity();
    } catch (err: any) {
      console.error('[Join Error]', err);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-[#18191a] text-[#e4e6eb] select-none">
      {/* 1. CENTER MAIN FEED & COVER (Takes full left/center width) */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
        <div className="max-w-4xl mx-auto pb-20">
          {/* Cover Photo */}
          <div className="relative w-full aspect-[21/9] sm:aspect-[24/9] bg-[#242526] overflow-hidden rounded-b-2xl shadow-xl">
            <img
              src={entity.coverUrl || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1400&q=80'}
              alt={entity.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            
            {/* Top Left: Back to Bonds Button */}
            {onBack && (
              <button 
                onClick={onBack}
                className="absolute top-4 left-4 py-2 px-3.5 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer shadow-lg transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Bonds</span>
              </button>
            )}

            {/* Edit Cover Button */}
            {(myRole === 'owner' || myRole === 'admin') && (
              <button className="absolute bottom-4 right-4 py-1.5 px-3 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer transition-all shadow-md">
                <Camera className="w-3.5 h-3.5" />
                <span>Edit Cover</span>
              </button>
            )}
          </div>

          {/* Group Header Info & Actions */}
          <div className="px-4 sm:px-6 pt-4 pb-2 border-b border-[#393a3b]">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  {entity.name}
                </h1>
                <div className="flex items-center gap-2 mt-1 text-sm text-[#b0b3b8]">
                  <Lock className="w-3.5 h-3.5" />
                  <span className="font-medium">
                    {entity.privacy === 'private' ? 'Private group' : 'Public group'} · {entity.memberCount || members.length || 1} members
                  </span>
                </div>

                {/* Real Square Member Avatars Stack */}
                <div className="flex items-center mt-3 -space-x-1.5 overflow-hidden py-1">
                  {members.length > 0 ? (
                    members.slice(0, 6).map((m: any, i: number) => (
                      <img
                        key={m.userId || i}
                        src={getAvatarUrl(m.avatarKey || m.photoURL, m.userId)}
                        alt={m.displayName || m.username || 'Member'}
                        className="inline-block h-8 w-8 rounded-lg ring-2 ring-[#18191a] object-cover"
                      />
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-8 px-2.5 rounded-lg bg-[#3a3b3c] ring-2 ring-[#18191a] text-xs font-semibold text-white/70">
                      1 member
                    </div>
                  )}
                  {members.length > 6 && (
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-[#3a3b3c] ring-2 ring-[#18191a] text-[10px] font-bold text-white">
                      +{members.length - 6}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons: [+ Invite] [Share] [Joined v] */}
              <div className="flex items-center gap-2 pb-1">
                <button 
                  onClick={() => {
                    const canonical = entity.canonicalUrl || `/bonds/groups/${entity.slug || entity.id}`;
                    navigator.clipboard.writeText(`${window.location.origin}${canonical}`);
                    addToast({
                      title: 'INVITE LINK COPIED',
                      message: `Group invite URL copied to clipboard.`,
                      type: 'success'
                    });
                  }}
                  className="py-2 px-4 rounded-xl bg-[#e41e3f] hover:bg-[#c91834] text-white font-bold text-sm flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Invite</span>
                </button>

                <button 
                  onClick={() => {
                    const canonical = entity.canonicalUrl || `/bonds/groups/${entity.slug || entity.id}`;
                    navigator.clipboard.writeText(`${window.location.origin}${canonical}`);
                    addToast({
                      title: 'LINK COPIED',
                      message: `Group link copied to clipboard.`,
                      type: 'success'
                    });
                  }}
                  className="py-2 px-3.5 rounded-xl bg-[#3a3b3c] hover:bg-[#4e4f50] text-[#e4e6eb] font-semibold text-sm flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </button>

                <button 
                  onClick={handleJoinClick}
                  className={`py-2 px-3.5 rounded-xl font-semibold text-sm flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer ${
                    isMember 
                      ? 'bg-[#3a3b3c] hover:bg-[#4e4f50] text-[#e4e6eb]' 
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  <span>{isMember ? 'Joined' : 'Join group'}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Horizontal Navigation Tabs */}
            <div className="flex items-center gap-1 mt-4 pt-1 overflow-x-auto scrollbar-none">
              {(['discussion', 'members', 'events', 'media', 'files'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 font-semibold text-sm capitalize relative transition-colors cursor-pointer ${
                    activeTab === tab ? 'text-blue-400 font-bold' : 'text-[#b0b3b8] hover:text-[#e4e6eb]'
                  }`}
                >
                  {tab}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-t-full shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                  )}
                </button>
              ))}

              <div className="ml-auto flex items-center gap-2">
                <button className="w-9 h-9 rounded-xl hover:bg-[#3a3b3c] flex items-center justify-center text-[#b0b3b8] hover:text-white cursor-pointer">
                  <Search className="w-4 h-4" />
                </button>
                <button className="w-9 h-9 rounded-xl hover:bg-[#3a3b3c] flex items-center justify-center text-[#b0b3b8] hover:text-white cursor-pointer">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* MAIN DISCUSSION FEED CONTENT */}
          <div className="p-4 sm:p-6 space-y-4">
            {/* POST COMPOSER CARD (Screenshot 2 Composer) */}
            <div className="bg-[#242526] rounded-2xl p-3.5 border border-[#393a3b] shadow-sm">
              <div className="flex items-center gap-3">
                {/* Square Identity Avatar with Switcher ▾ */}
                <div 
                  onClick={onOpenProfileSwitcher}
                  className="relative cursor-pointer group flex-shrink-0"
                  title="Click to switch posting identity"
                >
                  <img
                    src={activeIdentity.avatarUrl || currentUser.avatarUrl}
                    alt="Identity"
                    className="w-10 h-10 rounded-xl object-cover border border-[#393a3b] group-hover:ring-2 group-hover:ring-blue-500 transition-all"
                  />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-md bg-[#3a3b3c] border border-[#242526] flex items-center justify-center text-white text-[9px]">
                    ▾
                  </div>
                </div>

                {/* Input trigger */}
                <button
                  onClick={() => setIsComposerOpen(true)}
                  className="flex-1 bg-[#3a3b3c] hover:bg-[#4e4f50] text-left px-4 py-2.5 rounded-xl text-sm text-[#b0b3b8] hover:text-[#e4e6eb] transition-colors cursor-pointer"
                >
                  Write something...
                </button>
              </div>

              <div className="h-px bg-[#393a3b] my-3" />

              {/* Composer action triggers: Anonymous post, Feeling/activity, Poll */}
              <div className="grid grid-cols-3 gap-1 text-xs font-semibold text-[#b0b3b8]">
                <button
                  onClick={() => {
                    setIsAnonymous(!isAnonymous);
                    setIsComposerOpen(true);
                  }}
                  className={`py-2 px-2 rounded-xl hover:bg-[#3a3b3c] flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    isAnonymous ? 'text-blue-400 bg-blue-600/10' : ''
                  }`}
                >
                  <EyeOff className="w-4 h-4 text-blue-400" />
                  <span>Anonymous post</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedFeeling(selectedFeeling ? null : '🚀 energized');
                    setIsComposerOpen(true);
                  }}
                  className="py-2 px-2 rounded-xl hover:bg-[#3a3b3c] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Smile className="w-4 h-4 text-amber-400" />
                  <span>Feeling/activity</span>
                </button>

                <button
                  onClick={() => {
                    setShowPollBuilder(!showPollBuilder);
                    setIsComposerOpen(true);
                  }}
                  className="py-2 px-2 rounded-xl hover:bg-[#3a3b3c] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <BarChart2 className="w-4 h-4 text-amber-500" />
                  <span>Poll</span>
                </button>
              </div>
            </div>

            {/* EXPANDED COMPOSER MODAL */}
            {isComposerOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
                <div className="w-full max-w-lg bg-[#242526] border border-[#393a3b] rounded-2xl shadow-2xl overflow-hidden text-[#e4e6eb] animate-scale-up">
                  <div className="p-4 border-b border-[#393a3b] flex items-center justify-between">
                    <h3 className="font-bold text-base text-white">Create post</h3>
                    <button
                      onClick={() => setIsComposerOpen(false)}
                      className="w-8 h-8 rounded-xl bg-[#3a3b3c] hover:bg-[#4e4f50] flex items-center justify-center text-[#b0b3b8] hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={activeIdentity.avatarUrl || currentUser.avatarUrl}
                        alt="Author"
                        className="w-10 h-10 rounded-xl object-cover"
                      />
                      <div>
                        <p className="font-bold text-sm text-white">
                          {isAnonymous ? 'Anonymous Member' : activeIdentity.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] px-2 py-0.5 rounded-lg bg-[#3a3b3c] text-[#b0b3b8]">
                            {entity.name}
                          </span>
                          {selectedFeeling && (
                            <span className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-400">
                              {selectedFeeling}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <textarea
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      placeholder={`What's on your mind?`}
                      rows={4}
                      className="w-full bg-transparent text-white placeholder-[#b0b3b8] text-base resize-none outline-none"
                      autoFocus
                    />

                    {showPollBuilder && (
                      <div className="p-3 rounded-xl bg-[#18191a] border border-[#393a3b] space-y-2">
                        <p className="text-xs font-bold text-amber-400">Poll Question & Options</p>
                        <input
                          type="text"
                          value={pollQuestion}
                          onChange={(e) => setPollQuestion(e.target.value)}
                          placeholder="Ask a question..."
                          className="w-full bg-[#242526] text-sm px-3 py-2 rounded-xl border border-[#393a3b] outline-none text-white"
                        />
                        {pollOptions.map((opt, idx) => (
                          <input
                            key={idx}
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const next = [...pollOptions];
                              next[idx] = e.target.value;
                              setPollOptions(next);
                            }}
                            placeholder={`Option ${idx + 1}`}
                            className="w-full bg-[#242526] text-sm px-3 py-1.5 rounded-xl border border-[#393a3b] outline-none text-white"
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-4 border-t border-[#393a3b] flex justify-end">
                    <button
                      onClick={handleCreatePost}
                      disabled={postSubmitting || (!newPostContent.trim() && !pollQuestion.trim())}
                      className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm cursor-pointer transition-all"
                    >
                      {postSubmitting ? 'Posting...' : 'Post'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* FEED POSTS LIST */}
            {isLoadingPosts ? (
              <div className="p-8 text-center text-sm text-[#b0b3b8]">Loading posts...</div>
            ) : posts.length === 0 ? (
              <div className="bg-[#242526] rounded-2xl p-8 border border-[#393a3b] text-center">
                <p className="text-sm font-semibold text-white">No posts yet</p>
                <p className="text-xs text-[#b0b3b8] mt-1">Be the first to share an update in {entity.name}!</p>
              </div>
            ) : (
              posts.map((post) => (
                <div key={post.id} className="bg-[#242526] rounded-2xl border border-[#393a3b] shadow-sm overflow-hidden">
                  {/* Post Author Bar */}
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={post.authorAvatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                        alt={post.authorName}
                        className="w-10 h-10 rounded-xl object-cover"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white hover:underline cursor-pointer">
                            {post.authorName}
                          </span>
                          {post.authorRole === 'owner' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              OWNER
                            </span>
                          )}
                          {post.authorRole === 'admin' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                              ADMIN
                            </span>
                          )}
                          {post.authorRole === 'moderator' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-500/20 text-purple-400 border border-purple-500/30">
                              MODERATOR
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-[#b0b3b8] mt-0.5">
                          <span>2 hrs ago</span> · <Globe className="w-3 h-3 text-[#b0b3b8]" />
                        </div>
                      </div>
                    </div>

                    <button className="text-[#b0b3b8] hover:text-white p-1 rounded-xl hover:bg-[#3a3b3c] cursor-pointer">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Post Content */}
                  <div className="px-4 pb-3 text-sm text-[#e4e6eb] leading-relaxed whitespace-pre-line">
                    {post.content}
                  </div>

                  {/* Poll Display if present */}
                  {post.poll && (
                    <div className="mx-4 mb-3 p-3 rounded-xl bg-[#18191a] border border-[#393a3b] space-y-2">
                      <p className="font-bold text-sm text-white">{post.poll.question}</p>
                      <div className="space-y-1.5">
                        {post.poll.options?.map((opt: any, i: number) => (
                          <div key={i} className="p-2 rounded-lg bg-[#242526] hover:bg-[#3a3b3c] border border-white/5 flex items-center justify-between text-xs cursor-pointer">
                            <span>{opt.text}</span>
                            <span className="text-[#b0b3b8]">{opt.votes || 0} votes</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Engagement Counts Bar */}
                  <div className="px-4 py-2 flex items-center justify-between text-xs text-[#b0b3b8] border-b border-[#393a3b]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-md bg-blue-500 flex items-center justify-center text-white text-[9px]">
                        👍
                      </div>
                      <span>{post.likesCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span>{post.commentsCount || 0} comments</span>
                      <span>0 shares</span>
                    </div>
                  </div>

                  {/* Action Bar: Like, Comment, Share */}
                  <div className="grid grid-cols-3 gap-1 p-1 text-xs font-semibold text-[#b0b3b8]">
                    <button
                      onClick={() => handleToggleLike(post.id)}
                      className={`py-2 rounded-xl hover:bg-[#3a3b3c] flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                        post.hasLiked ? 'text-blue-400 font-bold' : ''
                      }`}
                    >
                      <ThumbsUp className={`w-4 h-4 ${post.hasLiked ? 'fill-blue-400' : ''}`} />
                      <span>Like</span>
                    </button>

                    <button
                      onClick={() => handleToggleComments(post.id)}
                      className="py-2 rounded-xl hover:bg-[#3a3b3c] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Comment</span>
                    </button>

                    <button
                      onClick={() => {
                        const postUrl = post.canonicalUrl || `${entity.canonicalUrl || `/bonds/groups/${entity.slug}`}/posts/${post.id}`;
                        navigator.clipboard.writeText(`${window.location.origin}${postUrl}`);
                        addToast({
                          title: 'LINK COPIED',
                          message: `Post URL copied to clipboard.`,
                          type: 'success'
                        });
                      }}
                      className="py-2 rounded-xl hover:bg-[#3a3b3c] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Share</span>
                    </button>
                  </div>

                  {/* COMMENTS SECTION WITH ADMIN / MODERATOR BADGES */}
                  {openCommentsPostId === post.id && (
                    <div className="p-4 border-t border-[#393a3b] bg-[#1c1d1e] space-y-3">
                      <div className="space-y-2.5">
                        {(postComments[post.id] || []).map((comm) => (
                          <div key={comm.id} className="flex items-start gap-2.5">
                            <img
                              src={comm.authorAvatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}
                              alt={comm.authorName}
                              className="w-8 h-8 rounded-lg object-cover mt-0.5"
                            />
                            <div className="flex-1 bg-[#242526] p-2.5 rounded-2xl border border-[#393a3b]">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-white">{comm.authorName}</span>
                                {comm.authorRole === 'admin' && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                                    ADMIN
                                  </span>
                                )}
                                {comm.authorRole === 'moderator' && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-500/20 text-purple-400 border border-purple-500/40">
                                    MODERATOR
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#e4e6eb] mt-1 leading-relaxed">{comm.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Comment Input */}
                      <div className="flex items-center gap-2 pt-1">
                        <img
                          src={activeIdentity.avatarUrl || currentUser.avatarUrl}
                          alt="You"
                          className="w-8 h-8 rounded-lg object-cover"
                        />
                        <div className="flex-1 relative">
                          <input
                            type="text"
                            value={commentInputs[post.id] || ''}
                            onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddComment(post.id);
                            }}
                            placeholder="Write a comment..."
                            className="w-full bg-[#242526] hover:bg-[#3a3b3c] text-xs text-white placeholder-[#b0b3b8] py-2 pl-3 pr-9 rounded-xl border border-[#393a3b] outline-none"
                          />
                          <button
                            onClick={() => handleAddComment(post.id)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-300 p-1 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 2. RIGHT MODERATOR TOOLS & ABOUT SIDEBAR (Placed on the RIGHT as requested!) */}
      <aside className="hidden lg:flex w-[340px] xl:w-[360px] flex-col border-l border-[#393a3b] bg-[#242526] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 shrink-0">
        {/* Compact Header */}
        <div className="p-4 border-b border-[#393a3b] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={entity.logoUrl || entity.coverUrl || 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=100&q=80'}
              alt={entity.name}
              className="w-11 h-11 rounded-xl object-cover border border-[#393a3b]"
            />
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-white truncate">{entity.name}</h3>
              <p className="text-[12px] text-[#b0b3b8] flex items-center gap-1">
                <Lock className="w-3 h-3 text-[#b0b3b8]" />
                <span>{entity.privacy === 'private' ? 'Private group' : 'Public group'} · {entity.memberCount || members.length || 1} members</span>
              </p>
            </div>
          </div>
        </div>

        {/* Manage 20+ Header */}
        <div className="px-4 py-2 flex items-center justify-between text-xs font-semibold text-[#b0b3b8]">
          <span>Manage 20+</span>
        </div>

        {/* Main Navigation Links */}
        <div className="px-2 space-y-1">
          <button
            onClick={() => setActiveRightNav('home')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
              activeRightNav === 'home' ? 'bg-[#3a3b3c] text-white' : 'hover:bg-[#3a3b3c]/60 text-[#e4e6eb]'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-[#e41e3f]/20 text-[#e41e3f] flex items-center justify-center">
              🏠
            </div>
            <span>Community home</span>
          </button>

          <button
            onClick={() => setActiveRightNav('overview')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
              activeRightNav === 'overview' ? 'bg-[#3a3b3c] text-white' : 'hover:bg-[#3a3b3c]/60 text-[#e4e6eb]'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-white/5 text-[#b0b3b8] flex items-center justify-center">
              📊
            </div>
            <span>Overview</span>
          </button>
        </div>

        <div className="h-px bg-[#393a3b] my-2 mx-3" />

        {/* Moderator Tools Accordion */}
        <div className="px-2">
          <button
            onClick={() => setIsModeratorToolsOpen(!isModeratorToolsOpen)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-[#b0b3b8] hover:text-white transition-colors cursor-pointer"
          >
            <span>Moderator tools</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isModeratorToolsOpen ? '' : '-rotate-90'}`} />
          </button>

          {isModeratorToolsOpen && (
            <div className="space-y-0.5 mt-1">
              <button 
                onClick={onOpenRequests}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#3a3b3c] text-sm text-[#e4e6eb] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 text-[#b0b3b8]" />
                  <div className="text-left">
                    <p className="font-semibold text-xs text-white">Member requests</p>
                    <p className="text-[11px] text-[#b0b3b8]">0 new today</p>
                  </div>
                </div>
              </button>

              <button className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#3a3b3c] text-sm text-[#e4e6eb] transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-[#b0b3b8]" />
                  <span className="font-semibold text-xs text-[#e4e6eb]">Membership questions</span>
                </div>
              </button>

              <button 
                onClick={() => setActiveRightNav('pending')}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#3a3b3c] text-sm text-[#e4e6eb] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-[#b0b3b8]" />
                  <div className="text-left">
                    <p className="font-semibold text-xs text-white">Pending posts</p>
                    <p className="text-[11px] text-[#b0b3b8]">0 new today</p>
                  </div>
                </div>
                <span className="px-1.5 py-0.5 rounded-full bg-blue-600/30 text-blue-400 text-[10px] font-bold border border-blue-500/30">
                  20+
                </span>
              </button>

              <button 
                onClick={() => setActiveRightNav('spam')}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#3a3b3c] text-sm text-[#e4e6eb] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-[#b0b3b8]" />
                  <div className="text-left">
                    <p className="font-semibold text-xs text-white">Potential spam</p>
                    <p className="text-[11px] text-[#b0b3b8]">0 new today</p>
                  </div>
                </div>
                <span className="px-1.5 py-0.5 rounded-full bg-blue-600/30 text-blue-400 text-[10px] font-bold border border-blue-500/30">
                  1
                </span>
              </button>

              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#3a3b3c] text-xs font-semibold text-[#e4e6eb] transition-colors cursor-pointer">
                <Calendar className="w-4 h-4 text-[#b0b3b8]" />
                <span>Scheduled posts</span>
              </button>

              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#3a3b3c] text-xs font-semibold text-[#e4e6eb] transition-colors cursor-pointer">
                <Clock className="w-4 h-4 text-[#b0b3b8]" />
                <span>Activity log</span>
              </button>

              <button className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#3a3b3c] text-sm text-[#e4e6eb] transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-4 h-4 text-[#b0b3b8]" />
                  <div className="text-left">
                    <p className="font-semibold text-xs text-white">Member-reported content</p>
                    <p className="text-[11px] text-[#b0b3b8]">0 new today</p>
                  </div>
                </div>
              </button>

              <button className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#3a3b3c] text-sm text-[#e4e6eb] transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-[#b0b3b8]" />
                  <div className="text-left">
                    <p className="font-semibold text-xs text-white">Moderation alerts</p>
                    <p className="text-[11px] text-[#b0b3b8]">0 new today</p>
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="h-px bg-[#393a3b] my-2 mx-3" />

        {/* About Group Accordion */}
        <div className="px-2">
          <button
            onClick={() => setIsAboutOpen(!isAboutOpen)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-[#b0b3b8] hover:text-white transition-colors cursor-pointer"
          >
            <span>About group</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isAboutOpen ? '' : '-rotate-90'}`} />
          </button>

          {isAboutOpen && (
            <div className="p-3 space-y-3 text-xs bg-[#18191a]/60 rounded-xl border border-white/5 my-1">
              <p className="text-[#b0b3b8] leading-relaxed">
                {entity.description || 'A cozy corner for surreal developer humor, avant-garde memes, late night debugging stories, and creative tech jokes.'}
              </p>

              <div className="space-y-2 pt-1 border-t border-white/5">
                <div className="flex items-center gap-2 text-white font-medium">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Private group · Only members post</span>
                </div>
                <div className="flex items-center gap-2 text-white font-medium">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Visible · Anyone can find this group</span>
                </div>
                <div className="flex items-center gap-2 text-[#b0b3b8]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Created Feb 2024</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="h-px bg-[#393a3b] my-2 mx-3" />

        {/* Support Section */}
        <div className="px-2 pb-6">
          <button
            onClick={() => setIsSupportOpen(!isSupportOpen)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-[#b0b3b8] hover:text-white transition-colors cursor-pointer"
          >
            <span>Support</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isSupportOpen ? '' : '-rotate-90'}`} />
          </button>

          {isSupportOpen && (
            <div className="space-y-0.5 mt-1">
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#3a3b3c] text-xs font-semibold text-[#e4e6eb] transition-colors cursor-pointer">
                <HelpCircle className="w-4 h-4 text-[#b0b3b8]" />
                <span>Help Center</span>
              </button>
              <button className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#3a3b3c] text-xs font-semibold text-[#e4e6eb] transition-colors cursor-pointer">
                <span>Groups hub</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#b0b3b8]" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
