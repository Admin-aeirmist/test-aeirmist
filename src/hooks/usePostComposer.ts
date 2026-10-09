import { useState, useRef, useEffect } from 'react';
import { useAeirmist } from '../context/AeirmistContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { MediaQuality } from '../services/MediaService';

export const usePostComposer = () => {
  const { db, user, profile, uploadMedia, addToast } = useAeirmist();
  const [content, setContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadAndBroadcastPost = async (payloadExtras: any) => {
    if (!user || !db) return;
    setIsUploading(true);
    setUploadProgress(15);

    try {
      // ... (re-implement the upload logic from the previous CreatePost.tsx)
      const payload = {
        userId: user.uid,
        content,
        createdAt: serverTimestamp(),
        ...payloadExtras
      };

      await addDoc(collection(db, 'posts'), payload);
      
      addToast({ title: "Published", message: "Post broadcasted successfully.", type: "success" });
    } catch (err) {
      addToast({ title: "Error", message: "Failed to broadcast post.", type: "warning" });
    } finally {
      setIsUploading(false);
    }
  };

  return { content, setContent, isUploading, uploadProgress, uploadAndBroadcastPost };
};
