import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, UserPlus, Crown, UserMinus, Camera, Edit3, Phone, Video, 
  Search, Bell, BellOff, Palette, Smile, Image as ImageIcon, 
  FileText, Link as LinkIcon, LogOut, ShieldCheck, ChevronRight, 
  Lock, Check, Loader2, User, AlertTriangle, AtSign, Tag, Trash2,
  Copy, Share2, Shield, Settings, Volume2, VolumeX, Sparkles
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { messagingService } from '../../modules/messaging/MessagingService';
import { getAvatarUrl } from '../../lib/avatar';
import { api } from '../../services/api/client';
import { MemberDetailsSheet } from './MemberDetailsSheet';
import { SharedGroupMediaModal } from './SharedGroupMediaModal';
import { logger } from '@/src/utils/logger';


interface GroupInfoPanelProps {
  chat: any;
  onClose: () => void;
  onInitiateCall?: (type: 'audio' | 'video') => void;
  onOpenWallpaper?: () => void;
  chats?: any[];
}

export const GroupInfoPanel: React.FC<GroupInfoPanelProps> = ({ chat, onClose, onInitiateCall, onOpenWallpaper, chats = [] }) => {
  const { profile, user, addToast, allProfiles, suggestedUsers, onlineUsers, db } = useAeirmist();
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState(chat.groupName || chat.name || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // Modals state
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showNicknamesModal, setShowNicknamesModal] = useState(false);
  const [selectedMemberForSheet, setSelectedMemberForSheet] = useState<any | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSharedMediaModal, setShowSharedMediaModal] = useState(false);
  const [sharedMediaTab, setSharedMediaTab] = useState<'media' | 'files' | 'all'>('media');
  
  // Add Member State
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [searchAddQuery, setSearchAddQuery] = useState('');
  const [firestoreProfiles, setFirestoreProfiles] = useState<any[]>([]);
  const [isFetchingRemote, setIsFetchingRemote] = useState(false);
  
  // Group Members Search Filter
  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const [memberFilterTab, setMemberFilterTab] = useState<'all' | 'admins' | 'muted'>('all');

  // Nicknames State
  const [nicknames, setNicknames] = useState<Record<string, string>>(chat.nicknames || {});
  const [editingNicknameUser, setEditingNicknameUser] = useState<any | null>(null);
  const [nicknameInput, setNicknameInput] = useState('');
  const [isSavingNickname, setIsSavingNickname] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUserId = profile?.id || user?.uid || '';
  const ownerId = chat.owner || chat.createdBy || chat.ownerId;
  const admins: string[] = chat.admins || [];
  const isOwner = currentUserId === ownerId;
  const isAdmin = isOwner || admins.includes(currentUserId);
  const memberProfileIds: string[] = chat.profileIds || chat.participants || [];

  // Update input state if chat changes
  useEffect(() => {
    setGroupNameInput(chat.groupName || chat.name || '');
    if (chat.nicknames) {
      setNicknames(chat.nicknames);
    }
  }, [chat]);

  // Fetch profiles when Add Member modal opens via backend API
  useEffect(() => {
    if (!showAddMemberModal) return;
    let isMounted = true;
    const fetchRemote = async () => {
      setIsFetchingRemote(true);
      try {
        const res = await api.users.search('');
        if (isMounted && res?.users) {
          setFirestoreProfiles(res.users);
        }
      } catch (err) {
        logger.warn('Failed fetching backend profiles for group:', err);
      } finally {
        if (isMounted) setIsFetchingRemote(false);
      }
    };
    fetchRemote();
    return () => { isMounted = false; };
  }, [showAddMemberModal]);

  // Combine available user profiles to resolve member details
  const resolvedMembers = useMemo(() => {
    return memberProfileIds.map((memId: string) => {
      const detail = chat.participantDetails?.[memId];
      if (detail) return { id: memId, ...detail };
      
      const foundInAll = (allProfiles || []).find((p: any) => p.id === memId || p.uid === memId);
      if (foundInAll) return foundInAll;

      const foundInSugg = (suggestedUsers || []).find((p: any) => p.id === memId || p.uid === memId);
      if (foundInSugg) return foundInSugg;

      return {
        id: memId,
        displayName: memId === currentUserId ? (profile?.displayName || 'You') : 'Aeirmist Member',
        photoURL: memId === currentUserId ? profile?.photoURL : null,
        username: memId
      };
    });
  }, [memberProfileIds, chat.participantDetails, allProfiles, suggestedUsers, currentUserId, profile]);

  // Filter members list based on search and tab
  const filteredMembers = useMemo(() => {
    return resolvedMembers.filter(mem => {
      const id = mem.id || mem.uid;
      const memNick = nicknames[id] || '';
      const name = (mem.displayName || mem.name || '').toLowerCase();
      const nick = memNick.toLowerCase();
      const uname = (mem.username || '').toLowerCase();
      const q = searchMemberQuery.toLowerCase();

      const matchesQuery = !q || name.includes(q) || nick.includes(q) || uname.includes(q);

      if (!matchesQuery) return false;

      if (memberFilterTab === 'admins') {
        return id === ownerId || admins.includes(id);
      }
      if (memberFilterTab === 'muted') {
        return !!chat.mutedMembers?.[id];
      }
      return true;
    });
  }, [resolvedMembers, searchMemberQuery, memberFilterTab, nicknames, ownerId, admins, chat.mutedMembers]);

  // Filter candidate profiles to add
  const availableToAdd = useMemo(() => {
    const map = new Map<string, any>();
    
    const isAlreadyMember = (u: any) => {
      const uId = u.id;
      const uUid = u.uid;
      return (
        (uId && memberProfileIds.includes(uId)) ||
        (uUid && memberProfileIds.includes(uUid)) ||
        (chat.participants && (chat.participants.includes(uId) || chat.participants.includes(uUid)))
      );
    };

    // Add contacts from allProfiles
    (allProfiles || []).forEach((u: any) => {
      const uid = u.id || u.uid;
      if (uid && !isAlreadyMember(u)) map.set(uid, u);
    });

    // Add contacts from suggestedUsers
    (suggestedUsers || []).forEach((u: any) => {
      const uid = u.id || u.uid;
      if (uid && !isAlreadyMember(u)) map.set(uid, u);
    });

    // Add remote Firestore profiles
    firestoreProfiles.forEach((u: any) => {
      const uid = u.id || u.uid;
      if (uid && !isAlreadyMember(u)) map.set(uid, u);
    });

    return Array.from(map.values()).filter((u: any) => {
      if (!searchAddQuery) return true;
      const name = (u.displayName || u.name || '').toLowerCase();
      const uname = (u.username || '').toLowerCase();
      const q = searchAddQuery.toLowerCase();
      return name.includes(q) || uname.includes(q);
    });
  }, [allProfiles, suggestedUsers, firestoreProfiles, memberProfileIds, chat.participants, searchAddQuery]);

  // Photo Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addToast({ title: 'File too large', message: 'Image must be under 5MB.', type: 'warning' });
      return;
    }

    setIsUpdating(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const photoData = reader.result as string;
        await messagingService.updateGroupDetails(db, chat.id, { photoURL: photoData }, profile?.displayName);
        chat.groupPhotoURL = photoData;
        chat.photo = photoData;
        addToast({ title: 'Photo Updated', message: 'Group picture has been changed.', type: 'success' });
      } catch (err) {
        logger.error('Failed to update group photo:', err);
        addToast({ title: 'Error', message: 'Failed to update photo.', type: 'warning' });
      } finally {
        setIsUpdating(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Group Name Save
  const handleSaveGroupName = async () => {
    if (!groupNameInput.trim()) return;
    setIsUpdating(true);
    try {
      await messagingService.updateGroupDetails(db, chat.id, { name: groupNameInput.trim() }, profile?.displayName);
      chat.groupName = groupNameInput.trim();
      chat.name = groupNameInput.trim();
      setIsEditingName(false);
      addToast({ title: 'Name Saved', message: 'Group name updated successfully.', type: 'success' });
    } catch (err) {
      logger.error('Failed to update group name:', err);
      addToast({ title: 'Error', message: 'Failed to update group name.', type: 'warning' });
    } finally {
      setIsUpdating(false);
    }
  };

  // Add Members
  const handleAddMembers = async () => {
    if (selectedNewMembers.length === 0) return;
    setIsAdding(true);
    try {
      const detailsMap: Record<string, any> = {};
      const newIdsToSubmit: string[] = [];

      selectedNewMembers.forEach(memId => {
        const found = availableToAdd.find(u => (u.id || u.uid) === memId || u.id === memId || u.uid === memId);
        if (found) {
          const pId = found.id || memId;
          const uId = found.uid || memId;

          if (pId) newIdsToSubmit.push(pId);
          if (uId && uId !== pId) newIdsToSubmit.push(uId);

          const detailObj = {
            displayName: found.displayName || found.name || 'Aeirmist Member',
            photoURL: found.photoURL || null,
            username: found.username || memId
          };

          if (pId) detailsMap[pId] = detailObj;
          if (uId) detailsMap[uId] = detailObj;
        } else {
          newIdsToSubmit.push(memId);
        }
      });

      const uniqueNewIds = Array.from(new Set(newIdsToSubmit));

      await messagingService.addGroupMembers(
        db, 
        chat.id, 
        currentUserId, 
        uniqueNewIds, 
        detailsMap, 
        profile?.displayName || 'Admin'
      );

      // Mutate local state on active chat object for instant UI update
      if (!chat.participants) chat.participants = [];
      if (!chat.profileIds) chat.profileIds = [];
      if (!chat.participantDetails) chat.participantDetails = {};

      uniqueNewIds.forEach(id => {
        if (!chat.participants.includes(id)) chat.participants.push(id);
        if (!chat.profileIds.includes(id)) chat.profileIds.push(id);
      });
      Object.assign(chat.participantDetails, detailsMap);

      setSelectedNewMembers([]);
      setShowAddMemberModal(false);
      addToast({ title: 'Members Added', message: 'New members joined the group.', type: 'success' });
    } catch (err: any) {
      logger.error('Failed to add members:', err);
      addToast({ title: 'Error', message: err?.message || 'Failed to add members.', type: 'warning' });
    } finally {
      setIsAdding(false);
    }
  };

  // Save Member Nickname
  const handleSaveNickname = async (targetId: string, cleanNickname: string) => {
    setIsSavingNickname(true);
    try {
      const targetUser = resolvedMembers.find(m => (m.id || m.uid) === targetId);
      const targetName = targetUser?.displayName || targetId;

      await messagingService.setGroupNickname(
        db, 
        chat.id, 
        targetId, 
        cleanNickname, 
        profile?.displayName || 'Member',
        targetName
      );

      const updated = { ...nicknames, [targetId]: cleanNickname.trim() };
      setNicknames(updated);
      chat.nicknames = updated;

      addToast({ title: 'Nickname Updated', message: `Nickname set for ${targetName}`, type: 'success' });
      setEditingNicknameUser(null);
    } catch (err) {
      logger.error('Failed to save nickname:', err);
      addToast({ title: 'Error', message: 'Failed to update nickname.', type: 'warning' });
    } finally {
      setIsSavingNickname(false);
    }
  };

  // Toggle Mute
  const handleToggleMute = async (targetId: string, nextMuted: boolean) => {
    try {
      const targetUser = resolvedMembers.find(m => (m.id || m.uid) === targetId);
      await messagingService.toggleMuteMember(
        db, 
        chat.id, 
        targetId, 
        nextMuted, 
        profile?.displayName, 
        targetUser?.displayName
      );
      if (!chat.mutedMembers) chat.mutedMembers = {};
      chat.mutedMembers[targetId] = nextMuted;
      addToast({ 
        title: nextMuted ? 'Member Muted' : 'Member Unmuted', 
        message: `${targetUser?.displayName || 'User'} has been ${nextMuted ? 'muted' : 'unmuted'}.`, 
        type: 'info' 
      });
    } catch (e) {
      addToast({ title: 'Error', message: 'Failed to update mute status.', type: 'warning' });
    }
  };

  // Role Promotion / Demotion
  const handlePromoteDemoteRole = async (targetId: string, currentRole: string, targetRole: 'owner' | 'admin' | 'moderator' | 'member') => {
    try {
      const targetUser = resolvedMembers.find(m => (m.id || m.uid) === targetId);
      const targetName = targetUser?.displayName || 'Member';

      await messagingService.setMemberRole(
        db, 
        chat.id, 
        currentUserId, 
        targetId, 
        targetRole, 
        profile?.displayName, 
        targetName
      );

      addToast({ 
        title: 'Role Updated', 
        message: `${targetName} is now ${targetRole.toUpperCase()}`, 
        type: 'success' 
      });
    } catch (e) {
      addToast({ title: 'Error', message: 'Failed to update user role.', type: 'warning' });
    }
  };

  // Remove Member
  const handleRemoveMember = async (targetId: string, memberName: string, reason?: string) => {
    try {
      await messagingService.removeGroupMember(
        db, 
        chat.id, 
        currentUserId, 
        targetId, 
        profile?.displayName, 
        memberName, 
        reason
      );

      chat.participants = (chat.participants || []).filter((id: string) => id !== targetId);
      chat.profileIds = (chat.profileIds || []).filter((id: string) => id !== targetId);
      
      addToast({ title: 'Member Removed', message: `${memberName} was removed from the group.`, type: 'info' });
    } catch (e) {
      addToast({ title: 'Error', message: 'Failed to remove member.', type: 'warning' });
    }
  };

  // Transfer Ownership
  const handleTransferOwnership = async (targetId: string, targetName: string) => {
    try {
      await messagingService.transferOwnership(
        db, 
        chat.id, 
        currentUserId, 
        targetId, 
        profile?.displayName, 
        targetName
      );
      chat.owner = targetId;
      addToast({ title: 'Ownership Transferred', message: `${targetName} is now the group owner.`, type: 'success' });
    } catch (e) {
      addToast({ title: 'Error', message: 'Failed to transfer group ownership.', type: 'warning' });
    }
  };

  // Leave Group Action
  const handleLeaveGroup = async () => {
    if (isOwner && resolvedMembers.length > 1) {
      addToast({ 
        title: 'Transfer Ownership Required', 
        message: 'You must transfer group ownership to another member before leaving.', 
        type: 'warning' 
      });
      setShowLeaveConfirm(false);
      return;
    }

    try {
      await messagingService.leaveGroup(
        db, 
        chat.id, 
        currentUserId, 
        user?.uid, 
        profile?.displayName || 'Member'
      );
      addToast({ title: 'Left Group', message: 'You left the group.', type: 'info' });
      onClose();
    } catch (e) {
      addToast({ title: 'Error', message: 'Failed to leave group.', type: 'warning' });
    }
  };

  // Delete Group Action
  const handleDeleteGroup = async () => {
    try {
      await messagingService.deleteGroup(db, chat.id, currentUserId);
      addToast({ title: 'Group Deleted', message: 'The group has been removed permanently.', type: 'info' });
      onClose();
    } catch (e) {
      addToast({ title: 'Error', message: 'Failed to delete group.', type: 'warning' });
    }
  };

  // Copy Share Link
  const handleCopyShareLink = () => {
    const link = `${window.location.origin}/group/${chat.id}`;
    navigator.clipboard.writeText(link);
    addToast({ title: 'Link Copied', message: 'Group invite link copied to clipboard.', type: 'success' });
  };

  const groupPhoto = getAvatarUrl(chat.groupPhotoURL || chat.photo);
  const groupTitle = chat.groupName || chat.name || 'Group Chat';

  return (
    <div className="w-full h-full bg-[#0D1117] text-white flex flex-col border-l border-white/10 overflow-hidden relative font-sans">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handlePhotoUpload} 
        accept="image/*" 
        className="hidden" 
      />

      {/* HEADER BAR */}
      <div 
        className="px-4 pb-4 border-b border-white/10 flex items-center justify-between bg-[#121820]/80 backdrop-blur-md sticky top-0 z-10 transition-all"
        style={{ paddingTop: 'calc(1rem + var(--sat, var(--safe-area-inset-top, 0px)))' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-widest text-aeirmist-cyan">GROUP DETAILS</span>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
        
        {/* GROUP HERO CARD */}
        <div className="flex flex-col items-center text-center">
          <div className="relative group mb-3">
            <img 
              src={groupPhoto} 
              alt={groupTitle} 
              className="w-24 h-24 rounded-3xl object-cover border-2 border-aeirmist-cyan/40 shadow-2xl"
            />
            {isAdmin && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUpdating}
                className="absolute inset-0 rounded-3xl bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs"
              >
                {isUpdating ? <Loader2 size={20} className="animate-spin text-aeirmist-cyan" /> : <Camera size={22} className="text-white" />}
              </button>
            )}
          </div>

          {/* Group Title Edit */}
          {isEditingName ? (
            <div className="flex items-center gap-2 w-full max-w-xs mt-1">
              <input 
                type="text" 
                value={groupNameInput}
                onChange={(e) => setGroupNameInput(e.target.value)}
                className="flex-1 bg-white/5 border border-aeirmist-cyan/40 rounded-xl px-3 py-1.5 text-sm font-bold text-white focus:outline-none"
                autoFocus
              />
              <button 
                onClick={handleSaveGroupName}
                disabled={isUpdating}
                className="p-2 rounded-xl bg-aeirmist-cyan text-black font-bold text-xs hover:bg-cyan-400 transition-colors"
              >
                {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 group/title">
              <h2 className="text-lg font-extrabold text-white tracking-tight">{groupTitle}</h2>
              {isAdmin && (
                <button 
                  onClick={() => setIsEditingName(true)}
                  className="opacity-60 group-hover/title:opacity-100 hover:text-aeirmist-cyan transition-opacity p-1"
                >
                  <Edit3 size={14} />
                </button>
              )}
            </div>
          )}

          <p className="text-xs text-white/50 font-medium mt-1">
            {resolvedMembers.length} {resolvedMembers.length === 1 ? 'member' : 'members'}
          </p>
        </div>

        {/* META MESSENGER ACTION ROW */}
        <div className="grid grid-cols-4 gap-2">
          <button 
            onClick={() => onInitiateCall && onInitiateCall('audio')}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-white group"
          >
            <Phone size={18} className="text-white/80 group-hover:scale-110 transition-transform mb-1" />
            <span className="text-[10px] font-bold text-white/70">Audio</span>
          </button>

          <button 
            onClick={() => onInitiateCall && onInitiateCall('video')}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-white group"
          >
            <Video size={18} className="text-white/80 group-hover:scale-110 transition-transform mb-1" />
            <span className="text-[10px] font-bold text-white/70">Video</span>
          </button>

          <button 
            onClick={() => setShowAddMemberModal(true)}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 hover:bg-aeirmist-cyan/20 hover:border-aeirmist-cyan/40 border border-white/5 transition-all text-white group"
          >
            <UserPlus size={18} className="text-aeirmist-cyan group-hover:scale-110 transition-transform mb-1" />
            <span className="text-[10px] font-bold text-aeirmist-cyan">Add</span>
          </button>

          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-white group ${isMuted ? 'bg-rose-500/20 border-rose-500/40' : 'bg-white/5 hover:bg-white/10 border-white/5'}`}
          >
            {isMuted ? (
              <BellOff size={18} className="text-rose-400 group-hover:scale-110 transition-transform mb-1" />
            ) : (
              <Bell size={18} className="text-white/80 group-hover:scale-110 transition-transform mb-1" />
            )}
            <span className="text-[10px] font-bold text-white/70">{isMuted ? 'Muted' : 'Mute'}</span>
          </button>
        </div>

        {/* CUSTOMIZATION & SETTINGS SECTION */}
        <div className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-white/40 px-1">Customization</span>
          <div className="bg-white/5 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
            
            {/* Set Wallpaper */}
            <button 
              onClick={onOpenWallpaper}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/5 transition-colors text-xs font-bold text-white"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                  <Palette size={16} />
                </div>
                <span>Set Wallpaper / Theme</span>
              </div>
              <ChevronRight size={16} className="text-white/30" />
            </button>

            {/* Set Nicknames */}
            <button 
              onClick={() => setShowNicknamesModal(true)}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/5 transition-colors text-xs font-bold text-white"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <AtSign size={16} />
                </div>
                <div>
                  <div>Set Nicknames</div>
                  <div className="text-[10px] text-white/40 font-normal">Custom names for everyone in chat</div>
                </div>
              </div>
              <ChevronRight size={16} className="text-white/30" />
            </button>

            {/* Invite Link */}
            <button 
              onClick={handleCopyShareLink}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/5 transition-colors text-xs font-bold text-white"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                  <Share2 size={16} />
                </div>
                <div>
                  <div>Invite Link</div>
                  <div className="text-[10px] text-white/40 font-normal">Copy group link to invite friends</div>
                </div>
              </div>
              <Copy size={14} className="text-white/40" />
            </button>
          </div>
        </div>

        {/* MEMBERS SECTION */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-white/40">
              MEMBERS ({resolvedMembers.length})
            </span>
            <button 
              onClick={() => setShowAddMemberModal(true)}
              className="text-xs font-bold text-aeirmist-cyan hover:underline flex items-center gap-1"
            >
              <UserPlus size={13} />
              Add
            </button>
          </div>

          {/* Search Member Bar */}
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input 
              type="text" 
              placeholder="Search members..." 
              value={searchMemberQuery}
              onChange={(e) => setSearchMemberQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-aeirmist-cyan/40"
            />
          </div>

          {/* Member Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5">
            <button
              onClick={() => setMemberFilterTab('all')}
              className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all ${memberFilterTab === 'all' ? 'bg-aeirmist-cyan text-black shadow-sm' : 'text-white/60 hover:text-white'}`}
            >
              All ({resolvedMembers.length})
            </button>
            <button
              onClick={() => setMemberFilterTab('admins')}
              className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all ${memberFilterTab === 'admins' ? 'bg-aeirmist-cyan text-black shadow-sm' : 'text-white/60 hover:text-white'}`}
            >
              Admins ({admins.length + (ownerId ? 1 : 0)})
            </button>
            <button
              onClick={() => setMemberFilterTab('muted')}
              className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all ${memberFilterTab === 'muted' ? 'bg-aeirmist-cyan text-black shadow-sm' : 'text-white/60 hover:text-white'}`}
            >
              Muted ({Object.values(chat.mutedMembers || {}).filter(Boolean).length})
            </button>
          </div>

          {/* MEMBER CARDS LIST */}
          <div className="space-y-2">
            {filteredMembers.length === 0 ? (
              <div className="text-center py-6 text-white/40 text-xs font-medium">
                No members found
              </div>
            ) : (
              filteredMembers.map((mem) => {
                const uid = mem.id || mem.uid;
                const isMemOwner = uid === ownerId;
                const isMemAdmin = isMemOwner || admins.includes(uid);
                const isMemMod = chat.memberRoles?.[uid] === 'moderator';
                const isSelfMem = uid === currentUserId;
                const memNick = nicknames[uid] || '';
                const displayName = mem.displayName || mem.name || 'Aeirmist Member';
                const username = mem.username || uid;
                const photoURL = getAvatarUrl(mem.photoURL);
                const isVerified = mem.verified !== false && mem.isVerified !== false;
                const isMutedMem = !!chat.mutedMembers?.[uid];
                const isMemOnline = isSelfMem || (!!onlineUsers && (
                  !!onlineUsers?.has?.(uid) || 
                  (!!mem.uid && !!onlineUsers?.has?.(mem.uid)) || 
                  (!!mem.id && !!onlineUsers?.has?.(mem.id))
                ));

                return (
                  <div
                    key={uid}
                    onClick={() => setSelectedMemberForSheet(mem)}
                    className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar with status ring */}
                      <div className="relative shrink-0">
                        <img 
                          src={photoURL} 
                          className="w-10 h-10 rounded-2xl object-cover" 
                          alt="" 
                        />
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#0D1117] p-0.5 flex items-center justify-center">
                          <div className={`w-full h-full rounded-full transition-colors ${isMemOnline ? 'bg-aeirmist-lime shadow-sm shadow-aeirmist-lime/50' : 'bg-zinc-600/80 border border-white/10'}`} />
                        </div>
                      </div>

                      {/* Display & Nickname */}
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white truncate">
                            {memNick || displayName}
                          </span>

                          {/* MANDATED VERIFIED BADGE RULE */}
                          {isVerified && (
                            <ShieldCheck className="text-aeirmist-cyan shrink-0 w-3.5 h-3.5" />
                          )}

                          {isSelfMem && (
                            <span className="px-1.5 py-0.2 rounded-full bg-aeirmist-cyan/20 text-aeirmist-cyan text-[9px] font-black uppercase">
                              YOU
                            </span>
                          )}
                        </div>

                        {memNick && (
                          <span className="text-[10px] text-white/50 font-medium truncate">
                            {displayName}
                          </span>
                        )}

                        <span className="text-[10px] text-white/40 font-mono truncate">
                          @{username}
                        </span>
                      </div>
                    </div>

                    {/* Role Badge */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isMemOwner && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                          <Crown size={11} className="text-amber-400" />
                          Owner
                        </span>
                      )}

                      {isMemAdmin && !isMemOwner && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                          <ShieldCheck size={11} className="text-cyan-300" />
                          Admin
                        </span>
                      )}

                      {isMemMod && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                          <Shield size={11} className="text-purple-300" />
                          Mod
                        </span>
                      )}

                      {isMutedMem && (
                        <VolumeX size={14} className="text-rose-400" />
                      )}

                      <ChevronRight size={14} className="text-white/20 group-hover:text-white/60 transition-colors" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SHARED MEDIA SECTION */}
        <div className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-white/40 px-1">Shared Files & Media</span>
          <div className="bg-white/5 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
            <button 
              onClick={() => {
                setSharedMediaTab('media');
                setShowSharedMediaModal(true);
              }}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/10 active:scale-[0.99] text-xs font-semibold text-white transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                  <ImageIcon size={15} />
                </div>
                <div>
                  <span className="block font-bold">Media & Photos</span>
                  <span className="text-[10px] font-medium text-white/40">Images, videos & GIFs</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-white/30 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
            </button>

            <button 
              onClick={() => {
                setSharedMediaTab('files');
                setShowSharedMediaModal(true);
              }}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/10 active:scale-[0.99] text-xs font-semibold text-white transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                  <FileText size={15} />
                </div>
                <div>
                  <span className="block font-bold">Files & Documents</span>
                  <span className="text-[10px] font-medium text-white/40">PDFs, archives & docs</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-white/30 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        </div>

        {/* DANGER ZONE / LEAVE GROUP */}
        <div className="pt-4 space-y-2">
          <button 
            onClick={() => setShowLeaveConfirm(true)}
            className="w-full py-3.5 px-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut size={16} />
            Leave Group
          </button>

          {isOwner && (
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-3.5 px-4 rounded-2xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-400 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 size={16} />
              Delete Group Permanently
            </button>
          )}
        </div>
      </div>

      {/* MEMBER DETAILS BOTTOM SHEET / DRAWER */}
      <AnimatePresence>
        {selectedMemberForSheet && (
          <MemberDetailsSheet
            member={selectedMemberForSheet}
            chat={chat}
            currentUserId={currentUserId}
            onClose={() => setSelectedMemberForSheet(null)}
            onSetNickname={(memId, currNick) => {
              const userObj = resolvedMembers.find(m => (m.id || m.uid) === memId);
              if (userObj) {
                setEditingNicknameUser(userObj);
                setNicknameInput(currNick);
              }
            }}
            onToggleMute={handleToggleMute}
            onPromoteDemoteRole={handlePromoteDemoteRole}
            onRemoveMember={handleRemoveMember}
            onTransferOwnership={handleTransferOwnership}
            onDirectMessage={(mem) => {
              addToast({ title: 'Opening Chat', message: `Navigating to conversation with ${mem.displayName}`, type: 'info' });
            }}
            onInitiateCall={(type, mem) => {
              if (onInitiateCall) onInitiateCall(type);
            }}
          />
        )}
      </AnimatePresence>

      {/* NICKNAMES MODAL (META MESSENGER STYLE) */}
      <AnimatePresence>
        {showNicknamesModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowNicknamesModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[#121820] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <AtSign size={16} /> Edit Nicknames
                </span>
                <button 
                  onClick={() => setShowNicknamesModal(false)}
                  className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-3 custom-scrollbar flex-1">
                {resolvedMembers.map((mem) => {
                  const uid = mem.id || mem.uid;
                  const currentNick = nicknames[uid] || '';
                  const displayName = mem.displayName || mem.name || 'User';
                  const isEditingThis = editingNicknameUser && (editingNicknameUser.id || editingNicknameUser.uid) === uid;

                  return (
                    <div 
                      key={uid}
                      className="p-3 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img src={getAvatarUrl(mem.photoURL)} className="w-8 h-8 rounded-xl object-cover" alt="" />
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white">{displayName}</span>
                            <span className="text-[10px] text-white/40">
                              {currentNick ? `Nickname: "${currentNick}"` : 'No nickname set'}
                            </span>
                          </div>
                        </div>

                        {!isEditingThis && (
                          <button
                            onClick={() => {
                              setEditingNicknameUser(mem);
                              setNicknameInput(currentNick);
                            }}
                            className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors"
                          >
                            Edit
                          </button>
                        )}
                      </div>

                      {isEditingThis && (
                        <div className="flex items-center gap-2 mt-1">
                          <input 
                            type="text" 
                            placeholder="Enter custom nickname..." 
                            value={nicknameInput}
                            onChange={(e) => setNicknameInput(e.target.value)}
                            className="flex-1 bg-white/10 border border-amber-500/40 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveNickname(uid, nicknameInput)}
                            disabled={isSavingNickname}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition-colors flex items-center gap-1"
                          >
                            {isSavingNickname ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ADD MEMBER MODAL */}
      <AnimatePresence>
        {showAddMemberModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowAddMemberModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-[#121820] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-aeirmist-cyan flex items-center gap-2">
                  <UserPlus size={16} /> Add Group Members
                </span>
                <button 
                  onClick={() => setShowAddMemberModal(false)}
                  className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Search Bar */}
              <div className="p-4 pb-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input 
                    type="text" 
                    placeholder="Search people by name or @username..." 
                    value={searchAddQuery}
                    onChange={(e) => setSearchAddQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-aeirmist-cyan"
                  />
                </div>
              </div>

              {/* Candidate List */}
              <div className="p-4 overflow-y-auto space-y-2 custom-scrollbar flex-1">
                {isFetchingRemote && availableToAdd.length === 0 ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-white/50 text-xs">
                    <Loader2 size={16} className="animate-spin text-aeirmist-cyan" />
                    <span>Loading users...</span>
                  </div>
                ) : availableToAdd.length === 0 ? (
                  <div className="text-center py-8 text-white/40 text-xs font-medium">
                    No new users found to add
                  </div>
                ) : (
                  availableToAdd.map((usr: any) => {
                    const uid = usr.id || usr.uid;
                    const isSelected = selectedNewMembers.includes(uid);
                    const displayName = usr.displayName || usr.name || 'User';
                    const isVerified = usr.verified !== false && usr.isVerified !== false;

                    return (
                      <div 
                        key={uid}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedNewMembers(selectedNewMembers.filter(id => id !== uid));
                          } else {
                            setSelectedNewMembers([...selectedNewMembers, uid]);
                          }
                        }}
                        className={`p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-all ${isSelected ? 'bg-aeirmist-cyan/20 border border-aeirmist-cyan/40' : 'bg-white/5 hover:bg-white/10 border border-white/5'}`}
                      >
                        <div className="flex items-center gap-3">
                          <img src={getAvatarUrl(usr.photoURL)} className="w-9 h-9 rounded-xl object-cover" alt="" />
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold text-white">{displayName}</span>
                              {isVerified && <ShieldCheck className="text-aeirmist-cyan shrink-0 w-3.5 h-3.5" />}
                            </div>
                            <span className="text-[10px] text-white/40">@{usr.username || 'user'}</span>
                          </div>
                        </div>

                        <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${isSelected ? 'bg-aeirmist-cyan border-aeirmist-cyan text-black' : 'border-white/20'}`}>
                          {isSelected && <Check size={12} className="stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Submit Footer */}
              <div className="p-4 border-t border-white/10 bg-[#121820]">
                <button
                  onClick={handleAddMembers}
                  disabled={selectedNewMembers.length === 0 || isAdding}
                  className="w-full py-3 rounded-2xl bg-aeirmist-cyan text-black font-extrabold text-xs hover:bg-cyan-400 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  {isAdding && <Loader2 size={16} className="animate-spin" />}
                  Add {selectedNewMembers.length > 0 ? `(${selectedNewMembers.length}) Members` : 'Members'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEAVE GROUP CONFIRMATION OVERLAY */}
      {showLeaveConfirm && (
        <div className="absolute inset-0 z-30 bg-[#0D1117]/95 backdrop-blur-md p-6 flex flex-col justify-center items-center text-center">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mb-3 border border-rose-500/30">
            <LogOut size={24} />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">Leave {groupTitle}?</h3>
          <p className="text-xs text-white/60 mb-6 max-w-xs">
            You will no longer receive messages from this group.
          </p>

          <div className="flex items-center gap-3 w-full max-w-xs">
            <button
              onClick={() => setShowLeaveConfirm(false)}
              className="flex-1 py-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLeaveGroup}
              className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white hover:bg-rose-500 text-xs font-bold transition-colors"
            >
              Leave
            </button>
          </div>
        </div>
      )}

      {/* DELETE GROUP CONFIRMATION OVERLAY */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-30 bg-[#0D1117]/95 backdrop-blur-md p-6 flex flex-col justify-center items-center text-center">
          <div className="w-12 h-12 rounded-full bg-red-600/20 text-red-400 flex items-center justify-center mb-3 border border-red-500/30">
            <Trash2 size={24} />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">Delete Group Permanently?</h3>
          <p className="text-xs text-white/60 mb-6 max-w-xs">
            This action cannot be undone. The group conversation and chat history will be removed for everyone.
          </p>

          <div className="flex items-center gap-3 w-full max-w-xs">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteGroup}
              className="flex-1 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-500 text-xs font-bold transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* SHARED FILES & MEDIA MODAL */}
      <SharedGroupMediaModal
        isOpen={showSharedMediaModal}
        onClose={() => setShowSharedMediaModal(false)}
        chat={chat}
        db={db}
        initialTab={sharedMediaTab}
        addToast={addToast}
      />
    </div>
  );
};
