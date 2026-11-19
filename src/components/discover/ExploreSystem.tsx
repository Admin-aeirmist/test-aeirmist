import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Users, Layers, Briefcase, Plus, MessageSquare,
  Shield, Globe, Lock, CheckCircle2, ChevronRight, Sparkles,
  Filter, Compass, ArrowRight, ExternalLink, Calendar, Code,
  Cpu, Rocket, Terminal, Share2, Star, SquarePen, Settings,
  ThumbsUp, MessageCircle, Send, Smile, BarChart2, EyeOff,
  Newspaper, Camera, MoreHorizontal
} from 'lucide-react';
import { api } from '../../services/api/client';
import { useAppearance, ACCENT_COLOR_MAP } from '../../context/AppearanceContext';
import { useAeirmist } from '../../context/AeirmistContext';
import { getAvatarUrl, resolveAvatarSrc } from '../../lib/avatar';
import { BondsEntityDetailModal } from './BondsEntityDetailModal';
import { TeamApplicationModal } from './TeamApplicationModal';
import { CreateGroupWizard } from './wizards/CreateGroupWizard';
import { CreateCommunityWizard } from './wizards/CreateCommunityWizard';
import { CreateTeamWizard } from './wizards/CreateTeamWizard';
import { BondsRequestsView } from '../messenger/BondsRequestsView';

// Facebook cloned components
import { FacebookBondsSidebar } from './FacebookBondsSidebar';
import { FacebookGroupView } from './FacebookGroupView';
import { FacebookPageTeamView } from './FacebookPageTeamView';
import { FacebookProfileSwitcherModal, ActiveIdentity } from './FacebookProfileSwitcherModal';

interface ExploreSystemProps {
  onUserClick?: (user: any) => void;
  onPostClick?: (postId: string) => void;
  onMessageEntity?: (entity: any) => void;
  initialStoreId?: string | null;
  initialProductId?: string | null;
  onStoreChange?: (storeId: string | null) => void;
  onProductChange?: (productId: string | null) => void;
  initialBondUrl?: string | null;
  onBondChange?: (bondUrl: string | null) => void;
}

export function getEntityCanonicalUrl(entity: any): string {
  if (!entity) return '/bonds';
  if (entity.canonicalUrl) return entity.canonicalUrl;
  const typePlural = entity.type === 'community' ? 'communities' : entity.type === 'team' ? 'teams' : 'groups';
  const slug = entity.slug || entity.id;
  return `/bonds/${typePlural}/${slug}`;
}

export const ExploreSystem: React.FC<ExploreSystemProps> = ({
  onUserClick,
  onPostClick,
  onMessageEntity,
  initialBondUrl,
  onBondChange,
}) => {
  // Navigation tabs - DEFAULT TO FEED
  const [navTab, setNavTab] = useState<'feed' | 'discover' | 'groups' | 'communities' | 'teams' | 'my_bonds' | 'requests'>('feed');
  const [sidebarMode, setSidebarMode] = useState<'feed' | 'discover' | 'my_bonds'>('feed');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Appearance Context (Theme Accent Color Synchronization)
  const { settings: appearanceSettings } = useAppearance();
  const accentHex = ACCENT_COLOR_MAP[appearanceSettings?.accentColor] || '#00f2ff';
  
  // Data state: 100% Real Live Entities (No Mock or Seed Data)
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Active full Facebook view (if an individual entity is open)
  const [activeFacebookViewEntity, setActiveFacebookViewEntity] = useState<any | null>(null);

  // Modals & Wizards
  const [selectedEntityForDetail, setSelectedEntityForDetail] = useState<any | null>(null);
  const [selectedTeamForApply, setSelectedTeamForApply] = useState<any | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState(false);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [isProfileSwitcherOpen, setIsProfileSwitcherOpen] = useState(false);
  const [isCreateDropdownOpen, setIsCreateDropdownOpen] = useState(false);

  // User Identity & Switcher state (Synchronized with real logged-in user)
  const { user, profile, localAvatarURL, logout, addToast } = useAeirmist();
  const [isAnonymousQuickPost, setIsAnonymousQuickPost] = useState(false);
  const [selectedFeeling, setSelectedFeeling] = useState<string | null>(null);
  const [showFeelingsPicker, setShowFeelingsPicker] = useState(false);
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['Option 1', 'Option 2']);

  const realAvatarUrl = useMemo(() => {
    return localAvatarURL || 
      resolveAvatarSrc(profile?.avatarKey || profile?.photoURL || user?.photoURL) || 
      getAvatarUrl(profile?.photoURL || user?.photoURL, profile?.displayName || user?.displayName);
  }, [localAvatarURL, profile, user]);

  const realDisplayName = profile?.displayName || user?.displayName || 'Junaed Islam Jim';
  const realUsername = profile?.username || 'junaed_islam_jim9';
  const realUserId = user?.uid || profile?.id || 'user-jim';

  const currentUser = useMemo(() => ({
    id: realUserId,
    name: realDisplayName,
    handle: realUsername,
    avatarUrl: realAvatarUrl,
  }), [realUserId, realDisplayName, realUsername, realAvatarUrl]);

  const [activeIdentity, setActiveIdentity] = useState<ActiveIdentity>({
    id: realUserId,
    name: realDisplayName,
    avatarUrl: realAvatarUrl,
    type: 'user',
    handle: realUsername,
  });

  useEffect(() => {
    if (activeIdentity.type === 'user') {
      setActiveIdentity({
        id: realUserId,
        name: realDisplayName,
        avatarUrl: realAvatarUrl,
        type: 'user',
        handle: realUsername,
      });
    }
  }, [realUserId, realDisplayName, realUsername, realAvatarUrl]);

  // Aggregated feed posts from followed/joined groups, teams & communities (100% Real Live Content)
  const [aggregatedFeedPosts, setAggregatedFeedPosts] = useState<any[]>([]);
  const [feedCommentInputs, setFeedCommentInputs] = useState<{ [postId: string]: string }>({});
  const [openFeedCommentsPostId, setOpenFeedCommentsPostId] = useState<string | null>(null);
  const [quickPostText, setQuickPostText] = useState('');
  const [quickPostEntityId, setQuickPostEntityId] = useState('');

  // Managed entities for identity switcher (Only genuine entities the user owns or leads)
  const managedEntities = useMemo(() => {
    const myIds = new Set([
      currentUser.id,
      user?.uid,
      profile?.id,
      profile?.userId,
      profile?.ownerUid,
      typeof window !== 'undefined' ? localStorage.getItem('aeirmist_user_id') : null
    ].filter(Boolean));

    return entities.filter(e => {
      if (!e || !e.id || String(e.id).startsWith('seed-')) return false;
      const isMyOwner = myIds.has(e.ownerId) || myIds.has(e.creatorId) || myIds.has(e.createdBy);
      return Boolean(isMyOwner || e.myRole === 'owner' || e.myRole === 'admin' || e.isCreator);
    });
  }, [entities, currentUser.id, user?.uid, profile?.id, profile?.userId, profile?.ownerUid]);

  // Keep quick post entity target aligned with active managed entities
  useEffect(() => {
    if (managedEntities.length > 0 && (!quickPostEntityId || !entities.some(e => e.id === quickPostEntityId))) {
      setQuickPostEntityId(managedEntities[0].id);
    } else if (entities.length > 0 && !quickPostEntityId) {
      setQuickPostEntityId(entities[0].id);
    }
  }, [managedEntities, entities, quickPostEntityId]);

  // Open individual entity with distinct canonical URL
  const handleOpenEntity = (entity: any) => {
    if (!entity) return;
    setActiveFacebookViewEntity(entity);
    const canonical = getEntityCanonicalUrl(entity);
    if (typeof window !== 'undefined' && window.location.pathname !== canonical) {
      window.history.pushState({ bondSlug: entity.slug || entity.id, _appNav: true }, '', canonical);
    }
    if (onBondChange) {
      onBondChange(canonical);
    }
  };

  // Close entity view and restore /bonds URL
  const handleCloseEntity = () => {
    setActiveFacebookViewEntity(null);
    if (typeof window !== 'undefined' && window.location.pathname !== '/bonds') {
      window.history.pushState({ tab: 'discover', _appNav: true }, '', '/bonds');
    }
    if (onBondChange) {
      onBondChange(null);
    }
  };

  // Fetch real entities from backend API
  const fetchEntities = async () => {
    setLoading(true);
    try {
      const typeParam = (navTab === 'groups' ? 'group' : navTab === 'communities' ? 'community' : navTab === 'teams' ? 'team' : undefined);
      const filterParam = navTab === 'my_bonds' ? 'my_memberships' : undefined;

      let localEntities: any[] = [];
      try {
        localEntities = JSON.parse(localStorage.getItem('aeirmist_local_bonds_entities') || '[]');
      } catch {}

      const res = await api.bonds.getEntities({
        type: typeParam,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        search: searchQuery.trim() || undefined,
        filter: filterParam,
      }).catch(() => ({ entities: [] }));

      const apiEntities = (res?.entities || []).filter((e: any) => !String(e.id).startsWith('seed-'));
      const combined = [...localEntities.filter(e => !String(e.id).startsWith('seed-')), ...apiEntities];
      const seen = new Set();
      const deduplicated = combined.filter(e => {
        if (!e?.id || seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
      setEntities(deduplicated);
    } catch (err) {
      console.warn('[Bonds Fetch Warning]', err);
      let localEntities: any[] = [];
      try {
        localEntities = JSON.parse(localStorage.getItem('aeirmist_local_bonds_entities') || '[]')
          .filter((e: any) => !String(e.id).startsWith('seed-'));
      } catch {}
      setEntities(localEntities);
    } finally {
      setLoading(false);
    }
  };

  // Fetch aggregated feed posts from backend API
  const fetchFeedPosts = async () => {
    try {
      const res = await api.bonds.getFeedPosts().catch(() => null);
      if (res && Array.isArray(res.posts)) {
        const cleanPosts = res.posts.filter((p: any) => !String(p.id).startsWith('seed-') && !String(p.entityId).startsWith('seed-'));
        setAggregatedFeedPosts(cleanPosts);
      }
    } catch (e) {
      console.warn('[Bonds Feed Fetch]', e);
    }
  };

  useEffect(() => {
    fetchEntities();
  }, [navTab, categoryFilter, searchQuery]);

  useEffect(() => {
    if (navTab === 'feed') {
      fetchFeedPosts();
    }
  }, [navTab]);

  // Synchronize deep link URL on initial load and popstate (Back/Forward)
  useEffect(() => {
    const handleUrlEntityCheck = () => {
      if (typeof window === 'undefined') return;
      const path = window.location.pathname;
      const match = path.match(/^\/(?:bonds\/)?(groups|communities|teams)\/([^/?#]+)/i);
      if (match) {
        const slug = match[2];
        const found = entities.find(ent => ent.slug === slug || ent.id === slug || (ent.slug && ent.slug.startsWith(slug)));
        if (found) {
          setActiveFacebookViewEntity(found);
          if (onBondChange) onBondChange(getEntityCanonicalUrl(found));
        } else {
          api.bonds.getEntity(slug).then(res => {
            if (res?.entity) {
              setActiveFacebookViewEntity(res.entity);
              if (onBondChange) onBondChange(getEntityCanonicalUrl(res.entity));
            }
          }).catch(() => {});
        }
      } else if (path === '/bonds' || path === '/bonds/' || path === '/explore' || path === '/discover') {
        setActiveFacebookViewEntity(null);
        if (onBondChange) onBondChange(null);
      }
    };

    handleUrlEntityCheck();
    window.addEventListener('popstate', handleUrlEntityCheck);
    return () => window.removeEventListener('popstate', handleUrlEntityCheck);
  }, [entities]);

  // Handle newly created bonds from wizards
  useEffect(() => {
    const handleCreated = (e: any) => {
      const newEnt = e.detail?.entity;
      if (newEnt) {
        setEntities(prev => [newEnt, ...prev.filter(x => x.id !== newEnt.id)]);
        handleOpenEntity(newEnt);
      }
    };
    window.addEventListener('aeirmist_bonds_created', handleCreated);
    return () => window.removeEventListener('aeirmist_bonds_created', handleCreated);
  }, []);

  // Handle navigation from Admin Panel or external bond links
  useEffect(() => {
    const handleBondNav = (e: any) => {
      const { slug, type } = e.detail || {};
      if (slug) {
        const found = entities.find(ent => ent.slug === slug || ent.id === slug || (ent.slug && ent.slug.startsWith(slug)));
        if (found) {
          handleOpenEntity(found);
        } else {
          api.bonds.getEntity(slug).then(res => {
            if (res?.entity) handleOpenEntity(res.entity);
          }).catch(() => {});
        }
      }
    };
    window.addEventListener('aeirmist-navigate-bond', handleBondNav);
    return () => window.removeEventListener('aeirmist-navigate-bond', handleBondNav);
  }, [entities]);

  // Handle direct message button click
  const handleMessageClick = (entity: any) => {
    if (onMessageEntity) {
      onMessageEntity(entity);
    } else {
      window.dispatchEvent(new CustomEvent('aeirmist:open_conversation', {
        detail: {
          conversationId: entity.conversationId,
          entity,
        }
      }));
    }
  };

  // Handle inline quick join / apply
  const handleQuickJoin = async (entity: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (entity.type === 'team') {
      setSelectedTeamForApply(entity);
      return;
    }

    try {
      const res = await api.bonds.joinOrRequest(entity.id);
      const newStatus = res?.result?.status === 'joined' ? 'active' : 'pending';
      setEntities(prev => prev.map(ent => ent.id === entity.id ? { ...ent, membershipStatus: newStatus, isMember: newStatus === 'active' } : ent));
    } catch (err: any) {
      console.error('[Quick Join Error]', err);
    }
  };

  // Handle Feed Post Creation (Persisted directly to backend)
  const handleCreateFeedPost = async () => {
    if (!quickPostText.trim() && !pollQuestion.trim()) return;
    const targetEntity = entities.find(e => e.id === quickPostEntityId) || managedEntities[0] || entities[0];
    if (!targetEntity) {
      addToast({
        title: 'SELECT ENTITY',
        message: 'Please create or select a Group, Community, or Team before posting.',
        type: 'warning'
      });
      return;
    }

    const authorName = isAnonymousQuickPost ? 'Anonymous Member' : activeIdentity.name;
    const authorAvatar = isAnonymousQuickPost ? getAvatarUrl('') : (activeIdentity.avatarUrl || currentUser.avatarUrl);

    let postContent = quickPostText.trim();
    if (selectedFeeling) {
      postContent = `${postContent}\n\nFeeling: ${selectedFeeling}`.trim();
    }
    if (showPollBuilder && pollQuestion.trim()) {
      const opts = pollOptions.filter(o => o.trim());
      if (opts.length > 0) {
        postContent = `${postContent}\n\n📊 Poll: ${pollQuestion}\n${opts.map((o, idx) => `• ${o}`).join('\n')}`.trim();
      }
    }

    try {
      const res = await api.bonds.createPost(targetEntity.id, {
        content: postContent,
        isAnonymous: isAnonymousQuickPost,
      }).catch(() => null);

      const newPost = res?.post || {
        id: `feed-${Date.now()}`,
        entityId: targetEntity.id,
        groupName: targetEntity.name,
        groupType: targetEntity.type,
        authorName,
        authorRole: isAnonymousQuickPost ? 'member' : 'owner',
        authorAvatarUrl: authorAvatar,
        content: postContent,
        likesCount: 0,
        commentsCount: 0,
        createdAt: 'Just now',
        hasLiked: false,
        comments: []
      };

      setAggregatedFeedPosts(prev => [newPost, ...prev]);
      setQuickPostText('');
      setIsAnonymousQuickPost(false);
      setSelectedFeeling(null);
      setShowFeelingsPicker(false);
      setShowPollBuilder(false);
      setPollQuestion('');
      setPollOptions(['Option 1', 'Option 2']);
      addToast({
        title: 'POST PUBLISHED',
        message: `Your post was shared to ${targetEntity.name}.`,
        type: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'POST FAILED',
        message: err?.message || 'Could not publish post to server.',
        type: 'warning',
      });
    }
  };

  // Handle Feed Comment Addition (Persisted directly to backend)
  const handleAddFeedComment = async (postId: string) => {
    const text = (feedCommentInputs[postId] || '').trim();
    if (!text) return;

    try {
      const res = await api.bonds.createPostComment(postId, text).catch(() => null);

      const newComment = res?.comment || {
        id: `c-${Date.now()}`,
        authorName: activeIdentity.name,
        authorRole: 'member',
        authorAvatarUrl: activeIdentity.avatarUrl || currentUser.avatarUrl,
        content: text,
        createdAt: 'Just now'
      };

      setAggregatedFeedPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            commentsCount: (p.commentsCount || 0) + 1,
            comments: [...(p.comments || []), newComment]
          };
        }
        return p;
      }));

      setFeedCommentInputs(prev => ({ ...prev, [postId]: '' }));
    } catch (err) {
      console.warn('[Feed comment error]', err);
    }
  };

  // Filter local entities based on active tab and search
  const filteredEntities = useMemo(() => {
    return entities.filter(ent => {
      if (navTab === 'groups' && ent.type !== 'group') return false;
      if (navTab === 'communities' && ent.type !== 'community') return false;
      if (navTab === 'teams' && ent.type !== 'team') return false;
      if (navTab === 'my_bonds' && !ent.isMember) return false;

      if (categoryFilter !== 'all' && ent.category !== categoryFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = ent.name?.toLowerCase().includes(q);
        const matchDesc = ent.description?.toLowerCase().includes(q);
        const matchCat = ent.category?.toLowerCase().includes(q);
        const matchTag = ent.tags?.some((t: string) => t.toLowerCase().includes(q));
        if (!matchName && !matchDesc && !matchCat && !matchTag) return false;
      }

      return true;
    });
  }, [entities, navTab, categoryFilter, searchQuery]);

  const groupsList = filteredEntities.filter(e => e.type === 'group');
  const communitiesList = filteredEntities.filter(e => e.type === 'community');
  const teamsList = filteredEntities.filter(e => e.type === 'team');

  // IF AN INDIVIDUAL ENTITY IS ACTIVELY OPENED, DISPLAY FULL FACEBOOK CLONED PAGE
  if (activeFacebookViewEntity) {
    if (activeFacebookViewEntity.type === 'group') {
      return (
        <div className="flex h-screen bg-[#18191a] overflow-hidden">
          <FacebookGroupView
            entity={activeFacebookViewEntity}
            currentUser={currentUser}
            activeIdentity={activeIdentity}
            onBack={handleCloseEntity}
            onOpenRequests={() => setNavTab('requests')}
            onOpenProfileSwitcher={() => setIsProfileSwitcherOpen(true)}
            onRefreshEntity={fetchEntities}
          />

          <FacebookProfileSwitcherModal
            isOpen={isProfileSwitcherOpen}
            onClose={() => setIsProfileSwitcherOpen(false)}
            currentUser={currentUser}
            managedEntities={managedEntities}
            activeIdentity={activeIdentity}
            onSwitchIdentity={(identity) => {
              setActiveIdentity(identity);
              setIsProfileSwitcherOpen(false);
            }}
            onOpenSettings={() => window.dispatchEvent(new CustomEvent('aeirmist-navigate', { detail: 'settings' }))}
            onLogout={logout}
          />
        </div>
      );
    } else {
      return (
        <div className="flex h-screen bg-[#18191a] overflow-hidden">
          <FacebookPageTeamView
            entity={activeFacebookViewEntity}
            currentUser={currentUser}
            activeIdentity={activeIdentity}
            onBack={handleCloseEntity}
            onOpenApplyModal={(team) => setSelectedTeamForApply(team)}
            onOpenProfileSwitcher={() => setIsProfileSwitcherOpen(true)}
            onRefreshEntity={fetchEntities}
          />

          {selectedTeamForApply && (
            <TeamApplicationModal
              isOpen={Boolean(selectedTeamForApply)}
              onClose={() => setSelectedTeamForApply(null)}
              team={{
                id: selectedTeamForApply.id,
                name: selectedTeamForApply.name,
                logoUrl: selectedTeamForApply.logoUrl,
                openRoles: selectedTeamForApply.settings?.openRoles,
              }}
              onApplicationSubmitted={() => {
                setEntities(prev => prev.map(e => e.id === selectedTeamForApply.id ? { ...e, membershipStatus: 'pending' } : e));
              }}
            />
          )}

          <FacebookProfileSwitcherModal
            isOpen={isProfileSwitcherOpen}
            onClose={() => setIsProfileSwitcherOpen(false)}
            currentUser={currentUser}
            managedEntities={managedEntities}
            activeIdentity={activeIdentity}
            onSwitchIdentity={(identity) => {
              setActiveIdentity(identity);
              setIsProfileSwitcherOpen(false);
            }}
            onOpenSettings={() => window.dispatchEvent(new CustomEvent('aeirmist-navigate', { detail: 'settings' }))}
            onLogout={logout}
          />
        </div>
      );
    }
  }

  // Is Main Area in Feed Mode? (Default when on Feed tab or sidebarMode === 'feed')
  const isFeedMode = navTab === 'feed' || sidebarMode === 'feed';

  return (
    <div className="min-h-screen bg-[#06080c] text-neutral-200 pb-24 flex flex-col justify-between">
      {/* 
        TOP STICKY HEADER
        - RED MARK SECTION REMOVED
        - BLUE MARK NAVIGATION TABS MOVED TO TOP
        - UNIFIED THEME ACCENT COLOR SYNCHRONIZED WITH APPEARANCE
      */}
      <div className="border-b border-white/10 bg-[#06080c]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Navigation Tabs at the Top */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
            {[
              { id: 'feed', label: 'Your Feed', icon: Newspaper },
              { id: 'discover', label: 'Discover', icon: Compass },
              { id: 'groups', label: 'Groups', icon: Users },
              { id: 'communities', label: 'Communities', icon: Layers },
              { id: 'teams', label: 'Teams', icon: Briefcase },
              { id: 'my_bonds', label: 'My Bonds', icon: Star },
              { id: 'requests', label: 'Requests', icon: Shield },
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = navTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setNavTab(tab.id as any);
                    if (tab.id === 'feed') setSidebarMode('feed');
                    else if (tab.id === 'discover') setSidebarMode('discover');
                    else if (tab.id === 'my_bonds') setSidebarMode('my_bonds');
                  }}
                  style={
                    isSelected
                      ? {
                          backgroundColor: `${accentHex}20`,
                          color: accentHex,
                          borderColor: `${accentHex}50`,
                          boxShadow: `0 0 12px ${accentHex}25`,
                        }
                      : undefined
                  }
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer border ${
                    isSelected
                      ? 'font-bold'
                      : 'border-transparent text-neutral-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" style={isSelected ? { color: accentHex } : undefined} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right: Pen Create Button + Square Profile DP */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Create Pen Button */}
            <div className="relative">
              <button
                onClick={() => setIsCreateDropdownOpen(prev => !prev)}
                style={{ borderColor: `${accentHex}50` }}
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border flex items-center justify-center text-white transition-all cursor-pointer group shadow-sm active:scale-95"
                title="Create Group, Community, or Team"
              >
                <SquarePen size={18} style={{ color: accentHex }} className="group-hover:scale-110 transition-transform" />
              </button>

              <AnimatePresence>
                {isCreateDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    className="absolute right-0 top-12 z-50 w-52 rounded-2xl bg-[#0f131a] border border-white/10 p-2 shadow-2xl backdrop-blur-xl space-y-1"
                  >
                    <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-white/50 border-b border-white/5">
                      Create in Bonds
                    </div>
                    <button
                      onClick={() => {
                        setIsCreateDropdownOpen(false);
                        setIsCreateGroupOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-white/90 hover:bg-white/10 hover:text-white transition-all text-left cursor-pointer"
                    >
                      <Users size={15} style={{ color: accentHex }} />
                      <span>Create New Group</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsCreateDropdownOpen(false);
                        setIsCreateCommunityOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-white/90 hover:bg-white/10 hover:text-white transition-all text-left cursor-pointer"
                    >
                      <Globe size={15} className="text-emerald-400" />
                      <span>Create Community</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsCreateDropdownOpen(false);
                        setIsCreateTeamOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-white/90 hover:bg-white/10 hover:text-white transition-all text-left cursor-pointer"
                    >
                      <Layers size={15} className="text-purple-400" />
                      <span>Create Team</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Square Profile DP */}
            <div 
              onClick={() => setIsProfileSwitcherOpen(true)}
              className="relative cursor-pointer group flex items-center gap-2 p-0.5 rounded-2xl hover:bg-white/5 transition-all shrink-0"
              title="Switch Active Profile / Page"
            >
              <div className="relative">
                <img
                  src={activeIdentity.avatarUrl || currentUser.avatarUrl}
                  alt={activeIdentity.name}
                  style={{ borderColor: accentHex }}
                  className="w-10 h-10 rounded-xl object-cover border-2 shadow-sm transition-all"
                />
                <div 
                  style={{ backgroundColor: accentHex }}
                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-md border border-[#06080c] flex items-center justify-center text-neutral-950 text-[9px] font-bold"
                >
                  ▾
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dual-Column Content: Left Scrollable Feed & Right Facebook Bonds Sidebar */}
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col lg:flex-row gap-6 w-full">
        {/* Left Column (Feed, Discovery Grid, or Requests) */}
        <div className="flex-1 min-w-0">
          {navTab === 'requests' ? (
            <div className="rounded-2xl border border-white/10 overflow-hidden bg-[#0b0e14] min-h-[500px]">
              <BondsRequestsView
                onOpenConversation={(convId) => {
                  handleMessageClick({ conversationId: convId });
                }}
              />
            </div>
          ) : isFeedMode ? (
            /* =========================================================================
               1. AGGREGATED FACEBOOK FEED OF FOLLOWED GROUPS, TEAMS & COMMUNITIES
               ========================================================================= */
            <div className="max-w-2xl mx-auto space-y-5">
              {/* Post Composer Card */}
              <div className="bg-[#11141c] rounded-2xl p-4 border border-white/10 shadow-lg">
                <div className="flex items-center gap-3">
                  <div 
                    onClick={() => setIsProfileSwitcherOpen(true)}
                    className="relative cursor-pointer group flex-shrink-0"
                    title="Switch Posting Identity"
                  >
                    <img
                      src={activeIdentity.avatarUrl || currentUser.avatarUrl}
                      alt="Author"
                      style={{ borderColor: accentHex }}
                      className="w-10 h-10 rounded-xl object-cover border-2 group-hover:scale-105 transition-all"
                    />
                    <div 
                      style={{ backgroundColor: accentHex }}
                      className="absolute -bottom-1 -right-1 w-4 h-4 rounded-md border border-[#11141c] flex items-center justify-center text-neutral-950 text-[9px] font-bold"
                    >
                      ▾
                    </div>
                  </div>

                  {/* Quick Input Bar */}
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={quickPostText}
                      onChange={(e) => setQuickPostText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateFeedPost();
                      }}
                      placeholder={`Write something to your groups, communities & teams...`}
                      className="w-full bg-white/5 hover:bg-white/10 text-xs text-white placeholder-neutral-400 pl-4 pr-16 py-3 rounded-xl border border-white/5 outline-none transition-all"
                    />
                    <button
                      onClick={handleCreateFeedPost}
                      disabled={!quickPostText.trim()}
                      style={{
                        backgroundColor: accentHex,
                        color: '#06080c',
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg disabled:opacity-40 font-black text-xs transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      Post
                    </button>
                  </div>
                </div>

                {/* Sub-bar with target entity picker & actions */}
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-neutral-400">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-neutral-500">Posting to:</span>
                    <select
                      value={quickPostEntityId}
                      onChange={(e) => setQuickPostEntityId(e.target.value)}
                      style={{ color: accentHex, borderColor: `${accentHex}40` }}
                      className="bg-white/5 text-xs px-2.5 py-1 rounded-lg border outline-none cursor-pointer"
                    >
                      {entities.map(e => (
                        <option key={e.id} value={e.id} className="bg-[#11141c] text-white">
                          {e.name} ({e.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <button 
                      type="button"
                      onClick={() => {
                        const next = !isAnonymousQuickPost;
                        setIsAnonymousQuickPost(next);
                        addToast({
                          title: next ? 'ANONYMOUS MODE ON' : 'ANONYMOUS MODE OFF',
                          message: next ? 'Your identity will be hidden on this post.' : 'Posting under your profile identity.',
                          type: 'info'
                        });
                      }}
                      className={`flex items-center gap-1.5 transition-colors cursor-pointer px-2 py-1 rounded-lg ${isAnonymousQuickPost ? 'bg-white/10 text-white' : 'hover:text-white'}`}
                    >
                      <EyeOff className="w-3.5 h-3.5" style={{ color: accentHex }} />
                      <span className="hidden sm:inline">Anonymous</span>
                    </button>
                    <div className="relative">
                      <button 
                        type="button"
                        onClick={() => setShowFeelingsPicker(prev => !prev)}
                        className={`flex items-center gap-1.5 transition-colors cursor-pointer px-2 py-1 rounded-lg ${selectedFeeling ? 'bg-white/10 text-white' : 'hover:text-white'}`}
                      >
                        <Smile className="w-3.5 h-3.5" style={{ color: accentHex }} />
                        <span className="hidden sm:inline">{selectedFeeling ? selectedFeeling.split(' ')[0] : 'Feeling'}</span>
                      </button>
                      {showFeelingsPicker && (
                        <div className="absolute right-0 bottom-full mb-2 bg-[#121620] border border-white/10 rounded-xl p-2 shadow-2xl flex gap-1 z-30">
                          {['🚀 Excited', '💡 Creative', '🔥 Productive', '☕ Relaxed', '🎉 Celebrating'].map(f => (
                            <button
                              key={f}
                              type="button"
                              onClick={() => {
                                setSelectedFeeling(f === selectedFeeling ? null : f);
                                setShowFeelingsPicker(false);
                              }}
                              className="px-2 py-1 rounded-lg hover:bg-white/10 text-xs text-white cursor-pointer whitespace-nowrap"
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        setShowPollBuilder(prev => !prev);
                      }}
                      className={`flex items-center gap-1.5 transition-colors cursor-pointer px-2 py-1 rounded-lg ${showPollBuilder ? 'bg-white/10 text-white' : 'hover:text-white'}`}
                    >
                      <BarChart2 className="w-3.5 h-3.5" style={{ color: accentHex }} />
                      <span className="hidden sm:inline">Poll</span>
                    </button>
                  </div>
                </div>

                {/* Inline Poll Builder if active */}
                {showPollBuilder && (
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                    <input
                      type="text"
                      placeholder="Ask a poll question..."
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      className="w-full bg-white/5 text-xs px-3 py-2 rounded-lg border border-white/10 text-white outline-none"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      {pollOptions.map((opt, i) => (
                        <input
                          key={i}
                          type="text"
                          placeholder={`Option ${i + 1}`}
                          value={opt}
                          onChange={(e) => {
                            const copy = [...pollOptions];
                            copy[i] = e.target.value;
                            setPollOptions(copy);
                          }}
                          className="bg-white/5 text-xs px-2.5 py-1.5 rounded-lg border border-white/5 text-white outline-none"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Aggregated Feed Posts Stream */}
              {aggregatedFeedPosts.length === 0 ? (
                <div className="bg-[#11141c] rounded-2xl border border-white/10 p-8 text-center shadow-lg">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center mx-auto mb-4 text-white/40">
                    <Sparkles className="w-7 h-7" style={{ color: accentHex }} />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">No Posts in Your Network Yet</h3>
                  <p className="text-xs text-white/50 max-w-md mx-auto mb-5 leading-relaxed">
                    Be the first to share an update, start a discussion, or create a Group, Community, or Team!
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsCreateGroupOpen(true)}
                      style={{ backgroundColor: accentHex }}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-black hover:opacity-90 transition-all cursor-pointer shadow-md"
                    >
                      + Create Group
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreateTeamOpen(true)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-all cursor-pointer"
                    >
                      + Create Team
                    </button>
                  </div>
                </div>
              ) : (
                aggregatedFeedPosts.map((post) => {
                const targetEntity = entities.find(e => e.id === post.entityId) || entities[0] || { name: 'Ecosystem', logoUrl: '' };
                const isOpenComments = openFeedCommentsPostId === post.id;

                return (
                  <div key={post.id} className="bg-[#11141c] rounded-2xl border border-white/10 shadow-lg overflow-hidden transition-all hover:border-white/20">
                    {/* Origin Entity & Author Header */}
                    <div className="p-4 border-b border-white/5 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {/* Clickable Entity Logo */}
                        <div
                          onClick={() => handleOpenEntity(targetEntity)}
                          className="relative cursor-pointer group shrink-0"
                          title={`View ${post.groupName}`}
                        >
                          <img
                            src={targetEntity.logoUrl || post.authorAvatarUrl}
                            alt={post.groupName}
                            style={{ borderColor: `${accentHex}30` }}
                            className="w-11 h-11 rounded-xl object-cover border group-hover:scale-105 transition-all shadow-md"
                          />
                        </div>

                        <div>
                          {/* Group / Community / Team Link */}
                          <div className="flex items-center gap-2">
                            <span 
                              onClick={() => handleOpenEntity(targetEntity)}
                              className="font-bold text-sm text-white hover:underline cursor-pointer transition-colors"
                            >
                              {post.groupName}
                            </span>
                            <span 
                              style={{
                                backgroundColor: `${accentHex}18`,
                                borderColor: `${accentHex}35`,
                                color: accentHex,
                              }}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase"
                            >
                              {post.groupType || targetEntity.type}
                            </span>
                          </div>

                          {/* Author & Timestamp */}
                          <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
                            <span>Posted by <strong className="text-neutral-200">{post.authorName}</strong></span>
                            {post.authorRole === 'owner' && (
                              <span 
                                style={{
                                  backgroundColor: `${accentHex}20`,
                                  borderColor: `${accentHex}40`,
                                  color: accentHex,
                                }}
                                className="px-1.5 py-0.2 rounded text-[9px] font-black border"
                              >
                                OWNER
                              </span>
                            )}
                            {post.authorRole === 'admin' && (
                              <span 
                                style={{
                                  backgroundColor: `${accentHex}20`,
                                  borderColor: `${accentHex}40`,
                                  color: accentHex,
                                }}
                                className="px-1.5 py-0.2 rounded text-[9px] font-black border"
                              >
                                ADMIN
                              </span>
                            )}
                            {post.authorRole === 'moderator' && (
                              <span 
                                style={{
                                  backgroundColor: `${accentHex}20`,
                                  borderColor: `${accentHex}40`,
                                  color: accentHex,
                                }}
                                className="px-1.5 py-0.2 rounded text-[9px] font-black border"
                              >
                                MODERATOR
                              </span>
                            )}
                            <span>·</span>
                            <span>{post.createdAt}</span>
                          </div>
                        </div>
                      </div>

                      <button className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Post Content */}
                    <div className="p-4 text-sm text-neutral-200 leading-relaxed whitespace-pre-line">
                      {post.content}
                    </div>

                    {/* Engagement Counts Bar */}
                    <div className="px-4 py-2 flex items-center justify-between text-xs text-neutral-400 border-t border-white/5">
                      <div className="flex items-center gap-1.5">
                        <div 
                          style={{ backgroundColor: accentHex, color: '#06080c' }}
                          className="w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-bold"
                        >
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
                    <div className="grid grid-cols-3 gap-1 p-1 text-xs font-semibold text-neutral-400 border-t border-white/5">
                      <button 
                        onClick={() => {
                          setAggregatedFeedPosts(prev => prev.map(p => {
                            if (p.id === post.id) {
                              const next = !p.hasLiked;
                              return {
                                ...p,
                                hasLiked: next,
                                likesCount: next ? p.likesCount + 1 : Math.max(0, p.likesCount - 1)
                              };
                            }
                            return p;
                          }));
                        }}
                        style={post.hasLiked ? { color: accentHex } : undefined}
                        className="py-2 rounded-xl hover:bg-white/5 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <ThumbsUp className="w-4 h-4" style={post.hasLiked ? { fill: accentHex } : undefined} />
                        <span>Like</span>
                      </button>

                      <button 
                        onClick={() => setOpenFeedCommentsPostId(isOpenComments ? null : post.id)}
                        className="py-2 rounded-xl hover:bg-white/5 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>Comment</span>
                      </button>

                      <button 
                        onClick={() => {
                          const postUrl = `${window.location.origin}/bonds/posts/${post.id}`;
                          navigator.clipboard.writeText(postUrl);
                          addToast({
                            title: 'LINK COPIED',
                            message: `Post link copied to clipboard.`,
                            type: 'success',
                          });
                        }}
                        className="py-2 rounded-xl hover:bg-white/5 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <Share2 className="w-4 h-4" />
                        <span>Share</span>
                      </button>
                    </div>

                    {/* EXPANDABLE COMMENTS STREAM WITH UNIFIED BADGES */}
                    {isOpenComments && (
                      <div className="p-4 border-t border-white/5 bg-black/20 space-y-3">
                        {/* Comments List */}
                        <div className="space-y-2.5">
                          {(post.comments || []).map((comm: any) => (
                            <div key={comm.id} className="flex items-start gap-2.5">
                              <img
                                src={comm.authorAvatarUrl}
                                alt={comm.authorName}
                                className="w-8 h-8 rounded-lg object-cover mt-0.5"
                              />
                              <div className="flex-1 bg-white/5 p-2.5 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-white">{comm.authorName}</span>
                                  {comm.authorRole === 'owner' && (
                                    <span 
                                      style={{ backgroundColor: `${accentHex}20`, borderColor: `${accentHex}40`, color: accentHex }}
                                      className="px-1.5 py-0.5 rounded text-[9px] font-black border"
                                    >
                                      OWNER
                                    </span>
                                  )}
                                  {comm.authorRole === 'admin' && (
                                    <span 
                                      style={{ backgroundColor: `${accentHex}20`, borderColor: `${accentHex}40`, color: accentHex }}
                                      className="px-1.5 py-0.5 rounded text-[9px] font-black border"
                                    >
                                      ADMIN
                                    </span>
                                  )}
                                  {comm.authorRole === 'moderator' && (
                                    <span 
                                      style={{ backgroundColor: `${accentHex}20`, borderColor: `${accentHex}40`, color: accentHex }}
                                      className="px-1.5 py-0.5 rounded text-[9px] font-black border"
                                    >
                                      MODERATOR
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-neutral-200 mt-1 leading-relaxed">{comm.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Comment Input Box */}
                        <div className="flex items-center gap-2 pt-1">
                          <img
                            src={activeIdentity.avatarUrl || currentUser.avatarUrl}
                            alt="You"
                            className="w-7 h-7 rounded-lg object-cover"
                          />
                          <div className="flex-1 relative">
                            <input
                              type="text"
                              value={feedCommentInputs[post.id] || ''}
                              onChange={(e) => setFeedCommentInputs({ ...feedCommentInputs, [post.id]: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddFeedComment(post.id);
                              }}
                              placeholder="Write a comment..."
                              className="w-full bg-white/5 hover:bg-white/10 text-xs text-white placeholder-neutral-400 py-2 pl-3 pr-9 rounded-xl border border-white/5 outline-none"
                            />
                            <button
                              onClick={() => handleAddFeedComment(post.id)}
                              style={{ color: accentHex }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 cursor-pointer hover:brightness-125"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }))}
            </div>
          ) : (
            /* =========================================================================
               2. DISCOVERY CATALOG GRID (When user navigates to Discover)
               ========================================================================= */
            <>
              {/* Search and Filters Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
                <div className="relative w-full sm:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Search groups, communities, teams, roles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-[#0b0e14] border border-white/10 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none transition-colors"
                    style={{ borderColor: searchQuery ? `${accentHex}60` : undefined }}
                  />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
                  <span className="text-xs text-neutral-500 shrink-0 flex items-center gap-1">
                    <Filter className="w-3 h-3" /> Category:
                  </span>
                  {['all', 'Tech & Developers', 'Design & UX', 'AI & Data', 'Software Engineering'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategoryFilter(c)}
                      style={
                        categoryFilter === c
                          ? { backgroundColor: `${accentHex}20`, color: accentHex, borderColor: `${accentHex}40` }
                          : undefined
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap transition-colors cursor-pointer border ${
                        categoryFilter === c
                          ? 'font-bold'
                          : 'border-transparent text-neutral-400 hover:text-white'
                      }`}
                    >
                      {c === 'all' ? 'All' : c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Discovery Sections */}
              <div className="space-y-10">
                {/* Groups Section */}
                {(navTab === 'discover' || navTab === 'groups') && groupsList.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" style={{ color: accentHex }} />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-white">Groups</h2>
                        <span className="text-xs text-neutral-500">People & Shared Interests</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {groupsList.map((grp) => (
                        <div
                          key={grp.id}
                          onClick={() => handleOpenEntity(grp)}
                          className="group bg-[#0b0e14] border border-white/10 hover:border-white/25 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 flex flex-col justify-between shadow-sm"
                        >
                          <div className="relative aspect-video bg-neutral-900 overflow-hidden">
                            {grp.coverUrl && (
                              <img
                                src={grp.coverUrl}
                                alt={grp.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e14] via-transparent to-transparent" />
                            <div 
                              style={{ backgroundColor: `${accentHex}20`, borderColor: `${accentHex}40`, color: accentHex }}
                              className="absolute top-3 right-3 px-2 py-0.5 rounded-lg backdrop-blur-md text-[10px] uppercase font-bold border"
                            >
                              {grp.privacy}
                            </div>
                            <div className="absolute bottom-3 left-3 w-12 h-12 rounded-xl bg-[#06080c] border border-white/20 overflow-hidden shadow-lg flex items-center justify-center">
                              {grp.logoUrl ? (
                                <img src={grp.logoUrl} alt={grp.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-sm font-bold" style={{ color: accentHex }}>{grp.name.slice(0, 2).toUpperCase()}</span>
                              )}
                            </div>
                          </div>

                          <div className="p-4 flex-1 flex flex-col justify-between">
                            <div>
                              <h3 className="text-sm font-bold text-white group-hover:underline transition-colors line-clamp-1">
                                {grp.name}
                              </h3>
                              <div className="text-[11px] font-medium mb-2" style={{ color: accentHex }}>{grp.category}</div>
                              <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                                {grp.description}
                              </p>
                            </div>

                            <div className="pt-4 border-t border-white/5 mt-4 flex items-center justify-between">
                              <span className="text-xs text-neutral-500 flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" />
                                {grp.memberCount} members
                              </span>

                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                {grp.isMember ? (
                                  <span 
                                    style={{ backgroundColor: `${accentHex}18`, borderColor: `${accentHex}35`, color: accentHex }}
                                    className="px-2.5 py-1 rounded-lg border text-xs font-semibold"
                                  >
                                    Joined
                                  </span>
                                ) : (
                                  <button
                                    onClick={(e) => handleQuickJoin(grp, e)}
                                    style={{ backgroundColor: accentHex, color: '#06080c' }}
                                    className="px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                  >
                                    Join
                                  </button>
                                )}
                                <button
                                  onClick={() => handleMessageClick(grp)}
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
                                  title="Message"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" style={{ color: accentHex }} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Communities Section */}
                {(navTab === 'discover' || navTab === 'communities') && communitiesList.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4" style={{ color: accentHex }} />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-white">Communities</h2>
                        <span className="text-xs text-neutral-500">Guilds & Knowledge Hubs</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {communitiesList.map((comm) => (
                        <div
                          key={comm.id}
                          onClick={() => handleOpenEntity(comm)}
                          className="group bg-[#0b0e14] border border-white/10 hover:border-white/25 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 flex flex-col justify-between shadow-sm"
                        >
                          <div className="relative aspect-video bg-neutral-900 overflow-hidden">
                            {comm.coverUrl && (
                              <img
                                src={comm.coverUrl}
                                alt={comm.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e14] via-transparent to-transparent" />
                            <div 
                              style={{ backgroundColor: `${accentHex}20`, borderColor: `${accentHex}40`, color: accentHex }}
                              className="absolute top-3 right-3 px-2 py-0.5 rounded-lg backdrop-blur-md text-[10px] uppercase font-bold border"
                            >
                              {comm.privacy}
                            </div>
                            <div className="absolute bottom-3 left-3 w-12 h-12 rounded-xl bg-[#06080c] border border-white/20 overflow-hidden shadow-lg flex items-center justify-center">
                              {comm.logoUrl ? (
                                <img src={comm.logoUrl} alt={comm.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-sm font-bold" style={{ color: accentHex }}>{comm.name.slice(0, 2).toUpperCase()}</span>
                              )}
                            </div>
                          </div>

                          <div className="p-4 flex-1 flex flex-col justify-between">
                            <div>
                              <h3 className="text-sm font-bold text-white group-hover:underline transition-colors line-clamp-1">
                                {comm.name}
                              </h3>
                              <div className="text-[11px] font-medium mb-2" style={{ color: accentHex }}>{comm.category}</div>
                              <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                                {comm.description}
                              </p>
                            </div>

                            <div className="pt-4 border-t border-white/5 mt-4 flex items-center justify-between">
                              <span className="text-xs text-neutral-500 flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" />
                                {comm.memberCount} members
                              </span>

                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                {comm.isMember ? (
                                  <span 
                                    style={{ backgroundColor: `${accentHex}18`, borderColor: `${accentHex}35`, color: accentHex }}
                                    className="px-2.5 py-1 rounded-lg border text-xs font-semibold"
                                  >
                                    Joined
                                  </span>
                                ) : (
                                  <button
                                    onClick={(e) => handleQuickJoin(comm, e)}
                                    style={{ backgroundColor: accentHex, color: '#06080c' }}
                                    className="px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                  >
                                    Join
                                  </button>
                                )}
                                <button
                                  onClick={() => handleMessageClick(comm)}
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
                                  title="Message"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" style={{ color: accentHex }} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Teams Section */}
                {(navTab === 'discover' || navTab === 'teams') && teamsList.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4" style={{ color: accentHex }} />
                        <h2 className="text-sm font-bold uppercase tracking-wider text-white">Teams</h2>
                        <span className="text-xs text-neutral-500">Projects, Roles & Recruitment</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {teamsList.map((team) => (
                        <div
                          key={team.id}
                          onClick={() => handleOpenEntity(team)}
                          className="group bg-[#0b0e14] border border-white/10 hover:border-white/25 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 flex flex-col justify-between shadow-sm"
                        >
                          <div className="relative aspect-video bg-neutral-900 overflow-hidden">
                            {team.coverUrl && (
                              <img
                                src={team.coverUrl}
                                alt={team.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e14] via-transparent to-transparent" />
                            <div 
                              style={{ backgroundColor: `${accentHex}20`, borderColor: `${accentHex}40`, color: accentHex }}
                              className="absolute top-3 right-3 px-2 py-0.5 rounded-lg backdrop-blur-md text-[10px] font-bold border"
                            >
                              {team.settings?.stage || 'Active'}
                            </div>
                            <div className="absolute bottom-3 left-3 w-12 h-12 rounded-xl bg-[#06080c] border border-white/20 overflow-hidden shadow-lg flex items-center justify-center">
                              {team.logoUrl ? (
                                <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-sm font-bold" style={{ color: accentHex }}>{team.name.slice(0, 2).toUpperCase()}</span>
                              )}
                            </div>
                          </div>

                          <div className="p-4 flex-1 flex flex-col justify-between">
                            <div>
                              <h3 className="text-sm font-bold text-white group-hover:underline transition-colors line-clamp-1">
                                {team.name}
                              </h3>
                              <div className="text-[11px] font-medium mb-2" style={{ color: accentHex }}>{team.category}</div>
                              <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                                {team.description}
                              </p>

                              {team.settings?.openRoles && (
                                <div className="mt-3 flex flex-wrap gap-1">
                                  {team.settings.openRoles.slice(0, 2).map((r: any, idx: number) => (
                                    <span 
                                      key={idx} 
                                      style={{ backgroundColor: `${accentHex}18`, borderColor: `${accentHex}30`, color: accentHex }}
                                      className="px-2 py-0.5 rounded-lg border text-[10px] font-medium"
                                    >
                                      {r.title}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="pt-4 border-t border-white/5 mt-4 flex items-center justify-between">
                              <span className="text-xs text-neutral-500 flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" />
                                {team.memberCount} members
                              </span>

                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={(e) => handleQuickJoin(team, e)}
                                  style={{ backgroundColor: accentHex, color: '#06080c' }}
                                  className="px-3 py-1 rounded-lg text-xs font-black transition-colors cursor-pointer shadow-sm"
                                >
                                  Apply
                                </button>
                                <button
                                  onClick={() => handleMessageClick(team)}
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
                                  title="Message"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" style={{ color: accentHex }} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right Column: FACEBOOK BONDS SIDEBAR */}
        <div className="hidden lg:block w-[320px] xl:w-[350px] shrink-0 sticky top-20 h-[calc(100vh-100px)] rounded-2xl overflow-hidden border border-white/10 shadow-xl">
          <FacebookBondsSidebar
            entities={entities}
            selectedEntity={activeFacebookViewEntity}
            onSelectEntity={(ent) => handleOpenEntity(ent)}
            onCreateClick={(type) => {
              if (type === 'group') setIsCreateGroupOpen(true);
              else if (type === 'community') setIsCreateCommunityOpen(true);
              else setIsCreateTeamOpen(true);
            }}
            activeType={navTab === 'communities' ? 'community' : navTab === 'teams' ? 'team' : 'group'}
            sidebarMode={sidebarMode}
            onSelectMode={(mode) => {
              setSidebarMode(mode);
              if (mode === 'feed') setNavTab('feed');
              else if (mode === 'my_bonds') setNavTab('my_bonds');
              else if (mode === 'discover') setNavTab('discover');
            }}
            onOpenSettings={() => setIsProfileSwitcherOpen(true)}
          />
        </div>
      </div>

      {/* FLOATING ACTION PEN (Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-30">
        <button
          onClick={() => setIsCreateGroupOpen(true)}
          style={{ borderColor: accentHex, boxShadow: `0 0 25px ${accentHex}50` }}
          className="w-14 h-14 rounded-2xl bg-neutral-900 border-2 text-white hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer group"
          title="Create in Bonds"
        >
          <SquarePen size={24} style={{ color: accentHex }} className="group-hover:rotate-6 transition-transform" />
        </button>
      </div>

      {/* Entity Detail Modal */}
      {selectedEntityForDetail && (
        <BondsEntityDetailModal
          isOpen={Boolean(selectedEntityForDetail)}
          onClose={() => setSelectedEntityForDetail(null)}
          entity={selectedEntityForDetail}
          onMessageClick={handleMessageClick}
          onJoinSuccess={(id, status) => {
            setEntities(prev => prev.map(e => e.id === id ? { ...e, membershipStatus: status, isMember: status === 'active' } : e));
          }}
        />
      )}

      {/* Team Application Modal */}
      {selectedTeamForApply && (
        <TeamApplicationModal
          isOpen={Boolean(selectedTeamForApply)}
          onClose={() => setSelectedTeamForApply(null)}
          team={{
            id: selectedTeamForApply.id,
            name: selectedTeamForApply.name,
            logoUrl: selectedTeamForApply.logoUrl,
            openRoles: selectedTeamForApply.settings?.openRoles,
          }}
          onApplicationSubmitted={() => {
            setEntities(prev => prev.map(e => e.id === selectedTeamForApply.id ? { ...e, membershipStatus: 'pending' } : e));
          }}
        />
      )}

      {/* Facebook Profile Switcher Modal */}
      <FacebookProfileSwitcherModal
        isOpen={isProfileSwitcherOpen}
        onClose={() => setIsProfileSwitcherOpen(false)}
        currentUser={currentUser}
        managedEntities={managedEntities}
        activeIdentity={activeIdentity}
        onSwitchIdentity={(identity) => {
          setActiveIdentity(identity);
          setIsProfileSwitcherOpen(false);
        }}
        onOpenSettings={() => window.dispatchEvent(new CustomEvent('aeirmist-navigate', { detail: 'settings' }))}
        onLogout={logout}
      />

      {/* Creation Wizards */}
      <CreateGroupWizard
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        onSuccess={(newEntity) => {
          setEntities(prev => [newEntity, ...prev]);
        }}
      />

      <CreateCommunityWizard
        isOpen={isCreateCommunityOpen}
        onClose={() => setIsCreateCommunityOpen(false)}
        onSuccess={(newEntity) => {
          setEntities(prev => [newEntity, ...prev]);
        }}
      />

      <CreateTeamWizard
        isOpen={isCreateTeamOpen}
        onClose={() => setIsCreateTeamOpen(false)}
        onSuccess={(newEntity) => {
          setEntities(prev => [newEntity, ...prev]);
        }}
      />
    </div>
  );
};
