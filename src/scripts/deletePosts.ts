
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { logger } from '@/src/utils/logger';


const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const dbId = firebaseConfig.firestoreDatabaseId === '(default)' ? undefined : firebaseConfig.firestoreDatabaseId;
const db = getFirestore(app, dbId);

async function cleanDeletedAccountPosts() {
    console.log('🔍 Scanning posts collection for deleted account posts...');
    const postsRef = collection(db, 'posts');
    const postsSnapshot = await getDocs(postsRef);
    console.log(`Found ${postsSnapshot.size} total posts.`);
    
    let count = 0;
    for (const postDoc of postsSnapshot.docs) {
        const data = postDoc.data();
        const isDeleted = Boolean(
            data.isDeletedAuthor === true ||
            data.scheduledForPurge === true ||
            data.authorName === 'Aeirmist User' ||
            data.userName === 'Aeirmist User' ||
            data.author?.name === 'Aeirmist User' ||
            data.author?.displayName === 'Aeirmist User'
        );

        if (isDeleted) {
            console.log(`🗑️ Deleting post ${postDoc.id} (Author: ${data.authorName || data.userName || 'Unknown'})`);
            await deleteDoc(doc(db, 'posts', postDoc.id));
            count++;
        }
    }
    console.log(`✅ Cleanup complete: Deleted ${count} orphaned posts.`);
}

cleanDeletedAccountPosts().catch(console.error);

