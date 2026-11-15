import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, UserPlus, Crown, UserMinus, Camera, Edit3, Phone, Video, 
  Search, Bell, BellOff, Palette, Smile, Image as ImageIcon, 
  FileText, Link as LinkIcon, LogOut, ShieldCheck, ChevronRight, ChevronDown,
  Lock, Check, Loader2, User, AlertTriangle, AtSign, Tag, Trash2, Users, Info,
  Copy, Share2, Shield, Settings, Volume2, VolumeX, Sparkles, MessageSquare
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { messagingService } from '../../modules/messaging/MessagingService';
import { getAvatarUrl, resolveAvatarSrc, getGroupAvatarUrl } from '../../lib/avatar';
import { useSharedProfile } from '../../hooks/useSharedProfile';
import { api } from '../../services/api/client';
import { Avatar } from '../ui/Avatar';
import { collection, query, getDocs, limit } from 'firebase/firestore';
import { MemberDetailsSheet } from './MemberDetailsSheet';
import { SharedGroupMediaModal } from './SharedGroupMediaModal';
import { logger } from '@/src/utils/logger';

const ERA_AI_ID = '00000000-0000-4000-a000-000000000001';

const GroupMemberAvatar: React.FC<{
  mem: any;
  isOnline?: boolean;
  showStatus?: boolean;
  sizeClassName?: string;
}> = React.memo(({ mem, isOnline = false, showStatus = false, sizeClassName = 'w-10 h-10' }) => {
  const memId = mem?.id || mem?.uid || '';
  const shared = useSharedProfile(null, memId);
  const isEra =
    memId === ERA_AI_ID ||
    mem?.username === 'era' ||
    String(mem?.displayName || '').toLowerCase() === 'era ai' ||
    shared?.username === 'era';

  const photo =
    (isEra ? 'ai:era_official' : null) ||
    shared?.photoURL ||
    resolveAvatarSrc(shared?.avatarKey) ||
    resolveAvatarSrc(mem?.photoURL) ||
    resolveAvatarSrc(mem?.avatarKey) ||
    null;

  return (
    <div className="relative shrink-0">
      <Avatar
        src={photo}
        userId={isEra ? ERA_AI_ID : memId}
        alt={mem?.displayName || mem?.username || 'Member'}
        sizeClassName={sizeClassName}
        roundedClassName="rounded-xl"
        innerRoundedClassName="rounded-[10px]"
      />
      {showStatus && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#0D1117] p-0.5 flex items-center justify-center z-10">
          <div className={`w-full h-full rounded-full transition-colors ${isOnline ? 'bg-aeirmist-lime shadow-sm shadow-aeirmist-lime/50' : 'bg-zinc-600/80 border border-white/10'}`} />
        </div>
      )}
    </div>
  );
});


interface GroupInfoPanelProps {
  chat: any;
  onClose: () => void;
  onInitiateCall?: (type: 'audio' | 'video') => void;
  onOpenWallpaper?: () => void;
  chats?: any[];
  onDirectMessage?: (member: any) => void;
}

export const GroupInfoPanel: React.FC<GroupInfoPanelProps> = ({ chat, onClose, onInitiateCall, onOpenWallpaper, chats = [], onDirectMessage }) => {
  const { profile, user, db, addToast, allProfiles, suggestedUsers, onlineUsers } = useAeirmist();
  
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
  const [openSections, setOpenSections] = useState<{
    chatInfo: boolean;
    customize: boolean;
    members: boolean;
    media: boolean;
    privacy: boolean;
  }>({
    chatInfo: false,
    customize: false,
    members: false,
    media: false,
    privacy: false,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Nicknames State
  const [nicknames, setNicknames] = useState<Record<string, string>>(chat.nicknames || {});
  const [editingNicknameUser, setEditingNicknameUser] = useState<any | null>(null);
  const [nicknameInput, setNicknameInput] = useState('');
  const [isSavingNickname, setIsSavingNickname] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fetchedMemberProfiles, setFetchedMemberProfiles] = useState<Record<string, any>>({});

  const currentUserId = profile?.id || user?.uid || '';
  const ownerId = chat.owner || chat.createdBy || chat.ownerId;
  const admins: string[] = chat.admins || [];
  const isOwner = currentUserId === ownerId;
  const isAdmin = isOwner || admins.includes(currentUserId);
  const memberProfileIds: string[] = useMemo(() => {
    const ids: string[] = [];
    if (Array.isArray(chat.profileIds) && chat.profileIds.length > 0) {
      chat.profileIds.forEach((p: any) => {
        const pid = typeof p === 'string' ? p : (p?.userId || p?.id || p?.uid);
        if (pid && !ids.includes(pid)) ids.push(pid);
      });
    }
    if (Array.isArray(chat.participants) && chat.participants.length > 0) {
      chat.participants.forEach((p: any) => {
        const pid = typeof p === 'string' ? p : (p?.userId || p?.id || p?.uid);
        if (pid && !ids.includes(pid)) ids.push(pid);
      });
    }
    if (ids.length === 0 && chat.participantDetails) {
      Object.keys(chat.participantDetails).forEach(k => {
        if (k && !ids.includes(k)) ids.push(k);
      });
    }
    return ids;
  }, [chat.profileIds, chat.participants, chat.participantDetails]);

  // Update input state if chat changes
  useEffect(() => {
    setGroupNameInput(chat.groupName || chat.name || '');
    if (chat.nicknames) {
      setNicknames(chat.nicknames);
    }
  }, [chat]);

  // Fetch PostgreSQL + Firestore profiles when Add Member modal opens
  useEffect(() => {
    if (!showAddMemberModal) return;
    let isMounted = true;
    const fetchRemote = async () => {
      setIsFetchingRemote(true);
      const list: any[] = [];
      try {
        const res = await api.users.getSuggestions(200);
        if (res && Array.isArray(res.users)) {
          res.users.forEach((u: any) => {
            list.push({
              ...u,
              id: u.profileId || u.id || u.userId,
              photoURL: resolveAvatarSrc(u.avatarKey) || resolveAvatarSrc(u.photoURL) || null,
            });
          });
        }
      } catch (err) {
        logger.warn('Failed fetching PostgreSQL profiles for group:', err);
      }
      if (db) {
        try {
          const q = query(collection(db, 'profiles'), limit(100));
          const snap = await getDocs(q);
          snap.docs.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
        } catch (err) {
          logger.warn('Failed fetching remote profiles for group:', err);
        }
      }
      if (isMounted) {
        setFirestoreProfiles(list);
        setIsFetchingRemote(false);
      }
    };
    fetchRemote();
    return () => { isMounted = false; };
  }, [showAddMemberModal, db]);

  // Accurately fetch missing member profile docs from PostgreSQL API, Firestore and chats cache
  useEffect(() => {
    let isMounted = true;
    const loadMissingProfiles = async () => {
      if (memberProfileIds.length === 0) return;
      const missingIds = memberProfileIds.filter(id => {
        if (id === currentUserId || id === profile?.id || id === user?.uid) return false;
        if (chat.participantDetails?.[id]?.displayName && chat.participantDetails[id].displayName !== 'Aeirmist Member' && chat.participantDetails[id]?.photoURL) return false;
        return true;
      });

      if (missingIds.length === 0) return;
      const newMap: Record<string, any> = {};

      for (const mId of missingIds) {
        if (mId === ERA_AI_ID || mId === 'era') {
          newMap[mId] = {
            id: ERA_AI_ID,
            displayName: 'Era AI',
            username: 'era',
            photoURL: 'ai:era_official',
            isVerified: true,
          };
          continue;
        }
        try {
          const res: any = await api.users.getProfile(mId);
          if (res?.profile) {
            const p = res.profile;
            newMap[mId] = {
              id: mId,
              displayName: p.displayName || p.username,
              username: p.username,
              photoURL: resolveAvatarSrc(p.avatarKey) || resolveAvatarSrc(p.photoURL),
              isVerified: Boolean(p.isVerified === true || p.badge === 'verified' || p.badge === 'admin'),
              badge: p.badge,
            };
          }
        } catch {}
      }

      // 1. Resolve from existing chats list (instant cache)
      (chats || []).forEach((c: any) => {
        const p1 = c.otherParticipantId;
        const p2 = c.otherParticipantUid;
        const op = c.otherProfile;
        missingIds.forEach(mId => {
          if (!newMap[mId]) {
            if ((p1 === mId || p2 === mId || c.profileIds?.includes(mId) || c.participants?.includes(mId)) && (op?.displayName || c.name)) {
              newMap[mId] = {
                id: mId,
                displayName: op?.displayName || c.name,
                username: op?.username || c.username,
                photoURL: op?.photoURL || c.photo,
                isVerified: Boolean(op?.isVerified === true || op?.verified === true || op?.badge === 'verified'),
                badge: op?.badge
              };
            }
            if (c.participantDetails?.[mId]?.displayName && c.participantDetails[mId].displayName !== 'Aeirmist Member') {
              newMap[mId] = c.participantDetails[mId];
            }
          }
        });
      });

      // 2. Fetch directly from Firestore profiles collection
      if (db) {
        for (const mId of missingIds) {
          if (newMap[mId]?.displayName && newMap[mId].displayName !== 'Aeirmist Member') continue;
          try {
            const { doc, getDoc } = await import('firebase/firestore');
            const docRef = doc(db, 'profiles', mId);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
              const data = snap.data();
              newMap[mId] = {
                id: mId,
                displayName: data.displayName || data.name || data.username,
                username: data.username,
                photoURL: data.photoURL || data.avatarKey,
                isVerified: Boolean(data.isVerified === true || data.verified === true || data.badge === 'verified' || data.isAdmin === true),
                badge: data.badge
              };
              continue;
            }
            const docRef2 = doc(db, 'profiles', `profile_${mId}`);
            const snap2 = await getDoc(docRef2);
            if (snap2.exists()) {
              const data = snap2.data();
              newMap[mId] = {
                id: mId,
                displayName: data.displayName || data.name || data.username,
                username: data.username,
                photoURL: data.photoURL || data.avatarKey,
                isVerified: Boolean(data.isVerified === true || data.verified === true || data.badge === 'verified' || data.isAdmin === true),
                badge: data.badge
              };
            }
          } catch (e) {
            logger.warn('Failed to load profile for member:', mId, e);
          }
        }
      }

      if (isMounted && Object.keys(newMap).length > 0) {
        setFetchedMemberProfiles(prev => ({ ...prev, ...newMap }));
      }
    };

    loadMissingProfiles();
    return () => { isMounted = false; };
  }, [memberProfileIds.join(','), db, currentUserId, profile?.id, user?.uid, chat.participantDetails, chats]);

  // Combine available user profiles to resolve member details with Canonical Identity Resolution
  const resolvedMembers = useMemo(() => {
    const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const formatHandle = (mem: any, fallbackId: string) => {
      const u = String(mem?.username || '').trim();
      if (u && !isUuid(u) && u !== fallbackId && u !== 'unknown' && u !== 'member') return u.replace(/^@+/, '');
      const d = String(mem?.displayName || mem?.name || '').trim();
      if (d && d !== 'Aeirmist Member' && d !== 'Member' && d !== 'You') {
        const slug = d.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        if (slug) return slug;
      }
      return 'member';
    };

    // 1. Pre-build Canonical Identity Map: Map every alias (profileId, firebaseUid, username, id) to canonical userId
    const aliasToCanonical = new Map<string, string>();

    // Current user aliases
    const myCanonical = profile?.userId || profile?.id || currentUserId || user?.uid;
    if (myCanonical) {
      if (profile?.id) aliasToCanonical.set(profile.id, myCanonical);
      if (user?.uid) aliasToCanonical.set(user.uid, myCanonical);
      if (profile?.userId) aliasToCanonical.set(profile.userId, myCanonical);
      if (currentUserId) aliasToCanonical.set(currentUserId, myCanonical);
      if (profile?.username) aliasToCanonical.set('u:' + profile.username.toLowerCase(), myCanonical);
    }

    // Helper to register entity aliases into canonical map
    const registerAliases = (uId?: string, pId?: string, fUid?: string, uname?: string) => {
      const canon = uId || pId || fUid;
      if (!canon) return;
      if (uId) aliasToCanonical.set(uId, canon);
      if (pId) aliasToCanonical.set(pId, canon);
      if (fUid) aliasToCanonical.set(fUid, canon);
      if (uname && uname !== 'member' && uname !== 'unknown' && !isUuid(uname)) {
        aliasToCanonical.set('u:' + uname.toLowerCase().replace(/^@+/, ''), canon);
      }
    };

    // Scan participantDetails
    if (chat.participantDetails) {
      Object.entries(chat.participantDetails).forEach(([k, detail]: [string, any]) => {
        if (!detail) return;
        const uId = detail.userId;
        const pId = detail.profileId || (isUuid(k) ? k : undefined);
        const fUid = detail.firebaseUid || (!isUuid(k) ? k : undefined);
        const canon = uId || detail.id || pId || fUid || k;
        if (canon) {
          aliasToCanonical.set(k, canon);
          registerAliases(uId, pId, fUid, detail.username);
        }
      });
    }

    // Scan participantObjects and participants array
    const partsArray = Array.isArray(chat.participants) ? chat.participants : [];
    partsArray.forEach((p: any) => {
      if (typeof p === 'object' && p !== null) {
        registerAliases(p.userId, p.profileId || p.id, p.firebaseUid || p.uid, p.username);
      }
    });

    // Scan fetchedMemberProfiles
    Object.entries(fetchedMemberProfiles).forEach(([k, p]: [string, any]) => {
      if (!p) return;
      registerAliases(p.userId, p.id || k, p.firebaseUid, p.username);
    });

    // Scan allProfiles and suggestedUsers
    [...(allProfiles || []), ...(suggestedUsers || [])].forEach((p: any) => {
      if (!p) return;
      registerAliases(p.userId, p.id, p.uid, p.username);
    });

    const rawList = memberProfileIds.map((memId: string) => {
      const isMe = Boolean(
        memId === currentUserId || 
        memId === profile?.id || 
        memId === user?.uid ||
        memId === profile?.userId ||
        aliasToCanonical.get(memId) === myCanonical
      );

      if (isMe) {
        return {
          id: memId,
          canonicalId: myCanonical,
          displayName: profile?.displayName || profile?.name || 'You',
          username: formatHandle(profile, memId),
          photoURL: profile?.photoURL,
          isVerified: Boolean(profile?.isVerified === true || profile?.verified === true || profile?.badge === 'verified' || profile?.isAdmin === true),
          badge: profile?.badge,
          role: chat.owner === memId || chat.ownerId === memId ? 'owner' : (admins.includes(memId) ? 'admin' : undefined),
          isMe: true,
        };
      }

      // 1. Check participantDetails
      const detail = chat.participantDetails?.[memId];
      if (detail && detail.displayName && detail.displayName !== 'Aeirmist Member') {
        const cId = aliasToCanonical.get(memId) || detail.userId || memId;
        return { 
          id: memId, 
          canonicalId: cId,
          ...detail,
          username: formatHandle(detail, memId),
          photoURL: detail.photoURL || detail.photo || detail.avatarKey,
          isVerified: Boolean(detail.isVerified === true || detail.verified === true || detail.badge === 'verified' || detail.isAdmin === true),
          badge: detail.badge,
          role: detail.role,
        };
      }

      // 2. Check chat.participants array of objects
      if (Array.isArray(chat.participants)) {
        const foundObj = chat.participants.find((p: any) => typeof p === 'object' && p !== null && (p.userId === memId || p.id === memId || p.uid === memId || p.profileId === memId));
        if (foundObj && (foundObj.displayName || foundObj.username)) {
          const cId = foundObj.userId || aliasToCanonical.get(memId) || memId;
          return {
            id: memId,
            canonicalId: cId,
            displayName: foundObj.displayName || foundObj.name || foundObj.username,
            username: formatHandle(foundObj, memId),
            photoURL: foundObj.photoURL || foundObj.avatarKey,
            isVerified: Boolean(foundObj.isVerified === true || foundObj.badge === 'verified' || foundObj.isAdmin === true),
            badge: foundObj.badge,
            role: foundObj.role,
          };
        }
      }

      // 3. Check fetchedMemberProfiles
      const fetched = fetchedMemberProfiles[memId];
      if (fetched && fetched.displayName && fetched.displayName !== 'Aeirmist Member') {
        const cId = fetched.userId || aliasToCanonical.get(memId) || memId;
        return {
          id: memId,
          canonicalId: cId,
          ...fetched,
          username: formatHandle(fetched, memId),
          photoURL: fetched.photoURL || fetched.photo || fetched.avatarKey,
          isVerified: Boolean(fetched.isVerified === true || fetched.verified === true || fetched.badge === 'verified' || fetched.isAdmin === true),
          badge: fetched.badge,
          role: fetched.role,
        };
      }

      // 4. Check chats list
      for (const c of (chats || [])) {
        if (c.otherParticipantId === memId || c.otherParticipantUid === memId || c.profileIds?.includes(memId) || c.participants?.includes(memId)) {
          const cand = c.otherProfile || c.participantDetails?.[memId];
          const candName = cand?.displayName || c.name;
          if (candName && candName !== 'Aeirmist Member') {
            const cId = cand?.userId || aliasToCanonical.get(memId) || memId;
            return {
              id: memId,
              canonicalId: cId,
              displayName: candName,
              username: formatHandle(cand || { username: c.username, displayName: candName }, memId),
              photoURL: cand?.photoURL || c.photo,
              isVerified: Boolean(cand?.isVerified === true || cand?.verified === true || cand?.badge === 'verified' || cand?.isAdmin === true),
              badge: cand?.badge,
              role: cand?.role,
            };
          }
        }
      }
      
      // 5. Check allProfiles
      const foundInAll = (allProfiles || []).find((p: any) => p.id === memId || p.uid === memId || p.userId === memId);
      if (foundInAll && (foundInAll.displayName || foundInAll.username)) {
        const cId = foundInAll.userId || aliasToCanonical.get(memId) || memId;
        return {
          id: memId,
          canonicalId: cId,
          ...foundInAll,
          displayName: foundInAll.displayName || foundInAll.name || foundInAll.username,
          username: formatHandle(foundInAll, memId),
          photoURL: foundInAll.photoURL || foundInAll.avatarKey,
          isVerified: Boolean(foundInAll.isVerified === true || foundInAll.verified === true || foundInAll.badge === 'verified' || foundInAll.isAdmin === true),
          badge: foundInAll.badge,
          role: foundInAll.role,
        };
      }

      // 6. Check suggestedUsers
      const foundInSugg = (suggestedUsers || []).find((p: any) => p.id === memId || p.uid === memId || p.userId === memId);
      if (foundInSugg && (foundInSugg.displayName || foundInSugg.username)) {
        const cId = foundInSugg.userId || aliasToCanonical.get(memId) || memId;
        return {
          id: memId,
          canonicalId: cId,
          ...foundInSugg,
          displayName: foundInSugg.displayName || foundInSugg.name || foundInSugg.username,
          username: formatHandle(foundInSugg, memId),
          photoURL: foundInSugg.photoURL || foundInSugg.avatarKey,
          isVerified: Boolean(foundInSugg.isVerified === true || foundInSugg.verified === true || foundInSugg.badge === 'verified' || foundInSugg.isAdmin === true),
          badge: foundInSugg.badge,
          role: foundInSugg.role,
        };
      }

      return {
        id: memId,
        canonicalId: aliasToCanonical.get(memId) || memId,
        displayName: 'Aeirmist Member',
        photoURL: null,
        username: 'member',
        isVerified: false,
        badge: null
      };
    });

    // Deduplicate members across PostgreSQL UUID, Firebase UID, and username
    const dedupedMap = new Map<string, any>();
    for (const mem of rawList) {
      const isMe = Boolean(
        mem.isMe ||
        mem.canonicalId === myCanonical ||
        mem.id === currentUserId ||
        mem.id === profile?.id ||
        mem.id === user?.uid ||
        (profile?.username && mem.username && mem.username.toLowerCase() === profile.username.toLowerCase())
      );

      let key = '';
      if (isMe) {
        key = '__ME__';
      } else if (mem.canonicalId && mem.canonicalId !== mem.id && !isUuid(mem.canonicalId)) {
        key = 'c:' + mem.canonicalId;
      } else if (mem.canonicalId && isUuid(mem.canonicalId)) {
        key = 'uid:' + mem.canonicalId;
      } else if (mem.username && mem.username !== 'member' && mem.username !== 'unknown' && !isUuid(mem.username)) {
        key = 'u:' + mem.username.toLowerCase().replace(/^@+/, '');
      } else if (mem.displayName && mem.displayName !== 'Aeirmist Member' && mem.displayName !== 'Member') {
        key = 'd:' + mem.displayName.toLowerCase().trim();
      } else {
        key = 'id:' + (mem.id || mem.uid);
      }

      if (dedupedMap.has(key)) {
        const existing = dedupedMap.get(key);
        const allIds = Array.from(new Set([...(existing.allIds || [existing.id]), ...(mem.allIds || [mem.id])].filter(Boolean)));
        const bestName = (existing.displayName && existing.displayName !== 'Aeirmist Member') ? existing.displayName : mem.displayName;
        const bestUsername = (existing.username && existing.username !== 'member' && !isUuid(existing.username)) ? existing.username : mem.username;
        const bestPhoto = existing.photoURL || mem.photoURL;
        const isVerified = Boolean(existing.isVerified || mem.isVerified);
        const badge = existing.badge || mem.badge;
        const bestRole = existing.role || mem.role;

        dedupedMap.set(key, {
          ...existing,
          ...mem,
          displayName: bestName,
          username: bestUsername,
          photoURL: bestPhoto,
          isVerified,
          badge,
          role: bestRole,
          isMe: existing.isMe || isMe,
          allIds
        });
      } else {
        dedupedMap.set(key, {
          ...mem,
          isMe,
          allIds: [mem.id].filter(Boolean)
        });
      }
    }

    // Secondary consolidation pass: ensure no two cards share the same non-trivial display name or username
    const finalMap = new Map<string, any>();
    for (const mem of dedupedMap.values()) {
      if (mem.isMe) {
        finalMap.set('__ME__', mem);
        continue;
      }

      const uKey = (mem.username && mem.username !== 'member' && !isUuid(mem.username)) ? 'u:' + mem.username.toLowerCase().replace(/^@+/, '') : null;
      const dKey = (mem.displayName && mem.displayName !== 'Aeirmist Member') ? 'd:' + mem.displayName.toLowerCase().trim() : null;

      let matchedKey: string | null = null;
      for (const [k, existing] of finalMap.entries()) {
        if (existing.isMe) continue;
        if (uKey && existing.username && existing.username.toLowerCase().replace(/^@+/, '') === mem.username.toLowerCase().replace(/^@+/, '')) {
          matchedKey = k;
          break;
        }
        if (dKey && existing.displayName && existing.displayName.toLowerCase().trim() === mem.displayName.toLowerCase().trim()) {
          matchedKey = k;
          break;
        }
      }

      if (matchedKey) {
        const existing = finalMap.get(matchedKey);
        const allIds = Array.from(new Set([...(existing.allIds || []), ...(mem.allIds || [mem.id])].filter(Boolean)));
        finalMap.set(matchedKey, {
          ...existing,
          photoURL: existing.photoURL || mem.photoURL,
          isVerified: Boolean(existing.isVerified || mem.isVerified),
          allIds,
        });
      } else {
        finalMap.set(mem.canonicalId || mem.id, mem);
      }
    }

    const uniqueMembers = Array.from(finalMap.values());
    uniqueMembers.sort((a, b) => {
      if (a.isMe && !b.isMe) return -1;
      if (!a.isMe && b.isMe) return 1;
      const aIsAdmin = a.role === 'owner' || a.role === 'admin' || a.allIds?.some((id: string) => id === ownerId || admins.includes(id)) || a.id === ownerId || admins.includes(a.id);
      const bIsAdmin = b.role === 'owner' || b.role === 'admin' || b.allIds?.some((id: string) => id === ownerId || admins.includes(id)) || b.id === ownerId || admins.includes(b.id);
      if (aIsAdmin && !bIsAdmin) return -1;
      if (!aIsAdmin && bIsAdmin) return 1;
      return (a.displayName || '').localeCompare(b.displayName || '');
    });

    return uniqueMembers;
  }, [memberProfileIds, chat.participantDetails, chat.participants, fetchedMemberProfiles, chats, allProfiles, suggestedUsers, currentUserId, profile, user?.uid, ownerId, admins]);

  // Filter members list based on search and tab
  const filteredMembers = useMemo(() => {
    return resolvedMembers.filter(mem => {
      const allIds: string[] = mem.allIds || [mem.id || mem.uid].filter(Boolean);
      const memNick = allIds.map(id => nicknames[id]).find(Boolean) || '';
      const name = (mem.displayName || mem.name || '').toLowerCase();
      const nick = memNick.toLowerCase();
      const uname = (mem.username || '').toLowerCase();
      const q = searchMemberQuery.toLowerCase();

      const matchesQuery = !q || name.includes(q) || nick.includes(q) || uname.includes(q);

      if (!matchesQuery) return false;

      if (memberFilterTab === 'admins') {
        return allIds.some(id => id === ownerId || admins.includes(id)) || mem.id === ownerId || admins.includes(mem.id);
      }
      if (memberFilterTab === 'muted') {
        return allIds.some(id => !!chat.mutedMembers?.[id]) || !!chat.mutedMembers?.[mem.id];
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
      const idStr = String(uId || uUid || '').toLowerCase();
      const uname = String(u.username || '').toLowerCase();
      const dname = String(u.displayName || u.name || '').toLowerCase();
      if (
        idStr === '00000000-0000-4000-a000-000000000001' ||
        idStr === 'system' ||
        idStr.includes('00000000-0000-4000-a000-000000000001') ||
        uname === 'era' ||
        uname === 'system' ||
        dname === 'era ai' ||
        dname === 'system'
      ) {
        return true; // Exclude system & Era AI from add candidates
      }
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

    setIsUpdating(true);
    try {
      let finalPhotoUrl = '';
      try {
        const uploadRes = await api.media.upload(file, `chats/groups`);
        finalPhotoUrl = uploadRes?.url || '';
      } catch (uploadErr) {
        logger.warn('Direct media upload failed, using dataURL fallback:', uploadErr);
      }

      if (!finalPhotoUrl) {
        const reader = new FileReader();
        finalPhotoUrl = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      await messagingService.updateGroupDetails(db, chat.id, { photoURL: finalPhotoUrl, avatarKey: finalPhotoUrl }, profile?.displayName);
      chat.groupPhotoURL = finalPhotoUrl;
      chat.photo = finalPhotoUrl;
      chat.avatarKey = finalPhotoUrl;
      addToast({ title: 'Photo Updated', message: 'Group picture has been changed.', type: 'success' });
    } catch (err) {
      logger.error('Failed to update group photo:', err);
      addToast({ title: 'Error', message: 'Failed to update photo.', type: 'warning' });
    } finally {
      setIsUpdating(false);
    }
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
        const found = availableToAdd.find(u => (u.id || u.uid || u.userId) === memId || u.id === memId || u.uid === memId);
        const canonId = found?.userId || found?.id || memId;
        newIdsToSubmit.push(canonId);

        const detailObj = {
          id: canonId,
          userId: found?.userId || canonId,
          profileId: found?.profileId || found?.id,
          firebaseUid: found?.uid || found?.firebaseUid,
          displayName: found?.displayName || found?.name || 'Aeirmist Member',
          photoURL: found?.photoURL || null,
          username: found?.username || memId,
          role: 'member'
        };

        detailsMap[canonId] = detailObj;
        if (found?.id) detailsMap[found.id] = detailObj;
        if (found?.uid && found.uid !== canonId) detailsMap[found.uid] = detailObj;
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

  const groupPhoto = getGroupAvatarUrl(chat.groupName || chat.name || (chat as any).title || 'Group Chat', chat.groupPhotoURL || chat.photo || chat.avatarKey);
  const groupTitle = chat.groupName || chat.name || (chat as any).title || 'Group Chat';

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

          <div className="flex flex-col items-center gap-1 mt-1 text-center">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                {chat.type === 'community' ? 'Community' : chat.type === 'team' ? 'Team' : 'Group'}
              </span>
              <span className="text-xs text-white/50 font-medium">
                {resolvedMembers.length} {resolvedMembers.length === 1 ? 'member' : 'members'}
              </span>
            </div>
            {(() => {
              const ts = chat.createdAt || chat.timestampMs || chat.created_at;
              if (!ts) return null;
              const d = new Date(typeof ts === 'number' ? ts : (ts.seconds ? ts.seconds * 1000 : ts));
              if (isNaN(d.getTime())) return null;
              return (
                <p className="text-[10px] text-white/40 font-mono mt-0.5">
                  Created on {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              );
            })()}
            {ownerId && (
              <p className="text-[10px] text-white/40 flex items-center gap-1">
                <span>👑 Created by <strong className="text-cyan-400">{resolvedMembers.find(m => (m.id || m.uid) === ownerId)?.displayName || 'Admin'}</strong></span>
              </p>
            )}
          </div>
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

        {/* MESSENGER APK 5 COLLAPSIBLE ACCORDION SECTIONS */}
        <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
          {/* 1. CHAT INFO */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('chatInfo')}
              className="w-full py-3.5 px-1 flex items-center justify-between text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
            >
              <span className="text-[14px] font-semibold text-white tracking-tight">Chat info</span>
              <ChevronDown
                size={18}
                className={`text-white/60 transition-transform duration-200 ${openSections.chatInfo ? 'rotate-180 text-aeirmist-cyan' : ''}`}
              />
            </button>
            <AnimatePresence initial={false}>
              {openSections.chatInfo && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="pb-3.5 space-y-2">
                    <div className="bg-white/5 border border-white/5 rounded-2xl p-3.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-white/50">Chat type</span>
                        <span className="font-bold text-cyan-300 uppercase text-[10px]">
                          {chat.type === 'community' ? 'Community' : chat.type === 'team' ? 'Team' : 'Group Chat'}
                        </span>
                      </div>
                      {chat.description && (
                        <div className="pt-1 border-t border-white/5 text-white/70 text-[11px]">
                          {chat.description}
                        </div>
                      )}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setIsEditingName(true)}
                          className="w-full mt-1 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-left text-xs font-semibold text-white flex items-center justify-between transition-colors"
                        >
                          <span className="flex items-center gap-2"><Edit3 size={14} className="text-aeirmist-cyan" /> Edit Group Name</span>
                          <ChevronRight size={14} className="text-white/40" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 2. CUSTOMIZE CHAT */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('customize')}
              className="w-full py-3.5 px-1 flex items-center justify-between text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
            >
              <span className="text-[14px] font-semibold text-white tracking-tight">Customize chat</span>
              <ChevronDown
                size={18}
                className={`text-white/60 transition-transform duration-200 ${openSections.customize ? 'rotate-180 text-aeirmist-cyan' : ''}`}
              />
            </button>
            <AnimatePresence initial={false}>
              {openSections.customize && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="pb-3.5">
                    <div className="bg-white/5 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
                      <button
                        type="button"
                        onClick={onOpenWallpaper}
                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/5 transition-colors text-xs font-bold text-white"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                            <Palette size={16} />
                          </div>
                          <span>Set Wallpaper / Theme</span>
                        </div>
                        <ChevronRight size={16} className="text-white/30" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowNicknamesModal(true)}
                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/5 transition-colors text-xs font-bold text-white"
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

                      <button
                        type="button"
                        onClick={handleCopyShareLink}
                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/5 transition-colors text-xs font-bold text-white"
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 3. CHAT MEMBERS */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('members')}
              className="w-full py-3.5 px-1 flex items-center justify-between text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-white tracking-tight">Chat members</span>
                <span className="text-[11px] font-bold text-white/45">({resolvedMembers.length})</span>
              </div>
              <ChevronDown
                size={18}
                className={`text-white/60 transition-transform duration-200 ${openSections.members ? 'rotate-180 text-aeirmist-cyan' : ''}`}
              />
            </button>
            <AnimatePresence initial={false}>
              {openSections.members && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pb-4 space-y-3 pt-1">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-white/40">
                        MEMBERS ({resolvedMembers.length})
                      </span>
                      <button
                        type="button"
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
                        type="button"
                        onClick={() => setMemberFilterTab('all')}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all ${memberFilterTab === 'all' ? 'bg-aeirmist-cyan text-black shadow-sm' : 'text-white/60 hover:text-white'}`}
                      >
                        All ({resolvedMembers.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setMemberFilterTab('admins')}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all ${memberFilterTab === 'admins' ? 'bg-aeirmist-cyan text-black shadow-sm' : 'text-white/60 hover:text-white'}`}
                      >
                        Admins ({resolvedMembers.filter(m => m.role === 'owner' || m.role === 'admin' || (m.allIds ? m.allIds.some((id: string) => id === ownerId || admins.includes(id)) : (m.id === ownerId || admins.includes(m.id)))).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setMemberFilterTab('muted')}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all ${memberFilterTab === 'muted' ? 'bg-aeirmist-cyan text-black shadow-sm' : 'text-white/60 hover:text-white'}`}
                      >
                        Muted ({resolvedMembers.filter(m => (m.allIds ? m.allIds.some((id: string) => !!chat.mutedMembers?.[id]) : !!chat.mutedMembers?.[m.id])).length})
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
                          const uid = mem.canonicalId || mem.id || mem.uid;
                          const allIds: string[] = mem.allIds || [uid].filter(Boolean);
                          const isMemOwner = mem.role === 'owner' || allIds.some((id: string) => id === ownerId) || chat.owner === uid || chat.ownerId === uid;
                          const isMemAdmin = isMemOwner || mem.role === 'admin' || allIds.some((id: string) => admins.includes(id));
                          const isMemMod = mem.role === 'moderator' || allIds.some((id: string) => chat.memberRoles?.[id] === 'moderator');
                          const isSelfMem = mem.isMe || allIds.some((id: string) => id === currentUserId || id === profile?.id || id === user?.uid);
                          const memNick = allIds.map((id: string) => nicknames[id]).find(Boolean) || '';
                          const displayName = mem.displayName || mem.name || (uid === ERA_AI_ID ? 'Era AI' : 'Aeirmist Member');
                          const rawUsername = mem.username || (uid === ERA_AI_ID ? 'era' : '');
                          const isHandleUuid = !rawUsername || /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(rawUsername) || rawUsername === 'member' || rawUsername === 'unknown';
                          const cleanHandle = isHandleUuid
                            ? (displayName && displayName !== 'Aeirmist Member' && displayName !== 'You' ? displayName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : 'member')
                            : rawUsername.replace(/^@+/, '');
                          const isVerified = Boolean(mem.isVerified === true || mem.verified === true || mem.badge === 'verified' || mem.badge === 'admin' || mem.isAdmin === true || uid === ERA_AI_ID);
                          const isMutedMem = allIds.some((id: string) => !!chat.mutedMembers?.[id]);
                          const isMemOnline = isSelfMem || uid === ERA_AI_ID || (!!onlineUsers && (
                            allIds.some((id: string) => onlineUsers?.has?.(id)) ||
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
                                <GroupMemberAvatar mem={mem} isOnline={isMemOnline} showStatus={true} />

                                {/* Display & Nickname */}
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-bold text-white truncate">
                                      {memNick || displayName}
                                    </span>

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
                                    @{cleanHandle}
                                  </span>
                                </div>
                              </div>

                              {/* Role Badge & Actions */}
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

                                {!isSelfMem && onDirectMessage && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onClose();
                                      onDirectMessage(mem);
                                    }}
                                    title={`Message ${displayName}`}
                                    className="p-1.5 rounded-xl text-white/40 hover:text-aeirmist-cyan hover:bg-white/10 transition-colors"
                                  >
                                    <MessageSquare size={14} />
                                  </button>
                                )}

                                <ChevronRight size={14} className="text-white/20 group-hover:text-white/60 transition-colors" />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 4. MEDIA, FILES AND LINKS */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('media')}
              className="w-full py-3.5 px-1 flex items-center justify-between text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
            >
              <span className="text-[14px] font-semibold text-white tracking-tight">Media, files and links</span>
              <ChevronDown
                size={18}
                className={`text-white/60 transition-transform duration-200 ${openSections.media ? 'rotate-180 text-aeirmist-cyan' : ''}`}
              />
            </button>
            <AnimatePresence initial={false}>
              {openSections.media && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="pb-3.5">
                    <div className="bg-white/5 border border-white/5 rounded-2xl divide-y divide-white/5 overflow-hidden">
                      <button
                        type="button"
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
                        type="button"
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 5. PRIVACY & SUPPORT */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection('privacy')}
              className="w-full py-3.5 px-1 flex items-center justify-between text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
            >
              <span className="text-[14px] font-semibold text-white tracking-tight">Privacy & support</span>
              <ChevronDown
                size={18}
                className={`text-white/60 transition-transform duration-200 ${openSections.privacy ? 'rotate-180 text-aeirmist-cyan' : ''}`}
              />
            </button>
            <AnimatePresence initial={false}>
              {openSections.privacy && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="pb-4 pt-1 space-y-2">
                    <button
                      type="button"
                      onClick={() => setIsMuted(!isMuted)}
                      className="w-full py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-white font-bold text-xs flex items-center justify-between transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        {isMuted ? <BellOff size={15} className="text-rose-400" /> : <Bell size={15} className="text-white/70" />}
                        {isMuted ? 'Unmute notifications' : 'Mute notifications'}
                      </span>
                      <span className="text-[10px] text-white/40">{isMuted ? 'Muted' : 'On'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowLeaveConfirm(true)}
                      className="w-full py-3.5 px-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                    >
                      <LogOut size={16} />
                      Leave Group
                    </button>

                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="w-full py-3.5 px-4 rounded-2xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-400 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                      >
                        <Trash2 size={16} />
                        Delete Group Permanently
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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
              if (onDirectMessage) {
                onClose();
                onDirectMessage(mem);
              } else {
                addToast({ title: 'Opening Chat', message: `Navigating to conversation with ${mem.displayName}`, type: 'info' });
              }
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
                          <GroupMemberAvatar mem={mem} sizeClassName="w-8 h-8" />
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
                    const isVerified = Boolean(usr.isVerified === true || usr.verified === true || usr.badge === 'verified' || usr.badge === 'admin' || usr.isAdmin === true);

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
                          <GroupMemberAvatar mem={usr} sizeClassName="w-9 h-9" />
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
