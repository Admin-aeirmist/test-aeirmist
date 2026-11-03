const fs = require('fs');
const path = require('path');

console.log('--- Patching src/components/messenger/GroupInfoPanel.tsx ---');
const gipPath = path.resolve('src/components/messenger/GroupInfoPanel.tsx');
let content = fs.readFileSync(gipPath, 'utf8');

// 1. Robust memberProfileIds derivation
const oldMemberProfileIdsPattern = /const memberProfileIds: string\[\] = chat\.profileIds \|\| chat\.participants \|\| \[\];/;
const newMemberProfileIds = `const memberProfileIds: string[] = useMemo(() => {
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
  }, [chat.profileIds, chat.participants, chat.participantDetails]);`;

if (oldMemberProfileIdsPattern.test(content)) {
  content = content.replace(oldMemberProfileIdsPattern, newMemberProfileIds);
  console.log('✔ Patched memberProfileIds extraction');
}

// 2. Enhance resolvedMembers
const oldResolvedMembersPattern = /const resolvedMembers = useMemo\(\(\) => \{[\s\S]*?return memberProfileIds\.map\(\(memId: string\) => \{[\s\S]*?return \{\s*id: memId,\s*displayName: 'Aeirmist Member',[\s\S]*?\};\s*\}\);[\s\S]*?\}, \[memberProfileIds, chat\.participantDetails, fetchedMemberProfiles, chats, allProfiles, suggestedUsers, currentUserId, profile, user\?\.uid\]\);/;

const newResolvedMembers = `const resolvedMembers = useMemo(() => {
    const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const formatHandle = (mem: any, fallbackId: string) => {
      const u = String(mem?.username || '').trim();
      if (u && !isUuid(u) && u !== fallbackId && u !== 'unknown' && u !== 'member') return u.replace(/^@+/, '');
      const d = String(mem?.displayName || mem?.name || '').trim();
      if (d && d !== 'Aeirmist Member') {
        const slug = d.toLowerCase().replace(/\\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        if (slug) return slug;
      }
      return 'member';
    };

    return memberProfileIds.map((memId: string) => {
      const isMe = memId === currentUserId || memId === profile?.id || memId === user?.uid;
      if (isMe) {
        return {
          id: memId,
          displayName: profile?.displayName || profile?.name || 'You',
          username: formatHandle(profile, memId),
          photoURL: profile?.photoURL,
          isVerified: Boolean(profile?.isVerified === true || profile?.verified === true || profile?.badge === 'verified' || profile?.isAdmin === true),
          badge: profile?.badge
        };
      }

      // 1. Check participantDetails
      const detail = chat.participantDetails?.[memId];
      if (detail && detail.displayName && detail.displayName !== 'Aeirmist Member') {
        return { 
          id: memId, 
          ...detail,
          username: formatHandle(detail, memId),
          photoURL: detail.photoURL || detail.photo || detail.avatarKey,
          isVerified: Boolean(detail.isVerified === true || detail.verified === true || detail.badge === 'verified' || detail.isAdmin === true),
          badge: detail.badge
        };
      }

      // 2. Check chat.participants array of objects
      if (Array.isArray(chat.participants)) {
        const foundObj = chat.participants.find((p: any) => typeof p === 'object' && p !== null && (p.userId === memId || p.id === memId || p.uid === memId));
        if (foundObj && (foundObj.displayName || foundObj.username)) {
          return {
            id: memId,
            displayName: foundObj.displayName || foundObj.name || foundObj.username,
            username: formatHandle(foundObj, memId),
            photoURL: foundObj.photoURL || foundObj.avatarKey,
            isVerified: Boolean(foundObj.isVerified === true || foundObj.badge === 'verified' || foundObj.isAdmin === true),
            badge: foundObj.badge
          };
        }
      }

      // 3. Check fetchedMemberProfiles
      const fetched = fetchedMemberProfiles[memId];
      if (fetched && fetched.displayName && fetched.displayName !== 'Aeirmist Member') {
        return {
          id: memId,
          ...fetched,
          username: formatHandle(fetched, memId),
          photoURL: fetched.photoURL || fetched.photo || fetched.avatarKey,
          isVerified: Boolean(fetched.isVerified === true || fetched.verified === true || fetched.badge === 'verified' || fetched.isAdmin === true),
          badge: fetched.badge
        };
      }

      // 4. Check chats list
      for (const c of (chats || [])) {
        if (c.otherParticipantId === memId || c.otherParticipantUid === memId || c.profileIds?.includes(memId) || c.participants?.includes(memId)) {
          const cand = c.otherProfile || c.participantDetails?.[memId];
          const candName = cand?.displayName || c.name;
          if (candName && candName !== 'Aeirmist Member') {
            return {
              id: memId,
              displayName: candName,
              username: formatHandle(cand || { username: c.username, displayName: candName }, memId),
              photoURL: cand?.photoURL || c.photo,
              isVerified: Boolean(cand?.isVerified === true || cand?.verified === true || cand?.badge === 'verified' || cand?.isAdmin === true),
              badge: cand?.badge
            };
          }
        }
      }
      
      // 5. Check allProfiles
      const foundInAll = (allProfiles || []).find((p: any) => p.id === memId || p.uid === memId);
      if (foundInAll && (foundInAll.displayName || foundInAll.username)) {
        return {
          id: memId,
          ...foundInAll,
          displayName: foundInAll.displayName || foundInAll.name || foundInAll.username,
          username: formatHandle(foundInAll, memId),
          photoURL: foundInAll.photoURL || foundInAll.avatarKey,
          isVerified: Boolean(foundInAll.isVerified === true || foundInAll.verified === true || foundInAll.badge === 'verified' || foundInAll.isAdmin === true),
          badge: foundInAll.badge
        };
      }

      // 6. Check suggestedUsers
      const foundInSugg = (suggestedUsers || []).find((p: any) => p.id === memId || p.uid === memId);
      if (foundInSugg && (foundInSugg.displayName || foundInSugg.username)) {
        return {
          id: memId,
          ...foundInSugg,
          displayName: foundInSugg.displayName || foundInSugg.name || foundInSugg.username,
          username: formatHandle(foundInSugg, memId),
          photoURL: foundInSugg.photoURL || foundInSugg.avatarKey,
          isVerified: Boolean(foundInSugg.isVerified === true || foundInSugg.verified === true || foundInSugg.badge === 'verified' || foundInSugg.isAdmin === true),
          badge: foundInSugg.badge
        };
      }

      return {
        id: memId,
        displayName: 'Aeirmist Member',
        photoURL: null,
        username: 'member',
        isVerified: false,
        badge: null
      };
    });
  }, [memberProfileIds, chat.participantDetails, chat.participants, fetchedMemberProfiles, chats, allProfiles, suggestedUsers, currentUserId, profile, user?.uid]);`;

if (oldResolvedMembersPattern.test(content)) {
  content = content.replace(oldResolvedMembersPattern, newResolvedMembers);
  console.log('✔ Patched resolvedMembers mapping');
}

// 3. Update avatar rendering in filteredMembers list to use blank silhouette fallback
const oldAvatarPattern = /<div className="relative shrink-0">\s*<img\s*src=\{photoURL\}\s*className="w-10 h-10 rounded-2xl object-cover"\s*alt=""\s*\/>\s*<div className="absolute -bottom-0\.5 -right-0\.5/;

const newAvatar = `<div className="relative shrink-0">
                        {photoURL ? (
                          <img 
                            src={photoURL} 
                            className="w-10 h-10 rounded-2xl object-cover border border-white/10" 
                            alt="" 
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-white/30">
                            <User size={18} />
                          </div>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5`;

if (oldAvatarPattern.test(content)) {
  content = content.replace(oldAvatarPattern, newAvatar);
  console.log('✔ Patched avatar rendering with blank silhouette fallback');
}

fs.writeFileSync(gipPath, content, 'utf8');
console.log('✔ Completed GroupInfoPanel patch');
