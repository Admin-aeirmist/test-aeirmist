import React, { useState } from 'react';
import { 
  Settings, 
  Search, 
  Newspaper, 
  Compass, 
  Users, 
  Plus, 
  Briefcase, 
  Globe, 
  Clock, 
  Sparkles,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { useAppearance, ACCENT_COLOR_MAP } from '../../context/AppearanceContext';

interface FacebookBondsSidebarProps {
  entities: any[];
  selectedEntity: any | null;
  onSelectEntity: (entity: any) => void;
  onCreateClick: (type: 'group' | 'community' | 'team') => void;
  activeType?: 'group' | 'community' | 'team';
  sidebarMode?: 'feed' | 'discover' | 'my_bonds';
  onSelectMode?: (mode: 'feed' | 'discover' | 'my_bonds') => void;
  onOpenSettings?: () => void;
  className?: string;
}

export const FacebookBondsSidebar: React.FC<FacebookBondsSidebarProps> = ({
  entities,
  selectedEntity,
  onSelectEntity,
  onCreateClick,
  activeType = 'group',
  sidebarMode = 'discover',
  onSelectMode,
  onOpenSettings,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { settings: appearanceSettings } = useAppearance();
  const accentHex = ACCENT_COLOR_MAP[appearanceSettings?.accentColor] || '#00f2ff';

  // Title & dynamic labels based on active type
  const typeLabels = {
    group: { title: 'Groups', single: 'group', icon: Users },
    community: { title: 'Communities', single: 'community', icon: Globe },
    team: { title: 'Teams', single: 'team', icon: Briefcase },
  };

  const currentMeta = typeLabels[activeType] || typeLabels.group;

  // Managed entities (user is owner/admin or has created them)
  const managedEntities = entities.filter(e => 
    e.type === activeType && (e.myRole === 'owner' || e.myRole === 'admin' || e.isCreator)
  );

  // Joined entities (user is an active member but not primary owner)
  const joinedEntities = entities.filter(e => 
    e.type === activeType && e.isMember && e.myRole !== 'owner'
  );

  // Fallback realistic display items
  const displayJoined = joinedEntities.length > 0 
    ? joinedEntities 
    : entities.filter(e => e.type === activeType && e.id !== managedEntities[0]?.id).slice(0, 4);

  // Filter based on search
  const filterBySearch = (list: any[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(item => 
      item.name?.toLowerCase().includes(q) || 
      item.category?.toLowerCase().includes(q)
    );
  };

  const filteredManaged = filterBySearch(managedEntities.length > 0 ? managedEntities : entities.filter(e => e.type === activeType).slice(0, 1));
  const filteredJoined = filterBySearch(displayJoined);

  return (
    <aside 
      className={`w-full sm:w-[320px] lg:w-[360px] h-full flex flex-col bg-[#11141c]/95 backdrop-blur-xl border-l border-white/10 text-neutral-200 select-none overflow-hidden ${className}`}
    >
      {/* Top Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          {currentMeta.title}
        </h2>
        <button
          onClick={onOpenSettings}
          className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-neutral-300 hover:text-white transition-colors cursor-pointer"
          title={`${currentMeta.title} Settings`}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Search Input */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${currentMeta.title.toLowerCase()}`}
            className="w-full bg-[#1e2330] hover:bg-[#252b3b] focus:bg-[#252b3b] text-sm text-neutral-100 placeholder:text-neutral-400 pl-9 pr-4 py-2.5 rounded-xl border border-white/5 outline-none transition-all"
            style={{ borderColor: searchQuery ? `${accentHex}60` : undefined }}
          />
        </div>
      </div>

      {/* Scrollable Navigation Body */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1 pb-10 scrollbar-thin scrollbar-thumb-white/10">
        {/* Navigation Quick Links */}
        <div className="space-y-0.5">
          <button
            onClick={() => onSelectMode && onSelectMode('feed')}
            style={
              sidebarMode === 'feed'
                ? {
                    backgroundColor: `${accentHex}20`,
                    borderColor: `${accentHex}45`,
                  }
                : undefined
            }
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer group border ${
              sidebarMode === 'feed' ? 'font-bold' : 'border-transparent hover:bg-white/5'
            }`}
          >
            <div 
              style={
                sidebarMode === 'feed'
                  ? { backgroundColor: accentHex, color: '#000000' }
                  : { backgroundColor: `${accentHex}20`, borderColor: `${accentHex}35`, color: accentHex }
              }
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform border"
            >
              <Newspaper className="w-4 h-4" />
            </div>
            <span 
              style={sidebarMode === 'feed' ? { color: accentHex } : undefined}
              className="text-sm font-semibold text-neutral-100"
            >
              Your feed
            </span>
          </button>

          <button
            onClick={() => onSelectMode && onSelectMode('discover')}
            style={
              sidebarMode === 'discover'
                ? {
                    backgroundColor: `${accentHex}20`,
                    borderColor: `${accentHex}45`,
                  }
                : undefined
            }
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer group border ${
              sidebarMode === 'discover' ? 'font-bold' : 'border-transparent hover:bg-white/5'
            }`}
          >
            <div 
              style={
                sidebarMode === 'discover'
                  ? { backgroundColor: accentHex, color: '#000000' }
                  : { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#d4d4d4' }
              }
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform border"
            >
              <Compass className="w-4 h-4" />
            </div>
            <span 
              style={sidebarMode === 'discover' ? { color: accentHex } : undefined}
              className="text-sm font-semibold text-neutral-100"
            >
              Discover
            </span>
          </button>

          <button
            onClick={() => onSelectMode && onSelectMode('my_bonds')}
            style={
              sidebarMode === 'my_bonds'
                ? {
                    backgroundColor: `${accentHex}20`,
                    borderColor: `${accentHex}45`,
                  }
                : undefined
            }
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer group border ${
              sidebarMode === 'my_bonds' ? 'font-bold' : 'border-transparent hover:bg-white/5'
            }`}
          >
            <div 
              style={
                sidebarMode === 'my_bonds'
                  ? { backgroundColor: accentHex, color: '#000000' }
                  : { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: '#d4d4d4' }
              }
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform border"
            >
              <Users className="w-4 h-4" />
            </div>
            <span 
              style={sidebarMode === 'my_bonds' ? { color: accentHex } : undefined}
              className="text-sm font-semibold text-neutral-100"
            >
              Your {currentMeta.title.toLowerCase()}
            </span>
          </button>
        </div>

        {/* Primary Action Button */}
        <div className="pt-2 pb-3 px-1">
          <button
            onClick={() => onCreateClick(activeType)}
            style={{
              backgroundColor: `${accentHex}18`,
              borderColor: `${accentHex}40`,
              color: accentHex,
            }}
            className="w-full py-2.5 px-4 rounded-xl border font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.99] hover:brightness-110"
          >
            <Plus className="w-4 h-4" />
            <span>Create new {currentMeta.single}</span>
          </button>
        </div>

        <div className="h-px bg-white/10 my-2 mx-1" />

        {/* Groups you manage */}
        <div className="pt-2">
          <div className="px-3 pb-2 flex items-center justify-between text-xs font-bold text-neutral-400 tracking-wider">
            <span>{currentMeta.title} you manage</span>
          </div>

          <div className="space-y-0.5">
            {filteredManaged.length > 0 ? (
              filteredManaged.map((entity) => {
              const isSelected = selectedEntity?.id === entity.id;
              return (
                <div
                  key={entity.id}
                  onClick={() => onSelectEntity(entity)}
                  style={
                    isSelected
                      ? {
                          backgroundColor: `${accentHex}20`,
                          borderColor: `${accentHex}45`,
                        }
                      : undefined
                  }
                  className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-all cursor-pointer group border ${
                    isSelected ? 'font-bold' : 'hover:bg-white/5 border-transparent'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={entity.logoUrl || entity.coverUrl || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=100&q=80'}
                      alt={entity.name}
                      className="w-12 h-12 rounded-xl object-cover border border-white/10"
                    />
                    <div 
                      style={{ backgroundColor: accentHex }}
                      className="absolute -bottom-1 -right-1 w-4 h-4 rounded-md border border-neutral-900 flex items-center justify-center text-[9px] text-neutral-950 font-bold" 
                      title="Admin"
                    >
                      ★
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 
                      style={isSelected ? { color: accentHex } : undefined}
                      className="text-sm font-bold text-white truncate transition-colors"
                    >
                      {entity.name}
                    </h4>
                    <p className="text-xs text-neutral-400 truncate flex items-center gap-1 mt-0.5">
                      <span>Active</span>
                    </p>
                  </div>
                </div>
              );
            })
            ) : (
              <div className="p-3 text-center rounded-xl bg-white/[0.02] border border-white/5 my-1">
                <p className="text-[11px] text-white/40">No managed {currentMeta.title.toLowerCase()} yet.</p>
              </div>
            )}
          </div>
        </div>

        <div className="h-px bg-white/10 my-3 mx-1" />

        {/* Groups you've joined */}
        <div className="pt-1">
          <div className="px-3 pb-2 flex items-center justify-between text-xs font-bold text-neutral-400 tracking-wider">
            <span>{currentMeta.title} you've joined</span>
            <button 
              style={{ color: accentHex }}
              className="font-semibold cursor-pointer hover:underline"
            >
              See all
            </button>
          </div>

          <div className="space-y-0.5">
            {filteredJoined.length > 0 ? (
              filteredJoined.map((entity, idx) => {
              const isSelected = selectedEntity?.id === entity.id;
              const timeSamples = ['Active recently', 'Active today', 'Active this week'];
              const activeText = timeSamples[idx % timeSamples.length];

              return (
                <div
                  key={entity.id}
                  onClick={() => onSelectEntity(entity)}
                  style={
                    isSelected
                      ? {
                          backgroundColor: `${accentHex}20`,
                          borderColor: `${accentHex}45`,
                        }
                      : undefined
                  }
                  className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-all cursor-pointer group border ${
                    isSelected ? 'font-bold' : 'hover:bg-white/5 border-transparent'
                  }`}
                >
                  <img
                    src={entity.logoUrl || entity.coverUrl || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=100&q=80'}
                    alt={entity.name}
                    className="w-12 h-12 rounded-xl object-cover border border-white/10 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 
                      style={isSelected ? { color: accentHex } : undefined}
                      className="text-sm font-bold text-neutral-200 truncate transition-colors flex items-center gap-1"
                    >
                      <span>{entity.name}</span>
                    </h4>
                    <p className="text-xs text-neutral-400 truncate mt-0.5">
                      {activeText}
                    </p>
                  </div>
                </div>
              );
            })
            ) : (
              <div className="p-3 text-center rounded-xl bg-white/[0.02] border border-white/5 my-1">
                <p className="text-[11px] text-white/40">No joined {currentMeta.title.toLowerCase()} yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
