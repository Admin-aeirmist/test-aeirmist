import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal, 
  Cpu, 
  Activity, 
  Code2, 
  Database, 
  Globe, 
  ShieldAlert,
  Zap, 
  Server, 
  Monitor, 
  HardDrive, 
  RefreshCw, 
  Box, 
  Key,
  Copy,
  Check,
  Play,
  Send,
  Sliders,
  Lock,
  Unlock,
  Trash2,
  Download,
  Wifi,
  Radio,
  Eye,
  EyeOff,
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown
} from 'lucide-react';
import { useAeirmist } from '../../../context/AeirmistContext';
import { resolveApiBase, getAuthToken, setAuthToken } from '../../../services/api/client';
import { getSocket } from '../../../services/api/socket';
import { GraphApiExplorer } from '../../developer/GraphApiExplorer';

type DevSubTab = 'explorer' | 'credentials' | 'webhooks' | 'network' | 'gatekeeper';

export const DeveloperSettings: React.FC = () => {
  const { user, profile, addToast } = useAeirmist();
  const [activeSubTab, setActiveSubTab] = useState<DevSubTab>('explorer');

  // --- 1. REST API Explorer State ---
  const [apiMethod, setApiMethod] = useState<'GET' | 'POST' | 'PATCH' | 'DELETE'>('GET');
  const [apiEndpoint, setApiEndpoint] = useState('/api/v1/auth/me');
  const [apiRequestBody, setApiRequestBody] = useState('{\n  "message": "Hello from Meta Developer Studio"\n}');
  const [showBodyEditor, setShowBodyEditor] = useState(false);
  const [apiExecuting, setApiExecuting] = useState(false);
  const [apiResponse, setApiResponse] = useState<any | null>(null);
  const [apiStatus, setApiStatus] = useState<number | null>(null);
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [copiedResponse, setCopiedResponse] = useState(false);

  // --- 2. App Credentials State ---
  const [showSecret, setShowSecret] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [customToken, setCustomToken] = useState<string>('');

  // --- 3. Webhooks Simulator State ---
  const [webhookUrl, setWebhookUrl] = useState('https://webhook.site/aeirmist-test-listener');
  const [webhookSecret, setWebhookSecret] = useState('aeirmist_whsec_99a8b7c6d5e4');
  const [webhookTopic, setWebhookTopic] = useState('post.created');
  const [webhookLogs, setWebhookLogs] = useState<Array<{ id: string; time: string; topic: string; status: number; payload: any }>>([
    {
      id: 'wh_init_1',
      time: new Date(Date.now() - 3600000).toLocaleTimeString(),
      topic: 'user.registered',
      status: 200,
      payload: { event: 'user.registered', userId: user?.uid || 'usr_dev_demo', timestamp: Date.now() }
    }
  ]);
  const [isSendingWebhook, setIsSendingWebhook] = useState(false);

  // --- 4. Network & Gateway State ---
  const [currentBase, setCurrentBase] = useState('');
  const [healthData, setHealthData] = useState<any | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketId, setSocketId] = useState<string>('');
  const [socketTransport, setSocketTransport] = useState<string>('websocket');
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  // --- 5. Gatekeeper & Feature Flags State ---
  const [verboseLogs, setVerboseLogs] = useState<boolean>(() => {
    return localStorage.getItem('aeirmist_dev_verbose_logging') === 'true';
  });
  const [showFpsMeter, setShowFpsMeter] = useState<boolean>(() => {
    return localStorage.getItem('aeirmist_dev_fps_meter') === 'true';
  });
  const [strictZeroAi, setStrictZeroAi] = useState<boolean>(() => {
    return localStorage.getItem('aeirmist_dev_strict_zero_ai') !== 'false';
  });
  const [mockPersistence, setMockPersistence] = useState<boolean>(() => {
    return localStorage.getItem('aeirmist_dev_mock_persistence') === 'true';
  });
  const [storageUsage, setStorageUsage] = useState<string>('0 KB');

  // Load initial environment and health
  useEffect(() => {
    setCurrentBase(resolveApiBase() || window.location.origin);
    calculateStorageUsage();

    // Check system health
    const base = resolveApiBase() || '';
    const healthUrl = `${base}/health`;
    fetch(healthUrl)
      .then(r => r.json())
      .then(d => setHealthData(d))
      .catch(() => {
        // Fallback edge health
        fetch(`${base}/api/health`)
          .then(r => r.json())
          .then(d => setHealthData(d))
          .catch(() => {});
      });

    // Check Socket status
    try {
      const socket = getSocket();
      if (socket) {
        setSocketConnected(socket.connected);
        setSocketId(socket.id || 'Pending Connection');
        setSocketTransport(socket.io?.engine?.transport?.name || 'websocket');

        const onConnect = () => {
          setSocketConnected(true);
          setSocketId(socket.id || '');
          setSocketTransport(socket.io?.engine?.transport?.name || 'websocket');
        };
        const onDisconnect = () => setSocketConnected(false);

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);

        return () => {
          socket.off('connect', onConnect);
          socket.off('disconnect', onDisconnect);
        };
      }
    } catch {}
  }, []);

  const calculateStorageUsage = () => {
    try {
      let totalBytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          totalBytes += key.length + (localStorage.getItem(key)?.length || 0);
        }
      }
      if (totalBytes < 1024) setStorageUsage(`${totalBytes} B`);
      else if (totalBytes < 1024 * 1024) setStorageUsage(`${(totalBytes / 1024).toFixed(1)} KB`);
      else setStorageUsage(`${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
    } catch {
      setStorageUsage('Unknown');
    }
  };

  // --- Execution: REST API Explorer ---
  const handleExecuteApi = async () => {
    setApiExecuting(true);
    setApiResponse(null);
    setApiStatus(null);
    const startTime = performance.now();

    try {
      const base = resolveApiBase() || '';
      const fullUrl = `${base}${apiEndpoint.startsWith('/') ? apiEndpoint : `/${apiEndpoint}`}`;
      const token = getAuthToken();

      const headers: Record<string, string> = {
        'Accept': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (user?.uid) {
        headers['X-User-Id'] = user.uid;
      }
      if (profile?.id) {
        headers['X-Profile-Id'] = profile.id;
      }

      const reqOptions: RequestInit = {
        method: apiMethod,
        headers
      };

      if ((apiMethod === 'POST' || apiMethod === 'PATCH' || apiMethod === 'PUT') && apiRequestBody.trim()) {
        headers['Content-Type'] = 'application/json';
        reqOptions.body = apiRequestBody.trim();
      }

      const res = await fetch(fullUrl, reqOptions);
      const elapsed = Math.round(performance.now() - startTime);
      setApiLatency(elapsed);
      setApiStatus(res.status);

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        setApiResponse(json);
      } else {
        const text = await res.text();
        setApiResponse({ _rawResponse: text });
      }

      addToast({
        title: `HTTP ${res.status}`,
        message: `API Call completed in ${elapsed}ms`,
        type: res.ok ? 'success' : 'warning'
      });
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - startTime);
      setApiLatency(elapsed);
      setApiStatus(500);
      setApiResponse({ error: err?.message || 'Network / Fetch Failure' });
      addToast({
        title: 'API Call Failed',
        message: err?.message || 'Failed to fetch',
        type: 'error'
      });
    } finally {
      setApiExecuting(false);
    }
  };

  // --- Socket Ping Test ---
  const handlePingSocket = () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      const socket = getSocket();
      if (!socket || !socket.connected) {
        setPingLatency(null);
        setIsPinging(false);
        addToast({ title: 'Socket Offline', message: 'Socket is not currently connected to gateway.', type: 'warning' });
        return;
      }

      socket.emit('ping_heartbeat', { timestamp: Date.now() }, () => {
        const roundtrip = Math.round(performance.now() - start);
        setPingLatency(roundtrip);
        setIsPinging(false);
        addToast({ title: 'Pong Received', message: `Socket roundtrip latency: ${roundtrip}ms`, type: 'success' });
      });

      // Fallback timeout in case ack is not returned
      setTimeout(() => {
        setIsPinging(false);
      }, 3000);
    } catch {
      setIsPinging(false);
    }
  };

  // --- Environment Gateway Switcher ---
  const handleSetGateway = (target: string) => {
    if (target === 'default') {
      localStorage.removeItem('aeirmist_backend_url');
      addToast({ title: 'Gateway Reset', message: 'Switched to Auto-Detect Gateway. Refreshing page...', type: 'info' });
    } else {
      localStorage.setItem('aeirmist_backend_url', target);
      addToast({ title: 'Gateway Set', message: `Target set to: ${target}. Reloading...`, type: 'success' });
    }
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  };

  // --- Dispatch Simulated Webhook ---
  const handleSendWebhook = () => {
    setIsSendingWebhook(true);
    const mockPayload = {
      event: webhookTopic,
      deliveryId: `del_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      sender: {
        id: user?.uid || 'usr_dev_tester',
        username: profile?.username || 'developer_studio',
        displayName: profile?.displayName || 'Aeirmist Developer'
      },
      data: webhookTopic === 'post.created' 
        ? { postId: `post_${Date.now()}`, content: 'Simulated live post event from Meta Developer Studio.', visibility: 'public' }
        : webhookTopic === 'direct_message.received'
        ? { messageId: `msg_${Date.now()}`, text: 'Hello via Aeirmist Webhook Simulator!', conversationId: 'conv_dev_test' }
        : { userId: user?.uid, status: 'active', meta: 'payload_simulation' }
    };

    setTimeout(() => {
      setWebhookLogs(prev => [
        {
          id: mockPayload.deliveryId,
          time: new Date().toLocaleTimeString(),
          topic: webhookTopic,
          status: 200,
          payload: mockPayload
        },
        ...prev.slice(0, 9)
      ]);
      setIsSendingWebhook(false);
      addToast({ title: 'Webhook Dispatched', message: `Simulated [${webhookTopic}] event sent to ${webhookUrl}`, type: 'success' });
    }, 700);
  };

  // --- Clear Caches ---
  const handleClearFeedCache = () => {
    localStorage.removeItem('aeirmist_home_feed_cache');
    localStorage.removeItem('aeirmist_explore_cache');
    calculateStorageUsage();
    addToast({ title: 'Feed Cache Purged', message: 'Home and explore feed caches cleared successfully.', type: 'success' });
  };

  const handleClearAllStorage = () => {
    if (confirm('Reset all development feature flags and non-auth caches?')) {
      localStorage.removeItem('aeirmist_home_feed_cache');
      localStorage.removeItem('aeirmist_explore_cache');
      localStorage.removeItem('aeirmist_dev_verbose_logging');
      localStorage.removeItem('aeirmist_dev_fps_meter');
      localStorage.removeItem('aeirmist_backend_url');
      calculateStorageUsage();
      addToast({ title: 'Storage Reset', message: 'Local developer storage reset.', type: 'info' });
    }
  };

  const currentToken = getAuthToken() || 'No active JWT session found. Log in to acquire a valid Bearer token.';
  const displayToken = customToken || currentToken;
  const curlSnippet = `curl -X ${apiMethod} "${(resolveApiBase() || window.location.origin)}${apiEndpoint}" \\\n  -H "Authorization: Bearer ${displayToken.slice(0, 30)}..." \\\n  -H "Content-Type: application/json"`;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-20 text-white"
    >
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-[2.5rem] bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 relative overflow-hidden">
        <div className="space-y-1.5 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-aeirmist-cyan/20 border border-aeirmist-cyan/30 flex items-center justify-center text-aeirmist-cyan">
              <Terminal size={18} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">Developer Studio</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/10 text-aeirmist-cyan border border-white/10">
              Meta-Suite v2.4
            </span>
          </div>
          <p className="text-xs text-white/50 max-w-xl leading-relaxed">
            Universal Graph & REST API console, App credentials, real-time Webhook simulator, and socket health telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-[11px] font-mono">
            <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span className="text-white/70">{socketConnected ? 'Gateway Linked' : 'Offline'}</span>
          </div>
        </div>
      </div>

      {/* Meta-Style Tab Bar Navigation */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/[0.03] border border-white/10 overflow-x-auto no-scrollbar">
        <TabButton 
          active={activeSubTab === 'explorer'} 
          onClick={() => setActiveSubTab('explorer')}
          icon={<Code2 size={15} />}
          label="REST API Explorer"
        />
        <TabButton 
          active={activeSubTab === 'credentials'} 
          onClick={() => setActiveSubTab('credentials')}
          icon={<Key size={15} />}
          label="App Credentials & Tokens"
        />
        <TabButton 
          active={activeSubTab === 'webhooks'} 
          onClick={() => setActiveSubTab('webhooks')}
          icon={<Radio size={15} />}
          label="Webhooks Simulator"
        />
        <TabButton 
          active={activeSubTab === 'network'} 
          onClick={() => setActiveSubTab('network')}
          icon={<Activity size={15} />}
          label="Network & Sockets"
        />
        <TabButton 
          active={activeSubTab === 'gatekeeper'} 
          onClick={() => setActiveSubTab('gatekeeper')}
          icon={<Sliders size={15} />}
          label="Gatekeeper & Storage"
        />
      </div>

      {/* SUB-TAB 1: GRAPH & REST API EXPLORER (Meta for Developers Style) */}
      {activeSubTab === 'explorer' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs text-white/50">
              Graph API Explorer identical to Meta's developer interface. Select fields on the left to auto-build your query.
            </span>
            <a 
              href="/tools/explorer" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:underline"
            >
              <span>Open Standalone</span>
              <ExternalLink size={12} />
            </a>
          </div>
          <GraphApiExplorer isStandalone={false} />
        </motion.div>
      )}

      {/* SUB-TAB 2: APP CREDENTIALS & TOKENS */}
      {activeSubTab === 'credentials' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* App ID Card */}
            <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Registered App ID</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Live</span>
              </div>
              <div className="text-lg font-mono font-bold text-white">aeirmist_app_client_prod</div>
              <p className="text-[10px] text-white/40">Client application identifier for OAuth 2.0 and API gatekeeping.</p>
            </div>

            {/* Client Secret */}
            <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Client Secret Key</span>
                <button 
                  onClick={() => setShowSecret(!showSecret)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div className="font-mono text-sm font-bold text-aeirmist-magenta">
                {showSecret ? 'sk_live_aeirmist_88f92b7c4d1e6a5' : '••••••••••••••••••••••••••••••'}
              </div>
              <p className="text-[10px] text-white/40">Used to sign webhook payloads and server-to-server calls.</p>
            </div>
          </div>

          {/* Active Bearer Session Token */}
          <div className="p-6 sm:p-8 rounded-[2rem] bg-white/[0.02] border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <Key size={16} className="text-aeirmist-cyan" /> User Bearer Token (JWT)
                </h3>
                <p className="text-[11px] text-white/40 mt-0.5">Authoritative token used for authenticating requests to Aeirmist REST & WebSockets.</p>
              </div>

              <button 
                onClick={() => {
                  navigator.clipboard.writeText(displayToken);
                  setCopiedToken(true);
                  setTimeout(() => setCopiedToken(false), 2000);
                  addToast({ title: 'Token Copied', message: 'Bearer token copied to clipboard.', type: 'success' });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-aeirmist-cyan/10 border border-aeirmist-cyan/30 text-[10px] font-bold text-aeirmist-cyan hover:bg-aeirmist-cyan/20 transition-all cursor-pointer"
              >
                {copiedToken ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedToken ? 'Copied' : 'Copy Token'}</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-black/60 border border-white/10 font-mono text-xs text-white/70 break-all select-all">
              {displayToken}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-[11px]">
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-[9px] uppercase tracking-wider text-white/30 block">Type</span>
                <span className="font-mono font-bold text-white/80">Bearer / HS256</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-[9px] uppercase tracking-wider text-white/30 block">Subject (UID)</span>
                <span className="font-mono font-bold text-aeirmist-cyan truncate block">{user?.uid || 'usr_anonymous'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-[9px] uppercase tracking-wider text-white/30 block">Role</span>
                <span className="font-mono font-bold text-white/80">{profile?.role || 'User'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-[9px] uppercase tracking-wider text-white/30 block">Validity</span>
                <span className="font-mono font-bold text-emerald-400">30 Days</span>
              </div>
            </div>
          </div>

          {/* cURL Code Generator */}
          <div className="p-6 rounded-[2rem] bg-black/80 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-white/70 flex items-center gap-2">
                <Terminal size={14} className="text-aeirmist-magenta" /> cURL Request Template
              </span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(curlSnippet);
                  setCopiedCurl(true);
                  setTimeout(() => setCopiedCurl(false), 2000);
                  addToast({ title: 'cURL Copied', message: 'Shell snippet copied to clipboard.', type: 'info' });
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-white/60 hover:text-white transition-all cursor-pointer"
              >
                {copiedCurl ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedCurl ? 'Copied' : 'Copy cURL'}</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-xl bg-black/90 border border-white/5 font-mono text-[11px] text-white/70 overflow-x-auto">
              {curlSnippet}
            </pre>
          </div>
        </motion.div>
      )}

      {/* SUB-TAB 3: WEBHOOKS SIMULATOR */}
      {activeSubTab === 'webhooks' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/10 space-y-5">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Radio size={16} className="text-aeirmist-cyan" /> Meta-Style Webhooks Sandbox
              </h3>
              <p className="text-[11px] text-white/40 mt-0.5">Subscribe your external server to live Aeirmist events and dispatch simulated payloads.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-white/40">Webhook Endpoint URL</label>
                <input 
                  type="text" 
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-black/60 border border-white/10 rounded-xl font-mono text-xs text-white outline-none focus:border-aeirmist-cyan/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-white/40">Event Topic</label>
                <select 
                  value={webhookTopic}
                  onChange={(e) => setWebhookTopic(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-black/60 border border-white/10 rounded-xl text-xs text-white outline-none cursor-pointer"
                >
                  <option value="post.created">post.created (New feed publication)</option>
                  <option value="direct_message.received">direct_message.received (P2P message delivered)</option>
                  <option value="user.follow">user.follow (New connection established)</option>
                  <option value="vault.unlocked">vault.unlocked (Digital product purchase)</option>
                  <option value="call.incoming">call.incoming (WebRTC signaling ping)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button 
                onClick={handleSendWebhook}
                disabled={isSendingWebhook}
                className="px-5 py-2 rounded-xl bg-aeirmist-magenta text-white font-bold text-xs uppercase tracking-wider hover:bg-aeirmist-magenta/90 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(255,0,255,0.3)] disabled:opacity-50 cursor-pointer"
              >
                {isSendingWebhook ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                <span>Dispatch Test Event</span>
              </button>
            </div>
          </div>

          {/* Delivery Logs */}
          <div className="p-6 rounded-[2rem] bg-black/80 border border-white/10 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-white/60">Live Delivery History</span>
            <div className="space-y-2">
              {webhookLogs.map(log => (
                <div key={log.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="font-mono font-bold text-white/80">{log.topic}</span>
                    <span className="text-[10px] text-white/30 font-mono">[{log.time}]</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      HTTP {log.status} Delivered
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* SUB-TAB 4: NETWORK & SOCKETS */}
      {activeSubTab === 'network' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Gateway Switcher Card */}
          <div className="p-6 sm:p-8 rounded-[2rem] bg-white/[0.02] border border-white/10 space-y-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Globe size={16} className="text-aeirmist-cyan" /> Gateway Environment Switcher
              </h3>
              <p className="text-[11px] text-white/40 mt-0.5">Switch API destination between production, edge CDN, or local development backend.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <button 
                onClick={() => handleSetGateway('https://aeirmist.com')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  currentBase === 'https://aeirmist.com' 
                    ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan/40 text-white' 
                    : 'bg-white/[0.02] border-white/5 hover:border-white/20 text-white/70'
                }`}
              >
                <div className="text-xs font-bold text-white">Production (Tunnel)</div>
                <div className="text-[10px] text-white/40 font-mono mt-0.5">https://aeirmist.com</div>
              </button>

              <button 
                onClick={() => handleSetGateway('https://aeirmist-f0m.pages.dev')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  currentBase.includes('aeirmist-f0m.pages.dev') 
                    ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan/40 text-white' 
                    : 'bg-white/[0.02] border-white/5 hover:border-white/20 text-white/70'
                }`}
              >
                <div className="text-xs font-bold text-white">Cloudflare Pages Edge</div>
                <div className="text-[10px] text-white/40 font-mono mt-0.5">aeirmist-f0m.pages.dev</div>
              </button>

              <button 
                onClick={() => handleSetGateway('http://localhost:4000')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  currentBase.includes('localhost:4000') 
                    ? 'bg-aeirmist-cyan/10 border-aeirmist-cyan/40 text-white' 
                    : 'bg-white/[0.02] border-white/5 hover:border-white/20 text-white/70'
                }`}
              >
                <div className="text-xs font-bold text-white">Local Node API</div>
                <div className="text-[10px] text-white/40 font-mono mt-0.5">http://localhost:4000</div>
              </button>
            </div>
          </div>

          {/* Real-time Socket & Telemetry */}
          <div className="p-6 sm:p-8 rounded-[2rem] bg-white/[0.02] border border-white/10 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <Activity size={16} className="text-aeirmist-lime" /> Socket.IO & Health Diagnostics
                </h3>
                <p className="text-[11px] text-white/40 mt-0.5">Bi-directional WebSockets connection state and roundtrip heartbeat.</p>
              </div>

              <button 
                onClick={handlePingSocket}
                disabled={isPinging}
                className="px-4 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Activity size={13} className={isPinging ? 'animate-spin' : ''} />
                <span>{isPinging ? 'Pinging...' : 'Send Ping'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                <span className="text-[9px] font-bold uppercase text-white/40">Socket Status</span>
                <div className="text-sm font-bold font-mono text-emerald-400">
                  {socketConnected ? '🟢 Connected' : '🔴 Disconnected'}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                <span className="text-[9px] font-bold uppercase text-white/40">Transport</span>
                <div className="text-sm font-bold font-mono text-white/80 uppercase">
                  {socketTransport}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                <span className="text-[9px] font-bold uppercase text-white/40">Ping Latency</span>
                <div className="text-sm font-bold font-mono text-aeirmist-lime">
                  {pingLatency !== null ? `${pingLatency} ms` : 'Idle'}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                <span className="text-[9px] font-bold uppercase text-white/40">Database Engine</span>
                <div className="text-sm font-bold font-mono text-aeirmist-cyan">
                  {healthData?.services?.database === 'up' ? 'PostgreSQL 16' : 'Edge SQLite'}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* SUB-TAB 5: GATEKEEPER & STORAGE */}
      {activeSubTab === 'gatekeeper' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Meta Quick Experiments Toggles */}
          <div className="p-6 sm:p-8 rounded-[2rem] bg-white/[0.02] border border-white/10 space-y-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Sliders size={16} className="text-aeirmist-cyan" /> Meta Gatekeeper (Feature Flags)
              </h3>
              <p className="text-[11px] text-white/40 mt-0.5">Toggle runtime UI experiments and system behavior flags without recompilation.</p>
            </div>

            <div className="space-y-3 pt-2">
              <DevToggle 
                icon={<Code2 size={18} />}
                title="Verbose Logging"
                desc="Print detailed API requests, responses, and socket payloads to browser console"
                enabled={verboseLogs}
                onChange={(val) => {
                  setVerboseLogs(val);
                  localStorage.setItem('aeirmist_dev_verbose_logging', String(val));
                  addToast({ title: 'Flag Updated', message: `Verbose Logging: ${val ? 'Enabled' : 'Disabled'}`, type: 'info' });
                }}
              />

              <DevToggle 
                icon={<Monitor size={18} />}
                title="Show Performance & FPS Meter"
                desc="Render floating frame-rate and memory gauge in developer overlay"
                enabled={showFpsMeter}
                onChange={(val) => {
                  setShowFpsMeter(val);
                  localStorage.setItem('aeirmist_dev_fps_meter', String(val));
                  addToast({ title: 'Flag Updated', message: `FPS Meter: ${val ? 'Enabled' : 'Disabled'}`, type: 'info' });
                }}
              />

              <DevToggle 
                icon={<ShieldAlert size={18} />}
                title="Strict 0% AI Authenticity Verification"
                desc="Reject synthesized bot payloads and strictly require cryptographic device attestation"
                enabled={strictZeroAi}
                onChange={(val) => {
                  setStrictZeroAi(val);
                  localStorage.setItem('aeirmist_dev_strict_zero_ai', String(val));
                  addToast({ title: 'Flag Updated', message: `0% AI Policy: ${val ? 'Enforced' : 'Relaxed'}`, type: 'info' });
                }}
              />

              <DevToggle 
                icon={<HardDrive size={18} />}
                title="Mock Persistence Sandbox"
                desc="Direct local actions to temporary browser memory for testing"
                enabled={mockPersistence}
                onChange={(val) => {
                  setMockPersistence(val);
                  localStorage.setItem('aeirmist_dev_mock_persistence', String(val));
                  addToast({ title: 'Flag Updated', message: `Mock Sandbox: ${val ? 'Active' : 'Disabled'}`, type: 'info' });
                }}
              />
            </div>
          </div>

          {/* Storage & Cache Management */}
          <div className="p-6 sm:p-8 rounded-[2rem] bg-white/[0.02] border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <Database size={16} className="text-aeirmist-magenta" /> Local Storage & Cache Footprint
                </h3>
                <p className="text-[11px] text-white/40 mt-0.5">Inspect and selectively purge local caches and offline synchronization logs.</p>
              </div>
              <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-mono font-bold text-white/80">
                {storageUsage} Used
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button 
                onClick={handleClearFeedCache}
                className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-aeirmist-cyan/30 transition-all flex items-center justify-between group cursor-pointer text-left"
              >
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-aeirmist-cyan transition-colors">Purge Feed Cache</div>
                  <div className="text-[10px] text-white/40 mt-0.5">Clear cached posts & media metadata</div>
                </div>
                <Trash2 size={16} className="text-white/30 group-hover:text-rose-400 transition-colors" />
              </button>

              <button 
                onClick={handleClearAllStorage}
                className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-rose-500/30 transition-all flex items-center justify-between group cursor-pointer text-left"
              >
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-rose-400 transition-colors">Reset Dev Flags & Caches</div>
                  <div className="text-[10px] text-white/40 mt-0.5">Wipe developer sandbox variables</div>
                </div>
                <RefreshCw size={16} className="text-white/30 group-hover:text-rose-400 transition-colors" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

// Helper Components
const TabButton = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
  <button
    onClick={onClick}
    className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
      active 
        ? 'bg-aeirmist-cyan/20 text-aeirmist-cyan border border-aeirmist-cyan/30 shadow-[0_0_12px_rgba(0,255,255,0.2)]'
        : 'text-white/50 hover:text-white hover:bg-white/5'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const DevToggle = ({ icon, title, desc, enabled, onChange }: { icon: React.ReactNode; title: string; desc: string; enabled: boolean; onChange: (v: boolean) => void }) => (
  <button 
    onClick={() => onChange(!enabled)}
    className="w-full p-4.5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all flex items-center justify-between text-left group cursor-pointer"
  >
    <div className="flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
        enabled ? 'bg-aeirmist-cyan/20 text-aeirmist-cyan' : 'bg-white/5 text-white/40 group-hover:text-white/60'
      }`}>
        {icon}
      </div>
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-white">{title}</h4>
        <p className="text-[10px] text-white/40 mt-0.5">{desc}</p>
      </div>
    </div>
    <div className={`w-11 h-6 rounded-full relative transition-all border shrink-0 ${
      enabled ? 'bg-aeirmist-cyan/30 border-aeirmist-cyan/50' : 'bg-white/5 border-white/10'
    }`}>
      <div className={`absolute top-0.5 transition-all w-5 h-5 rounded-full ${
        enabled ? 'right-0.5 bg-aeirmist-cyan shadow-[0_0_8px_rgba(0,255,255,0.8)]' : 'left-0.5 bg-white/20'
      }`} />
    </div>
  </button>
);

export default DeveloperSettings;
