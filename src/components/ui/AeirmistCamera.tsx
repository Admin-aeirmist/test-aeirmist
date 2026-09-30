import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Camera as CameraIcon, Image as ImageIcon, Video as VideoIcon, X, Loader2 } from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { logger } from '@/src/utils/logger';

export type CameraMode = 'PHOTO' | 'VIDEO' | 'STORY';

interface AeirmistCameraProps {
  onCapture: (file: File, mode?: any) => void;
  onClose: () => void;
  initialMode?: any;
}

export const AeirmistCamera: React.FC<AeirmistCameraProps> = ({
  onCapture,
  onClose,
  initialMode = 'PHOTO'
}) => {
  const { addToast } = useAeirmist();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isLaunching, setIsLaunching] = useState(true);

  // Directly launch native device camera
  const launchNativeCamera = useCallback(async () => {
    setIsLaunching(true);

    if (Capacitor.isNativePlatform()) {
      try {
        // Request & check camera permissions on Android
        const permission = await Camera.checkPermissions();
        if (permission.camera !== 'granted') {
          const req = await Camera.requestPermissions();
          if (req.camera !== 'granted') {
            addToast?.({
              title: 'Permission Required',
              message: 'Camera permission is required to take photos.',
              type: 'warning'
            });
            onClose();
            return;
          }
        }

        // Open device native camera app directly
        const photo = await Camera.getPhoto({
          quality: 95,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera
        });

        if (photo.webPath) {
          const response = await fetch(photo.webPath);
          const blob = await response.blob();
          const file = new File(
            [blob],
            `camera_${Date.now()}.${photo.format || 'jpg'}`,
            { type: `image/${photo.format || 'jpeg'}` }
          );
          onCapture(file, initialMode);
        }
        onClose();
      } catch (err: any) {
        // User cancelled camera or pressed back
        logger.info('[Camera] Native camera dismissed or error:', err);
        onClose();
      }
    } else {
      // In web browser: trigger native HTML5 camera capture
      if (initialMode === 'VIDEO' && videoInputRef.current) {
        videoInputRef.current.click();
      } else if (fileInputRef.current) {
        fileInputRef.current.click();
      }
      setIsLaunching(false);
    }
  }, [initialMode, onCapture, onClose, addToast]);

  useEffect(() => {
    launchNativeCamera();
  }, [launchNativeCamera]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onCapture(file, initialMode);
      onClose();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 select-none font-sans">
      {/* Hidden native inputs for mobile web browser capture */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        type="file"
        ref={videoInputRef}
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        type="file"
        ref={galleryInputRef}
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Clean, minimal overlay while launching device camera */}
      <div className="w-full max-w-sm bg-[#121217] border border-white/10 rounded-3xl p-6 flex flex-col items-center text-center shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/40 hover:text-white rounded-full bg-white/5 transition-all"
        >
          <X size={18} />
        </button>

        <div className="w-16 h-16 rounded-2xl bg-[#00F2FF]/10 border border-[#00F2FF]/30 flex items-center justify-center text-[#00F2FF] mb-4 shadow-[0_0_20px_rgba(0,242,255,0.2)]">
          {isLaunching ? (
            <Loader2 size={32} className="animate-spin text-[#00F2FF]" />
          ) : (
            <CameraIcon size={32} />
          )}
        </div>

        <h2 className="text-lg font-bold text-white mb-1">
          {isLaunching ? 'Opening Camera...' : 'Device Camera'}
        </h2>
        <p className="text-xs text-white/40 mb-6 max-w-xs">
          {isLaunching
            ? 'Launching your device camera app with full resolution and lens features.'
            : 'Select an option to capture with your device camera or choose from gallery.'}
        </p>

        {/* Action Buttons (works on both native APK and browser) */}
        <div className="w-full space-y-3">
          <button
            onClick={() => {
              if (Capacitor.isNativePlatform()) {
                launchNativeCamera();
              } else if (fileInputRef.current) {
                fileInputRef.current.click();
              }
            }}
            className="w-full py-3.5 px-4 rounded-xl bg-[#00F2FF] hover:bg-white text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-[0_0_15px_rgba(0,242,255,0.3)] cursor-pointer active:scale-95"
          >
            <CameraIcon size={16} />
            <span>Open Device Camera</span>
          </button>

          <button
            onClick={() => {
              if (videoInputRef.current) {
                videoInputRef.current.click();
              }
            }}
            className="w-full py-3.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all border border-white/10 cursor-pointer active:scale-95"
          >
            <VideoIcon size={16} />
            <span>Record Video</span>
          </button>

          <button
            onClick={() => {
              if (galleryInputRef.current) {
                galleryInputRef.current.click();
              }
            }}
            className="w-full py-3 px-4 rounded-xl bg-transparent hover:bg-white/5 text-white/60 hover:text-white font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <ImageIcon size={15} />
            <span>Choose from Gallery</span>
          </button>
        </div>
      </div>
    </div>
  );
};
