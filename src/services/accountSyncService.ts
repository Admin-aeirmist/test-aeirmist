import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { normalizeUsername } from '../utils/usernameUtils';
import { BLANK_DP } from '../lib/avatar';
import { logger } from '../utils/logger';

export interface ConsolidateResult {
  success: boolean;
  canonicalProfile: any;
  cleanedDuplicateIds: string[];
  totalMerged: number;
}

/**
 * Consolidates and merges all disparate profiles in Firestore that belong to
 * the same user/username, uploads the unified single profile to:
 * 1. profiles/profile_{uid}
 * 2. users/{uid}
 * 3. usernames/{normUsername}
 * and deletes all duplicate redundant profile documents from the database.
 */
export async function consolidateAndSyncUserProfiles(
  targetUser?: any
): Promise<ConsolidateResult> {
  const activeUser = targetUser || auth.currentUser;
  if (!db || !activeUser || !activeUser.uid) {
    return { success: false, canonicalProfile: null, cleanedDuplicateIds: [], totalMerged: 0 };
  }

  const userUid = activeUser.uid;
  const userEmail = (activeUser.email || '').toLowerCase().trim();
  const canonicalProfileId = `profile_${userUid}`;
  const isMainAdmin = userEmail === 'junaedislamjim180@gmail.com' || userUid === 'iFqvwxqejCSte6K24gJe5ZE4NTo1' || userUid === 'doViFWfMXcOoas976z6MO216YNg1';

  logger.info(`[AccountSync] Starting database deduplication & sync for UID: ${userUid} (${userEmail})`);

  try {
    const candidateDocsMap = new Map<string, any>();

    // Helper to safely add doc data
    const addCandidate = (docId: string, data: any) => {
      if (!docId || !data) return;
      candidateDocsMap.set(docId, { id: docId, ...data });
    };

    // 1. Direct fetch: canonical profile_UID
    try {
      const snap1 = await getDoc(doc(db, 'profiles', canonicalProfileId));
      if (snap1.exists()) addCandidate(snap1.id, snap1.data());
    } catch (e) {
      logger.warn('[AccountSync] Fetch canonicalProfileId warning:', e);
    }

    // 2. Direct fetch: plain UID document in profiles
    if (userUid !== canonicalProfileId) {
      try {
        const snap2 = await getDoc(doc(db, 'profiles', userUid));
        if (snap2.exists()) addCandidate(snap2.id, snap2.data());
      } catch (e) {}
    }

    // 3. Query: ownerUid == userUid
    try {
      const qOwner = query(collection(db, 'profiles'), where('ownerUid', '==', userUid));
      const sOwner = await getDocs(qOwner);
      sOwner.forEach(d => addCandidate(d.id, d.data()));
    } catch (e) {}

    // 4. Query: uid == userUid
    try {
      const qUid = query(collection(db, 'profiles'), where('uid', '==', userUid));
      const sUid = await getDocs(qUid);
      sUid.forEach(d => addCandidate(d.id, d.data()));
    } catch (e) {}

    // 5. Query: email == userEmail
    if (userEmail) {
      try {
        const qEmail = query(collection(db, 'profiles'), where('email', '==', userEmail));
        const sEmail = await getDocs(qEmail);
        sEmail.forEach(d => addCandidate(d.id, d.data()));
      } catch (e) {}
    }

    // 6. If main admin, also check junaed_islam_jim9
    if (isMainAdmin) {
      try {
        const qAdmin = query(collection(db, 'profiles'), where('usernameNormalized', '==', 'junaed_islam_jim9'));
        const sAdmin = await getDocs(qAdmin);
        sAdmin.forEach(d => addCandidate(d.id, d.data()));
      } catch (e) {}

      try {
        const qAdminRaw = query(collection(db, 'profiles'), where('username', '==', 'junaed_islam_jim9'));
        const sAdminRaw = await getDocs(qAdminRaw);
        sAdminRaw.forEach(d => addCandidate(d.id, d.data()));
      } catch (e) {}
    }

    // 7. Check user document in users/{userUid}
    let userDocData: any = null;
    try {
      const userSnap = await getDoc(doc(db, 'users', userUid));
      if (userSnap.exists()) {
        userDocData = userSnap.data();
      }
    } catch (e) {}

    const allCandidateList = Array.from(candidateDocsMap.values());
    logger.info(`[AccountSync] Found ${allCandidateList.length} profile documents in database for user ${userUid}`);

    // Base info resolution
    const existingCanonical = candidateDocsMap.get(canonicalProfileId) || {};

    const baseUsername = existingCanonical.username 
      || userDocData?.username 
      || allCandidateList.find(c => c.username)?.username 
      || (userEmail ? userEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') : (isMainAdmin ? 'junaedislamjim' : 'user'));
    const normUsername = normalizeUsername(baseUsername);
    
    // Pick highest quality fields across all candidate profiles
    let bestDisplayName = existingCanonical.displayName || activeUser.displayName || (isMainAdmin ? 'Junaed Islam Jim' : '');
    let bestUsername = existingCanonical.username || userDocData?.username || allCandidateList.find(c => c.username)?.username || (userEmail ? userEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') : (isMainAdmin ? 'junaedislamjim' : ''));
    let bestPhotoURL = '';
    let bestCoverURL = '';
    let bestBio = existingCanonical.bio || (isMainAdmin ? 'Founder & Lead Architect at Aeirmist' : '');
    let bestTagline = existingCanonical.tagline || '';
    let bestLocation = existingCanonical.location || '';
    let bestLocationData = existingCanonical.locationData || null;
    let bestWebsite = existingCanonical.website || '';
    let bestCategory = existingCanonical.category || '';
    let bestPronouns = existingCanonical.pronouns || [];
    let bestDateOfBirth = existingCanonical.dateOfBirth || '';
    let bestGender = existingCanonical.gender || '';
    let bestPhoneNumber = existingCanonical.phoneNumber || '';
    let bestPhoneCountryCode = existingCanonical.phoneCountryCode || '+1';
    let bestPhoneVerified = existingCanonical.phoneVerified || false;
    let bestRelationshipStatus = existingCanonical.relationshipStatus || null;
    let bestRelationshipStatusVisibility = existingCanonical.relationshipStatusVisibility || 'public';
    let bestPersonalEmail = existingCanonical.personalEmail || '';
    let bestRecoveryEmail = existingCanonical.recoveryEmail || '';
    let bestRecoveryPhone = existingCanonical.recoveryPhone || '';
    let bestFollowersCount = 0;
    let bestFollowingCount = 0;
    let bestLevel = isMainAdmin ? 9999 : 100;
    let isAdmin = isMainAdmin;
    let isVerified = isMainAdmin;
    let onboardingCompleted = isMainAdmin;
    let onboardingStep = isMainAdmin ? 5 : 1;
    let mergedSocialLinks: any = {};
    let mergedPrivacySettings: any = { privateProfile: false, showActivity: true, allowMessages: 'everyone', hideFollowers: false };
    let mergedThemeSettings: any = { accentColor: '#00f2ff', glowIntensity: 0.8, noiseEffect: true };
    const mergedFollowers = new Set<string>();
    const mergedFollowing = new Set<string>();

    for (const c of allCandidateList) {
      if (!c) continue;
      // Display name
      if (!bestDisplayName || bestDisplayName === 'Aeirmist User' || bestDisplayName.startsWith('Guest Account') || bestDisplayName.includes('@')) {
        if (c.displayName && !c.displayName.startsWith('Guest Account') && c.displayName !== 'Aeirmist User') {
          bestDisplayName = c.displayName;
        }
      }

      // Username
      if (!bestUsername || bestUsername.startsWith('guest_')) {
        if (c.username && !c.username.startsWith('guest_')) {
          bestUsername = c.username;
        }
      }

      // Avatar
      if (!bestPhotoURL || bestPhotoURL === BLANK_DP) {
        if (c.photoURL && c.photoURL !== BLANK_DP && typeof c.photoURL === 'string' && c.photoURL.length > 5) {
          bestPhotoURL = c.photoURL;
        }
      }

      // Cover / banner
      if (!bestCoverURL && (c.coverURL || c.bannerURL)) {
        bestCoverURL = c.coverURL || c.bannerURL;
      }

      // Bio
      if (!bestBio || bestBio.includes('Ephemeral') || bestBio === 'Account created.') {
        if (c.bio && !c.bio.includes('Ephemeral') && c.bio !== 'Account created.') {
          bestBio = c.bio;
        }
      }

      // Tagline
      if (!bestTagline && c.tagline && c.tagline !== 'Temporary State') {
        bestTagline = c.tagline;
      }

      // Account settings fields
      if (!bestLocation && c.location) bestLocation = c.location;
      if (!bestLocationData && c.locationData) bestLocationData = c.locationData;
      if (!bestWebsite && c.website) bestWebsite = c.website;
      if (!bestCategory && c.category) bestCategory = c.category;
      if ((!bestPronouns || (Array.isArray(bestPronouns) && bestPronouns.length === 0)) && c.pronouns) bestPronouns = c.pronouns;
      if (!bestDateOfBirth && c.dateOfBirth) bestDateOfBirth = c.dateOfBirth;
      if (!bestGender && c.gender) bestGender = c.gender;
      if (!bestPhoneNumber && c.phoneNumber) bestPhoneNumber = c.phoneNumber;
      if (c.phoneCountryCode) bestPhoneCountryCode = c.phoneCountryCode;
      if (c.phoneVerified) bestPhoneVerified = true;
      if (c.relationshipStatus) bestRelationshipStatus = c.relationshipStatus;
      if (c.relationshipStatusVisibility) bestRelationshipStatusVisibility = c.relationshipStatusVisibility;
      if (!bestPersonalEmail && c.personalEmail) bestPersonalEmail = c.personalEmail;
      if (!bestRecoveryEmail && c.recoveryEmail) bestRecoveryEmail = c.recoveryEmail;
      if (!bestRecoveryPhone && c.recoveryPhone) bestRecoveryPhone = c.recoveryPhone;

      // Counts
      if (typeof c.followersCount === 'number') bestFollowersCount = Math.max(bestFollowersCount, c.followersCount);
      if (typeof c.followingCount === 'number') bestFollowingCount = Math.max(bestFollowingCount, c.followingCount);
      if (typeof c.aeirmistLevel === 'number') bestLevel = Math.max(bestLevel, c.aeirmistLevel);

      // Status
      if (c.isAdmin) isAdmin = true;
      if (c.isVerified) isVerified = true;
      if (c.onboardingCompleted) onboardingCompleted = true;
      if (typeof c.onboardingStep === 'number') onboardingStep = Math.max(onboardingStep, c.onboardingStep);

      // Maps
      if (c.socialLinks) mergedSocialLinks = { ...mergedSocialLinks, ...c.socialLinks };
      if (c.privacySettings) mergedPrivacySettings = { ...mergedPrivacySettings, ...c.privacySettings };
      if (c.themeSettings) mergedThemeSettings = { ...mergedThemeSettings, ...c.themeSettings };

      // Social arrays
      if (Array.isArray(c.social?.followers)) c.social.followers.forEach((f: string) => mergedFollowers.add(f));
      if (Array.isArray(c.social?.following)) c.social.following.forEach((f: string) => mergedFollowing.add(f));
    }

    // Also factor in userDocData
    if (userDocData) {
      if (!bestPhotoURL && userDocData.photoURL) bestPhotoURL = userDocData.photoURL;
      if (!bestDisplayName && userDocData.displayName) bestDisplayName = userDocData.displayName;
      if (!bestUsername && userDocData.username) bestUsername = userDocData.username;
      if (userDocData.isAdmin) isAdmin = true;
    }

    // Auth currentUser factors
    if (!bestPhotoURL && activeUser.photoURL) bestPhotoURL = activeUser.photoURL;
    if (!bestDisplayName && activeUser.displayName) bestDisplayName = activeUser.displayName;

    // Fallbacks
    if (!bestDisplayName) {
      bestDisplayName = isMainAdmin ? 'Junaed Islam Jim' : (bestUsername || 'Aeirmist Member');
    }
    if (!bestUsername) {
      bestUsername = normUsername || (userEmail ? userEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') : (isMainAdmin ? 'junaedislamjim' : 'member'));
    }
    if (!bestPhotoURL) bestPhotoURL = BLANK_DP;
    if (!bestBio) bestBio = isMainAdmin ? 'Founder & Lead Architect at Aeirmist' : 'Aeirmist Account Active';

    const finalNormUsername = normalizeUsername(bestUsername);

    // Clean any bloated base64 from appearanceSettings
    let cleanAppearance = existingCanonical.appearanceSettings ? { ...existingCanonical.appearanceSettings } : undefined;
    if (cleanAppearance && Array.isArray(cleanAppearance.globalBgList)) {
      cleanAppearance.globalBgList = cleanAppearance.globalBgList.filter((u: any) => typeof u === 'string' && !u.startsWith('data:image'));
    }

    // Construct Canonical Merged Profile
    const canonicalProfile: any = {
      ...existingCanonical,
      id: canonicalProfileId,
      uid: userUid,
      ownerUid: userUid,
      username: bestUsername,
      usernameNormalized: finalNormUsername,
      email: userEmail,
      displayName: bestDisplayName,
      photoURL: bestPhotoURL,
      coverURL: bestCoverURL,
      bannerURL: bestCoverURL,
      bio: bestBio,
      tagline: bestTagline,
      location: bestLocation,
      locationData: bestLocationData,
      website: bestWebsite,
      category: bestCategory,
      pronouns: bestPronouns,
      dateOfBirth: bestDateOfBirth,
      gender: bestGender,
      phoneNumber: bestPhoneNumber,
      phoneCountryCode: bestPhoneCountryCode,
      phoneVerified: bestPhoneVerified,
      relationshipStatus: bestRelationshipStatus,
      relationshipStatusVisibility: bestRelationshipStatusVisibility,
      personalEmail: bestPersonalEmail,
      recoveryEmail: bestRecoveryEmail,
      recoveryPhone: bestRecoveryPhone,
      followersCount: Math.max(bestFollowersCount, mergedFollowers.size),
      followingCount: Math.max(bestFollowingCount, mergedFollowing.size),
      aeirmistLevel: isMainAdmin ? 9999 : bestLevel,
      isAdmin,
      role: isAdmin ? 'admin' : 'user',
      isVerified,
      isActive: true,
      onboardingCompleted,
      onboardingStep,
      socialLinks: mergedSocialLinks,
      privacySettings: mergedPrivacySettings,
      themeSettings: mergedThemeSettings,
      ...(cleanAppearance ? { appearanceSettings: cleanAppearance } : {}),
      social: {
        followers: Array.from(mergedFollowers),
        following: Array.from(mergedFollowing),
        pendingFollowing: []
      },
      updatedAt: serverTimestamp(),
      syncedAt: serverTimestamp()
    };

    if (!canonicalProfile.createdAt) {
      canonicalProfile.createdAt = existingCanonical.createdAt || serverTimestamp();
    }

    // 1. Upload & sync canonical profile to profiles/profile_{uid}
    await setDoc(doc(db, 'profiles', canonicalProfileId), canonicalProfile, { merge: true });
    logger.info(`[AccountSync] ✅ Synced canonical profile: profiles/${canonicalProfileId}`);

    // 2. Upload & sync to users/{uid}
    await setDoc(doc(db, 'users', userUid), {
      uid: userUid,
      ownerUid: userUid,
      email: userEmail,
      username: bestUsername,
      usernameNormalized: finalNormUsername,
      displayName: bestDisplayName,
      photoURL: bestPhotoURL,
      isAdmin,
      role: isAdmin ? 'admin' : 'user',
      lastLogin: serverTimestamp(),
      syncedAt: serverTimestamp()
    }, { merge: true });
    logger.info(`[AccountSync] ✅ Synced user document: users/${userUid}`);

    // 3. Upload & sync to usernames/{normUsername}
    if (finalNormUsername) {
      await setDoc(doc(db, 'usernames', finalNormUsername), {
        uid: userUid,
        ownerUid: userUid,
        email: userEmail,
        username: bestUsername,
        usernameNormalized: finalNormUsername,
        normalizedUsername: finalNormUsername,
        profileId: canonicalProfileId,
        updatedAt: serverTimestamp()
      }, { merge: true });
      logger.info(`[AccountSync] ✅ Synced lock document: usernames/${finalNormUsername}`);
    }

    // 4. Clean up duplicate profile documents from Firestore!
    const cleanedDuplicateIds: string[] = [];
    for (const [docId] of candidateDocsMap.entries()) {
      if (docId !== canonicalProfileId) {
        try {
          await deleteDoc(doc(db, 'profiles', docId));
          cleanedDuplicateIds.push(docId);
          logger.info(`[AccountSync] 🗑️ Removed duplicate profile ID from database: ${docId}`);
        } catch (delErr) {
          logger.warn(`[AccountSync] Failed to delete duplicate profile ${docId}:`, delErr);
        }
      }
    }

    logger.info(`[AccountSync] Successfully consolidated ${allCandidateList.length} profiles into 1 canonical ID (${canonicalProfileId}). Deleted ${cleanedDuplicateIds.length} duplicate IDs.`);

    return {
      success: true,
      canonicalProfile,
      cleanedDuplicateIds,
      totalMerged: allCandidateList.length
    };
  } catch (error) {
    logger.error('[AccountSync] Error during profile consolidation:', error);
    return { success: false, canonicalProfile: null, cleanedDuplicateIds: [], totalMerged: 0 };
  }
}

