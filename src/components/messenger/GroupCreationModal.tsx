import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Camera, Search, Check, Loader2, Users, Globe, Briefcase, 
  ArrowLeft, Crown, ShieldCheck, ChevronRight, UserPlus, Sparkles 
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { messagingService } from '../../modules/messaging/MessagingService';
import { getAvatarUrl } from '../../lib/avatar';
import { collection, query, getDocs, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { logger } from '@/src/utils/logger';

interface GroupCreationModalProps {
  onClose: () => void;
  onGroupCreated?: (groupId: string, groupData?: any) => void;
  chats?: any[];
}

export type ChannelCategory = 'group' | 'community' | 'team';

const CHANNEL_TYPES: {
  type: ChannelCategory;
  title: string;
  subtitle: string;
  badge: string;
  icon: any;
  colorClass: string;
  gradientClass: string;
  borderClass: string;
}[] = [
  {
    type: 'group',
    title: 'Create Group',
    subtitle: 'Private group chat with close friends, family, or personal circles.',
    badge: 'Messenger',
    icon: Users,
    colorClass: 'text-cyan-400',
    gradientClass: 'from-cyan-500/20 via-blue-500/10 to-transparent',
    borderClass: 'border-cyan-500/30 hover:border-cyan-400/60'
  },
  {
    type: 'community',
    title: 'Create Community',
    subtitle: 'Public hub or open discussion space for creators, fans, and broad topics.',
    badge: 'Open / Public',
    icon: Globe,
    colorClass: 'text-purple-400',
    gradientClass: 'from-purple-500/20 via-pink-500/10 to-transparent',
    borderClass: 'border-purple-500/30 hover:border-purple-400/60'
  },
  {
    type: 'team',
    title: 'Create Team',
    subtitle: 'Focused collaboration workspace for projects, startups, operations, and tasks.',
    badge: 'Productivity',
    icon: Briefcase,
    colorClass: 'text-emerald-400',
    gradientClass: 'from-emerald-500/20 via-teal-500/10 to-transparent',
    borderClass: 'border-emerald-500/30 hover:border-emerald-400/60'
  }
];

const FALLBACK_CONTACTS = [
  { id: 'usr_shajidur', displayName: 'Shajidur Rahman', username: 'shajidur', photoURL: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&q=80&w=200' },
  { id: 'usr_shahriar', displayName: 'Shahriar Aman', username: 'shahriar', photoURL: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200' },
  { id: 'usr_nishat', displayName: 'Nishat Tasnim', username: 'nishat', photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200' },
  { id: 'usr_abdullah', displayName: 'Abdullah Al', username: 'abdullah', photoURL: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=200' }
];

const isSystemOrAiUser = (p: any): boolean => {
  if (!p) return true;
  const id = String(p.id || p.uid || p.userId || '').toLowerCase().trim();
  const username = String(p.username || '').toLowerCase().trim();
  const displayName = String(p.displayName || p.name || '').toLowerCase().trim();
  return (
    id === '00000000-0000-4000-a000-000000000001' ||
    id === 'system' ||
    id === 'era' ||
    id.includes('00000000-0000-4000-a000-000000000001') ||
    username === 'era' ||
    username === 'system' ||
    username.includes('00000000-0000-4000-a000-000000000001') ||
    displayName === 'era ai' ||
    displayName === 'era' ||
    displayName === 'system'
  );
};

export const GroupCreationModal: React.FC<GroupCreationModalProps> = ({ onClose, onGroupCreated, chats = [] }) => {
  const { allProfiles, suggestedUsers, profile, user, db, addToast } = useAeirmist();
  
  // Step 0 = Category selection, Step 1 = Add Members, Step 2 = Details & Confirm
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [selectedType, setSelectedType] = useState<ChannelCategory>('group');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupPhoto, setGroupPhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [firestoreProfiles, setFirestoreProfiles] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeChannelConfig = useMemo(() => {
    return CHANNEL_TYPES.find(c => c.type === selectedType) || CHANNEL_TYPES[0];
  }, [selectedType]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      addToast({ title: 'File too large', message: 'Picture must be under 5MB.', type: 'warning' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setGroupPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Fetch Firestore profiles
  useEffect(() => {
    let isMounted = true;
    const fetchRemoteUsers = async () => {
      if (!db) return;
      setIsFetchingUsers(true);
      try {
        const profilesRef = collection(db, 'profiles');
        const q = query(profilesRef, limit(40));
        const snap = await getDocs(q);
        if (isMounted) {
          const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setFirestoreProfiles(fetched);
        }
      } catch (e) {
        logger.warn('Failed to fetch profiles for creation modal:', e);
      } finally {
        if (isMounted) setIsFetchingUsers(false);
      }
    };
    fetchRemoteUsers();
    return () => { isMounted = false; };
  }, [db]);

  // Extract users from chats
  const chatUsers = useMemo(() => {
    const usersMap = new Map<string, any>();
    chats.forEach(c => {
      if (c.participantDetails) {
        Object.entries(c.participantDetails).forEach(([pid, details]: [string, any]) => {
          if (pid !== profile?.id && pid !== user?.uid) {
            usersMap.set(pid, {
              id: pid,
              displayName: details.displayName || details.name || c.name || pid,
              username: details.username || pid,
              photoURL: details.photoURL || details.photo || c.photo
            });
          }
        });
      } else if (c.otherParticipantId && c.otherParticipantId !== profile?.id) {
        usersMap.set(c.otherParticipantId, {
          id: c.otherParticipantId,
          displayName: c.name || c.otherParticipantId,
          username: c.username || c.otherParticipantId,
          photoURL: c.photo
        });
      }
    });
    return Array.from(usersMap.values());
  }, [chats, profile?.id, user?.uid]);

  // Combined candidates
  const availablePeople = useMemo(() => {
    const unique = new Map<string, any>();
    (suggestedUsers || []).forEach(p => { if (p && p.id) unique.set(p.id, p); });
    chatUsers.forEach(p => { if (p && p.id && !unique.has(p.id)) unique.set(p.id, p); });
    firestoreProfiles.forEach(p => { if (p && p.id && !unique.has(p.id)) unique.set(p.id, p); });
    (allProfiles || []).forEach(p => { if (p && p.id && !unique.has(p.id)) unique.set(p.id, p); });

    if (unique.size < 3) {
      FALLBACK_CONTACTS.forEach(p => { if (!unique.has(p.id)) unique.set(p.id, p); });
    }

    return Array.from(unique.values()).filter(p => p.id !== profile?.id && p.uid !== user?.uid && !isSystemOrAiUser(p));
  }, [suggestedUsers, chatUsers, firestoreProfiles, allProfiles, profile?.id, user?.uid]);

  const toggleMember = (id: string) => {
    setSelectedMembers(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  const getCleanHandle = (p: any): string => {
    if (!p) return 'member';
    const uname = String(p.username || '').trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uname);
    if (uname && !isUuid && uname !== p.id && uname !== 'unknown') {
      return uname.replace(/^@+/, '');
    }
    const name = String(p.displayName || p.name || '').trim();
    if (name) {
      const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      if (slug) return slug;
    }
    return 'member';
  };

  const handleCreate = async () => {
    if (!groupName.trim() || selectedMembers.length === 0 || !profile) return;
    setIsLoading(true);
    try {
      const cleanGroupName = groupName.trim();
      const selectedMemberObjects = selectedMembers.map(id => availablePeople.find(p => p.id === id) || { id, displayName: id });
      const selectedMemberUids = selectedMemberObjects.map(p => p.uid || p.ownerUid || p.id);
      const creatorDisplayName = profile.displayName || profile.username || 'Admin';
      const typeLabel = selectedType === 'community' ? 'Community' : selectedType === 'team' ? 'Team' : 'Group';

      const participantDetailsMap: Record<string, any> = {
        [profile.id]: {
          id: profile.id,
          displayName: creatorDisplayName,
          username: getCleanHandle(profile),
          photoURL: profile.photoURL || '',
          role: 'admin'
        }
      };
      if (user?.uid && user.uid !== profile.id) {
        participantDetailsMap[user.uid] = participantDetailsMap[profile.id];
      }

      selectedMemberObjects.forEach(m => {
        const mId = m.id;
        const mUid = m.uid || m.ownerUid || m.id;
        const cleanUname = getCleanHandle(m);
        const memDetail = {
          id: mId,
          uid: mUid,
          displayName: m.displayName || m.name || cleanUname,
          username: cleanUname,
          photoURL: m.photoURL || m.photo || '',
          role: 'member'
        };
        participantDetailsMap[mId] = memDetail;
        if (mUid && mUid !== mId) participantDetailsMap[mUid] = memDetail;
      });

      const now = Date.now();
      const creationSystemText = `${creatorDisplayName} created the ${typeLabel.toLowerCase()} "${cleanGroupName}".`;
      const memberNamesText = selectedMemberObjects.map(m => m.displayName || m.username || 'Member').slice(0, 3).join(', ') + 
        (selectedMemberObjects.length > 3 ? ` and ${selectedMemberObjects.length - 3} others` : '');
      const membersJoinedText = `${creatorDisplayName} added ${memberNamesText}.`;

      // Instant group creation: writes to Firestore + Backend API concurrently with 3s timeout
      const newGroupId = await messagingService.createGroupConversation(
        db, 
        profile.id, 
        selectedMembers, 
        cleanGroupName, 
        groupPhoto || undefined,
        user?.uid || profile.id,
        selectedMemberUids,
        selectedType,
        participantDetailsMap
      );

      // Persist System Events asynchronously without blocking UI
      messagingService.sendSystemEvent(db, newGroupId, creationSystemText).catch(() => {});
      messagingService.sendSystemEvent(db, newGroupId, membersJoinedText).catch(() => {});

      addToast({ 
        title: `${typeLabel} Created!`, 
        message: `"${cleanGroupName}" is ready with ${selectedMembers.length + 1} members. You are the Admin.`, 
        type: 'success' 
      });
      
      const newGroupData = {
        id: newGroupId,
        name: cleanGroupName,
        groupName: cleanGroupName,
        title: cleanGroupName,
        type: selectedType,
        isGroup: true,
        photo: groupPhoto || '',
        groupPhotoURL: groupPhoto || '',
        createdBy: profile.id,
        owner: profile.id,
        admins: [profile.id, user?.uid || profile.id],
        profileIds: [profile.id, ...selectedMembers],
        participants: [user?.uid || profile.id, ...selectedMemberUids],
        participantDetails: participantDetailsMap,
        createdAt: now,
        updatedAt: now,
        lastMessage: creationSystemText,
        unread: false
      };

      if (onGroupCreated) {
        onGroupCreated(newGroupId, newGroupData);
      } else {
        onClose();
      }
    } catch (e) {
      logger.error('Creation error:', e);
      addToast({ title: 'Error', message: 'Failed to create channel. Please try again.', type: 'warning' });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProfiles = availablePeople.filter(p => {
    const queryStr = searchQuery.toLowerCase().trim();
    if (!queryStr) return true;
    const nameMatch = (p.displayName || p.name || '').toLowerCase().includes(queryStr);
    const userMatch = (p.username || '').toLowerCase().includes(queryStr);
    return nameMatch || userMatch;
  });

  const selectedMemberDetails = useMemo(() => {
    return selectedMembers.map(id => availablePeople.find(p => p.id === id) || { id, displayName: id, photoURL: '' });
  }, [selectedMembers, availablePeople]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 15 }}
        className="bg-[#0f1118] border border-white/10 w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-5 text-white relative overflow-hidden"
      >
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5 relative z-10">
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button 
                onClick={() => setStep((prev) => (prev - 1) as any)}
                className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-all mr-1"
                title="Back"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                {step === 0 && 'Create New Space'}
                {step === 1 && `Add to ${activeChannelConfig.title.replace('Create ', '')}`}
                {step === 2 && `${activeChannelConfig.title.replace('Create ', '')} Details`}
              </h2>
              <p className="text-[11px] text-white/40">
                {step === 0 && 'Select space type to start your channel'}
                {step === 1 && 'Select connections to invite'}
                {step === 2 && 'Give your space a title & photo'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-xl bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* STEP 0: Select Type */}
        {step === 0 && (
          <div className="flex flex-col gap-3 relative z-10 py-1">
            {CHANNEL_TYPES.map((cfg) => {
              const IconComp = cfg.icon;
              return (
                <button
                  key={cfg.type}
                  onClick={() => {
                    setSelectedType(cfg.type);
                    setStep(1);
                  }}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-4 bg-gradient-to-r ${cfg.gradientClass} ${cfg.borderClass} group hover:scale-[1.01]`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-12 h-12 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center ${cfg.colorClass} shadow-md group-hover:scale-105 transition-transform`}>
                      <IconComp size={22} strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{cfg.title}</span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-white/70 font-mono font-medium">
                          {cfg.badge}
                        </span>
                      </div>
                      <p className="text-xs text-white/50 mt-1 line-clamp-2 leading-relaxed">
                        {cfg.subtitle}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-white/30 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              );
            })}
          </div>
        )}

        {/* STEP 1: Add Members */}
        {step === 1 && (
          <div className="flex-1 flex flex-col gap-3.5 relative z-10 min-h-0">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
              <input 
                type="text"
                placeholder="Search friends by name or @username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50 transition-colors"
                autoFocus
              />
            </div>

            {/* Selected Members Chips */}
            {selectedMembers.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar shrink-0">
                {selectedMemberDetails.map((mem) => (
                  <div 
                    key={mem.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-white shrink-0 text-xs"
                  >
                    <img 
                      src={getAvatarUrl(mem.photoURL)} 
                      className="w-4 h-4 rounded-full object-cover" 
                      alt="" 
                    />
                    <span className="font-medium text-[11px] max-w-[80px] truncate">{mem.displayName || mem.username}</span>
                    <button 
                      onClick={() => toggleMember(mem.id)}
                      className="text-white/40 hover:text-white ml-0.5"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Scrollable Members List */}
            <div className="flex-1 overflow-y-auto max-h-60 space-y-1 custom-scrollbar pr-1">
              {isFetchingUsers && availablePeople.length === 0 ? (
                <div className="py-10 text-center text-white/40 flex flex-col items-center gap-2">
                  <Loader2 className="animate-spin text-cyan-400" size={22} />
                  <p className="text-xs">Loading connections...</p>
                </div>
              ) : filteredProfiles.length === 0 ? (
                <div className="py-10 text-center text-white/40 text-xs">
                  No matching friends found.
                </div>
              ) : (
                filteredProfiles.map(p => {
                  const isSelected = selectedMembers.includes(p.id);
                  return (
                    <button 
                      key={p.id}
                      type="button"
                      onClick={() => toggleMember(p.id)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-2xl transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-cyan-500/15 border border-cyan-500/40 text-white' 
                          : 'hover:bg-white/5 border border-transparent text-white/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img 
                          src={getAvatarUrl(p.photoURL || p.photo)} 
                          className="w-10 h-10 rounded-2xl object-cover shrink-0 border border-white/10" 
                          alt="" 
                        />
                        <div className="text-left min-w-0">
                          <p className="text-xs font-bold text-white truncate">{p.displayName || p.name || p.username}</p>
                          <p className="text-[10px] text-white/40 truncate">@{getCleanHandle(p)}</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                        isSelected 
                          ? 'bg-cyan-400 border-cyan-400 text-black' 
                          : 'border-white/20 bg-white/5'
                      }`}>
                        {isSelected && <Check size={13} strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-2 pt-2 border-t border-white/5">
              <button 
                type="button"
                onClick={() => setStep(0)}
                className="py-2.5 px-4 rounded-xl bg-white/5 text-white/70 hover:text-white text-xs font-semibold"
              >
                Back
              </button>
              <button 
                disabled={selectedMembers.length === 0}
                onClick={() => setStep(2)}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black text-xs font-bold uppercase tracking-wider disabled:opacity-30 transition-all hover:brightness-110 shadow-lg shadow-cyan-500/20"
              >
                Next ({selectedMembers.length} selected)
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Details & Confirm */}
        {step === 2 && (
          <div className="flex-1 flex flex-col gap-4 relative z-10">
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              onChange={handleImageSelect} 
              className="hidden" 
            />

            {/* Photo Picker */}
            <div className="flex flex-col items-center gap-3 py-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative w-24 h-24 rounded-3xl bg-white/5 flex flex-col items-center justify-center border-2 border-dashed border-white/20 hover:border-cyan-400/50 transition-all overflow-hidden"
              >
                {groupPhoto ? (
                  <>
                    <img src={groupPhoto} className="w-full h-full object-cover" alt="Preview" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold uppercase tracking-wider">
                      Change
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-white/40 group-hover:text-cyan-400 transition-colors">
                    <Camera size={26} />
                    <span className="text-[10px] font-medium">Add Photo (Optional)</span>
                  </div>
                )}
              </button>
              {groupPhoto && (
                <button 
                  type="button" 
                  onClick={() => setGroupPhoto(null)} 
                  className="text-[10px] text-rose-400 hover:underline"
                >
                  Remove Photo
                </button>
              )}

              {/* Channel Name Input */}
              <div className="w-full">
                <label className="text-[11px] font-bold text-white/50 mb-1 block">
                  {selectedType === 'community' ? 'Community Name' : selectedType === 'team' ? 'Team Name' : 'Group Name'}
                </label>
                <input 
                  type="text"
                  placeholder={
                    selectedType === 'community' 
                      ? 'e.g. Aeirmist Explorers' 
                      : selectedType === 'team' 
                        ? 'e.g. Core Engineering Team' 
                        : 'e.g. Weekend Crew'
                  }
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm font-semibold text-white focus:outline-none focus:border-cyan-400/50 transition-colors"
                  autoFocus
                />
              </div>
            </div>

            {/* Creator Admin Notice (Messenger Style) */}
            <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-start gap-3">
              <div className="p-1.5 rounded-xl bg-cyan-400/20 text-cyan-300 shrink-0">
                <Crown size={16} />
              </div>
              <div className="text-left text-xs leading-relaxed">
                <p className="font-bold text-white">You will be the Admin</p>
                <p className="text-[11px] text-white/60 mt-0.5">
                  As the creator, you can add or remove members and grant Admin privileges to anyone at any time.
                </p>
              </div>
            </div>

            {/* Creation Date Preview */}
            <div className="text-center text-[10px] text-white/40 font-mono">
              Created on {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-white/5">
              <button 
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-2xl bg-white/5 text-white/70 hover:text-white text-xs font-semibold uppercase tracking-wider"
              >
                Back
              </button>
              <button 
                type="button"
                disabled={isLoading || !groupName.trim()}
                onClick={handleCreate}
                className="flex-[2] py-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black text-xs font-extrabold uppercase tracking-wider disabled:opacity-40 hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>Create {activeChannelConfig.title.replace('Create ', '')}</span>
                )}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};
