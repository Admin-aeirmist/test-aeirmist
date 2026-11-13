import React from 'react';
import { 
  Check, 
  Repeat2, 
  Users, 
  Settings, 
  HelpCircle, 
  AlertCircle, 
  Moon, 
  LogOut, 
  ChevronRight,
  Globe,
  Layers,
  X
} from 'lucide-react';
import { useAppearance, ACCENT_COLOR_MAP } from '../../context/AppearanceContext';
import { resolveAvatarSrc } from '../../lib/avatar';

export interface ActiveIdentity {
  id: string;
  name: string;
  avatarUrl?: string;
  type: 'user' | 'page' | 'team' | 'community' | 'group';
  handle?: string;
}

interface FacebookProfileSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    id: string;
    name: string;
    avatarUrl?: string;
    handle?: string;
  };
  managedEntities: any[];
  activeIdentity: ActiveIdentity;
  onSwitchIdentity: (identity: ActiveIdentity) => void;
  onOpenSettings?: () => void;
  onLogout?: () => void;
}

export const FacebookProfileSwitcherModal: React.FC<FacebookProfileSwitcherModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  managedEntities,
  activeIdentity,
  onSwitchIdentity,
  onOpenSettings,
  onLogout,
}) => {
  const { settings } = useAppearance();
  const accent = ACCENT_COLOR_MAP[settings.accentColor] || ACCENT_COLOR_MAP.blue;
  const accentHex = typeof accent === 'string' ? accent : '#00f2fe';

  if (!isOpen) return null;

  const isPersonalActive = activeIdentity.type === 'user';

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] animate-fade-in flex justify-end items-start p-3 sm:p-5 pt-14"
      onClick={onClose}
    >
      <div 
        className="w-full sm:w-[380px] max-h-[calc(100vh-4.5rem)] bg-[#1a1e27] border border-white/10 rounded-2xl shadow-2xl overflow-y-auto scroll-container text-neutral-200 select-none animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title and Close button */}
        <div className="p-3 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Repeat2 size={16} style={{ color: accentHex }} />
            <span className="text-xs font-mono uppercase tracking-wider text-white/60">Switch Identity / Profiles</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Active Personal Profile Card */}
        <div className="p-3 pb-1">
          <div 
            onClick={() => {
              onSwitchIdentity({
                id: currentUser.id,
                name: currentUser.name,
                avatarUrl: currentUser.avatarUrl,
                type: 'user',
                handle: currentUser.handle,
              });
              onClose();
            }}
            style={isPersonalActive ? { borderColor: accentHex, boxShadow: `0 0 15px ${accentHex}30` } : undefined}
            className={`p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all ${
              isPersonalActive 
                ? 'border-2 bg-white/5' 
                : 'hover:bg-white/5 border border-transparent'
            }`}
          >
            <div className="relative">
              <img
                src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                alt={currentUser.name}
                className="w-11 h-11 rounded-xl object-cover border border-white/10 bg-white/5"
              />
              {isPersonalActive && (
                <div 
                  style={{ backgroundColor: accentHex }}
                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-[#1a1e27] flex items-center justify-center text-neutral-950 text-[10px] font-bold"
                >
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-white text-sm truncate">{currentUser.name}</h3>
              <p className="text-[11px] text-neutral-400 font-mono truncate">@{currentUser.handle || 'user'} • Personal Profile</p>
            </div>
          </div>
        </div>

        {/* Managed Pages, Groups & Teams Section */}
        <div className="px-3 py-2 space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-wider text-white/40 px-1 pt-1 pb-1 flex items-center justify-between">
            <span>Your Managed Pages, Groups & Teams</span>
            {managedEntities.length > 0 && (
              <span className="text-[9px] text-white/30">({managedEntities.length})</span>
            )}
          </div>

          {managedEntities.length > 0 ? (
            managedEntities.map((ent) => {
              const isEntityActive = activeIdentity.id === ent.id;
              const typeLabel = ent.type === 'team' ? 'Team' : ent.type === 'community' ? 'Community' : 'Group';
              return (
                <div
                  key={ent.id}
                  onClick={() => {
                    onSwitchIdentity({
                      id: ent.id,
                      name: ent.name,
                      avatarUrl: ent.logoUrl || ent.coverUrl,
                      type: ent.type,
                    });
                    onClose();
                  }}
                  style={isEntityActive ? { borderColor: accentHex, backgroundColor: `${accentHex}10` } : undefined}
                  className={`p-2.5 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                    isEntityActive 
                      ? 'border-2' 
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative">
                      <img
                        src={resolveAvatarSrc(ent.logoUrl || ent.coverUrl) || 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=100&q=80'}
                        alt={ent.name}
                        className="w-10 h-10 rounded-xl object-cover border border-white/10 bg-white/5"
                      />
                      <div 
                        style={isEntityActive ? { backgroundColor: accentHex } : undefined}
                        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-[#1a1e27] flex items-center justify-center ${
                          isEntityActive ? 'text-neutral-950 font-bold' : 'bg-neutral-900 text-neutral-300'
                        }`}
                      >
                        {isEntityActive ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : <Repeat2 className="w-2.5 h-2.5" />}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-neutral-100 truncate block">{ent.name}</span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {typeLabel} • {ent.memberCount || 1} members
                      </span>
                    </div>
                  </div>
                  <div className="text-neutral-400 hover:text-white p-1 rounded-full hover:bg-white/10 shrink-0">
                    <Repeat2 className="w-3.5 h-3.5" />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-center my-1">
              <p className="text-[11px] text-white/50 mb-2">You don't manage any Groups or Teams yet.</p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  window.dispatchEvent(new CustomEvent('aeirmist-open-create-entity'));
                }}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold text-black bg-aeirmist-cyan hover:bg-opacity-90 transition-all cursor-pointer"
              >
                + Create New Group or Team
              </button>
            </div>
          )}
        </div>

        <div className="h-px bg-white/10 my-1 mx-3" />

        {/* Quick Menu Navigation Items */}
        <div className="p-2 space-y-0.5">
          <button 
            onClick={() => {
              onClose();
              if (onOpenSettings) onOpenSettings();
            }}
            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 text-neutral-300 hover:text-white transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                <Settings className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold">Settings & Privacy</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white" />
          </button>

          <button 
            onClick={() => {
              onClose();
              window.dispatchEvent(new CustomEvent('aeirmist:open-appearance'));
            }}
            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 text-neutral-300 hover:text-white transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                <Moon className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold">Display & Theme Accent</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white" />
          </button>

          <button 
            onClick={() => {
              onClose();
              if (onLogout) onLogout();
            }}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-red-500/10 text-neutral-300 hover:text-red-400 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <LogOut className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold">Log out</span>
          </button>
        </div>

        {/* Clean Compact Footer */}
        <div className="p-2.5 px-3 bg-black/20 text-[10px] text-neutral-500 border-t border-white/5 flex items-center justify-between font-mono">
          <span>Aeirmist Bonds Ecosystem</span>
          <span>v2.0</span>
        </div>
      </div>
    </div>
  );
};
