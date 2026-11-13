import React, { useRef, useState } from 'react';
import { Upload, Image as ImageIcon, X, RefreshCw, Check } from 'lucide-react';
import { api } from '../../../services/api/client';
import { useAppearance, ACCENT_COLOR_MAP } from '../../../context/AppearanceContext';

interface DeviceImageUploaderProps {
  coverUrl: string;
  onCoverChange: (url: string) => void;
  logoUrl: string;
  onLogoChange: (url: string) => void;
  coverLabel?: string;
  logoLabel?: string;
  coverAspectHint?: string;
  logoAspectHint?: string;
}

export const DeviceImageUploader: React.FC<DeviceImageUploaderProps> = ({
  coverUrl,
  onCoverChange,
  logoUrl,
  onLogoChange,
  coverLabel = 'Cover Banner',
  logoLabel = 'Logo / Avatar',
  coverAspectHint = '16:9 ratio recommended (PNG, JPG, WebP)',
  logoAspectHint = '1:1 square ratio recommended',
}) => {
  const { settings: appearanceSettings } = useAppearance();
  const accentHex = ACCENT_COLOR_MAP[appearanceSettings?.accentColor] || '#00f2ff';

  const coverInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [showUrlInputs, setShowUrlInputs] = useState(false);

  // Handle Cover File Upload
  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Instant local preview via Data URL (never fails, 100% offline & workable)
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        onCoverChange(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);

    // 2. Background upload to backend media storage if online
    setIsUploadingCover(true);
    api.media.upload(file, 'bonds')
      .then((res) => {
        if (res?.url) {
          onCoverChange(res.url);
        }
      })
      .catch((err) => {
        console.warn('[Cover upload to backend fallback to local DataURL]', err);
      })
      .finally(() => {
        setIsUploadingCover(false);
      });
  };

  // Handle Logo File Upload
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Instant local preview via Data URL
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        onLogoChange(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);

    // 2. Background upload to backend media storage if online
    setIsUploadingLogo(true);
    api.media.upload(file, 'bonds')
      .then((res) => {
        if (res?.url) {
          onLogoChange(res.url);
        }
      })
      .catch((err) => {
        console.warn('[Logo upload to backend fallback to local DataURL]', err);
      })
      .finally(() => {
        setIsUploadingLogo(false);
      });
  };

  return (
    <div className="space-y-4">
      {/* 1. Cover Banner Upload */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold text-neutral-300">
            {coverLabel} <span className="text-[11px] text-neutral-500 font-normal">({coverAspectHint})</span>
          </label>
          {coverUrl && (
            <button
              type="button"
              onClick={() => {
                onCoverChange('');
                if (coverInputRef.current) coverInputRef.current.value = '';
              }}
              className="text-[11px] text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Remove</span>
            </button>
          )}
        </div>

        <input
          type="file"
          ref={coverInputRef}
          accept="image/*"
          onChange={handleCoverSelect}
          className="hidden"
        />

        {coverUrl ? (
          <div
            onClick={() => coverInputRef.current?.click()}
            className="relative h-32 w-full rounded-xl border border-white/15 overflow-hidden group cursor-pointer bg-neutral-900 shadow-inner"
          >
            <img src={coverUrl} alt="Cover preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-semibold backdrop-blur-xs">
              <Upload className="w-4 h-4 text-cyan-400" />
              <span>Click to Change Device Image</span>
            </div>
            {isUploadingCover && (
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/70 text-[10px] text-cyan-300 flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Syncing...</span>
              </div>
            )}
          </div>
        ) : (
          <div
            onClick={() => coverInputRef.current?.click()}
            className="h-28 rounded-xl border-2 border-dashed border-white/15 hover:border-cyan-400/60 bg-black/30 hover:bg-white/[0.03] transition-all flex flex-col items-center justify-center gap-2 cursor-pointer p-4 text-center group"
          >
            <div 
              style={{ backgroundColor: `${accentHex}15`, borderColor: `${accentHex}30` }}
              className="w-10 h-10 rounded-full border flex items-center justify-center text-neutral-300 group-hover:scale-105 transition-transform"
            >
              <Upload style={{ color: accentHex }} className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">
                Choose Image from Device
              </p>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                PNG, JPG, WebP, GIF • Click to browse file system
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. Logo / Avatar Upload */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold text-neutral-300">
            {logoLabel} <span className="text-[11px] text-neutral-500 font-normal">({logoAspectHint})</span>
          </label>
          {logoUrl && (
            <button
              type="button"
              onClick={() => {
                onLogoChange('');
                if (logoInputRef.current) logoInputRef.current.value = '';
              }}
              className="text-[11px] text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Remove</span>
            </button>
          )}
        </div>

        <input
          type="file"
          ref={logoInputRef}
          accept="image/*"
          onChange={handleLogoSelect}
          className="hidden"
        />

        <div className="flex items-center gap-3.5 p-3 rounded-xl bg-black/30 border border-white/10">
          {logoUrl ? (
            <div
              onClick={() => logoInputRef.current?.click()}
              className="relative w-16 h-16 rounded-xl border-2 border-white/20 overflow-hidden group cursor-pointer bg-neutral-900 shrink-0 shadow-md"
            >
              <img src={logoUrl} alt="Logo preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white backdrop-blur-xs">
                <Upload className="w-4 h-4 text-cyan-400" />
              </div>
            </div>
          ) : (
            <div
              onClick={() => logoInputRef.current?.click()}
              className="w-16 h-16 rounded-xl border-2 border-dashed border-white/15 hover:border-cyan-400/60 bg-white/[0.02] hover:bg-white/[0.05] transition-all flex items-center justify-center cursor-pointer shrink-0 text-neutral-400 hover:text-cyan-400"
            >
              <ImageIcon className="w-6 h-6" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              style={{
                backgroundColor: `${accentHex}18`,
                borderColor: `${accentHex}40`,
                color: accentHex,
              }}
              className="px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer hover:brightness-110 active:scale-[0.98]"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{logoUrl ? 'Change Device Photo' : 'Upload Logo from Device'}</span>
            </button>
            <p className="text-[11px] text-neutral-500 mt-1">
              Upload square icon, badge, crest or avatar from your computer/mobile
            </p>
          </div>
        </div>
      </div>

      {/* 3. Combined Live Preview Card */}
      {(coverUrl || logoUrl) && (
        <div className="pt-2">
          <p className="text-[11px] font-semibold text-neutral-400 mb-1.5 uppercase tracking-wider">Live Preview</p>
          <div className="relative h-28 bg-neutral-900 rounded-xl overflow-hidden border border-white/10 shadow-lg">
            {coverUrl ? (
              <img src={coverUrl} alt="Cover preview" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-linear-to-r from-neutral-900 via-neutral-800 to-neutral-900 flex items-center justify-center text-neutral-600 text-xs">
                No Cover Image
              </div>
            )}
            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
            {logoUrl && (
              <div className="absolute bottom-2.5 left-3 w-12 h-12 rounded-xl border-2 border-white/30 bg-black overflow-hidden shadow-xl">
                <img src={logoUrl} alt="Logo preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Secondary URL accordion if someone prefers link */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowUrlInputs(!showUrlInputs)}
          className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
        >
          {showUrlInputs ? '− Hide URL inputs' : '+ Or provide external image link (optional)'}
        </button>
        {showUrlInputs && (
          <div className="space-y-2 mt-2 pt-2 border-t border-white/5">
            <div>
              <label className="block text-[11px] text-neutral-400 mb-0.5">External Cover URL</label>
              <input
                type="url"
                placeholder="https://..."
                value={coverUrl}
                onChange={(e) => onCoverChange(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-neutral-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-neutral-400 mb-0.5">External Logo URL</label>
              <input
                type="url"
                placeholder="https://..."
                value={logoUrl}
                onChange={(e) => onLogoChange(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-neutral-600 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
