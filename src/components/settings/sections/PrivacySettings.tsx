import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Lock, 
  Eye, 
  EyeOff, 
  UserX, 
  ShieldAlert, 
  Search, 
  Check, 
  ChevronRight, 
  KeyRound, 
  Archive, 
  MessageSquare, 
  ShieldCheck, 
  Ghost, 
  UserCheck, 
  Loader2,
  Sparkles,
  Heart,
  AtSign,
  Trash2
} from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useAeirmist } from '../../../context/AeirmistContext';
import { getAvatarUrl } from '../../../lib/avatar';

export default function PrivacySettings() {
  const { 
    profile, 
    updateProfile, 
    addToast, 
    toggleBlockUser, 
    toggleRestrictUser, 
    isBlocked, 
    isRestricted,
    db
  } = useAeirmist();

  const [activeSubTab, setActiveSubTab] = useState<'controls' | 'blocked' | 'restricted' | 'vault'>('controls');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const { logActivity } = useAeirmist();

  // Privacy Checkup modal state
  const [showCheckupModal, setShowCheckupModal] = useState(false);
  const [checkupStep, setCheckupStep] = useState(0);

  // Vault state
  const [vaultPin, setVaultPin] = useState('');
  const [confirmVaultPin, setConfirmVaultPin] = useState('');
  const [showVaultPinModal, setShowVaultPinModal] = useState(false);
  const [isSavingPin, setIsSavingPin] = useState(false);

  // Sync privacy field updates
  const handleToggleSetting = async (key: string, currentValue: boolean) => {
    setIsUpdating(key);
    try {
      const nextValue = !currentValue;
      if (key.startsWith('messagingSettings.')) {
        const fieldName = key.replace('messagingSettings.', '');
        await updateProfile({
          messagingSettings: {
            ...(profile?.messagingSettings || {}),
            [fieldName]: nextValue
          }
        });
      } else {
        await updateProfile({ [key]: nextValue });
      }
      addToast({
        title: 'Privacy Setting Updated',
        message: `${key.replace(/([A-[Z])/g, ' $1')} has been updated.`,
        type: 'success'
      });
    } catch (err: any) {
      addToast({ title: 'Update Failed', message: 'Could not update privacy setting.', type: 'warning' });
    } finally {
      setIsUpdating(null);
    }
  };

  const handleSelectSetting = async (key: string, value: string) => {
    setIsUpdating(key);
    try {
      if (key.startsWith('messagingSettings.')) {
        const fieldName = key.replace('messagingSettings.', '');
        await updateProfile({
          messagingSettings: {
            ...(profile?.messagingSettings || {}),
            [fieldName]: value
          }
        });
      } else {
        await updateProfile({ [key]: value });
      }
      addToast({
        title: 'Privacy Setting Updated',
        message: 'Your preferences have been saved.',
        type: 'success'
      });
    } catch (err: any) {
      addToast({ title: 'Update Failed', message: 'Could not update setting.', type: 'warning' });
    } finally {
      setIsUpdating(null);
    }
  };

  // Blocked & Restricted users arrays
  const blockedUserIds: string[] = profile?.social?.blocked || [];
  const restrictedUserIds: string[] = profile?.social?.restricted || [];

  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [restrictedUsers, setRestrictedUsers] = useState<any[]>([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);
  const [isLoadingRestricted, setIsLoadingRestricted] = useState(false);

  // Real-time / direct loader for blocked user profiles
  useEffect(() => {
    let isMounted = true;
    if (!db || blockedUserIds.length === 0) {
      setBlockedUsers([]);
      setIsLoadingBlocked(false);
      return;
    }

    const fetchBlockedDetails = async () => {
      setIsLoadingBlocked(true);
      try {
        const loaded: any[] = [];
        for (const targetId of blockedUserIds) {
          if (!targetId) continue;
          
          // 1. Direct profile lookup by document ID
          try {
            const pRef = doc(db, 'profiles', targetId);
            const pSnap = await getDoc(pRef);
            if (pSnap.exists()) {
              loaded.push({ id: pSnap.id, ...pSnap.data() });
              continue;
            }
          } catch {}

          // 2. Query by ownerUid
          try {
            const q = query(collection(db, 'profiles'), where('ownerUid', '==', targetId), limit(1));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
              const d = qSnap.docs[0];
              loaded.push({ id: d.id, ...d.data() });
              continue;
            }
          } catch {}

          // 3. Query by uid
          try {
            const q = query(collection(db, 'profiles'), where('uid', '==', targetId), limit(1));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
              const d = qSnap.docs[0];
              loaded.push({ id: d.id, ...d.data() });
              continue;
            }
          } catch {}

          // 4. Fallback from users collection
          try {
            const uRef = doc(db, 'users', targetId);
            const uSnap = await getDoc(uRef);
            if (uSnap.exists()) {
              const uData = uSnap.data();
              loaded.push({
                id: targetId,
                displayName: uData?.displayName || uData?.name || 'Aeirmist User',
                username: uData?.username || targetId.slice(0, 8),
                avatarUrl: uData?.photoURL || uData?.avatarUrl || '',
                isVerified: uData?.isVerified || false,
                ...uData
              });
              continue;
            }
          } catch {}

          // 5. Clean fallback object so the row ALWAYS appears
          loaded.push({
            id: targetId,
            displayName: 'Blocked Account',
            username: targetId.length > 15 ? targetId.slice(0, 10) + '...' : targetId,
            avatarUrl: '',
            isVerified: false
          });
        }

        if (isMounted) {
          setBlockedUsers(loaded);
        }
      } catch (e) {
        console.warn('[PrivacySettings] Error fetching blocked details:', e);
      } finally {
        if (isMounted) setIsLoadingBlocked(false);
      }
    };

    fetchBlockedDetails();
    return () => { isMounted = false; };
  }, [db, blockedUserIds.join(',')]);

  // Real-time / direct loader for restricted user profiles
  useEffect(() => {
    let isMounted = true;
    if (!db || restrictedUserIds.length === 0) {
      setRestrictedUsers([]);
      setIsLoadingRestricted(false);
      return;
    }

    const fetchRestrictedDetails = async () => {
      setIsLoadingRestricted(true);
      try {
        const loaded: any[] = [];
        for (const targetId of restrictedUserIds) {
          if (!targetId) continue;
          try {
            const pRef = doc(db, 'profiles', targetId);
            const pSnap = await getDoc(pRef);
            if (pSnap.exists()) {
              loaded.push({ id: pSnap.id, ...pSnap.data() });
              continue;
            }
          } catch {}

          try {
            const q = query(collection(db, 'profiles'), where('ownerUid', '==', targetId), limit(1));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
              const d = qSnap.docs[0];
              loaded.push({ id: d.id, ...d.data() });
              continue;
            }
          } catch {}

          try {
            const uRef = doc(db, 'users', targetId);
            const uSnap = await getDoc(uRef);
            if (uSnap.exists()) {
              const uData = uSnap.data();
              loaded.push({
                id: targetId,
                displayName: uData?.displayName || uData?.name || 'Aeirmist User',
                username: uData?.username || targetId.slice(0, 8),
                avatarUrl: uData?.photoURL || uData?.avatarUrl || '',
                isVerified: uData?.isVerified || false,
                ...uData
              });
              continue;
            }
          } catch {}

          loaded.push({
            id: targetId,
            displayName: 'Restricted Account',
            username: targetId.length > 15 ? targetId.slice(0, 10) + '...' : targetId,
            avatarUrl: '',
            isVerified: false
          });
        }

        if (isMounted) {
          setRestrictedUsers(loaded);
        }
      } catch (e) {
        console.warn('[PrivacySettings] Error fetching restricted details:', e);
      } finally {
        if (isMounted) setIsLoadingRestricted(false);
      }
    };

    fetchRestrictedDetails();
    return () => { isMounted = false; };
  }, [db, restrictedUserIds.join(',')]);

  const blockedProfiles = blockedUsers.filter(p => 
    p.username?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const restrictedProfiles = restrictedUsers.filter(p => 
    p.username?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleUnblock = async (targetId: string, handle: string) => {
    try {
      setBlockedUsers(prev => prev.filter(u => u.id !== targetId));
      await toggleBlockUser(targetId);
      addToast({
        title: 'User Unblocked',
        message: `@${handle} has been removed from your blocked list. Interaction is now permitted.`,
        type: 'success',
        icon: <UserCheck size={18} />
      });
      await logActivity('user_unblock', `Restored access for user: @${handle}`);
    } catch (err: any) {
      addToast({ title: 'Action Failed', message: 'Could not restore user status.', type: 'warning' });
    }
  };

  const handleUnrestrict = async (targetId: string, handle: string) => {
    try {
      setRestrictedUsers(prev => prev.filter(u => u.id !== targetId));
      await toggleRestrictUser(targetId);
      addToast({
        title: 'Restriction Lifted',
        message: `Restrictions removed for @${handle}. They can now view your content again.`,
        type: 'success',
        icon: <ShieldCheck size={18} />
      });
      await logActivity('user_unrestrict', `Lifted interaction restriction for user: @${handle}`);
    } catch (err: any) {
      addToast({ title: 'Action Failed', message: 'Could not lift restriction.', type: 'warning' });
    }
  };

  const handleSaveVaultPin = async () => {
    if (vaultPin.length < 4) {
      addToast({ title: 'Validation Error', message: 'Vault passcode must be at least 4 digits.', type: 'warning' });
      return;
    }
    if (vaultPin !== confirmVaultPin) {
      addToast({ title: 'Validation Error', message: 'Passcodes do not match.', type: 'warning' });
      return;
    }

    setIsSavingPin(true);
    try {
      await updateProfile({
        vaultPinCode: vaultPin,
        vaultEnabled: true,
        vaultUpdatedAt: new Date().toISOString()
      });
      addToast({
        title: 'Vault Security Updated',
        message: 'Your Vault PIN code is configured and active.',
        type: 'success'
      });
      setShowVaultPinModal(false);
      setVaultPin('');
      setConfirmVaultPin('');
    } catch (err: any) {
      addToast({ title: 'Error', message: 'Failed to update Vault PIN.', type: 'warning' });
    } finally {
      setIsSavingPin(false);
    }
  };

  const Toggle = ({ enabled, onToggle, loading }: { enabled: boolean; onToggle: () => void; loading?: boolean }) => (
    <button
      onClick={onToggle}
      disabled={loading}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${enabled ? 'bg-aeirmist-cyan shadow-[0_0_12px_rgba(0,242,255,0.3)]' : 'bg-white/10'}`}
    >
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out flex items-center justify-center ${enabled ? 'translate-x-5' : 'translate-x-0'}`}>
        {loading && <Loader2 size={10} className="animate-spin text-black" />}
      </span>
    </button>
  );

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-24">
      {/* Privacy Center snapshot */}
      <div className="p-5 rounded-3xl bg-white/[0.02] border border-white/5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-aeirmist-cyan/10 text-aeirmist-cyan"><ShieldCheck size={18} /></div>
            <div><h2 className="text-sm font-black uppercase tracking-wider text-white">Privacy Center</h2><p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Your important privacy controls at a glance</p></div>
          </div>
          <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 text-[9px] font-black uppercase tracking-widest text-aeirmist-cyan">User controlled</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="p-3 rounded-2xl bg-white/[0.025] border border-white/5"><div className="text-[9px] uppercase tracking-widest text-white/35">Profile</div><div className="mt-1 text-xs font-bold text-white">{profile?.isPrivate ? 'Private' : 'Public'}</div></div>
          <div className="p-3 rounded-2xl bg-white/[0.025] border border-white/5"><div className="text-[9px] uppercase tracking-widest text-white/35">Activity</div><div className="mt-1 text-xs font-bold text-white">{profile?.showOnlineStatus !== false ? 'Visible' : 'Hidden'}</div></div>
          <div className="p-3 rounded-2xl bg-white/[0.025] border border-white/5"><div className="text-[9px] uppercase tracking-widest text-white/35">Messages</div><div className="mt-1 text-xs font-bold text-white capitalize">{profile?.messagingSettings?.whoCanMessageMe || 'Followers'}</div></div>
          <div className="p-3 rounded-2xl bg-white/[0.025] border border-white/5"><div className="text-[9px] uppercase tracking-widest text-white/35">Protected lists</div><div className="mt-1 text-xs font-bold text-white">{blockedUserIds.length + restrictedUserIds.length}</div></div>
        </div>
        {/* Privacy Checkup CTA */}
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-white">Run a Privacy Checkup</p>
            <p className="text-[10px] text-white/40 mt-0.5">Review who can see your profile, messages, and activity in a quick 3-step walkthrough.</p>
          </div>
          <button
            onClick={() => setShowCheckupModal(true)}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-aeirmist-cyan text-black font-black text-xs uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all shadow-[0_0_15px_rgba(0,242,255,0.25)]"
          >
            <Sparkles size={14} />
            Start Checkup
          </button>
        </div>
      </div>

      {/* Sub-navigation Header */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-white/[0.02] border border-white/5">
        <button
          onClick={() => { setActiveSubTab('controls'); setSearchQuery(''); }}
          className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 ${activeSubTab === 'controls' ? 'bg-aeirmist-cyan text-black shadow-[0_0_20px_rgba(0,242,255,0.3)]' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
        >
          <Shield size={14} />
          <span>Privacy Controls</span>
        </button>

        <button
          onClick={() => { setActiveSubTab('blocked'); setSearchQuery(''); }}
          className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 ${activeSubTab === 'blocked' ? 'bg-aeirmist-cyan text-black shadow-[0_0_20px_rgba(0,242,255,0.3)]' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
        >
          <UserX size={14} />
          <span>Blocked ({blockedUserIds.length})</span>
        </button>

        <button
          onClick={() => { setActiveSubTab('restricted'); setSearchQuery(''); }}
          className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 ${activeSubTab === 'restricted' ? 'bg-aeirmist-cyan text-black shadow-[0_0_20px_rgba(0,242,255,0.3)]' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
        >
          <ShieldAlert size={14} />
          <span>Restricted ({restrictedUserIds.length})</span>
        </button>

        <button
          onClick={() => { setActiveSubTab('vault'); setSearchQuery(''); }}
          className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 ${activeSubTab === 'vault' ? 'bg-aeirmist-cyan text-black shadow-[0_0_20px_rgba(0,242,255,0.3)]' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
        >
          <KeyRound size={14} />
          <span>Vault & Hidden</span>
        </button>
      </div>

      {/* SUB-TAB 1: Privacy Controls */}
      {activeSubTab === 'controls' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-aeirmist-cyan/10 text-aeirmist-cyan">
                <Lock size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Profile &amp; Visibility</h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Control who can discover and view your profile</p>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-white">Private Profile</h4>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-tight mt-0.5">Only confirmed followers can view your posts, stories, and activity</p>
                </div>
                <Toggle 
                  enabled={!!profile?.isPrivate} 
                  onToggle={() => handleToggleSetting('isPrivate', !!profile?.isPrivate)} 
                  loading={isUpdating === 'isPrivate'} 
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-white">Activity Status</h4>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-tight mt-0.5">Broadcast active online status across the network</p>
                </div>
                <Toggle 
                  enabled={profile?.showOnlineStatus !== false} 
                  onToggle={() => handleToggleSetting('showOnlineStatus', profile?.showOnlineStatus !== false)} 
                  loading={isUpdating === 'showOnlineStatus'} 
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-white">Hide Followers & Following List</h4>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-tight mt-0.5">Conceal your social connections graph from public view</p>
                </div>
                <Toggle 
                  enabled={!!profile?.hideFollowers} 
                  onToggle={() => handleToggleSetting('hideFollowers', !!profile?.hideFollowers)} 
                  loading={isUpdating === 'hideFollowers'} 
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-white">Hide Likes & Views Count</h4>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-tight mt-0.5">Conceal total likes and view counts on your posts</p>
                </div>
                <Toggle 
                  enabled={!!profile?.hideLikes} 
                  onToggle={() => handleToggleSetting('hideLikes', !!profile?.hideLikes)} 
                  loading={isUpdating === 'hideLikes'} 
                />
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-aeirmist-magenta/10 text-aeirmist-magenta">
                <MessageSquare size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Interactions & Direct Messages</h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Manage who can message you and tag you in posts</p>
              </div>
            </div>

            <div className="space-y-5 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-white">Direct Message Requests</label>
                <select
                  value={profile?.messagingSettings?.whoCanMessageMe || 'followers'}
                  onChange={(e) => handleSelectSetting('messagingSettings.whoCanMessageMe', e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-wider text-white focus:border-aeirmist-cyan outline-none transition-all cursor-pointer"
                >
                  <option value="everyone" className="bg-zinc-900 text-white">Open to Everyone</option>
                  <option value="followers" className="bg-zinc-900 text-white">Followers Only (Recommended)</option>
                  <option value="mutual" className="bg-zinc-900 text-white">Mutual Connections Only</option>
                  <option value="nobody" className="bg-zinc-900 text-white">Total Silence (Nobody)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-white">Mentions & Tagging Permissions</label>
                <select
                  value={profile?.allowTagging || 'everyone'}
                  onChange={(e) => handleSelectSetting('allowTagging', e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-wider text-white focus:border-aeirmist-cyan outline-none transition-all cursor-pointer"
                >
                  <option value="everyone" className="bg-zinc-900 text-white">Allow Mentions from Everyone</option>
                  <option value="followers" className="bg-zinc-900 text-white">Followers Only</option>
                  <option value="nobody" className="bg-zinc-900 text-white">Disable All Tags & Mentions</option>
                </select>
              </div>
            </div>
          </div>

          {/* TELEGRAM STYLE: Delete my account (If away for...) */}
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-red-500/10 text-red-400">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Delete my account</h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Account auto-destruction timer if away</p>
              </div>
            </div>

            <div className="pt-2">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                <div>
                  <h4 className="text-xs font-extrabold text-white">If away for...</h4>
                  <p className="text-[10px] text-white/40 mt-0.5">If you do not log in at least once within this period, your account will be self-destructed.</p>
                </div>
                <select
                  value={profile?.deleteAccountIfAwayFor || '24 months'}
                  onChange={(e) => handleSelectSetting('deleteAccountIfAwayFor', e.target.value)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs font-semibold text-aeirmist-cyan focus:border-aeirmist-cyan outline-none transition-all cursor-pointer shrink-0 ml-4"
                >
                  <option value="1 month">1 month</option>
                  <option value="3 months">3 months</option>
                  <option value="6 months">6 months</option>
                  <option value="12 months">12 months</option>
                  <option value="24 months">24 months</option>
                </select>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* SUB-TAB 2: Blocked Users */}
      {activeSubTab === 'blocked' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <UserX size={18} className="text-red-400" />
                  <span>Blocked Users</span>
                </h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mt-0.5">
                  Blocked users cannot message, tag, or view your profile and content
                </p>
              </div>

              <div className="relative min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search blocked..."
                  className="w-full h-9 pl-9 pr-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-red-400/50"
                />
              </div>
            </div>

            {isLoadingBlocked ? (
              <div className="p-12 text-center rounded-2xl bg-white/[0.01] border border-dashed border-white/10 space-y-3">
                <Loader2 size={24} className="mx-auto text-aeirmist-cyan animate-spin" />
                <h4 className="text-xs font-black uppercase tracking-widest text-white/60">Loading Blocked Users</h4>
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-mono">Fetching account details...</p>
              </div>
            ) : blockedProfiles.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {blockedProfiles.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={getAvatarUrl(user.avatarUrl, user.id)}
                        alt={user.displayName || user.username}
                        className="w-12 h-12 rounded-2xl object-cover border border-white/10 shrink-0 bg-white/5 shadow-md aspect-square"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = getAvatarUrl(null, user.id);
                        }}
                      />
                      <div className="min-w-0 truncate">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-xs font-extrabold text-white truncate">{user.displayName || user.username || 'Aeirmist User'}</span>
                          {user.isVerified && <ShieldCheck className="text-aeirmist-cyan shrink-0" size={14} />}
                        </div>
                        <span className="text-[10px] text-white/40 font-mono truncate block">@{user.username || 'user'}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleUnblock(user.id, user.username || 'user')}
                      className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <UserCheck size={12} />
                      <span>Unblock</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center rounded-2xl bg-white/[0.01] border border-dashed border-white/10 space-y-3">
                <Ghost size={32} className="mx-auto text-white/20" />
                <h4 className="text-xs font-black uppercase tracking-widest text-white/60">No Blocked Users</h4>
                <p className="text-[10px] text-white/30 uppercase tracking-widest">
                  {searchQuery ? 'No blocked users match your search query.' : 'Your blocked list is empty.'}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* SUB-TAB 3: Restricted Users */}
      {activeSubTab === 'restricted' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <ShieldAlert size={18} className="text-aeirmist-magenta" />
                  <span>Restricted Users</span>
                </h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mt-0.5">
                  Restricted users can comment, but their comments are only visible to them until approved
                </p>
              </div>

              <div className="relative min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search restricted..."
                  className="w-full h-9 pl-9 pr-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-aeirmist-magenta/50"
                />
              </div>
            </div>

            {isLoadingRestricted ? (
              <div className="p-12 text-center rounded-2xl bg-white/[0.01] border border-dashed border-white/10 space-y-3">
                <Loader2 size={24} className="mx-auto text-aeirmist-magenta animate-spin" />
                <h4 className="text-xs font-black uppercase tracking-widest text-white/60">Loading Restricted Users</h4>
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-mono">Fetching account details...</p>
              </div>
            ) : restrictedProfiles.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {restrictedProfiles.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={getAvatarUrl(user.avatarUrl, user.id)}
                        alt={user.displayName || user.username}
                        className="w-12 h-12 rounded-2xl object-cover border border-white/10 shrink-0 bg-white/5 shadow-md aspect-square"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = getAvatarUrl(null, user.id);
                        }}
                      />
                      <div className="min-w-0 truncate">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-xs font-extrabold text-white truncate">{user.displayName || user.username || 'Aeirmist User'}</span>
                          {user.isVerified && <ShieldCheck className="text-aeirmist-cyan shrink-0" size={14} />}
                        </div>
                        <span className="text-[10px] text-white/40 font-mono truncate block">@{user.username || 'user'}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleUnrestrict(user.id, user.username || 'user')}
                      className="px-4 py-2 rounded-xl bg-aeirmist-magenta/10 text-aeirmist-magenta hover:bg-aeirmist-magenta/20 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <UserCheck size={12} />
                      <span>Lift Restriction</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center rounded-2xl bg-white/[0.01] border border-dashed border-white/10 space-y-3">
                <ShieldAlert size={32} className="mx-auto text-white/20" />
                <h4 className="text-xs font-black uppercase tracking-widest text-white/60">No Restricted Users</h4>
                <p className="text-[10px] text-white/30 uppercase tracking-widest">
                  {searchQuery ? 'No restricted users match your search query.' : 'No accounts are currently restricted.'}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* SUB-TAB 4: Vault & Hidden Chats */}
      {activeSubTab === 'vault' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-aeirmist-cyan/10 text-aeirmist-cyan">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">Aeirmist Secure Vault</h3>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Protect sensitive conversations behind a PIN code lock</p>
                </div>
              </div>

              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${profile?.vaultEnabled ? 'bg-aeirmist-cyan/10 text-aeirmist-cyan border border-aeirmist-cyan/20' : 'bg-white/10 text-white/40'}`}>
                {profile?.vaultEnabled ? 'Vault Protected' : 'Not Configured'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-white">Vault PIN Passcode</h4>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-tight mt-0.5">
                  {profile?.vaultEnabled ? 'PIN lock active. Click below to re-configure.' : 'Set up a passcode to lock hidden conversations.'}
                </p>
              </div>
              <button
                onClick={() => setShowVaultPinModal(true)}
                className="px-4 py-2.5 rounded-xl bg-aeirmist-cyan text-black font-black uppercase text-[10px] tracking-widest hover:bg-aeirmist-cyan/90 transition-all cursor-pointer"
              >
                {profile?.vaultEnabled ? 'Change PIN' : 'Set Vault PIN'}
              </button>
            </div>
          </div>

          {/* Hidden & Archived Chats */}
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-white/5 text-white/60">
                <Archive size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Archived & Hidden Channels</h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Auto-archive policies and hidden chat options</p>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-white">Auto-Archive Inactive Chats</h4>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-tight mt-0.5">Automatically move chats to archive after 30 days of inactivity</p>
                </div>
                <Toggle
                  enabled={!!profile?.messagingSettings?.autoArchiveInactive}
                  onToggle={() => handleToggleSetting('messagingSettings.autoArchiveInactive', !!profile?.messagingSettings?.autoArchiveInactive)}
                  loading={isUpdating === 'messagingSettings.autoArchiveInactive'}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-white">Auto-Archive Spam Requests</h4>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-tight mt-0.5">Route unconfirmed promotional requests directly to archives</p>
                </div>
                <Toggle
                  enabled={profile?.messagingSettings?.autoArchiveSpam !== false}
                  onToggle={() => handleToggleSetting('messagingSettings.autoArchiveSpam', profile?.messagingSettings?.autoArchiveSpam !== false)}
                  loading={isUpdating === 'messagingSettings.autoArchiveSpam'}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Vault PIN Setup Modal */}
      {showVaultPinModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#090D16]/90 border border-white/10 space-y-5 shadow-2xl relative">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-aeirmist-cyan/10 text-aeirmist-cyan">
                <KeyRound size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-white uppercase tracking-wider text-sm">Vault Passcode Setup</h3>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">Enter a 4-digit security code</p>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-white/40 tracking-wider">New PIN Code</label>
                <input
                  type="password"
                  maxLength={6}
                  value={vaultPin}
                  onChange={(e) => setVaultPin(e.target.value)}
                  placeholder="••••"
                  className="w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-white font-mono text-center tracking-[0.5em] text-lg focus:outline-none focus:border-aeirmist-cyan/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Confirm PIN Code</label>
                <input
                  type="password"
                  maxLength={6}
                  value={confirmVaultPin}
                  onChange={(e) => setConfirmVaultPin(e.target.value)}
                  placeholder="••••"
                  className="w-full h-11 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-white font-mono text-center tracking-[0.5em] text-lg focus:outline-none focus:border-aeirmist-cyan/50"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowVaultPinModal(false);
                    setVaultPin('');
                    setConfirmVaultPin('');
                  }}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-white/60 font-bold uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveVaultPin}
                  disabled={isSavingPin || vaultPin.length < 4}
                  className="flex-1 py-3 rounded-xl bg-aeirmist-cyan text-black font-black uppercase text-[10px] tracking-widest hover:bg-aeirmist-cyan/90 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSavingPin ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  <span>Save PIN</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Privacy Checkup Modal ── */}
      <AnimatePresence>
        {showCheckupModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-[#0d1117] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/5">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-aeirmist-cyan/10 text-aeirmist-cyan"><ShieldCheck size={18} /></div>
                    <h2 className="text-sm font-black uppercase tracking-wider text-white">Privacy Checkup</h2>
                  </div>
                  <button onClick={() => { setShowCheckupModal(false); setCheckupStep(0); }} className="p-2 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-colors">✕</button>
                </div>
                {/* Step dots */}
                <div className="flex gap-2 mt-4">
                  {[0,1,2].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= checkupStep ? 'bg-aeirmist-cyan' : 'bg-white/10'}`} />
                  ))}
                </div>
                <p className="text-[10px] text-white/40 mt-2">Step {checkupStep + 1} of 3</p>
              </div>

              {/* Step Content */}
              <div className="p-6 space-y-4 min-h-[200px]">
                {checkupStep === 0 && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2"><Eye size={14} className="text-aeirmist-cyan" /> Who can see your profile?</h3>
                    {[
                      { label: 'Private Profile', desc: 'Only approved followers see your posts', key: 'isPrivate', val: profile?.isPrivate ?? false },
                      { label: 'Hide Online Status', desc: 'Others won\'t see when you\'re active', key: 'showOnlineStatus', val: !(profile?.showOnlineStatus ?? true), invert: true },
                      { label: 'Hide Followers Count', desc: 'Keep your follower numbers to yourself', key: 'hideFollowerCount', val: profile?.hideFollowerCount ?? false },
                    ].map(item => (
                      <div key={item.key} className="flex items-center justify-between py-2 border-b border-white/5">
                        <div><p className="text-xs font-bold text-white">{item.label}</p><p className="text-[10px] text-white/40">{item.desc}</p></div>
                        <div className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${item.val ? 'bg-aeirmist-cyan' : 'bg-white/10'}`}
                          onClick={() => handleToggleSetting(item.key, item.invert ? !item.val : item.val)}>
                          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${item.val ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {checkupStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2"><MessageSquare size={14} className="text-aeirmist-cyan" /> Who can contact you?</h3>
                    <div className="flex items-center justify-between py-2 border-b border-white/5">
                      <div><p className="text-xs font-bold text-white">Direct Messages</p><p className="text-[10px] text-white/40">Who can send you a message</p></div>
                      <select
                        value={profile?.messagingSettings?.whoCanMessageMe || 'followers'}
                        onChange={e => handleSelectSetting('messagingSettings.whoCanMessageMe', e.target.value)}
                        className="bg-white/10 text-white text-xs rounded-xl px-3 py-1.5 border border-white/10 outline-none cursor-pointer"
                      >
                        <option value="everyone">Everyone</option>
                        <option value="followers">Followers</option>
                        <option value="mutuals">Mutuals only</option>
                        <option value="nobody">Nobody</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-white/5">
                      <div><p className="text-xs font-bold text-white">Mentions & Tags</p><p className="text-[10px] text-white/40">Who can tag you in posts</p></div>
                      <select
                        value={profile?.whoCanTagMe || 'followers'}
                        onChange={e => handleSelectSetting('whoCanTagMe', e.target.value)}
                        className="bg-white/10 text-white text-xs rounded-xl px-3 py-1.5 border border-white/10 outline-none cursor-pointer"
                      >
                        <option value="everyone">Everyone</option>
                        <option value="followers">Followers</option>
                        <option value="nobody">Nobody</option>
                      </select>
                    </div>
                  </div>
                )}
                {checkupStep === 2 && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2"><ShieldCheck size={14} className="text-aeirmist-cyan" /> Security & Data</h3>
                    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2">
                      <p className="text-xs font-bold text-white">Blocked accounts</p>
                      <p className="text-[10px] text-white/50">You have <span className="text-white font-bold">{blockedUserIds.length}</span> blocked and <span className="text-white font-bold">{restrictedUserIds.length}</span> restricted accounts.</p>
                      <button onClick={() => { setShowCheckupModal(false); setCheckupStep(0); setActiveSubTab('blocked'); }} className="text-[10px] text-aeirmist-cyan font-bold uppercase tracking-wider hover:underline">Manage blocked list →</button>
                    </div>
                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-3">
                      <Check size={16} className="text-emerald-400 shrink-0" />
                      <p className="text-xs text-white/70">Your privacy settings have been reviewed. Changes are saved automatically.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Buttons */}
              <div className="p-6 pt-0 flex justify-between gap-3">
                <button
                  onClick={() => checkupStep > 0 ? setCheckupStep(s => s - 1) : (setShowCheckupModal(false), setCheckupStep(0))}
                  className="px-5 py-2.5 rounded-xl bg-white/5 text-white/60 font-bold text-xs uppercase tracking-wider hover:bg-white/10 transition-all"
                >
                  {checkupStep === 0 ? 'Cancel' : '← Back'}
                </button>
                <button
                  onClick={() => checkupStep < 2 ? setCheckupStep(s => s + 1) : (setShowCheckupModal(false), setCheckupStep(0))}
                  className="px-5 py-2.5 rounded-xl bg-aeirmist-cyan text-black font-black text-xs uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all"
                >
                  {checkupStep === 2 ? '✓ Done' : 'Next →'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}



