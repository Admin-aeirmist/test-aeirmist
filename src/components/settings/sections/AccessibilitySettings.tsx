import React from 'react';
import { motion } from 'motion/react';
import { 
  Eye, 
  Type, 
  MousePointer2, 
  Layers, 
  Wind,
  Maximize2,
  Minimize2,
  Settings2,
  Scan,
  Monitor
} from 'lucide-react';
import { useAeirmist } from '../../../context/AeirmistContext';
import { useAppearance } from '../../../context/AppearanceContext';

const AccessibilitySettings = () => {
  const { addToast } = useAeirmist();
  const { 
    settings,
    updateAppearanceSettings
  } = useAppearance();

  const {
    reduceMotion,
    highContrast,
    fontSize,
    interfaceScale
  } = settings;

  const handleFontSizeChange = (direction: 'up' | 'down') => {
    const sizes: ('small' | 'medium' | 'large' | 'xlarge')[] = ['small', 'medium', 'large', 'xlarge'];
    const currentIndex = sizes.indexOf(fontSize);
    let newIndex = currentIndex;
    
    if (direction === 'up' && currentIndex < sizes.length - 1) newIndex++;
    if (direction === 'down' && currentIndex > 0) newIndex--;
    
    if (newIndex !== currentIndex) {
      updateAppearanceSettings({ fontSize: sizes[newIndex] });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-12"
    >
      <div className="space-y-1">
        <h2 className="text-3xl font-display font-bold text-white">Visual Synthesis</h2>
        <p className="text-xs text-white/45 uppercase tracking-widest font-medium">Calibrate the interface to your sensory requirements</p>
      </div>

      {/* Visual Assistance */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-aeirmist-cyan/10 flex items-center justify-center text-aeirmist-cyan">
            <Eye size={18} />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">Visual Calibration</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AccessibilityToggle 
            icon={<Wind size={18} />}
            title="Reduced Motion"
            desc="Minimize animations and visual transients"
            enabled={reduceMotion}
            onChange={(val: boolean) => updateAppearanceSettings({ reduceMotion: val })}
          />
          <AccessibilityToggle 
            icon={<Layers size={18} />}
            title="High Contrast"
            desc="Increase legibility and structural definition"
            enabled={highContrast}
            onChange={(val: boolean) => updateAppearanceSettings({ highContrast: val })}
          />
        </div>
      </section>

      {/* Typography & Scaling */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-aeirmist-magenta/10 flex items-center justify-center text-aeirmist-magenta">
            <Type size={18} />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">Information Density</h3>
        </div>

        <div className="space-y-8">
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-white/90">Typography Scale</h4>
                <p className="text-[10px] text-white/40 mt-1">Adjust global text size for optimal readout</p>
              </div>
              <span className="text-xs font-mono text-aeirmist-magenta capitalize">{fontSize}</span>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => handleFontSizeChange('down')}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all disabled:opacity-20"
                disabled={fontSize === 'small'}
              >
                <Minimize2 size={16} />
              </button>
              <div className="flex-1 h-1 bg-white/5 rounded-full relative">
                <div 
                  className="absolute inset-y-0 left-0 bg-aeirmist-magenta rounded-full shadow-[0_0_8px_rgba(255,0,255,0.4)]"
                  style={{ width: `${(fontSize === 'small' ? 0 : fontSize === 'medium' ? 33 : fontSize === 'large' ? 66 : 100)}%` }}
                />
              </div>
              <button 
                onClick={() => handleFontSizeChange('up')}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all disabled:opacity-20"
                disabled={fontSize === 'xlarge'}
              >
                <Maximize2 size={16} />
              </button>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-white/90">UI Scaling</h4>
                <p className="text-[10px] text-white/40 mt-1">Magnify interface elements and controls</p>
              </div>
              <span className="text-xs font-mono text-aeirmist-cyan">{interfaceScale}%</span>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => updateAppearanceSettings({ interfaceScale: Math.max(80, interfaceScale - 5) })}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
              >
                <Scan size={16} />
              </button>
              <div className="flex-1 h-1 bg-white/5 rounded-full relative">
                <div 
                  className="absolute inset-y-0 left-0 bg-aeirmist-cyan rounded-full shadow-[0_0_8px_rgba(0,242,255,0.4)]"
                  style={{ width: `${((interfaceScale - 80) / 40) * 100}%` }}
                />
              </div>
              <button 
                onClick={() => updateAppearanceSettings({ interfaceScale: Math.min(120, interfaceScale + 5) })}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
              >
                <Monitor size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Advanced Interaction */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-aeirmist-lime/10 flex items-center justify-center text-aeirmist-lime">
            <MousePointer2 size={18} />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">Haptic & Input</h3>
        </div>

        <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/60">
                <Settings2 size={18} />
              </div>
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-white">Large Cursor Support</h4>
                <p className="text-[10px] text-white/30">Enhance pointer visibility for precise interaction</p>
              </div>
            </div>
            <button className="w-12 h-6 bg-white/5 rounded-full relative transition-colors border border-white/10">
              <div className="absolute top-1 left-1 w-4 h-4 bg-white/20 rounded-full" />
            </button>
          </div>
        </div>
      </section>
    </motion.div>
  );
};

const AccessibilityToggle = ({ icon, title, desc, enabled, onChange }: any) => (
  <button 
    onClick={() => onChange(!enabled)}
    className={`p-5 rounded-3xl border transition-all text-left flex items-start gap-4 group ${
      enabled 
        ? 'bg-white/[0.05] border-white/20 shadow-[0_8px_32px_rgba(255,255,255,0.05)]' 
        : 'bg-white/[0.01] border-white/5 hover:border-white/10'
    }`}
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
      enabled ? 'bg-white/10 text-white' : 'bg-white/5 text-white/40 group-hover:text-white/60'
    }`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between">
        <h4 className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${
          enabled ? 'text-white' : 'text-white/60 group-hover:text-white/80'
        }`}>
          {title}
        </h4>
        <div className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-aeirmist-cyan animate-pulse' : 'bg-white/10'}`} />
      </div>
      <p className="text-[10px] text-white/30 mt-1 leading-relaxed">{desc}</p>
    </div>
  </button>
);

export default AccessibilitySettings;
