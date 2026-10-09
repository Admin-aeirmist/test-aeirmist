import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ShieldAlert, Loader2, Search, UserX } from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { doc, getDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';

interface UserInfo {
  uid: string;
  profileId?: string;
  photoURL?: string;
  displayName?: string;
  username?: string;
}

export const BlockedSection = ({ onBack, onUserClick }: { onBack: () => void, onUserClick?: (user: any) => void }) => {
  const { profile, toggleBlockUser, db, allProfiles = [], addToast } = useAeirmist();
  const rawBlockedIds: string[] = profile?.social?.blocked || [];
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load and resolve all blocked users
  useEffect(() => {
    let isMounted = true;
    if (!db || rawBlockedIds.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const fetchAll = async () => {
      setLoading(true);
      const resolvedList: UserInfo[] = [];
      const seenKeys = new Set<string>();

      for (const targetId of rawBlockedIds) {
        if (!targetId || typeof targetId !== 'string') continue;

        // 1. In-memory check from allProfiles
        const inMem = allProfiles.find((p: any) =>
          p.id === targetId ||
          p.uid === targetId ||
          p.ownerUid === targetId ||
          p.id === `profile_${targetId}` ||
          `profile_${p.id}` === targetId
        );

        if (inMem) {
          const key = inMem.username || inMem.id;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            resolvedList.push({
              uid: targetId,
              profileId: inMem.id,
              photoURL: inMem.photoURL,
              displayName: inMem.displayName || inMem.name || inMem.username || 'Blocked User',
              username: inMem.username,
            });
          }
          continue;
        }

        // 2. Direct Firestore profile doc lookup
        let resolved = false;
        try {
          const pSnap = await getDoc(doc(db, 'profiles', targetId));
          if (pSnap.exists()) {
            const d = pSnap.data();
            const key = d.username || pSnap.id;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              resolvedList.push({
                uid: targetId,
                profileId: pSnap.id,
                photoURL: d.photoURL,
                displayName: d.displayName || d.name || d.username || 'Blocked User',
                username: d.username,
              });
            }
            resolved = true;
          }
        } catch {}

        if (resolved) continue;

        // 3. Try with 'profile_' prefix
        try {
          const normId = targetId.startsWith('profile_') ? targetId : `profile_${targetId}`;
          const pSnap = await getDoc(doc(db, 'profiles', normId));
          if (pSnap.exists()) {
            const d = pSnap.data();
            const key = d.username || pSnap.id;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              resolvedList.push({
                uid: targetId,
                profileId: pSnap.id,
                photoURL: d.photoURL,
                displayName: d.displayName || d.name || d.username || 'Blocked User',
                username: d.username,
              });
            }
            resolved = true;
          }
        } catch {}

        if (resolved) continue;

        // 4. Query by ownerUid
        try {
          const q = query(collection(db, 'profiles'), where('ownerUid', '==', targetId), limit(1));
          const qSnap = await getDocs(q);
          if (!qSnap.empty) {
            const d = qSnap.docs[0];
            const data = d.data();
            const key = data.username || d.id;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              resolvedList.push({
                uid: targetId,
                profileId: d.id,
                photoURL: data.photoURL,
                displayName: data.displayName || data.name || data.username || 'Blocked User',
                username: data.username,
              });
            }
            resolved = true;
          }
        } catch {}

        if (resolved) continue;

        // 5. Query by uid
        try {
          const q = query(collection(db, 'profiles'), where('uid', '==', targetId), limit(1));
          const qSnap = await getDocs(q);
          if (!qSnap.empty) {
            const d = qSnap.docs[0];
            const data = d.data();
            const key = data.username || d.id;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              resolvedList.push({
                uid: targetId,
                profileId: d.id,
                photoURL: data.photoURL,
                displayName: data.displayName || data.name || data.username || 'Blocked User',
                username: data.username,
              });
            }
            resolved = true;
          }
        } catch {}

        if (resolved) continue;

        // 6. Fallback if profile not found
        if (!seenKeys.has(targetId)) {
          seenKeys.add(targetId);
          resolvedList.push({
            uid: targetId,
            displayName: 'Blocked Account',
            username: targetId.slice(0, 10),
          });
        }
      }

      if (isMounted) {
        setUsers(resolvedList);
        setLoading(false);
      }
    };

    fetchAll();
    return () => { isMounted = false; };
  }, [db, JSON.stringify(rawBlockedIds), allProfiles.length]);

  const handleUnblock = async (u: UserInfo) => {
    setUnblockingId(u.uid);
    try {
      await toggleBlockUser(u.uid);
      // Optimistically remove from view
      setUsers(prev => prev.filter(item => item.uid !== u.uid && item.profileId !== u.profileId));
      addToast?.({
        title: 'Unblocked',
        message: `@${u.username || u.displayName} has been unblocked.`,
        type: 'success'
      });
    } catch (e: any) {
      addToast?.({
        title: 'Error',
        message: 'Could not unblock user. Please try again.',
        type: 'warning'
      });
    } finally {
      setUnblockingId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(u =>
      (u.displayName && u.displayName.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q))
    );
  }, [users, searchQuery]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex flex-col h-full bg-[#0a0a0c] select-none"
    >
      {/* Instagram-style Header */}
      <div className="px-6 py-5 border-b border-white/8 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
            title="Back to Chats"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Blocked accounts</h1>
            <p className="text-xs text-white/40 mt-0.5">You can block people anytime from their profiles.</p>
          </div>
        </div>

        {rawBlockedIds.length > 0 && (
          <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-white/50">
            {rawBlockedIds.length} {rawBlockedIds.length === 1 ? 'account' : 'accounts'}
          </span>
        )}
      </div>

      {/* Search Bar if multiple blocked accounts */}
      {users.length > 3 && (
        <div className="px-6 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={14} />
            <input
              type="text"
              placeholder="Search blocked accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder:text-white/30 outline-none focus:border-white/20 transition-all"
            />
          </div>
        </div>
      )}

      {/* Main List */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 no-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 size={28} className="animate-spin text-white/30" />
            <p className="text-xs text-white/40 font-medium">Loading blocked accounts...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center px-8 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/25">
              <UserX size={32} />
            </div>
            <div className="space-y-1 max-w-sm">
              <p className="text-sm font-bold text-white/80">
                {searchQuery ? 'No accounts match your search' : 'No Blocked Accounts'}
              </p>
              <p className="text-xs text-white/40 leading-relaxed">
                {searchQuery
                  ? 'Try searching with a different name or username.'
                  : 'Accounts you block will appear here. You can block someone directly from their profile or chat settings.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-white/5 bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
            {filteredUsers.map((u) => {
              const isBusy = unblockingId === u.uid;
              return (
                <div
                  key={u.uid}
                  className="flex items-center justify-between gap-4 p-4 hover:bg-white/[0.03] transition-colors"
                >
                  <div
                    className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer"
                    onClick={() => onUserClick && onUserClick(u)}
                  >
                    {/* Square Profile Picture */}
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/10 border border-white/10 flex-shrink-0 relative group">
                      {u.photoURL ? (
                        <img
                          src={u.photoURL}
                          alt={u.displayName || 'Avatar'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-white/40 text-base bg-gradient-to-tr from-white/5 to-white/15">
                          {(u.displayName || u.username || 'U')[0].toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* ID Name & Username */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate hover:underline">
                        {u.displayName || 'Unknown User'}
                      </p>
                      {u.username && (
                        <p className="text-xs text-white/45 truncate mt-0.5">
                          @{u.username}
                        </p>
                      )}
                      <p className="text-[10px] text-white/25 truncate mt-0.5">
                        Includes other accounts they may have or create
                      </p>
                    </div>
                  </div>

                  {/* Workable Unblock Button */}
                  <button
                    onClick={() => handleUnblock(u)}
                    disabled={isBusy}
                    className="flex-shrink-0 px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-bold text-white border border-white/10 hover:border-white/20 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    {isBusy ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Unblocking...</span>
                      </>
                    ) : (
                      'Unblock'
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};
