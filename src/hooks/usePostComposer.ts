import { useState } from 'react';
import { useAeirmist } from '../context/AeirmistContext';
import { api } from '../services/api/client';

export const usePostComposer = () => {
  const { user, addToast } = useAeirmist();
  const [content, setContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadAndBroadcastPost = async (payloadExtras: any = {}) => {
    if (!user) return;
    setIsUploading(true);
    setUploadProgress(15);

    try {
      await api.posts.create({
        content,
        ...payloadExtras
      });
      
      addToast({ title: "Published", message: "Post broadcasted successfully.", type: "success" });
      setContent('');
    } catch (err: any) {
      addToast({ title: "Error", message: err.message || "Failed to broadcast post.", type: "warning" });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return { content, setContent, isUploading, uploadProgress, uploadAndBroadcastPost };
};
