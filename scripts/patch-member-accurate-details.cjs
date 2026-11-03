const fs = require('fs');
const path = require('path');

// =========================================================================
// 1. src/components/messenger/GroupInfoPanel.tsx
// =========================================================================
const infoPath = path.join(__dirname, '../src/components/messenger/GroupInfoPanel.tsx');
let info = fs.readFileSync(infoPath, 'utf8').replace(/\r\n/g, '\n');

// Add fetchedMemberProfiles state right after fileInputRef definition
const targetStateAnchor = '  const fileInputRef = useRef<HTMLInputElement>(null);';
const stateAddition = `  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fetchedMemberProfiles, setFetchedMemberProfiles] = useState<Record<string, any>>({});`;

if (!info.includes('fetchedMemberProfiles')) {
  info = info.replace(targetStateAnchor, stateAddition);
}

// Add the profile loading useEffect right before resolvedMembers
const targetBeforeResolved = '  // Combine available user profiles to resolve member details';
const effectAddition = `  // Accurately fetch missing member profile docs from Firestore and chats cache
  useEffect(() => {
    let isMounted = true;
    const loadMissingProfiles = async () => {
      if (memberProfileIds.length === 0) return;
      const missingIds = memberProfileIds.filter(id => {
        if (id === currentUserId || id === profile?.id || id === user?.uid) return false;
        if (chat.participantDetails?.[id]?.displayName && chat.participantDetails[id].displayName !== 'Aeirmist Member') return false;
        return true;
      });

      if (missingIds.length === 0) return;
      const newMap: Record<string, any> = {};

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
            const docRef2 = doc(db, 'profiles', \`profile_\${mId}\`);
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

  // Combine available user profiles to resolve member details`;

if (!info.includes('loadMissingProfiles')) {
  info = info.replace(targetBeforeResolved, effectAddition);
}

// Replace resolvedMembers calculation
const resolvedMembersPattern = /const resolvedMembers = useMemo\(\(\) => \{[\s\S]*?\}\, \[memberProfileIds[\s\S]*?\]\);/;
const replacementResolvedMembers = `const resolvedMembers = useMemo(() => {
    const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
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
          isVerified: Boolean(detail.isVerified === true || detail.verified === true || detail.badge === 'verified' || detail.isAdmin === true),
          badge: detail.badge
        };
      }

      // 2. Check fetchedMemberProfiles
      const fetched = fetchedMemberProfiles[memId];
      if (fetched && fetched.displayName && fetched.displayName !== 'Aeirmist Member') {
        return {
          id: memId,
          ...fetched,
          username: formatHandle(fetched, memId),
          isVerified: Boolean(fetched.isVerified === true || fetched.verified === true || fetched.badge === 'verified' || fetched.isAdmin === true),
          badge: fetched.badge
        };
      }

      // 3. Check chats list
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
      
      const foundInAll = (allProfiles || []).find((p: any) => p.id === memId || p.uid === memId);
      if (foundInAll && foundInAll.displayName && foundInAll.displayName !== 'Aeirmist Member') {
        return {
          id: memId,
          ...foundInAll,
          username: formatHandle(foundInAll, memId),
          isVerified: Boolean(foundInAll.isVerified === true || foundInAll.verified === true || foundInAll.badge === 'verified' || foundInAll.isAdmin === true),
          badge: foundInAll.badge
        };
      }

      const foundInSugg = (suggestedUsers || []).find((p: any) => p.id === memId || p.uid === memId);
      if (foundInSugg && foundInSugg.displayName && foundInSugg.displayName !== 'Aeirmist Member') {
        return {
          id: memId,
          ...foundInSugg,
          username: formatHandle(foundInSugg, memId),
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
  }, [memberProfileIds, chat.participantDetails, fetchedMemberProfiles, chats, allProfiles, suggestedUsers, currentUserId, profile, user?.uid]);`;

info = info.replace(resolvedMembersPattern, replacementResolvedMembers);

// Replace faulty isVerified checks in GroupInfoPanel.tsx
info = info.replace(
  'const isVerified = mem.verified !== false && mem.isVerified !== false;',
  'const isVerified = Boolean(mem.isVerified === true || mem.verified === true || mem.badge === \'verified\' || mem.badge === \'admin\' || mem.isAdmin === true);'
);

info = info.replace(
  'const isVerified = usr.verified !== false && usr.isVerified !== false;',
  'const isVerified = Boolean(usr.isVerified === true || usr.verified === true || usr.badge === \'verified\' || usr.badge === \'admin\' || usr.isAdmin === true);'
);

fs.writeFileSync(infoPath, info, 'utf8');
console.log('Successfully updated GroupInfoPanel.tsx with accurate profiles and badges!');

// =========================================================================
// 2. src/components/messenger/MemberDetailsSheet.tsx
// =========================================================================
const sheetPath = path.join(__dirname, '../src/components/messenger/MemberDetailsSheet.tsx');
let sheet = fs.readFileSync(sheetPath, 'utf8').replace(/\r\n/g, '\n');

sheet = sheet.replace(
  'const isVerified = member.verified !== false && member.isVerified !== false;',
  'const isVerified = Boolean(member.isVerified === true || member.verified === true || member.badge === \'verified\' || member.badge === \'admin\' || member.isAdmin === true);'
);

fs.writeFileSync(sheetPath, sheet, 'utf8');
console.log('Successfully updated MemberDetailsSheet.tsx with accurate verified badge rule!');
