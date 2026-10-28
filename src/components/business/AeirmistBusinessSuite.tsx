import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Inbox, 
  Calendar as CalendarIcon, 
  BarChart3, 
  Sliders, 
  Bot, 
  Plus, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  RefreshCw, 
  ExternalLink, 
  ShieldCheck, 
  FileText, 
  Send, 
  Trash2, 
  Edit3, 
  Users, 
  TrendingUp, 
  ThumbsUp, 
  Eye, 
  Share2, 
  Globe, 
  Layers, 
  X, 
  Zap, 
  ToggleLeft, 
  ToggleRight, 
  ArrowUpRight,
  Briefcase,
  HelpCircle,
  Copy,
  Check
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { resolveApiBase, getAuthToken } from '../../services/api/client';

type SuiteTab = 'overview' | 'inbox' | 'planner' | 'content' | 'automation' | 'insights' | 'settings';

interface AutomationRule {
  id: string;
  name: string;
  keyword: string;
  replyTemplate: string;
  enabled: boolean;
  triggerCount: number;
}

interface ScheduledPost {
  id: string;
  content: string;
  date: string;
  time: string;
  type: 'post' | 'reel' | 'story';
  status: 'scheduled' | 'published' | 'draft';
}

interface InboxItem {
  id: string;
  senderName: string;
  senderHandle: string;
  avatar: string;
  type: 'dm' | 'comment';
  sourcePostTitle?: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
  handledByEra: boolean;
}

export const AeirmistBusinessSuite: React.FC<{ isStandalone?: boolean }> = ({ isStandalone = true }) => {
  const { user, profile, addToast } = useAeirmist();

  // Navigation & Active View
  const [activeTab, setActiveTab] = useState<SuiteTab>('overview');
  const [selectedAsset, setSelectedAsset] = useState({
    id: 'page_aeirmist_brand',
    name: profile?.displayName ? `${profile.displayName}'s Brand Hub` : 'Aeirmist Official',
    handle: profile?.username ? `@${profile.username}_biz` : '@aeirmist_hq',
    followers: 18450,
    category: 'Media & Tech Creator'
  });

  // Assets dropdown
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);

  // Era AI Local Engine Telemetry
  const [eraStatus, setEraStatus] = useState<{ online: boolean; port: number; latencyMs?: number }>({
    online: true,
    port: 5051,
    latencyMs: 34
  });

  // --- Unified Inbox State ---
  const [inboxFilter, setInboxFilter] = useState<'all' | 'dms' | 'comments' | 'unread'>('all');
  const [selectedInboxItem, setSelectedInboxItem] = useState<InboxItem | null>(null);
  const [inboxReplyText, setInboxReplyText] = useState('');
  const [isGeneratingAiReply, setIsGeneratingAiReply] = useState(false);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([
    {
      id: 'msg_1',
      senderName: 'Samiul Haque',
      senderHandle: '@samiul_dev',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      type: 'dm',
      lastMessage: 'Hi! Can you share pricing details for your enterprise partner tier?',
      timestamp: '10m ago',
      unread: true,
      handledByEra: false
    },
    {
      id: 'cmt_2',
      senderName: 'Nusrat Jahan',
      senderHandle: '@nusrat_creates',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
      type: 'comment',
      sourcePostTitle: 'Next-Gen Reels Streaming Update',
      lastMessage: 'This update is incredible! Is there an API for automated video scheduling?',
      timestamp: '35m ago',
      unread: true,
      handledByEra: true
    },
    {
      id: 'msg_3',
      senderName: 'Farhan Rahman',
      senderHandle: '@farhan_ui',
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100',
      type: 'dm',
      lastMessage: 'Order confirmed for the VIP badge! Where do I get the invoice?',
      timestamp: '2h ago',
      unread: false,
      handledByEra: true
    }
  ]);

  // --- Automation Rules State ---
  const [instantGreetingEnabled, setInstantGreetingEnabled] = useState(true);
  const [awayMessageEnabled, setAwayMessageEnabled] = useState(true);
  const [commentToDmEnabled, setCommentToDmEnabled] = useState(true);
  const [greetingText, setGreetingText] = useState(
    'Hello! Thanks for reaching out to our official page. Era AI and our team are here to help you.'
  );
  const [awayText, setAwayText] = useState(
    'We are currently away from the desk, but Era AI has saved your note and will notify our executive.'
  );

  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([
    {
      id: 'rule_1',
      name: 'Pricing & Tiers FAQ',
      keyword: 'price',
      replyTemplate: 'Our creator membership starts free, and the Pro Partner tier is $19/mo. Would you like a brochure?',
      enabled: true,
      triggerCount: 142
    },
    {
      id: 'rule_2',
      name: 'Order & Invoice',
      keyword: 'order',
      replyTemplate: 'Please share your Order ID or email, and our billing bot will send the PDF receipt right away.',
      enabled: true,
      triggerCount: 89
    },
    {
      id: 'rule_3',
      name: 'Location & Office',
      keyword: 'location',
      replyTemplate: 'Our digital headquarters is on Aeirmist Cloud, with regional teams in Dhaka and Singapore.',
      enabled: true,
      triggerCount: 64
    }
  ]);

  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleKeyword, setNewRuleKeyword] = useState('');
  const [newRuleReply, setNewRuleReply] = useState('');
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);

  // --- Planner / Calendar State ---
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([
    {
      id: 'sch_1',
      content: '🚀 Big news coming tomorrow! Exclusive features for verified creators dropping on Aeirmist.',
      date: '2026-10-29',
      time: '18:00',
      type: 'post',
      status: 'scheduled'
    },
    {
      id: 'sch_2',
      content: 'Friday Cinema Reel: The art of modern UI motion design #AeirmistReels #Creator',
      date: '2026-10-30',
      time: '20:30',
      type: 'reel',
      status: 'scheduled'
    }
  ]);

  const [newPostContent, setNewPostContent] = useState('');
  const [newPostDate, setNewPostDate] = useState('2026-10-30');
  const [newPostTime, setNewPostTime] = useState('14:00');
  const [newPostType, setNewPostType] = useState<'post' | 'reel' | 'story'>('post');
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Fetch Era AI local status on mount
  useEffect(() => {
    const base = resolveApiBase() || '';
    fetch(`${base}/api/v1/ai/status`)
      .then(r => r.json())
      .then(d => {
        if (d?.success) {
          setEraStatus({
            online: d.online ?? true,
            port: d.port || 5051,
            latencyMs: d.latencyMs || 28
          });
        }
      })
      .catch(() => {});
  }, []);

  // Set default selected inbox item
  useEffect(() => {
    if (!selectedInboxItem && inboxItems.length > 0) {
      setSelectedInboxItem(inboxItems[0]);
    }
  }, [inboxItems, selectedInboxItem]);

  // Generate Era AI Smart Response for selected inbox message
  const handleGenerateEraReply = async () => {
    if (!selectedInboxItem) return;
    setIsGeneratingAiReply(true);

    try {
      const base = resolveApiBase() || '';
      const token = getAuthToken();
      const res = await fetch(`${base}/api/v1/ai/business/auto-reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: selectedInboxItem.lastMessage,
          rules: automationRules
        })
      });

      if (res.ok) {
        const data = await res.json();
        setInboxReplyText(data.reply || '');
        addToast({
          title: 'Era AI Reply Generated',
          message: `Auto-drafted using rule: ${data.ruleMatched || 'Generative Assistant'}`,
          type: 'success'
        });
      } else {
        // Fallback local template
        setInboxReplyText(`Hello ${selectedInboxItem.senderName}! Thank you for your inquiry. How can our team assist you further?`);
      }
    } catch {
      setInboxReplyText(`Hello ${selectedInboxItem.senderName}! Thank you for reaching out to ${selectedAsset.name}. We would be happy to help!`);
    } finally {
      setIsGeneratingAiReply(false);
    }
  };

  // Send reply in Unified Inbox
  const handleSendInboxReply = () => {
    if (!inboxReplyText.trim() || !selectedInboxItem) return;

    addToast({
      title: 'Reply Sent',
      message: `Message delivered to ${selectedInboxItem.senderName}`,
      type: 'success'
    });

    setInboxItems(prev => prev.map(item => {
      if (item.id === selectedInboxItem.id) {
        return { ...item, unread: false, handledByEra: true };
      }
      return item;
    }));

    setInboxReplyText('');
  };

  // Add new automation rule
  const handleCreateRule = () => {
    if (!newRuleName.trim() || !newRuleKeyword.trim() || !newRuleReply.trim()) {
      addToast({ title: 'Missing Fields', message: 'Please provide rule name, trigger keyword, and reply template.', type: 'warning' });
      return;
    }

    const newRule: AutomationRule = {
      id: `rule_${Date.now()}`,
      name: newRuleName.trim(),
      keyword: newRuleKeyword.trim().toLowerCase(),
      replyTemplate: newRuleReply.trim(),
      enabled: true,
      triggerCount: 0
    };

    setAutomationRules(prev => [...prev, newRule]);
    setNewRuleName('');
    setNewRuleKeyword('');
    setNewRuleReply('');
    setShowAddRuleModal(false);
    addToast({ title: 'Rule Created', message: `Era AI will now trigger on "${newRule.keyword}"`, type: 'success' });
  };

  // Add new scheduled post
  const handleSchedulePost = () => {
    if (!newPostContent.trim()) {
      addToast({ title: 'Content Required', message: 'Please write your post content.', type: 'warning' });
      return;
    }

    const post: ScheduledPost = {
      id: `sch_${Date.now()}`,
      content: newPostContent.trim(),
      date: newPostDate,
      time: newPostTime,
      type: newPostType,
      status: 'scheduled'
    };

    setScheduledPosts(prev => [...prev, post]);
    setNewPostContent('');
    setShowScheduleModal(false);
    addToast({ title: 'Content Scheduled', message: `Post queued for ${post.date} at ${post.time}`, type: 'success' });
  };

  return (
    <div className={`w-full bg-[#0a0d14] text-[#e4e6eb] font-sans antialiased flex flex-col ${
      isStandalone ? 'min-h-screen' : 'min-h-[700px] rounded-2xl border border-white/10 overflow-hidden shadow-2xl'
    }`}>
      {/* 1. TOP META BUSINESS SUITE HEADER */}
      <header className="h-16 px-4 md:px-6 bg-[#111624] border-b border-[#252b3d] flex items-center justify-between select-none shrink-0 z-20">
        <div className="flex items-center gap-3">
          {/* Business Suite Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('overview')}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center font-black text-white text-sm shadow-[0_0_15px_rgba(0,255,255,0.4)]">
              <Briefcase size={16} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-white text-sm tracking-tight">Aeirmist</span>
                <span className="text-xs font-bold text-cyan-400">Business Suite</span>
              </div>
              <span className="text-[10px] text-white/40">Pages, Unified Inbox & Automation</span>
            </div>
          </div>

          <div className="h-5 w-[1px] bg-white/10 mx-2 hidden sm:block" />

          {/* Asset Switcher (Page / Profile Selector) */}
          <div className="relative">
            <button 
              onClick={() => setShowAssetDropdown(!showAssetDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1a2032] hover:bg-[#232b42] border border-[#2d3650] text-xs transition-all cursor-pointer"
            >
              <div className="w-5 h-5 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[10px]">
                {selectedAsset.name[0]}
              </div>
              <div className="text-left hidden sm:block">
                <span className="font-bold text-white block leading-tight">{selectedAsset.name}</span>
                <span className="text-[9px] text-white/50 block font-mono">{selectedAsset.handle}</span>
              </div>
              <ChevronDown size={13} className="text-white/40 ml-1" />
            </button>

            {/* Asset Dropdown Menu */}
            {showAssetDropdown && (
              <div className="absolute left-0 mt-2 w-64 bg-[#141a29] border border-[#2d3650] rounded-xl shadow-2xl p-2 z-50 space-y-1">
                <span className="text-[10px] uppercase font-bold text-white/40 px-2 py-1 block">Your Business Assets</span>
                <div 
                  onClick={() => setShowAssetDropdown(false)}
                  className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <span className="text-xs font-bold text-cyan-300 block">{selectedAsset.name}</span>
                    <span className="text-[10px] text-white/50">{selectedAsset.category} • {selectedAsset.followers.toLocaleString()} followers</span>
                  </div>
                  <Check size={14} className="text-cyan-400" />
                </div>
                <div 
                  onClick={() => {
                    setSelectedAsset({
                      id: 'page_creator_personal',
                      name: `${profile?.displayName || 'Personal'} Creator Hub`,
                      handle: `@${profile?.username || 'user'}_creator`,
                      followers: 3200,
                      category: 'Individual Influencer'
                    });
                    setShowAssetDropdown(false);
                    addToast({ title: 'Switched Page Asset', message: 'Now managing Personal Creator Hub', type: 'info' });
                  }}
                  className="p-2 rounded-lg hover:bg-white/5 flex items-center justify-between cursor-pointer text-xs"
                >
                  <div>
                    <span className="font-medium text-white/80 block">{profile?.displayName || 'Personal'} Creator Hub</span>
                    <span className="text-[10px] text-white/40">Individual Influencer</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-2.5">
          {/* Era AI Live Telemetry Pill */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#162033] border border-cyan-500/20 text-[11px] font-mono">
            <span className={`w-2 h-2 rounded-full ${eraStatus.online ? 'bg-cyan-400 animate-pulse' : 'bg-rose-400'}`} />
            <span className="text-cyan-300 font-bold">Era AI</span>
            <span className="text-white/40">{eraStatus.online ? `Port ${eraStatus.port} (Active)` : 'Offline'}</span>
          </div>

          <button 
            onClick={() => setShowScheduleModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-xs transition-all shadow-[0_2px_10px_rgba(24,119,242,0.4)] cursor-pointer"
          >
            <Plus size={14} />
            <span>Create Post</span>
          </button>

          <a 
            href="/"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-all cursor-pointer"
          >
            <span>Exit to Feed</span>
            <ArrowUpRight size={13} className="text-white/50" />
          </a>
        </div>
      </header>

      {/* 2. BODY LAYOUT: SIDEBAR + MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        
        {/* SIDEBAR NAVIGATION (Meta Business Suite Style) */}
        <aside className="w-full md:w-64 bg-[#0e1320] border-r border-[#202738] flex flex-col shrink-0">
          <div className="p-3 space-y-1">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'overview' ? 'bg-[#1877f2] text-white shadow-[0_2px_8px_rgba(24,119,242,0.3)]' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Briefcase size={16} />
              <span>Home & Overview</span>
            </button>

            <button 
              onClick={() => setActiveTab('inbox')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'inbox' ? 'bg-[#1877f2] text-white shadow-[0_2px_8px_rgba(24,119,242,0.3)]' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <Inbox size={16} />
                <span>Unified Inbox</span>
              </div>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-400 text-black font-black font-mono">
                {inboxItems.filter(i => i.unread).length}
              </span>
            </button>

            <button 
              onClick={() => setActiveTab('automation')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'automation' ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_2px_12px_rgba(0,255,255,0.3)]' : 'text-cyan-300 hover:text-white hover:bg-cyan-500/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <Bot size={16} />
                <span>Era AI Automation</span>
              </div>
              <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-400/20 text-cyan-300 font-bold border border-cyan-400/30">FREE</span>
            </button>

            <button 
              onClick={() => setActiveTab('planner')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'planner' ? 'bg-[#1877f2] text-white shadow-[0_2px_8px_rgba(24,119,242,0.3)]' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <CalendarIcon size={16} />
              <span>Planner & Calendar</span>
            </button>

            <button 
              onClick={() => setActiveTab('content')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'content' ? 'bg-[#1877f2] text-white shadow-[0_2px_8px_rgba(24,119,242,0.3)]' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileText size={16} />
              <span>Content & Reels</span>
            </button>

            <button 
              onClick={() => setActiveTab('insights')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'insights' ? 'bg-[#1877f2] text-white shadow-[0_2px_8px_rgba(24,119,242,0.3)]' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <BarChart3 size={16} />
              <span>Insights & Analytics</span>
            </button>
          </div>

          <div className="mt-auto p-4 border-t border-[#202738] bg-[#0b0e18]">
            <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/20 space-y-1.5">
              <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-bold">
                <Sparkles size={13} />
                <span>Era AI Sovereign Engine</span>
              </div>
              <p className="text-[11px] text-white/50 leading-relaxed">
                Running locally from <code className="text-cyan-300">D:\ai\Era</code>. Zero token billing, unlimited auto-responses.
              </p>
            </div>
          </div>
        </aside>

        {/* MAIN WORKSPACE VIEW */}
        <main className="flex-1 bg-[#0b0f19] overflow-y-auto p-4 md:p-6 min-h-0">
          
          {/* TAB 1: OVERVIEW & DASHBOARD */}
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              {/* Header Hero */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-[#141b2d] to-[#121626] border border-[#252f47] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">Welcome to Aeirmist Business Suite</span>
                  <h1 className="text-xl md:text-2xl font-black text-white">{selectedAsset.name}</h1>
                  <p className="text-xs text-white/50">Manage your presence, interact with audience, and automate operations with Era AI.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setActiveTab('inbox')}
                    className="px-4 py-2 rounded-xl bg-[#1e273d] hover:bg-[#283452] border border-[#323f61] text-xs font-bold text-white transition-all cursor-pointer"
                  >
                    Open Unified Inbox
                  </button>
                  <button 
                    onClick={() => setActiveTab('automation')}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold text-xs transition-all shadow-[0_2px_12px_rgba(0,255,255,0.3)] cursor-pointer"
                  >
                    Configure Era Bot
                  </button>
                </div>
              </div>

              {/* KPI Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-[#121624] border border-[#232b40] space-y-1">
                  <span className="text-[11px] font-medium text-white/40">Total Followers</span>
                  <div className="text-xl md:text-2xl font-black text-white">{selectedAsset.followers.toLocaleString()}</div>
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
                    <TrendingUp size={11} /> +12.4% this month
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-[#121624] border border-[#232b40] space-y-1">
                  <span className="text-[11px] font-medium text-white/40">Post Reach</span>
                  <div className="text-xl md:text-2xl font-black text-white">48,210</div>
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5">
                    <TrendingUp size={11} /> +28.1% vs last week
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-[#121624] border border-[#232b40] space-y-1">
                  <span className="text-[11px] font-medium text-white/40">Era Automated Replies</span>
                  <div className="text-xl md:text-2xl font-black text-cyan-300">295</div>
                  <span className="text-[10px] text-cyan-400 font-bold">100% Free / Local Engine</span>
                </div>
                <div className="p-4 rounded-xl bg-[#121624] border border-[#232b40] space-y-1">
                  <span className="text-[11px] font-medium text-white/40">Avg. Response Time</span>
                  <div className="text-xl md:text-2xl font-black text-white">&lt; 1 sec</div>
                  <span className="text-[10px] text-emerald-400 font-bold">Instant AI Dispatch</span>
                </div>
              </div>

              {/* Action Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-[#121624] border border-[#232b40] space-y-3">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                    <Inbox size={16} />
                    <span>Unread Messages & Comments</span>
                  </div>
                  <p className="text-xs text-white/60">You have {inboxItems.filter(i => i.unread).length} customer inquiries awaiting reply across DMs and Reels.</p>
                  <button 
                    onClick={() => setActiveTab('inbox')}
                    className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition-all cursor-pointer"
                  >
                    View All Messages
                  </button>
                </div>

                <div className="p-5 rounded-2xl bg-[#121624] border border-[#232b40] space-y-3">
                  <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                    <CalendarIcon size={16} />
                    <span>Next Scheduled Post</span>
                  </div>
                  <p className="text-xs text-white/60">
                    {scheduledPosts.length > 0 ? scheduledPosts[0].content.slice(0, 70) + '...' : 'No upcoming posts scheduled.'}
                  </p>
                  <button 
                    onClick={() => setActiveTab('planner')}
                    className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition-all cursor-pointer"
                  >
                    Open Planner Calendar
                  </button>
                </div>

                <div className="p-5 rounded-2xl bg-[#121624] border border-[#232b40] space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <Bot size={16} />
                    <span>Era Automation Rules</span>
                  </div>
                  <p className="text-xs text-white/60">{automationRules.filter(r => r.enabled).length} auto-reply rules currently active for instant FAQ responses.</p>
                  <button 
                    onClick={() => setActiveTab('automation')}
                    className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition-all cursor-pointer"
                  >
                    Manage Bot Rules
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: UNIFIED INBOX */}
          {activeTab === 'inbox' && (
            <div className="h-[620px] rounded-2xl border border-[#232b40] bg-[#101420] overflow-hidden grid grid-cols-1 md:grid-cols-12 shadow-2xl">
              
              {/* Inbox List (Left Column) */}
              <div className="md:col-span-5 border-r border-[#202738] flex flex-col bg-[#0e121d]">
                <div className="p-3 border-b border-[#202738] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-white">Unified Inbox</span>
                    <span className="text-[10px] text-cyan-400 font-mono">DMs & Comments</span>
                  </div>
                  {/* Filters */}
                  <div className="flex items-center gap-1 text-[11px]">
                    {(['all', 'dms', 'comments', 'unread'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setInboxFilter(f)}
                        className={`px-2.5 py-1 rounded-lg uppercase font-bold text-[10px] transition-all cursor-pointer ${
                          inboxFilter === f ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-white/40 hover:text-white'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-white/5">
                  {inboxItems
                    .filter(i => {
                      if (inboxFilter === 'dms') return i.type === 'dm';
                      if (inboxFilter === 'comments') return i.type === 'comment';
                      if (inboxFilter === 'unread') return i.unread;
                      return true;
                    })
                    .map(item => (
                      <div 
                        key={item.id}
                        onClick={() => setSelectedInboxItem(item)}
                        className={`p-3 flex items-start gap-3 cursor-pointer hover:bg-white/[0.03] transition-all ${
                          selectedInboxItem?.id === item.id ? 'bg-cyan-500/10 border-l-2 border-cyan-400' : ''
                        }`}
                      >
                        <img src={item.avatar} className="w-9 h-9 rounded-xl object-cover shrink-0" alt="" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white truncate">{item.senderName}</span>
                            <span className="text-[10px] text-white/40">{item.timestamp}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-white/50">
                            <span className={`px-1 rounded text-[8px] font-bold uppercase ${
                              item.type === 'dm' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'
                            }`}>
                              {item.type}
                            </span>
                            {item.sourcePostTitle && <span className="truncate">on "{item.sourcePostTitle}"</span>}
                          </div>
                          <p className="text-xs text-white/70 truncate mt-1">{item.lastMessage}</p>
                          {item.handledByEra && (
                            <span className="inline-flex items-center gap-1 text-[9px] text-cyan-400 font-mono mt-1">
                              <Bot size={10} /> Auto-handled by Era AI
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Conversation Detail & Reply Pane (Right Column) */}
              <div className="md:col-span-7 flex flex-col bg-[#111624]">
                {selectedInboxItem ? (
                  <>
                    {/* Header */}
                    <div className="p-4 border-b border-[#202738] flex items-center justify-between bg-[#141a2b]">
                      <div className="flex items-center gap-3">
                        <img src={selectedInboxItem.avatar} className="w-10 h-10 rounded-xl object-cover" alt="" />
                        <div>
                          <span className="text-xs font-bold text-white block">{selectedInboxItem.senderName}</span>
                          <span className="text-[10px] text-white/40 font-mono">{selectedInboxItem.senderHandle} • {selectedInboxItem.type.toUpperCase()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={handleGenerateEraReply}
                          disabled={isGeneratingAiReply}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold text-xs transition-all shadow-[0_2px_8px_rgba(0,255,255,0.3)] disabled:opacity-50 cursor-pointer"
                        >
                          {isGeneratingAiReply ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                          <span>Draft with Era AI</span>
                        </button>
                      </div>
                    </div>

                    {/* Messages Body */}
                    <div className="flex-1 p-4 overflow-y-auto space-y-4">
                      {/* Customer Inquiry Bubble */}
                      <div className="flex items-start gap-3">
                        <img src={selectedInboxItem.avatar} className="w-8 h-8 rounded-xl object-cover shrink-0" alt="" />
                        <div className="p-3 rounded-2xl rounded-tl-none bg-[#1e273d] border border-[#2d3a5a] text-xs text-white max-w-md space-y-1">
                          <p>{selectedInboxItem.lastMessage}</p>
                          <span className="text-[9px] text-white/30 block text-right">{selectedInboxItem.timestamp}</span>
                        </div>
                      </div>

                      {/* If Era already auto-replied */}
                      {selectedInboxItem.handledByEra && (
                        <div className="flex items-start gap-3 justify-end">
                          <div className="p-3 rounded-2xl rounded-tr-none bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-200 max-w-md space-y-1">
                            <div className="flex items-center gap-1 text-[10px] text-cyan-400 font-bold mb-1">
                              <Bot size={11} /> Era Auto-Responder:
                            </div>
                            <p>Thank you for inquiring! We have received your message and sent full information.</p>
                            <span className="text-[9px] text-cyan-400/50 block text-right">Instant Dispatch</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Reply Input Bar */}
                    <div className="p-3 border-t border-[#202738] bg-[#0e121d] space-y-2">
                      <div className="relative">
                        <textarea 
                          rows={3}
                          value={inboxReplyText}
                          onChange={(e) => setInboxReplyText(e.target.value)}
                          placeholder="Type an official reply, or click 'Draft with Era AI' to auto-generate..."
                          className="w-full bg-[#182033] border border-[#283552] rounded-xl p-3 text-xs text-white outline-none focus:border-cyan-500/50 resize-none"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/40">Replying as <strong className="text-white">{selectedAsset.name}</strong></span>
                        <button 
                          onClick={handleSendInboxReply}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-xs transition-all cursor-pointer"
                        >
                          <Send size={13} />
                          <span>Send Reply</span>
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-xs text-white/30">
                    Select a conversation from the left inbox to view and respond.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ERA AI AUTOMATION & BOTS */}
          {activeTab === 'automation' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              
              {/* Top Banner */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-[#101828] to-blue-950/40 border border-cyan-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-cyan-400 font-extrabold text-sm">
                    <Bot size={18} />
                    <span>Autonomous Business Assistant & FAQ Bot</span>
                  </div>
                  <h2 className="text-lg font-black text-white">Zero-Cost AI Automation Engine</h2>
                  <p className="text-xs text-white/60">
                    Powered by your sovereign <code className="text-cyan-300">D:\ai\Era</code> daemon. Runs locally without external API tokens or fees.
                  </p>
                </div>
                <button 
                  onClick={() => setShowAddRuleModal(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-extrabold text-xs transition-all shadow-[0_2px_12px_rgba(0,255,255,0.4)] cursor-pointer shrink-0"
                >
                  + Add Keyword Trigger
                </button>
              </div>

              {/* Master Toggles: Instant Greeting & Away Messages */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Instant Greeting */}
                <div className="p-5 rounded-2xl bg-[#121624] border border-[#232b40] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap size={16} className="text-cyan-400" />
                      <span className="text-xs font-bold text-white">Instant Welcome Greeting</span>
                    </div>
                    <button 
                      onClick={() => setInstantGreetingEnabled(!instantGreetingEnabled)}
                      className="cursor-pointer text-cyan-400"
                    >
                      {instantGreetingEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} className="text-white/30" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    Automatically greets customers the moment they send their very first message in your page inbox.
                  </p>
                  <textarea 
                    rows={3}
                    value={greetingText}
                    onChange={(e) => setGreetingText(e.target.value)}
                    className="w-full bg-[#182033] border border-[#283552] rounded-xl p-2.5 text-xs text-white outline-none focus:border-cyan-500/50"
                  />
                </div>

                {/* Away Message */}
                <div className="p-5 rounded-2xl bg-[#121624] border border-[#232b40] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-blue-400" />
                      <span className="text-xs font-bold text-white">After-Hours / Away Auto-Reply</span>
                    </div>
                    <button 
                      onClick={() => setAwayMessageEnabled(!awayMessageEnabled)}
                      className="cursor-pointer text-cyan-400"
                    >
                      {awayMessageEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} className="text-white/30" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    Responds to inquiries outside normal hours (e.g. 10 PM - 8 AM) while collecting their details for follow-up.
                  </p>
                  <textarea 
                    rows={3}
                    value={awayText}
                    onChange={(e) => setAwayText(e.target.value)}
                    className="w-full bg-[#182033] border border-[#283552] rounded-xl p-2.5 text-xs text-white outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>

              {/* Keyword Automation Rules List */}
              <div className="p-5 rounded-2xl bg-[#121624] border border-[#232b40] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Active Keyword Trigger Rules</h3>
                    <p className="text-[11px] text-white/40">When an incoming DM or comment matches these keywords, Era responds automatically.</p>
                  </div>
                  <span className="text-xs font-mono text-cyan-400 font-bold">{automationRules.length} Rules Configured</span>
                </div>

                <div className="space-y-2">
                  {automationRules.map(rule => (
                    <div 
                      key={rule.id}
                      className="p-3.5 rounded-xl bg-[#182033] border border-[#283552] flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-white">{rule.name}</span>
                          <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px] border border-cyan-500/30">
                            keyword: "{rule.keyword}"
                          </span>
                        </div>
                        <p className="text-xs text-white/60 font-mono bg-black/30 p-2 rounded-lg max-w-xl">
                          "{rule.replyTemplate}"
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] text-white/40 font-mono">{rule.triggerCount} triggers</span>
                        <button 
                          onClick={() => {
                            setAutomationRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
                            addToast({ title: 'Rule Updated', message: `${rule.name} is now ${!rule.enabled ? 'Enabled' : 'Disabled'}`, type: 'info' });
                          }}
                          className="cursor-pointer text-cyan-400"
                        >
                          {rule.enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} className="text-white/30" />}
                        </button>
                        <button 
                          onClick={() => setAutomationRules(prev => prev.filter(r => r.id !== rule.id))}
                          className="text-white/30 hover:text-rose-400 p-1 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PLANNER & CALENDAR */}
          {activeTab === 'planner' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-white">Content Planner & Scheduler</h2>
                  <p className="text-xs text-white/50">Schedule posts, reels, and stories in advance to maintain continuous audience engagement.</p>
                </div>
                <button 
                  onClick={() => setShowScheduleModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-xs transition-all cursor-pointer shadow-[0_2px_10px_rgba(24,119,242,0.4)]"
                >
                  <Plus size={14} />
                  <span>Schedule Content</span>
                </button>
              </div>

              {/* Scheduled Posts Timeline */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scheduledPosts.map(post => (
                  <div key={post.id} className="p-4 rounded-xl bg-[#121624] border border-[#232b40] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          {post.type}
                        </span>
                        <span className="text-xs font-mono text-white/60">📅 {post.date} at {post.time}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {post.status}
                      </span>
                    </div>
                    <p className="text-xs text-white/90 bg-black/40 p-3 rounded-lg leading-relaxed">{post.content}</p>
                    <div className="flex justify-end gap-2 text-xs">
                      <button 
                        onClick={() => {
                          setScheduledPosts(prev => prev.filter(p => p.id !== post.id));
                          addToast({ title: 'Schedule Removed', message: 'Post removed from queue.', type: 'info' });
                        }}
                        className="text-white/40 hover:text-rose-400 p-1 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: CONTENT LIST */}
          {activeTab === 'content' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-white">Published & Active Content</h2>
                  <p className="text-xs text-white/50">Performance metrics for your posts and reels on {selectedAsset.name}.</p>
                </div>
              </div>

              <div className="rounded-xl border border-[#232b40] bg-[#121624] overflow-hidden">
                <div className="grid grid-cols-12 bg-black/40 px-4 py-3 border-b border-[#232b40] text-[11px] font-bold text-white/40 uppercase tracking-wider">
                  <span className="col-span-6">Post Content</span>
                  <span className="col-span-2">Reach / Views</span>
                  <span className="col-span-2">Engagement</span>
                  <span className="col-span-2 text-right">Published</span>
                </div>
                <div className="divide-y divide-white/5 text-xs">
                  <div className="grid grid-cols-12 px-4 py-3 items-center hover:bg-white/[0.02]">
                    <span className="col-span-6 font-medium text-white truncate">🎉 Welcome to the new era of sovereign social media with Aeirmist 2.0!</span>
                    <span className="col-span-2 text-cyan-300 font-mono font-bold">14,280 views</span>
                    <span className="col-span-2 text-emerald-400 font-mono">1,890 likes • 340 comments</span>
                    <span className="col-span-2 text-right text-white/40">Yesterday</span>
                  </div>
                  <div className="grid grid-cols-12 px-4 py-3 items-center hover:bg-white/[0.02]">
                    <span className="col-span-6 font-medium text-white truncate">Behind the scenes: Deep neural networks & local autonomous agents in action.</span>
                    <span className="col-span-2 text-cyan-300 font-mono font-bold">29,400 views</span>
                    <span className="col-span-2 text-emerald-400 font-mono">4,120 likes • 820 comments</span>
                    <span className="col-span-2 text-right text-white/40">3 days ago</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: INSIGHTS & ANALYTICS */}
          {activeTab === 'insights' && (
            <div className="space-y-6 max-w-6xl mx-auto">
              <div>
                <h2 className="text-lg font-black text-white">Audience Growth & Reach Insights</h2>
                <p className="text-xs text-white/50">Comprehensive analytics across {selectedAsset.name}.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-[#121624] border border-[#232b40] space-y-4">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Reach by Region</span>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-white/60">Dhaka & Bangladesh</span>
                      <span className="font-mono text-cyan-300 font-bold">64%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-cyan-400 rounded-full" style={{ width: '64%' }} />
                    </div>

                    <div className="flex justify-between">
                      <span className="text-white/60">United States & Canada</span>
                      <span className="font-mono text-cyan-300 font-bold">22%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: '22%' }} />
                    </div>

                    <div className="flex justify-between">
                      <span className="text-white/60">Europe & UK</span>
                      <span className="font-mono text-cyan-300 font-bold">14%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: '14%' }} />
                    </div>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-[#121624] border border-[#232b40] space-y-4">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Top Performing Hours</span>
                  <p className="text-[11px] text-white/50">Your audience is most active between <strong>7:00 PM and 11:30 PM</strong>.</p>
                  <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-mono">
                    💡 Tip: Schedule your primary daily reel at <strong>8:15 PM</strong> for maximum organic reach.
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* MODAL: ADD KEYWORD TRIGGER RULE */}
      <AnimatePresence>
        {showAddRuleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-[#141a2b] border border-[#2d3a5a] rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="h-12 px-5 border-b border-[#252f47] flex items-center justify-between bg-[#182035]">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Bot size={16} className="text-cyan-400" />
                  <span>Create Era AI Keyword Trigger</span>
                </div>
                <button onClick={() => setShowAddRuleModal(false)} className="text-white/40 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs font-sans">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-white/60">Rule Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Delivery Policy FAQ"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    className="w-full bg-[#1b233a] border border-[#283552] rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-500/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-white/60">Trigger Keyword</label>
                  <input 
                    type="text" 
                    placeholder="e.g. delivery, shipping, time"
                    value={newRuleKeyword}
                    onChange={(e) => setNewRuleKeyword(e.target.value)}
                    className="w-full bg-[#1b233a] border border-[#283552] rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-500/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-white/60">Era AI Reply Template</label>
                  <textarea 
                    rows={4}
                    placeholder="Enter the automated reply message..."
                    value={newRuleReply}
                    onChange={(e) => setNewRuleReply(e.target.value)}
                    className="w-full bg-[#1b233a] border border-[#283552] rounded-xl p-3 text-white outline-none focus:border-cyan-500/50 resize-none"
                  />
                </div>
              </div>

              <div className="h-14 px-5 bg-[#182035] border-t border-[#252f47] flex items-center justify-end gap-2">
                <button 
                  onClick={() => setShowAddRuleModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateRule}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs transition-all cursor-pointer shadow-[0_2px_10px_rgba(0,255,255,0.4)]"
                >
                  Save Trigger Rule
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: SCHEDULE CONTENT */}
      <AnimatePresence>
        {showScheduleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-[#141a2b] border border-[#2d3a5a] rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="h-12 px-5 border-b border-[#252f47] flex items-center justify-between bg-[#182035]">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <CalendarIcon size={16} className="text-cyan-400" />
                  <span>Schedule Content for {selectedAsset.name}</span>
                </div>
                <button onClick={() => setShowScheduleModal(false)} className="text-white/40 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs font-sans">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-white/60">Content Type</label>
                  <div className="flex gap-2">
                    {(['post', 'reel', 'story'] as const).map(t => (
                      <button 
                        key={t}
                        onClick={() => setNewPostType(t)}
                        className={`flex-1 py-1.5 rounded-lg uppercase font-bold text-xs border transition-all cursor-pointer ${
                          newPostType === t ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-[#1b233a] border-[#283552] text-white/50'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-white/60">Post Description / Caption</label>
                  <textarea 
                    rows={4}
                    placeholder="Write caption, hashtags, and media notes..."
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    className="w-full bg-[#1b233a] border border-[#283552] rounded-xl p-3 text-white outline-none focus:border-cyan-500/50 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-white/60">Publish Date</label>
                    <input 
                      type="date" 
                      value={newPostDate}
                      onChange={(e) => setNewPostDate(e.target.value)}
                      className="w-full bg-[#1b233a] border border-[#283552] rounded-xl px-3 py-2 text-white outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-white/60">Publish Time</label>
                    <input 
                      type="time" 
                      value={newPostTime}
                      onChange={(e) => setNewPostTime(e.target.value)}
                      className="w-full bg-[#1b233a] border border-[#283552] rounded-xl px-3 py-2 text-white outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="h-14 px-5 bg-[#182035] border-t border-[#252f47] flex items-center justify-end gap-2">
                <button 
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSchedulePost}
                  className="px-5 py-2 rounded-xl bg-[#1877f2] hover:bg-[#166fe5] text-white font-bold text-xs transition-all cursor-pointer shadow-[0_2px_10px_rgba(24,119,242,0.4)]"
                >
                  Schedule Post
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AeirmistBusinessSuite;
