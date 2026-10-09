import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { X, Camera, Search, Check, Loader2, Image as ImageIcon } from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { messagingService } from '../../modules/messaging/MessagingService';
import { getAvatarUrl } from '../../lib/avatar';
import { collection, query, getDocs, limit } from 'firebase/firestore';
import { logger } from '@/src/utils/logger';


interface GroupCreationModalProps {
  onClose: () => void;
  onGroupCreated?: (groupId: string, groupData?: any) => void;
  chats?: any[];
}

// Fallback demo contacts if database has no other profiles yet
const FALLBACK_CONTACTS = [
  { id: 'usr_nishat', displayName: 'Nishat Tasnim', username: 'or else settings tehekeo', photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200' },
  { id: 'usr_shahriar_a', displayName: 'Shahriar A. Tasim', username: '???', photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200' },
  { id: 'usr_shahriar', displayName: 'Shahriar Aman', username: 'hili', photoURL: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200' },
  { id: 'usr_shajidur', displayName: 'Shajidur Rahman', username: 'hosting kinle', photoURL: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&q=80&w=200' },
  { id: 'usr_abdullah', displayName: 'Abdullah Al', username: 'hi', photoURL: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=200' }
];

export const GroupCreationModal: React.FC<GroupCreationModalProps> = ({ onClose, onGroupCreated, chats = [] }) => {
    const { allProfiles, suggestedUsers, profile, user, db, addToast } = useAeirmist();
    const [step, setStep] = useState(1);
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [groupName, setGroupName] = useState('');
    const [groupPhoto, setGroupPhoto] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingUsers, setIsFetchingUsers] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [firestoreProfiles, setFirestoreProfiles] = useState<any[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            addToast({ title: 'File too large', message: 'Group picture must be under 5MB.', type: 'warning' });
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            setGroupPhoto(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    // Fetch users from Firestore on mount
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
                logger.warn('Failed to fetch Firestore profiles for group modal:', e);
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

    // Combined unique list of candidates
    const availablePeople = useMemo(() => {
        const unique = new Map<string, any>();

        // 1. Suggested Users
        (suggestedUsers || []).forEach(p => {
            if (p && p.id) unique.set(p.id, p);
        });

        // 2. Chat Users
        chatUsers.forEach(p => {
            if (p && p.id && !unique.has(p.id)) unique.set(p.id, p);
        });

        // 3. Firestore Profiles
        firestoreProfiles.forEach(p => {
            if (p && p.id && !unique.has(p.id)) unique.set(p.id, p);
        });

        // 4. Local Profiles
        (allProfiles || []).forEach(p => {
            if (p && p.id && !unique.has(p.id)) unique.set(p.id, p);
        });

        // 5. Fallbacks if list is sparse
        if (unique.size < 3) {
            FALLBACK_CONTACTS.forEach(p => {
                if (!unique.has(p.id)) unique.set(p.id, p);
            });
        }

        // Filter out current user
        return Array.from(unique.values()).filter(p => p.id !== profile?.id && p.uid !== user?.uid);
    }, [suggestedUsers, chatUsers, firestoreProfiles, allProfiles, profile?.id, user?.uid]);

    const toggleMember = (id: string) => {
        setSelectedMembers(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
    };

    const handleCreate = async () => {
        if (!groupName.trim() || selectedMembers.length === 0 || !profile) return;
        setIsLoading(true);
        try {
            const selectedMemberUids = selectedMembers.map(id => {
                const found = availablePeople.find(p => p.id === id);
                return found?.uid || found?.ownerUid || id;
            });

            const newGroupId = await messagingService.createGroupConversation(
                db, 
                profile.id, 
                selectedMembers, 
                groupName.trim(), 
                groupPhoto || undefined,
                user?.uid || profile.id,
                selectedMemberUids
            );

            addToast({ title: 'Group Created', message: 'Your group is ready.', type: 'success' });
            
            const newGroupData = {
                id: newGroupId,
                name: groupName.trim(),
                groupName: groupName.trim(),
                photo: groupPhoto || '',
                groupPhotoURL: groupPhoto || '',
                profileIds: [profile.id, ...selectedMembers],
                participants: [user?.uid || profile.id, ...selectedMemberUids]
            };

            if (onGroupCreated) {
                onGroupCreated(newGroupId, newGroupData);
            } else {
                onClose();
            }
        } catch (e) {
            logger.error('Group creation error:', e);
            addToast({ title: 'Error', message: 'Failed to create group.', type: 'warning' });
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

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
            <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-[#181A20] w-full max-w-sm rounded-3xl border border-white/10 p-6 shadow-2xl flex flex-col gap-6 text-white"
            >
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <h2 className="text-base font-bold text-white tracking-tight">
                        {step === 1 ? 'New Group' : 'Group Details'}
                    </h2>
                    <button onClick={onClose} className="text-white/40 hover:text-white transition-colors cursor-pointer"><X size={20} /></button>
                </div>

                {step === 1 && (
                    <div className="flex-1 flex flex-col gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                            <input 
                                type="text"
                                placeholder="Search friends..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-aeirmist-cyan/50 transition-colors"
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto max-h-64 space-y-1 custom-scrollbar pr-1">
                            {isFetchingUsers && availablePeople.length === 0 ? (
                                <div className="py-8 text-center text-white/40 flex flex-col items-center gap-2">
                                    <Loader2 className="animate-spin text-aeirmist-cyan" size={20} />
                                    <p className="text-xs">Loading people...</p>
                                </div>
                            ) : filteredProfiles.length === 0 ? (
                                <div className="py-8 text-center text-white/40 text-xs">
                                    No friends found.
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
                                                    ? 'bg-aeirmist-cyan/15 border border-aeirmist-cyan/40 text-white' 
                                                    : 'hover:bg-white/5 border border-transparent text-white/80 hover:text-white'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <img 
                                                    src={getAvatarUrl(p.photoURL || p.photo)} 
                                                    className="w-9 h-9 rounded-2xl object-cover shrink-0 border border-white/10" 
                                                    alt="" 
                                                />
                                                <div className="text-left min-w-0">
                                                    <p className="text-xs font-semibold text-white truncate">{p.displayName || p.name || p.username}</p>
                                                    <p className="text-[10px] text-white/40 truncate">@{p.username || p.id}</p>
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div className="w-5 h-5 rounded-full bg-aeirmist-cyan text-black flex items-center justify-center shrink-0">
                                                    <Check size={12} strokeWidth={3} />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        <button 
                            disabled={selectedMembers.length === 0}
                            onClick={() => setStep(2)}
                            className="w-full py-3 rounded-2xl bg-aeirmist-cyan text-black text-xs font-bold uppercase tracking-wider disabled:opacity-40 transition-all cursor-pointer hover:bg-aeirmist-cyan/90"
                        >
                            Next ({selectedMembers.length})
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <div className="flex-1 flex flex-col gap-5">
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            accept="image/*" 
                            onChange={handleImageSelect} 
                            className="hidden" 
                        />
                        <div className="flex flex-col items-center gap-4 py-2">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="group relative w-24 h-24 rounded-3xl bg-white/5 flex flex-col items-center justify-center border border-dashed border-white/20 hover:border-aeirmist-cyan/50 transition-all overflow-hidden cursor-pointer"
                            >
                                {groupPhoto ? (
                                    <>
                                        <img src={groupPhoto} className="w-full h-full object-cover" alt="Group" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold uppercase tracking-wider">
                                            Change
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center gap-1.5 text-white/40 group-hover:text-aeirmist-cyan transition-colors">
                                        <Camera size={26} />
                                        <span className="text-[10px] font-medium">Add Photo</span>
                                    </div>
                                )}
                            </button>
                            {groupPhoto && (
                                <button 
                                    type="button" 
                                    onClick={() => setGroupPhoto(null)} 
                                    className="text-[10px] text-red-400 hover:underline"
                                >
                                    Remove photo
                                </button>
                            )}
                            <input 
                                type="text"
                                placeholder="Group Name"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-xs text-white text-center focus:outline-none focus:border-aeirmist-cyan/50"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button 
                                type="button"
                                onClick={() => setStep(1)}
                                className="flex-1 py-3 rounded-2xl bg-white/5 text-white/70 hover:text-white text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-white/10"
                            >
                                Back
                            </button>
                            <button 
                                type="button"
                                disabled={isLoading || !groupName.trim()}
                                onClick={handleCreate}
                                className="flex-[2] py-3 rounded-2xl bg-aeirmist-cyan text-black text-xs font-bold uppercase tracking-wider disabled:opacity-40 hover:bg-aeirmist-cyan/90 transition-all cursor-pointer"
                            >
                                {isLoading ? 'Creating...' : 'Create Group'}
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
};

