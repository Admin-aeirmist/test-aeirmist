import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Link2, Search, Compass, Users, Briefcase, Rocket, Calendar, 
  GraduationCap, DollarSign, ShoppingBag, Sparkles, Filter, 
  ArrowUpRight, ShieldCheck, Star, Layers, Globe, CheckCircle2,
  ChevronRight, ExternalLink, MessageCircle, Heart, FolderKanban
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { getAvatarUrl } from '../../lib/avatar';

interface ExploreSystemProps {
  onUserClick?: (user: any) => void;
  onPostClick?: (postId: string) => void;
  initialStoreId?: string | null;
  initialProductId?: string | null;
  onStoreChange?: (storeId: string | null) => void;
  onProductChange?: (productId: string | null) => void;
}

type EcosystemCategory = 'all' | 'projects' | 'communities' | 'careers' | 'capital' | 'events' | 'knowledge' | 'marketplace';

const CATEGORIES: { id: EcosystemCategory; label: string; icon: any; count: number }[] = [
  { id: 'all', label: 'All Ecosystem', icon: Compass, count: 68 },
  { id: 'projects', label: 'Projects & Workspaces', icon: FolderKanban, count: 18 },
  { id: 'communities', label: 'Communities & Guilds', icon: Users, count: 14 },
  { id: 'careers', label: 'Opportunities & Gigs', icon: Briefcase, count: 12 },
  { id: 'capital', label: 'Investors & Grants', icon: DollarSign, count: 8 },
  { id: 'events', label: 'Events & Hackathons', icon: Calendar, count: 6 },
  { id: 'knowledge', label: 'Research & Learning', icon: GraduationCap, count: 10 },
  { id: 'marketplace', label: 'Digital Marketplace', icon: ShoppingBag, count: 16 }
];

const SEED_PROJECTS = [
  {
    id: 'proj_bond_core',
    title: 'BOND Core Infrastructure',
    tagline: 'Global decentralized identity and real-time collaborative workspace protocol.',
    category: 'projects',
    tags: ['Distributed Systems', 'TypeScript', 'PostgreSQL', 'WebSockets'],
    lead: 'Junaed Islam Jim',
    leadAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
    leadHandle: 'junaed_islam_jim9',
    verified: true,
    membersCount: 28,
    progress: 74,
    status: 'Active Development',
    badgeColor: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10'
  },
  {
    id: 'proj_era_ai',
    title: 'Era AI Model Gateway',
    tagline: 'Multi-provider intelligence router with context boundaries and human approval gates.',
    category: 'projects',
    tags: ['AI/ML', 'Model Router', 'pgvector', 'RAG'],
    lead: 'Era AI Systems',
    leadAvatar: '',
    leadHandle: 'era_official',
    verified: true,
    membersCount: 16,
    progress: 88,
    status: 'Phase 2 Architecture',
    badgeColor: 'border-purple-500/40 text-purple-400 bg-purple-500/10'
  },
  {
    id: 'proj_zeropay',
    title: 'ZeroPay Settlement Mesh',
    tagline: 'Ultra-low-latency microtransaction ledger for regional cross-border digital creator payments.',
    category: 'capital',
    tags: ['FinTech', 'Stripe', 'Ledger', 'bKash'],
    lead: 'Tawsif Rahman',
    leadAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
    leadHandle: 'tawsif20',
    verified: true,
    membersCount: 12,
    progress: 60,
    status: 'Seeking Backers',
    badgeColor: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
  }
];

const SEED_COMMUNITIES = [
  {
    id: 'comm_fullstack_devs',
    title: 'Global Fullstack Guild',
    description: 'Premier network of React 19, TypeScript, Rust, and Node.js engineers building high-scale distributed applications.',
    category: 'communities',
    tags: ['React 19', 'TypeScript', 'Next.js', 'PostgreSQL'],
    members: 2420,
    postsThisWeek: 184,
    isOpen: true,
    bannerGradient: 'from-cyan-500/20 via-blue-600/15 to-transparent'
  },
  {
    id: 'comm_founders_network',
    title: 'BOND Founders Circle',
    description: 'Peer-to-peer closed community for early-stage startup founders, technical creators, and angel operators.',
    category: 'communities',
    tags: ['Ventures', 'Fundraising', 'Product DNA', 'Scale'],
    members: 890,
    postsThisWeek: 92,
    isOpen: false,
    bannerGradient: 'from-amber-500/20 via-orange-600/15 to-transparent'
  },
  {
    id: 'comm_ai_research',
    title: 'Autonomous Agents Lab',
    description: 'Open discussion forum on prompt-chaining, tool invocation protocols, evaluation datasets, and safety barriers.',
    category: 'communities',
    tags: ['LLM', 'Autonomous Agents', 'Safety', 'Eval'],
    members: 1650,
    postsThisWeek: 140,
    isOpen: true,
    bannerGradient: 'from-purple-500/20 via-pink-600/15 to-transparent'
  }
];

const SEED_OPPORTUNITIES = [
  {
    id: 'opp_staff_infra',
    title: 'Lead Distributed Systems Engineer',
    org: 'BOND Engineering Hub',
    category: 'careers',
    type: 'Full-time · Remote',
    compensation: '$120k – $160k · Equity',
    tags: ['PostgreSQL', 'Redis', 'Docker', 'WebSockets', 'Go/Node'],
    location: 'Global (Remote)',
    postedDaysAgo: 2
  },
  {
    id: 'opp_ui_architect',
    title: 'Senior Frontend Design Technologist',
    org: 'Aeirmist Studios',
    category: 'careers',
    type: 'Contract · 6 Mos',
    compensation: '$60 – $85 / hr',
    tags: ['React 19', 'Tailwind CSS v4', 'Framer Motion', 'WebSockets'],
    location: 'Remote / Hybrid',
    postedDaysAgo: 4
  },
  {
    id: 'opp_security_audit',
    title: 'Security & Penetration Audit Bounty',
    org: 'Platform Governance Taskforce',
    category: 'careers',
    type: 'Bounty / Award',
    compensation: 'Up to $15,000 / Critical CVE',
    tags: ['OAuth2', 'JWT', 'Rate Limiting', 'Vault AES'],
    location: 'Global',
    postedDaysAgo: 1
  }
];

const SEED_CAPITAL = [
  {
    id: 'cap_ecosystem_fund',
    title: 'BOND Genesis Developer Grant',
    sponsor: 'BOND Foundation & Ecosystem Partners',
    category: 'capital',
    grantSize: '$10,000 – $50,000 Equity-Free',
    focus: 'Open-source SDKs, developer tooling, decentralized collaboration, privacy apps',
    deadline: 'Rolling Submissions',
    stage: 'Open Call'
  },
  {
    id: 'cap_seed_syndicate',
    title: 'Pan-Asian Creator Tech Syndicate',
    sponsor: 'Venture Capital Alliance',
    category: 'capital',
    grantSize: '$100k – $500k Pre-Seed / Seed',
    focus: 'Consumer digital networks, creator commerce, regional payment infrastructure',
    deadline: 'Dec 15, 2026',
    stage: 'Active Review'
  }
];

const SEED_EVENTS = [
  {
    id: 'evt_bond_hackathon',
    title: 'BOND Global Hackathon 2026',
    organizer: 'BOND Core Team',
    category: 'events',
    date: 'Dec 05 – Dec 12, 2026',
    format: 'Virtual (Global)',
    prizePool: '$75,000 in Bounties',
    participants: 1240,
    tags: ['Hackathon', 'Ecosystem', 'AI Tools', 'Spaces']
  },
  {
    id: 'evt_infra_summit',
    title: 'Distributed Real-Time Summit',
    organizer: 'Global Cloud Architecture Group',
    category: 'events',
    date: 'Nov 24, 2026',
    format: 'Interactive Live Stream',
    prizePool: 'Free Registration',
    participants: 680,
    tags: ['WebSockets', 'Cloudflare Edge', 'PostgreSQL 16']
  }
];

export const ExploreSystem: React.FC<ExploreSystemProps> = ({
  onUserClick,
  onPostClick,
  onStoreChange,
  onProductChange
}) => {
  const { profile, addToast } = useAeirmist();
  const [selectedCategory, setSelectedCategory] = useState<EcosystemCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'featured' | 'verified' | 'open'>('all');

  const filteredProjects = useMemo(() => {
    return SEED_PROJECTS.filter(p => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.tagline.toLowerCase().includes(q) || p.tags.some(t => t.toLowerCase().includes(q));
    });
  }, [selectedCategory, searchQuery]);

  const filteredCommunities = useMemo(() => {
    return SEED_COMMUNITIES.filter(c => {
      if (selectedCategory !== 'all' && c.category !== selectedCategory) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.tags.some(t => t.toLowerCase().includes(q));
    });
  }, [selectedCategory, searchQuery]);

  const filteredOpportunities = useMemo(() => {
    return SEED_OPPORTUNITIES.filter(o => {
      if (selectedCategory !== 'all' && o.category !== selectedCategory) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return o.title.toLowerCase().includes(q) || o.org.toLowerCase().includes(q) || o.tags.some(t => t.toLowerCase().includes(q));
    });
  }, [selectedCategory, searchQuery]);

  const filteredCapital = useMemo(() => {
    return SEED_CAPITAL.filter(k => {
      if (selectedCategory !== 'all' && k.category !== selectedCategory) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return k.title.toLowerCase().includes(q) || k.sponsor.toLowerCase().includes(q) || k.focus.toLowerCase().includes(q);
    });
  }, [selectedCategory, searchQuery]);

  const filteredEvents = useMemo(() => {
    return SEED_EVENTS.filter(e => {
      if (selectedCategory !== 'all' && e.category !== selectedCategory) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return e.title.toLowerCase().includes(q) || e.organizer.toLowerCase().includes(q);
    });
  }, [selectedCategory, searchQuery]);

  const handleActionToast = (title: string, message: string) => {
    addToast?.({
      title,
      message,
      type: 'info'
    });
  };

  return (
    <div className="w-full min-h-screen bg-[#06080c] text-white flex flex-col pb-20 select-none">
      {/* Ambient Top Glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed top-1/3 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Hero Banner Header */}
      <header className="relative w-full border-b border-white/5 bg-gradient-to-b from-[#0c101a]/80 via-[#080b12]/60 to-transparent backdrop-blur-xl px-4 md:px-8 pt-6 pb-6 z-20">
        <div className="max-w-7xl mx-auto flex flex-col gap-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-blue-500/15 to-purple-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_25px_rgba(0,255,255,0.15)] shrink-0">
                <Link2 size={24} strokeWidth={2.4} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-black tracking-tight text-white uppercase font-sans">
                    Bonds Ecosystem
                  </h1>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-[9px] font-black uppercase tracking-widest text-cyan-400">
                    Live Hub
                  </span>
                </div>
                <p className="text-xs text-white/50 tracking-wide mt-0.5">
                  A connected digital ecosystem for builders, teams, talent, capital & knowledge.
                </p>
              </div>
            </div>

            {/* AI Assistant Quick Pill */}
            <div className="flex items-center gap-2 self-start md:self-auto bg-white/[0.03] border border-white/10 rounded-2xl px-3.5 py-2 backdrop-blur-md">
              <Sparkles size={15} className="text-cyan-400 animate-pulse" />
              <span className="text-xs font-semibold text-white/80">Era AI Discovery:</span>
              <span className="text-xs text-cyan-400/90 font-medium cursor-pointer hover:underline" onClick={() => handleActionToast("Era AI Discovery", "Era AI is analyzing matching ecosystem connections for your profile.")}>
                Recommend Matches
              </span>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={16} />
              <input
                type="text"
                placeholder="Search projects, communities, roles, investors, hackathons..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-2xl py-2.5 pl-10 pr-4 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick Pill Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto shrink-0">
              {(['all', 'featured', 'verified', 'open'] as const).map(filterKey => (
                <button
                  key={filterKey}
                  onClick={() => setQuickFilter(filterKey)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all capitalize ${
                    quickFilter === filterKey
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'bg-white/[0.03] text-white/60 hover:text-white border border-white/5'
                  }`}
                >
                  {filterKey}
                </button>
              ))}
            </div>
          </div>

          {/* Horizontal Sector Category Navigation */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 pb-1">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 text-white border border-cyan-400/50 shadow-md shadow-cyan-500/10'
                      : 'bg-white/[0.02] text-white/60 hover:text-white hover:bg-white/[0.05] border border-white/5'
                  }`}
                >
                  <Icon size={14} className={isSelected ? 'text-cyan-400' : 'text-white/40'} />
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-cyan-400/20 text-cyan-300' : 'bg-white/5 text-white/40'}`}>
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Sections */}
      <main className="max-w-7xl mx-auto w-full px-4 md:px-8 pt-8 flex flex-col gap-10 relative z-10">
        
        {/* SECTION 1: Active Projects & Initiatives */}
        {(selectedCategory === 'all' || selectedCategory === 'projects') && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FolderKanban size={18} className="text-cyan-400" />
                <h2 className="text-base font-bold text-white tracking-tight">Active Projects & Initiatives</h2>
                <span className="text-xs text-white/40">({filteredProjects.length})</span>
              </div>
              <button 
                onClick={() => handleActionToast("New Project", "Project Workspace creation is being provisioned.")}
                className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
              >
                + Propose Project
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filteredProjects.map(proj => (
                <motion.div
                  key={proj.id}
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col justify-between p-5 rounded-3xl bg-white/[0.025] hover:bg-white/[0.045] border border-white/5 hover:border-cyan-500/30 transition-all backdrop-blur-xl group shadow-lg"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${proj.badgeColor}`}>
                        {proj.status}
                      </span>
                      <span className="text-[11px] text-white/40 font-mono">
                        {proj.membersCount} Collaborators
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-1 mb-1">
                      {proj.title}
                    </h3>
                    <p className="text-xs text-white/60 leading-relaxed line-clamp-2 mb-4">
                      {proj.tagline}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {proj.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 rounded-lg bg-white/[0.04] text-[10px] text-white/60 border border-white/5">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {proj.leadAvatar ? (
                        <img src={proj.leadAvatar} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold">
                          AI
                        </div>
                      )}
                      <span className="text-[11px] text-white/70 font-medium truncate">@{proj.leadHandle}</span>
                      {proj.verified && <ShieldCheck size={12} className="text-cyan-400 shrink-0" />}
                    </div>

                    <button
                      onClick={() => handleActionToast(proj.title, `Opening project workspace for ${proj.title}.`)}
                      className="p-1.5 rounded-xl bg-white/5 group-hover:bg-cyan-500/20 text-white/50 group-hover:text-cyan-300 transition-all"
                    >
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION 2: Communities & Guilds */}
        {(selectedCategory === 'all' || selectedCategory === 'communities') && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Users size={18} className="text-purple-400" />
                <h2 className="text-base font-bold text-white tracking-tight">Communities & Guilds</h2>
                <span className="text-xs text-white/40">({filteredCommunities.length})</span>
              </div>
              <button 
                onClick={() => handleActionToast("Create Community", "Open discussion space creation modal.")}
                className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
              >
                + Create Space
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filteredCommunities.map(comm => (
                <div
                  key={comm.id}
                  className="flex flex-col justify-between p-5 rounded-3xl bg-white/[0.025] hover:bg-white/[0.045] border border-white/5 hover:border-purple-500/30 transition-all backdrop-blur-xl relative overflow-hidden group shadow-lg"
                >
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${comm.bannerGradient} rounded-full blur-2xl pointer-events-none`} />

                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                        comm.isOpen ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                      }`}>
                        {comm.isOpen ? 'Public Guild' : 'Private Circle'}
                      </span>
                      <span className="text-[11px] text-white/40">
                        {comm.members.toLocaleString()} Members
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors mb-1.5">
                      {comm.title}
                    </h3>
                    <p className="text-xs text-white/60 leading-relaxed line-clamp-3 mb-4">
                      {comm.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {comm.tags.map(t => (
                        <span key={t} className="px-2 py-0.5 rounded-lg bg-white/[0.04] text-[10px] text-white/60 border border-white/5">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/5 flex items-center justify-between relative z-10">
                    <span className="text-[11px] text-white/40 font-mono">
                      {comm.postsThisWeek} posts this week
                    </span>
                    <button
                      onClick={() => handleActionToast(comm.title, `You joined the ${comm.title} space.`)}
                      className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-bold transition-all border border-purple-500/30"
                    >
                      Join Space
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION 3: Career Opportunities & Bounties */}
        {(selectedCategory === 'all' || selectedCategory === 'careers') && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Briefcase size={18} className="text-emerald-400" />
                <h2 className="text-base font-bold text-white tracking-tight">Opportunities & Bounties</h2>
                <span className="text-xs text-white/40">({filteredOpportunities.length})</span>
              </div>
              <button 
                onClick={() => handleActionToast("Post Role", "Talent post creation is opening.")}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
              >
                + Post Opportunity
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filteredOpportunities.map(opp => (
                <div
                  key={opp.id}
                  className="flex flex-col justify-between p-5 rounded-3xl bg-white/[0.025] hover:bg-white/[0.045] border border-white/5 hover:border-emerald-500/30 transition-all backdrop-blur-xl group shadow-lg"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-emerald-400">
                        {opp.type}
                      </span>
                      <span className="text-[10px] text-white/40">
                        {opp.postedDaysAgo}d ago
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors mb-1 line-clamp-1">
                      {opp.title}
                    </h3>
                    <p className="text-xs text-white/70 font-medium mb-3">
                      {opp.org} · <span className="text-white/40">{opp.location}</span>
                    </p>

                    <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 mb-3">
                      <span className="text-xs font-bold text-white font-mono">{opp.compensation}</span>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {opp.tags.map(t => (
                        <span key={t} className="px-2 py-0.5 rounded-lg bg-white/[0.04] text-[10px] text-white/60">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleActionToast(opp.title, `Application submitted for ${opp.title}.`)}
                    className="w-full py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all"
                  >
                    Apply Now
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION 4: Capital, Grants & Sponsors */}
        {(selectedCategory === 'all' || selectedCategory === 'capital') && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <DollarSign size={18} className="text-amber-400" />
                <h2 className="text-base font-bold text-white tracking-tight">Capital, Grants & Sponsors</h2>
                <span className="text-xs text-white/40">({filteredCapital.length})</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCapital.map(cap => (
                <div
                  key={cap.id}
                  className="flex flex-col justify-between p-5 rounded-3xl bg-white/[0.025] hover:bg-white/[0.045] border border-white/5 hover:border-amber-500/30 transition-all backdrop-blur-xl group shadow-lg"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-amber-500/30 text-amber-400 bg-amber-500/10">
                        {cap.stage}
                      </span>
                      <span className="text-[11px] text-white/40">
                        Deadline: {cap.deadline}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors mb-1">
                      {cap.title}
                    </h3>
                    <p className="text-xs text-white/70 font-medium mb-3">
                      Sponsor: {cap.sponsor}
                    </p>

                    <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/20 mb-3">
                      <p className="text-[11px] text-amber-300 font-bold font-mono">{cap.grantSize}</p>
                      <p className="text-[11px] text-white/60 mt-1">{cap.focus}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => handleActionToast(cap.title, `Opening proposal portal for ${cap.title}.`)}
                      className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all"
                    >
                      Submit Pitch / Proposal
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION 5: Events & Hackathons */}
        {(selectedCategory === 'all' || selectedCategory === 'events') && (
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Calendar size={18} className="text-blue-400" />
                <h2 className="text-base font-bold text-white tracking-tight">Events & Hackathons</h2>
                <span className="text-xs text-white/40">({filteredEvents.length})</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredEvents.map(evt => (
                <div
                  key={evt.id}
                  className="flex flex-col justify-between p-5 rounded-3xl bg-white/[0.025] hover:bg-white/[0.045] border border-white/5 hover:border-blue-500/30 transition-all backdrop-blur-xl group shadow-lg"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-blue-400">
                        {evt.format}
                      </span>
                      <span className="text-[11px] text-white/40">
                        {evt.participants} Registered
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors mb-1">
                      {evt.title}
                    </h3>
                    <p className="text-xs text-white/70 font-medium mb-3">
                      By {evt.organizer} · <span className="text-white/40">{evt.date}</span>
                    </p>

                    <div className="p-3 rounded-2xl bg-blue-500/5 border border-blue-500/20 mb-3">
                      <span className="text-xs font-bold text-blue-300 font-mono">Prize / Benefit: {evt.prizePool}</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {evt.tags.map(t => (
                        <span key={t} className="px-2 py-0.5 rounded-lg bg-white/[0.04] text-[10px] text-white/60">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => handleActionToast(evt.title, `You are registered for ${evt.title}. Ticket added to your Vault.`)}
                      className="px-4 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 text-xs font-bold transition-all"
                    >
                      Register Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </main>
    </div>
  );
};

export default ExploreSystem;
