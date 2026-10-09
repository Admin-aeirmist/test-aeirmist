import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sun, Moon, Monitor, Paintbrush, Layers, Type, Sparkles, 
  Eye, Image as ImageIcon, Accessibility, RotateCcw,
  Check, ChevronRight, Upload, AlertCircle, Trash2, LayoutGrid, X,
  Activity, Settings2, Minimize, Maximize, Palette, Wind
} from 'lucide-react';
import { useAppearance, AppearanceSettingsConfig } from '../../../context/AppearanceContext';
import { useAeirmist, MediaQuality } from '../../../context/AeirmistContext';
import { useTheme } from '../../../context/ThemeContext';
import { logger } from '@/src/utils/logger';


export default function AppearanceSettings() {
  const { settings, updateAppearanceSettings, resetAppearanceSettings } = useAppearance();
  const { uploadMedia, user } = useAeirmist();
  const { activeTheme } = useTheme();
  const isLight = activeTheme?.isLight;
  
  const [activeModal, setActiveModal] = useState<'theme' | 'accent' | 'background' | 'density' | 'fontSize' | 'reset' | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [galleryTab, setGalleryTab] = useState<'defaults' | 'custom' | 'solids' | 'gradients'>('defaults');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdate = <K extends keyof AppearanceSettingsConfig>(key: K, value: AppearanceSettingsConfig[K]) => {
    updateAppearanceSettings({ [key]: value });
  };

  const solidColors = useMemo(() => isLight ? [
    { hex: '#f8fafc', name: 'Alabaster' },
    { hex: '#f1f5f9', name: 'Slate Light' },
    { hex: '#e2e8f0', name: 'Mist' },
    { hex: '#ffffff', name: 'Pure White' },
    { hex: '#0a0a0f', name: 'Space' },
    { hex: '#0f172a', name: 'Slate' }
  ] : [
    { hex: '#0a0a0f', name: 'Space' },
    { hex: '#0f172a', name: 'Slate' },
    { hex: '#111827', name: 'Coal' },
    { hex: '#171717', name: 'Onyx' }
  ], [isLight]);

  const gradientColors = useMemo(() => isLight ? [
    { grad: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)', name: 'Morning Breeze' },
    { grad: 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%)', name: 'Pastel Lilac' },
    { grad: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', name: 'Silver Sky' },
    { grad: 'linear-gradient(135deg, #09090e 0%, #170d24 100%)', name: 'Twilight' }
  ] : [
    { grad: 'linear-gradient(135deg, #09090e 0%, #170d24 100%)', name: 'Twilight' },
    { grad: 'linear-gradient(135deg, #020617 0%, #0c1a30 100%)', name: 'Abyss' },
    { grad: 'linear-gradient(135deg, #0a1108 0%, #051a1c 100%)', name: 'Jade' }
  ], [isLight]);

  const defaultWallpapers = useMemo(() => isLight ? [
    { url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=640&auto=format&fit=crop', name: 'Pastel Aura' },
    { url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=640&auto=format&fit=crop', name: 'Ocean Mist' },
    { url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=640&auto=format&fit=crop', name: 'Deep Twilight' },
    { url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?q=80&w=640&auto=format&fit=crop', name: 'Neon City' }
  ] : [
    { url: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=640&auto=format&fit=crop', name: 'Cosmic Dust' },
    { url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=640&auto=format&fit=crop', name: 'Deep Twilight' },
    { url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?q=80&w=640&auto=format&fit=crop', name: 'Neon City' },
    { url: 'https://images.unsplash.com/photo-1483168527879-c66136b56105?q=80&w=640&auto=format&fit=crop', name: 'Aurora Glow' }
  ], [isLight]);

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    const allValidTypes = [...validImageTypes, ...validVideoTypes];

    if (!allValidTypes.includes(file.type)) {
      setUploadError('Unsupported format. Please select PNG, JPG, WEBP, GIF, or MP4/WEBM.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setUploadError('File exceeds the maximum 20MB limit.');
      return;
    }

    // Instant local preview update (0ms latency)
    const localBlobUrl = URL.createObjectURL(file);
    const initialList = [...(settings.globalBgList || [])];
    if (!initialList.includes(localBlobUrl)) {
      initialList.push(localBlobUrl);
    }

    updateAppearanceSettings({
      globalBgType: 'custom',
      globalBgValue: localBlobUrl,
      globalBgList: initialList
    });

    setIsUploading(true);
    setUploadError(null);

    try {
      if (uploadMedia) {
        try {
          const downloadURL = await uploadMedia(file, `wallpapers/${user?.uid}`, (progress) => {
            logger.info(`Global Background Upload: ${Math.round(progress)}%`);
          }, MediaQuality.WALLPAPER_LITE);
          
          if (downloadURL) {
            const newList = (settings.globalBgList || []).map(item => item === localBlobUrl ? downloadURL : item);
            if (!newList.includes(downloadURL)) newList.push(downloadURL);
            updateAppearanceSettings({
              globalBgType: 'custom',
              globalBgValue: downloadURL,
              globalBgList: newList
            });
          }
        } catch (uploadErr) {
          logger.warn("Cloud wallpaper upload failed, keeping local blob URL:", uploadErr);
        }
      }
    } catch (err: any) {
      setUploadError(err.message || 'Error processing the selected file.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveWallpaper = () => {
    updateAppearanceSettings({
      globalBgType: 'none',
      globalBgValue: ''
    });
  };

  const handleRemoveFromRotationList = (indexToRemove: number) => {
    const list = [...(settings.globalBgList || [])];
    const itemToRemove = list[indexToRemove];
    list.splice(indexToRemove, 1);
    
    const isCurrentlyActive = settings.globalBgValue === itemToRemove;
    const nextActiveValue = isCurrentlyActive ? (list[0] || '') : settings.globalBgValue;
    const nextActiveType = isCurrentlyActive ? (list.length > 0 ? 'custom' : 'none') : settings.globalBgType;

    updateAppearanceSettings({
      globalBgList: list,
      globalBgValue: nextActiveValue,
      globalBgType: nextActiveType as any
    });
  };

  const toggleSetting = (keyName: keyof AppearanceSettingsConfig) => {
    handleUpdate(keyName, !settings[keyName] as any);
  };

  // Switch UI subcomponent
  const Switch = ({ enabled, onClick }: { enabled: boolean, onClick: () => void }) => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-aeirmist-cyan focus:ring-offset-2 ${
        isLight ? 'focus:ring-offset-white' : 'focus:ring-offset-[#07090e]'
      } ${
        enabled ? 'bg-aeirmist-cyan shadow-[0_0_12px_rgba(0,242,255,0.4)]' : (isLight ? 'bg-slate-200' : 'bg-white/10')
      }`}
      aria-label="Toggle preference"
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );

  // Settings Row Container
  const SettingRow = ({ 
    icon: IconComponent, 
    title, 
    enabled, 
    keyName 
  }: { 
    icon: React.ComponentType<any>, 
    title: string, 
    enabled: boolean, 
    keyName: keyof typeof settings 
  }) => {
    return (
      <div 
        onClick={() => toggleSetting(keyName)}
        className={`flex items-center justify-between py-2 px-3.5 rounded-xl border transition-all cursor-pointer ${
          isLight ? 'bg-white hover:bg-slate-50 border-slate-200 shadow-sm' : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.03]'
        }`}
      >
        <div className="flex items-center gap-3 pr-4 min-w-0">
          <div className={`p-1.5 rounded-lg shrink-0 ${enabled ? 'bg-aeirmist-cyan/10 text-aeirmist-cyan shadow-[0_0_10px_rgba(0,242,255,0.15)]' : (isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-white/40')}`}>
            <IconComponent size={14} />
          </div>
          <h4 className={`text-[11px] font-bold uppercase tracking-wider truncate ${isLight ? 'text-slate-700' : 'text-white/90'}`}>{title}</h4>
        </div>
        <Switch enabled={enabled} onClick={() => toggleSetting(keyName)} />
      </div>
    );
  };

  // Interactive Modal Row Component
  const ModalRow = ({ 
    icon: IconComponent, 
    title, 
    value, 
    onClick 
  }: { 
    icon: React.ComponentType<any>, 
    title: string, 
    value: string, 
    onClick: () => void 
  }) => {
    return (
      <div 
        onClick={onClick}
        className={`flex items-center justify-between py-2 px-3.5 rounded-xl border transition-all cursor-pointer ${
          isLight ? 'bg-white hover:bg-slate-50 border-slate-200 shadow-sm' : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.03]'
        }`}
      >
        <div className="flex items-center gap-3 pr-4 min-w-0">
          <div className={`p-1.5 rounded-lg shrink-0 ${isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-white/40'}`}>
            <IconComponent size={14} />
          </div>
          <h4 className={`text-[11px] font-bold uppercase tracking-wider truncate ${isLight ? 'text-slate-700' : 'text-white/90'}`}>{title}</h4>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-500' : 'text-white/40'}`}>{value}</span>
          <ChevronRight size={14} className={isLight ? 'text-slate-400' : 'text-white/30'} />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 select-none">
      {/* Header Container */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 md:p-8 rounded-[2rem] bg-gradient-to-r from-aeirmist-cyan/5 via-transparent to-transparent border border-white/5 relative overflow-hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-aeirmist-cyan/15 flex items-center justify-center text-aeirmist-cyan shadow-[0_0_15px_rgba(0,242,255,0.2)]">
              <Palette size={20} className="animate-pulse" />
            </div>
            <div>
              <h2 className={`text-xl font-display font-black tracking-wider uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>Appearance</h2>
              <p className="text-[10px] font-mono text-aeirmist-cyan uppercase tracking-widest">Sensory & Geometric Config</p>
            </div>
          </div>
          <p className={`text-xs leading-relaxed max-w-md pt-2 ${isLight ? 'text-slate-500' : 'text-white/50'}`}>
            Configure visual settings, themes, layouts, interface scale, and layout density for your active device.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        
        {/* SECTION 1: DISPLAY & SIZING */}
        <div className={`p-4 md:p-5 rounded-3xl border space-y-3 ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.01] border-white/5"}`}>
          <div className="flex items-center gap-2 pb-2 px-1">
            <Monitor size={14} className={isLight ? "text-slate-400" : "text-white/40"} />
            <h3 className={`text-xs font-black uppercase tracking-widest ${isLight ? "text-slate-800" : "text-white/95"}`}>Display & Sizing</h3>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            <ModalRow icon={Moon} title="Theme Mode" value={settings.themeMode} onClick={() => setActiveModal('theme')} />
            <ModalRow icon={Paintbrush} title="Accent Color" value={settings.accentColor} onClick={() => setActiveModal('accent')} />
            <ModalRow icon={ImageIcon} title="Background Wallpaper" value={settings.globalBgType} onClick={() => setActiveModal('background')} />
            <ModalRow icon={Layers} title="Layout Density" value={settings.density} onClick={() => setActiveModal('density')} />
            <ModalRow icon={Type} title="Font Size" value={settings.fontSize} onClick={() => setActiveModal('fontSize')} />
          </div>
        </div>

        {/* SECTION 2: EFFECTS & ANIMATIONS */}
        <div className={`p-4 md:p-5 rounded-3xl border space-y-3 ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.01] border-white/5"}`}>
          <div className="flex items-center gap-2 pb-2 px-1">
            <Sparkles size={14} className={isLight ? "text-slate-400" : "text-white/40"} />
            <h3 className={`text-xs font-black uppercase tracking-widest ${isLight ? "text-slate-800" : "text-white/95"}`}>Effects & Animations</h3>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            <SettingRow icon={Layers} title="Glassmorphism Effect" enabled={settings.enableGlassEffect} keyName="enableGlassEffect" />
            <SettingRow icon={Wind} title="UI Animations" enabled={settings.enableAnimations} keyName="enableAnimations" />
            <SettingRow icon={Activity} title="Smooth Transitions" enabled={settings.smoothTransitions} keyName="smoothTransitions" />
            <SettingRow icon={Minimize} title="Reduce Motion" enabled={settings.reduceMotion} keyName="reduceMotion" />
          </div>
        </div>

        {/* SECTION 3: ACCESSIBILITY */}
        <div className={`p-4 md:p-5 rounded-3xl border space-y-3 ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.01] border-white/5"}`}>
          <div className="flex items-center gap-2 pb-2 px-1">
            <Accessibility size={14} className={isLight ? "text-slate-400" : "text-white/40"} />
            <h3 className={`text-xs font-black uppercase tracking-widest ${isLight ? "text-slate-800" : "text-white/95"}`}>Accessibility</h3>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            <SettingRow icon={Eye} title="High Contrast" enabled={settings.highContrast} keyName="highContrast" />
            <SettingRow icon={Type} title="Improve Readability" enabled={settings.improveReadability} keyName="improveReadability" />
            <SettingRow icon={Maximize} title="Large Target Buttons" enabled={settings.largeButtons} keyName="largeButtons" />
            <SettingRow icon={Palette} title="Color Blind Support" enabled={settings.colorBlindFriendly} keyName="colorBlindFriendly" />
          </div>
        </div>

        {/* SECTION 4: ACTIONS */}
        <div className={`p-4 md:p-5 rounded-3xl border space-y-3 ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.01] border-white/5"}`}>
          <div className="flex items-center gap-2 pb-2 px-1">
            <Settings2 size={14} className={isLight ? "text-slate-400" : "text-white/40"} />
            <h3 className={`text-xs font-black uppercase tracking-widest ${isLight ? "text-slate-800" : "text-white/95"}`}>System Actions</h3>
          </div>
          
          <button 
            type="button"
            onClick={() => setActiveModal('reset')}
            className="w-full px-6 py-3 rounded-xl bg-red-950/30 border border-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all"
          >
            Reset Appearance Preferences
          </button>
        </div>

      </div>

      {/* MODALS */}
      <AnimatePresence>
        {activeModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className={`max-w-md w-full p-6 md:p-8 rounded-[2.5rem] border relative z-10 shadow-2xl ${isLight ? 'bg-white border-slate-200' : 'bg-[#0b0e14]/90 backdrop-blur-2xl border-white/10'}`}
            >
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className={`absolute right-6 top-6 transition-colors ${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-white/30 hover:text-white'}`}
              >
                <X size={20} />
              </button>

              {activeModal === 'theme' && (
                <div className="space-y-5">
                  <div className={`flex items-center gap-2 pb-1 border-b ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
                    <Moon className="text-aeirmist-cyan" size={16} />
                    <h3 className={`text-xs font-bold uppercase tracking-widest ${isLight ? 'text-slate-900' : 'text-white'}`}>Theme Mode</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: 'dark', label: 'Dark', icon: Moon },
                      { id: 'light', label: 'Light', icon: Sun },
                      { id: 'system', label: 'System', icon: Monitor }
                    ].map((item) => (
                      <button 
                        key={item.id}
                        type="button"
                        onClick={() => handleUpdate('themeMode', item.id as any)}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${
                          settings.themeMode === item.id 
                            ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan text-aeirmist-cyan' 
                            : isLight ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <item.icon size={16} />
                        {item.label}
                        {settings.themeMode === item.id && <Check size={14} className="ml-auto" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeModal === 'accent' && (
                <div className="space-y-5">
                  <div className={`flex items-center gap-2 pb-1 border-b ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
                    <Paintbrush className="text-aeirmist-cyan" size={16} />
                    <h3 className={`text-xs font-bold uppercase tracking-widest ${isLight ? 'text-slate-900' : 'text-white'}`}>Accent Color</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'cyan', name: 'Cyan', color: 'bg-[#00f2ff]' },
                      { id: 'blue', name: 'Blue', color: 'bg-[#3b82f6]' },
                      { id: 'purple', name: 'Purple', color: 'bg-[#a855f7]' },
                      { id: 'emerald', name: 'Emerald', color: 'bg-[#10b981]' },
                      { id: 'orange', name: 'Orange', color: 'bg-[#f97316]' },
                      { id: 'red', name: 'Red', color: 'bg-[#ef4444]' },
                    ].map((item) => (
                      <button 
                        key={item.id}
                        type="button"
                        onClick={() => handleUpdate('accentColor', item.id as any)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          settings.accentColor === item.id 
                            ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan' 
                            : isLight ? 'bg-slate-50 border-slate-200 hover:bg-slate-100' : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full ${item.color} flex items-center justify-center shrink-0`}>
                          {settings.accentColor === item.id && <Check size={12} className="text-black font-black" />}
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-700' : 'text-white/80'}`}>{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeModal === 'density' && (
                <div className="space-y-5">
                  <div className={`flex items-center gap-2 pb-1 border-b ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
                    <Layers className="text-aeirmist-cyan" size={16} />
                    <h3 className={`text-xs font-bold uppercase tracking-widest ${isLight ? 'text-slate-900' : 'text-white'}`}>Layout Density</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: 'compact', label: 'Compact' },
                      { id: 'comfortable', label: 'Comfortable' },
                      { id: 'spacious', label: 'Spacious' }
                    ].map((item) => (
                      <button 
                        key={item.id}
                        type="button"
                        onClick={() => handleUpdate('density', item.id as any)}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${
                          settings.density === item.id 
                            ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan text-aeirmist-cyan' 
                            : isLight ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {item.label}
                        {settings.density === item.id && <Check size={14} className="ml-auto" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeModal === 'fontSize' && (
                <div className="space-y-5">
                  <div className={`flex items-center gap-2 pb-1 border-b ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
                    <Type className="text-aeirmist-cyan" size={16} />
                    <h3 className={`text-xs font-bold uppercase tracking-widest ${isLight ? 'text-slate-900' : 'text-white'}`}>Font Size</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: 'small', label: 'Small' },
                      { id: 'medium', label: 'Medium' },
                      { id: 'large', label: 'Large' },
                      { id: 'xlarge', label: 'Extra Large' }
                    ].map((item) => (
                      <button 
                        key={item.id}
                        type="button"
                        onClick={() => handleUpdate('fontSize', item.id as any)}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${
                          settings.fontSize === item.id 
                            ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan text-aeirmist-cyan' 
                            : isLight ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {item.label}
                        {settings.fontSize === item.id && <Check size={14} className="ml-auto" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeModal === 'background' && (
                <div className="space-y-5">
                  <div className={`flex items-center gap-2 pb-1 border-b ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
                    <ImageIcon className="text-aeirmist-cyan" size={16} />
                    <h3 className={`text-xs font-bold uppercase tracking-widest ${isLight ? 'text-slate-900' : 'text-white'}`}>Background Wallpaper</h3>
                  </div>
                  
                  <div className={`flex flex-col sm:flex-row items-center gap-4 p-3 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/5'}`}>
                    <div 
                      className={`w-full sm:w-24 h-16 rounded-lg relative overflow-hidden border flex items-center justify-center shrink-0 ${
                        isLight ? 'bg-slate-200/60 border-slate-300' : 'bg-black/40 border-white/10'
                      }`}
                      style={{ 
                        background: settings.globalBgType === 'gradient' ? settings.globalBgValue : settings.globalBgType === 'solid' ? settings.globalBgValue : undefined,
                        backgroundImage: settings.globalBgType === 'custom' ? `url(${settings.globalBgValue})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    >
                      {settings.globalBgType === 'none' && (
                        <span className={`text-[7px] font-black uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-white/30'}`}>Default Grid</span>
                      )}
                      {settings.globalBgType !== 'none' && (
                        <div 
                          className="absolute inset-0" 
                          style={{ 
                            backgroundColor: isLight ? '#ffffff' : '#000000',
                            opacity: (settings.globalBgOverlay / 100) * (isLight ? 0.3 : 1)
                          }} 
                        />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={`h-8 px-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5 ${
                          isLight 
                            ? 'bg-white border-slate-200 text-slate-700 hover:border-aeirmist-cyan hover:bg-aeirmist-cyan/5 shadow-sm' 
                            : 'bg-white/5 border-white/10 hover:border-aeirmist-cyan hover:bg-aeirmist-cyan/5 text-white'
                        }`}
                      >
                        <Upload size={11} className="text-aeirmist-cyan" />
                        Replace
                      </button>
                      {settings.globalBgType !== 'none' && (
                        <button
                          type="button"
                          onClick={handleRemoveWallpaper}
                          className={`h-8 px-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5 ${
                            isLight
                              ? 'bg-white border-slate-200 text-red-600 hover:border-red-400 hover:bg-red-50 shadow-sm'
                              : 'bg-white/5 border-white/10 hover:border-aeirmist-magenta hover:bg-aeirmist-magenta/5 text-white/80 hover:text-white'
                          }`}
                        >
                          <Trash2 size={11} className={isLight ? 'text-red-500' : 'text-aeirmist-magenta'} />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleBgUpload} 
                    accept="image/png, image/jpeg, image/jpg, image/webp, image/gif, video/mp4, video/webm" 
                    className="hidden" 
                  />
                  {uploadError && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-aeirmist-magenta/10 border border-aeirmist-magenta/20 text-[10px] text-aeirmist-magenta uppercase tracking-wider font-bold">
                      <AlertCircle size={13} />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  <div className={`p-3 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.01] border-white/5'} space-y-3`}>
                    <div className={`flex border-b pb-2 overflow-x-auto gap-4 ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
                      {[
                        { id: 'defaults', label: 'Defaults' },
                        { id: 'solids', label: 'Solids' },
                        { id: 'gradients', label: 'Gradients' },
                        { id: 'custom', label: 'My Library' },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setGalleryTab(tab.id as any)}
                          className={`text-[9px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors pb-1 border-b-2 ${
                            galleryTab === tab.id 
                              ? 'text-aeirmist-cyan border-aeirmist-cyan' 
                              : isLight ? 'text-slate-400 border-transparent hover:text-slate-600' : 'text-white/40 border-transparent hover:text-white/70'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="max-h-48 overflow-y-auto no-scrollbar pt-1">
                      {galleryTab === 'defaults' && (
                        <div className="grid grid-cols-2 gap-2">
                          {defaultWallpapers.map((bg, idx) => (
                            <div 
                              key={idx}
                              onClick={() => {
                                updateAppearanceSettings({
                                  globalBgType: 'custom',
                                  globalBgValue: bg.url
                                });
                              }}
                              className={`h-20 rounded-xl bg-cover bg-center border-2 cursor-pointer transition-all ${
                                settings.globalBgValue === bg.url ? 'border-aeirmist-cyan shadow-[0_0_15px_rgba(0,242,255,0.2)] scale-[0.98]' : isLight ? 'border-slate-200 hover:border-slate-300' : 'border-transparent hover:border-white/20'
                              }`}
                              style={{ backgroundImage: `url(${bg.url})` }}
                            >
                              <div className="w-full h-full bg-gradient-to-t from-black/80 to-transparent flex items-end p-2 rounded-[10px]">
                                <span className="text-[8px] text-white/90 font-bold uppercase tracking-wider">{bg.name}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {galleryTab === 'solids' && (
                        <div className="grid grid-cols-2 gap-2">
                          {solidColors.map((bg, idx) => (
                            <div 
                              key={idx}
                              onClick={() => {
                                updateAppearanceSettings({
                                  globalBgType: 'solid',
                                  globalBgValue: bg.hex
                                });
                              }}
                              className={`h-14 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-center ${
                                settings.globalBgValue === bg.hex ? 'border-aeirmist-cyan shadow-[0_0_15px_rgba(0,242,255,0.2)] scale-[0.98]' : isLight ? 'border-slate-200 hover:border-slate-300' : 'border-transparent hover:border-white/20'
                              }`}
                              style={{ backgroundColor: bg.hex }}
                            >
                              <span className="text-[9px] text-white/90 font-bold uppercase tracking-wider mix-blend-difference">{bg.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {galleryTab === 'gradients' && (
                        <div className="grid grid-cols-2 gap-2">
                          {gradientColors.map((bg, idx) => (
                            <div 
                              key={idx}
                              onClick={() => {
                                updateAppearanceSettings({
                                  globalBgType: 'gradient',
                                  globalBgValue: bg.grad
                                });
                              }}
                              className={`h-14 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-center ${
                                settings.globalBgValue === bg.grad ? 'border-aeirmist-cyan shadow-[0_0_15px_rgba(0,242,255,0.2)] scale-[0.98]' : isLight ? 'border-slate-200 hover:border-slate-300' : 'border-transparent hover:border-white/20'
                              }`}
                              style={{ background: bg.grad }}
                            >
                              <span className="text-[9px] text-white/90 font-bold uppercase tracking-wider mix-blend-difference">{bg.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {galleryTab === 'custom' && (
                        <div className="grid grid-cols-2 gap-2">
                          {!settings.globalBgList?.length ? (
                            <div className="col-span-2 py-8 text-center">
                              <p className={`text-[10px] uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-white/30'}`}>No custom uploads found.</p>
                            </div>
                          ) : (
                            settings.globalBgList.map((bg, idx) => (
                              <div key={idx} className="relative group">
                                <div 
                                  onClick={() => {
                                    updateAppearanceSettings({
                                      globalBgType: 'custom',
                                      globalBgValue: bg
                                    });
                                  }}
                                  className={`h-20 rounded-xl bg-cover bg-center border-2 cursor-pointer transition-all ${
                                    settings.globalBgValue === bg ? 'border-aeirmist-cyan shadow-[0_0_15px_rgba(0,242,255,0.2)] scale-[0.98]' : isLight ? 'border-slate-200 hover:border-slate-300' : 'border-transparent hover:border-white/20'
                                  }`}
                                  style={{ backgroundImage: `url(${bg})` }}
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveFromRotationList(idx);
                                  }}
                                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeModal === 'reset' && (
                <div className="text-center space-y-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                    <AlertCircle size={24} />
                  </div>
                  <div className="space-y-1">
                    <h3 className={`text-sm font-bold uppercase tracking-widest ${isLight ? 'text-slate-900' : 'text-white'}`}>Confirm Reset</h3>
                    <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-white/50'}`}>
                      Are you sure you want to restore default appearance parameters? Custom settings will be cleared.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await resetAppearanceSettings();
                        setActiveModal(null);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-xs font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                    >
                      Confirm Reset
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
