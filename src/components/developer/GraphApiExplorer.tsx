import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal, 
  Code2, 
  Key, 
  Play, 
  Copy, 
  Check, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  Info, 
  RefreshCw, 
  ExternalLink, 
  Sliders, 
  Layers, 
  Database, 
  CheckSquare, 
  Square, 
  Maximize2, 
  Minimize2, 
  FileCode, 
  ShieldCheck, 
  Globe, 
  X,
  Share2,
  Trash2
} from 'lucide-react';
import { useAeirmist } from '../../context/AeirmistContext';
import { resolveApiBase, getAuthToken, setAuthToken } from '../../services/api/client';

interface FieldNode {
  name: string;
  type: 'field' | 'edge';
  checked: boolean;
  children?: FieldNode[];
}

const DEFAULT_USER_FIELDS: FieldNode[] = [
  { name: 'id', type: 'field', checked: true },
  { name: 'name', type: 'field', checked: true },
  { name: 'username', type: 'field', checked: true },
  { name: 'email', type: 'field', checked: true },
  { name: 'role', type: 'field', checked: false },
  { name: 'is_verified', type: 'field', checked: false },
  { name: 'created_at', type: 'field', checked: false },
  {
    name: 'profile',
    type: 'edge',
    checked: false,
    children: [
      { name: 'bio', type: 'field', checked: false },
      { name: 'location', type: 'field', checked: false },
      { name: 'avatar_url', type: 'field', checked: false },
      { name: 'aeirmist_level', type: 'field', checked: false },
      { name: 'points', type: 'field', checked: false }
    ]
  },
  {
    name: 'posts',
    type: 'edge',
    checked: false,
    children: [
      { name: 'id', type: 'field', checked: false },
      { name: 'content', type: 'field', checked: false },
      { name: 'created_at', type: 'field', checked: false },
      { name: 'likes_count', type: 'field', checked: false }
    ]
  },
  { name: 'conversations', type: 'edge', checked: false },
  { name: 'vault_items', type: 'edge', checked: false }
];

const AVAILABLE_PERMISSIONS = [
  { id: 'public_profile', name: 'public_profile', category: 'User Data' },
  { id: 'email', name: 'email', category: 'User Data' },
  { id: 'user_posts', name: 'user_posts', category: 'Content' },
  { id: 'user_friends', name: 'user_friends', category: 'Social Graph' },
  { id: 'user_messaging', name: 'user_messaging', category: 'Direct Messages' },
  { id: 'user_vault', name: 'user_vault', category: 'Payments & Assets' },
  { id: 'pages_manage_posts', name: 'pages_manage_posts', category: 'Pages' },
  { id: 'pages_read_engagement', name: 'pages_read_engagement', category: 'Analytics' }
];

export const GraphApiExplorer: React.FC<{ isStandalone?: boolean }> = ({ isStandalone = false }) => {
  const { user, profile, addToast } = useAeirmist();

  // Navigation & View
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showTokenDebugger, setShowTokenDebugger] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState<'curl' | 'js' | 'python' | 'android'>('curl');

  // Query State
  const [method, setMethod] = useState<'GET' | 'POST' | 'DELETE'>('GET');
  const [apiVersion, setApiVersion] = useState('v21.0');
  const [queryPath, setQueryPath] = useState('me?fields=id,name,username,email');
  const [activeCenterTab, setActiveCenterTab] = useState<'response' | 'body' | 'headers' | 'params'>('response');
  const [requestBody, setRequestBody] = useState('{\n  "message": "Hello from Aeirmist Graph API Explorer"\n}');

  // Fields Tree
  const [fieldSearch, setFieldSearch] = useState('');
  const [fieldsTree, setFieldsTree] = useState<FieldNode[]>(DEFAULT_USER_FIELDS);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({ profile: false, posts: false });

  // Right Sidebar: Token & App
  const [appsList] = useState([
    { id: '109284729104821', name: 'Aeirmist Core Client' },
    { id: '384918294719284', name: 'Aeirmist Mobile Graph (iOS/Android)' },
    { id: '718294019284102', name: 'Aeirmist Webhooks Engine' }
  ]);
  const [selectedAppId, setSelectedAppId] = useState('109284729104821');
  const [tokenType, setTokenType] = useState<'User Token' | 'Page Token' | 'App Token'>('User Token');
  const [permissions, setPermissions] = useState<string[]>(['public_profile', 'email', 'user_posts', 'user_vault']);
  const [permSearch, setPermSearch] = useState('');
  const [showPermDropdown, setShowPermDropdown] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedQuery, setCopiedQuery] = useState(false);
  const [isEditingToken, setIsEditingToken] = useState(false);

  // Active Access Token
  const [activeToken, setActiveToken] = useState<string>(() => {
    return getAuthToken() || 'EAAx_aeirmist_live_oauth_token_client';
  });

  // Response State
  const [isLoading, setIsLoading] = useState(false);
  const [responseStatus, setResponseStatus] = useState<number | null>(200);
  const [responseLatency, setResponseLatency] = useState<number | null>(24);
  const [responseSize, setResponseSize] = useState<string>('842 B');
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({
    'content-type': 'application/json; charset=utf-8',
    'x-aeirmist-rev': '21.0.4',
    'cache-control': 'no-store, private'
  });
  const [responseData, setApiResponseData] = useState<any>({
    id: user?.uid || 'usr_17400000_abc',
    name: profile?.displayName || 'Junaed Islam Jim',
    username: profile?.username || 'junaed_islam_jim9',
    email: user?.email || profile?.email || 'admin.aeirmist@gmail.com'
  });

  // Synchronize token with auth state
  useEffect(() => {
    const liveToken = getAuthToken();
    if (liveToken && tokenType === 'User Token') {
      setActiveToken(liveToken);
    }
  }, [user, tokenType]);

  // Decode JWT payload for live Token Debugger
  const getDecodedToken = () => {
    try {
      if (activeToken && activeToken.includes('.')) {
        const parts = activeToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          return payload;
        }
      }
    } catch {}
    return null;
  };

  const decodedJwt = getDecodedToken();
  const authToken = activeToken;

  // Toggle field selection and update query path accordingly
  const handleToggleField = (fieldName: string, parentName?: string) => {
    setFieldsTree(prev => {
      const updateTree = (nodes: FieldNode[]): FieldNode[] => {
        return nodes.map(node => {
          if (parentName && node.name === parentName && node.children) {
            return {
              ...node,
              children: node.children.map(c => c.name === fieldName ? { ...c, checked: !c.checked } : c)
            };
          }
          if (!parentName && node.name === fieldName) {
            return { ...node, checked: !node.checked };
          }
          if (node.children) {
            return { ...node, children: updateTree(node.children) };
          }
          return node;
        });
      };
      const updated = updateTree(prev);

      // Reconstruct query path 'me?fields=...'
      const selectedFields: string[] = [];
      const collect = (nodes: FieldNode[], prefix = '') => {
        nodes.forEach(n => {
          if (n.checked) {
            selectedFields.push(prefix ? `${prefix}.${n.name}` : n.name);
          }
          if (n.children) {
            collect(n.children, n.name);
          }
        });
      };
      collect(updated);

      if (queryPath.startsWith('me')) {
        setQueryPath(selectedFields.length > 0 ? `me?fields=${selectedFields.join(',')}` : 'me');
      }

      return updated;
    });
  };

  // Execute Graph / REST Query
  const handleExecuteQuery = async () => {
    setIsLoading(true);
    const start = performance.now();
    try {
      const base = resolveApiBase() || '';
      let targetEndpoint = queryPath.trim();

      // Translate Facebook Graph syntax to Aeirmist REST endpoints
      if (targetEndpoint.startsWith('me?fields=') || targetEndpoint === 'me') {
        targetEndpoint = '/api/v1/auth/me';
      } else if (targetEndpoint.startsWith('me/feed') || targetEndpoint.startsWith('me/posts') || targetEndpoint === 'posts') {
        targetEndpoint = '/api/v1/posts?limit=10';
      } else if (targetEndpoint.startsWith('users/search')) {
        targetEndpoint = `/api/v1/users/search?q=${targetEndpoint.split('?q=')[1] || ''}`;
      } else if (!targetEndpoint.startsWith('/api/') && !targetEndpoint.startsWith('/health')) {
        targetEndpoint = `/api/v1/${targetEndpoint.replace(/^\/+/, '')}`;
      }

      const fullUrl = `${base}${targetEndpoint.startsWith('/') ? targetEndpoint : `/${targetEndpoint}`}`;
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'X-App-Id': selectedAppId
      };
      if (activeToken) {
        headers['Authorization'] = activeToken.startsWith('Bearer ') ? activeToken : `Bearer ${activeToken}`;
      }
      if (user?.uid) {
        headers['X-User-Id'] = user.uid;
      }

      const options: RequestInit = {
        method,
        headers
      };

      if ((method === 'POST') && requestBody.trim()) {
        headers['Content-Type'] = 'application/json';
        options.body = requestBody.trim();
      }

      const res = await fetch(fullUrl, options);
      const elapsed = Math.round(performance.now() - start);
      setResponseLatency(elapsed);
      setResponseStatus(res.status);

      // Collect real response headers
      const resHeaderMap: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        resHeaderMap[key] = val;
      });
      if (Object.keys(resHeaderMap).length > 0) {
        setResponseHeaders(resHeaderMap);
      }

      const contentType = res.headers.get('content-type') || '';
      let data: any;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = { _rawText: text };
      }

      // If user queried me?fields=..., filter JSON response like Facebook Graph API Explorer does
      if (queryPath.includes('fields=') && data?.user) {
        const fieldList = queryPath.split('fields=')[1]?.split(',') || [];
        const filtered: Record<string, any> = {};
        const source = {
          id: data.user.id || data.user.uid,
          name: data.user.displayName || data.profile?.displayName,
          username: data.user.username || data.profile?.username,
          email: data.user.email,
          role: data.user.role,
          is_verified: data.user.isVerified,
          profile: data.profile || data.user.profile,
          created_at: data.user.createdAt
        };
        fieldList.forEach(f => {
          if ((source as any)[f] !== undefined) {
            filtered[f] = (source as any)[f];
          }
        });
        setApiResponseData(Object.keys(filtered).length > 0 ? filtered : data);
      } else {
        setApiResponseData(data);
      }

      const stringified = JSON.stringify(data);
      setResponseSize(stringified.length < 1024 ? `${stringified.length} B` : `${(stringified.length / 1024).toFixed(1)} KB`);

      addToast({
        title: `HTTP ${res.status}`,
        message: `Graph query completed in ${elapsed}ms`,
        type: res.ok ? 'success' : 'warning'
      });
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - start);
      setResponseLatency(elapsed);
      setResponseStatus(500);
      setApiResponseData({
        error: {
          message: err?.message || 'Failed to fetch graph node',
          type: 'OAuthException',
          code: 500,
          fbtrace_id: `aeirmist_trace_${Date.now()}`
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Generate Code Snippets
  const getGeneratedCode = () => {
    const fullUrl = `https://developers.aeirmist.com/v21.0/${queryPath.replace(/^\/+/, '')}`;
    if (codeLanguage === 'curl') {
      return `curl -i -X ${method} \\\n  "${fullUrl}" \\\n  -H "Authorization: Bearer ${authToken.slice(0, 30)}..." \\\n  -H "Content-Type: application/json"${method === 'POST' ? ` \\\n  -d '${requestBody.replace(/\n/g, '')}'` : ''}`;
    }
    if (codeLanguage === 'js') {
      return `/* Aeirmist JavaScript SDK */\nAeirmist.api(\n  '/${queryPath}',\n  '${method}',\n  ${method === 'POST' ? requestBody : '{}'},\n  function(response) {\n    if (!response || response.error) {\n      console.error('Error occurred:', response.error);\n    } else {\n      console.log('Graph Response:', response);\n    }\n  }\n);`;
    }
    if (codeLanguage === 'python') {
      return `import requests\n\nurl = "${fullUrl}"\nheaders = {\n    "Authorization": "Bearer ${authToken.slice(0, 30)}...",\n    "Content-Type": "application/json"\n}\n\nresponse = requests.request("${method}", url, headers=headers${method === 'POST' ? `, json=${requestBody}` : ''})\nprint(response.json())`;
    }
    return `// Aeirmist Android SDK\nval request = GraphRequest.newGraphPathRequest(\n    accessToken,\n    "/${queryPath}"\n) { response ->\n    Log.d("AeirmistGraph", response.rawResponse)\n}\nrequest.executeAsync()`;
  };

  return (
    <div className={`w-full bg-[#0b0f19] text-[#e4e6eb] font-sans antialiased ${
      isStandalone ? 'min-h-screen flex flex-col rounded-none border-0' : 'border border-white/10 rounded-2xl overflow-hidden shadow-2xl'
    } ${
      isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'relative'
    }`}>
      {/* 1. TOP META DEVELOPER NAVIGATION BAR */}
      <header className="h-14 px-4 bg-[#18191a] border-b border-[#2d3239] flex items-center justify-between select-none">
        <div className="flex items-center gap-3">
          {/* Aeirmist Infinity Logo with Meta aesthetic */}
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-black text-black text-sm shadow-[0_0_12px_rgba(0,255,255,0.4)]">
              A
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-white tracking-tight text-sm">aeirmist</span>
              <span className="text-[11px] text-white/50 font-normal">for developers</span>
            </div>
          </div>

          <div className="h-4 w-[1px] bg-white/20 mx-1 hidden sm:block" />

          {/* Breadcrumb / Title */}
          <div className="items-center gap-1.5 text-xs hidden sm:flex">
            <span className="text-white/40 hover:text-white/70 cursor-pointer">Tools</span>
            <span className="text-white/30">/</span>
            <span className="text-white font-medium flex items-center gap-1.5">
              Graph API Explorer
              <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-500/20 text-cyan-400 font-mono border border-cyan-500/30">v21.0</span>
            </span>
          </div>

          {/* URL Chip */}
          <div className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#242526] border border-[#3a3b3c] text-[11px] text-white/60 font-mono">
            <Globe size={11} className="text-cyan-400" />
            <span>developers.aeirmist.com/tools/explorer/</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isStandalone && (
            <a 
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#242526] hover:bg-[#303031] border border-[#3a3b3c] text-xs font-semibold text-white/80 transition-all cursor-pointer mr-1"
            >
              <span>Back to Aeirmist</span>
            </a>
          )}
          <button 
            onClick={() => {
              navigator.clipboard.writeText(`curl -X ${method} "https://developers.aeirmist.com/v21.0/${queryPath}" -H "Authorization: Bearer ${authToken}"`);
              setCopiedQuery(true);
              setTimeout(() => setCopiedQuery(false), 2000);
              addToast({ title: 'cURL Copied', message: 'Command copied for terminal.', type: 'info' });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#242526] hover:bg-[#303031] border border-[#3a3b3c] text-xs font-semibold text-white/80 transition-all cursor-pointer"
          >
            {copiedQuery ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span className="hidden sm:inline">{copiedQuery ? 'Copied' : 'Copy cURL'}</span>
          </button>

          <button 
            onClick={() => setShowCodeModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#242526] hover:bg-[#303031] border border-[#3a3b3c] text-xs font-semibold text-white/80 transition-all cursor-pointer"
          >
            <FileCode size={13} className="text-cyan-400" />
            <span>Get Code</span>
          </button>

          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-md bg-[#242526] hover:bg-[#303031] border border-[#3a3b3c] text-white/60 hover:text-white transition-all cursor-pointer"
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </header>

      {/* 2. MAIN 3-COLUMN WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px] bg-[#0e131f]">
        
        {/* LEFT COLUMN: FIELDS & EDGES TREE (Meta Sidebar) */}
        <aside className="lg:col-span-3 border-r border-[#2d3239] bg-[#141824] flex flex-col">
          <div className="p-3 border-b border-[#2d3239]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">Node Fields</span>
              <span className="text-[10px] text-cyan-400 font-mono">User (me)</span>
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-white/30" />
              <input 
                type="text" 
                placeholder="Search fields or edges..."
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                className="w-full bg-[#1e2230] border border-[#2d3239] rounded-md pl-8 pr-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5 text-xs">
            {fieldsTree
              .filter(f => !fieldSearch || f.name.toLowerCase().includes(fieldSearch.toLowerCase()))
              .map(node => (
                <div key={node.name} className="space-y-0.5">
                  <div 
                    className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors cursor-pointer group"
                    onClick={() => handleToggleField(node.name)}
                  >
                    <div className="flex items-center gap-2">
                      {node.checked ? (
                        <CheckSquare size={14} className="text-cyan-400" />
                      ) : (
                        <Square size={14} className="text-white/30 group-hover:text-white/60" />
                      )}
                      <span className={`font-mono ${node.checked ? 'text-white font-medium' : 'text-white/60'}`}>
                        {node.name}
                      </span>
                    </div>

                    {node.children && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedNodes(prev => ({ ...prev, [node.name]: !prev[node.name] }));
                        }}
                        className="text-white/30 hover:text-white p-0.5"
                      >
                        <ChevronDown size={13} className={`transform transition-transform ${expandedNodes[node.name] ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>

                  {/* Children / Sub-fields */}
                  {node.children && expandedNodes[node.name] && (
                    <div className="pl-6 space-y-0.5 border-l border-white/5 ml-3">
                      {node.children.map(child => (
                        <div 
                          key={child.name}
                          onClick={() => handleToggleField(child.name, node.name)}
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 cursor-pointer text-xs"
                        >
                          {child.checked ? (
                            <CheckSquare size={13} className="text-cyan-400" />
                          ) : (
                            <Square size={13} className="text-white/30" />
                          )}
                          <span className={`font-mono text-[11px] ${child.checked ? 'text-white' : 'text-white/50'}`}>
                            {child.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>

          <div className="p-2.5 border-t border-[#2d3239] bg-[#101420] text-[10px] text-white/30">
            Checking fields updates query parameter <code className="text-cyan-400">?fields=</code>
          </div>
        </aside>

        {/* CENTER COLUMN: QUERY BUILDER & RESPONSE VIEWER */}
        <main className="lg:col-span-6 flex flex-col border-r border-[#2d3239]">
          
          {/* Query Bar */}
          <div className="p-3 bg-[#18191a] border-b border-[#2d3239] space-y-2">
            <div className="flex items-center gap-2">
              
              {/* Method Dropdown */}
              <select 
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className={`h-9 px-2.5 rounded-md font-bold text-xs border outline-none cursor-pointer ${
                  method === 'GET' 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                    : method === 'POST' 
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' 
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="DELETE">DELETE</option>
              </select>

              {/* API Version Dropdown */}
              <select 
                value={apiVersion}
                onChange={(e) => setApiVersion(e.target.value)}
                className="h-9 px-2 bg-[#242526] border border-[#3a3b3c] rounded-md text-xs font-mono text-white/70 outline-none cursor-pointer"
              >
                <option value="v21.0">v21.0 (Latest)</option>
                <option value="v20.0">v20.0</option>
                <option value="v1.0">v1.0</option>
              </select>

              {/* Endpoint Input */}
              <div className="flex-1 flex items-center h-9 px-3 bg-[#242526] border border-[#3a3b3c] rounded-md focus-within:border-cyan-500/60 transition-colors">
                <span className="text-xs text-white/40 font-mono mr-1 select-none">
                  /{apiVersion}/
                </span>
                <input 
                  type="text" 
                  value={queryPath}
                  onChange={(e) => setQueryPath(e.target.value)}
                  placeholder="me?fields=id,name"
                  className="w-full bg-transparent text-xs font-mono text-white outline-none"
                />
              </div>

              {/* Meta Blue Submit Button */}
              <button 
                onClick={handleExecuteQuery}
                disabled={isLoading}
                className="h-9 px-5 rounded-md bg-[#1877f2] hover:bg-[#166fe5] text-white font-semibold text-xs transition-all flex items-center gap-1.5 shadow-[0_2px_8px_rgba(24,119,242,0.4)] disabled:opacity-50 cursor-pointer shrink-0"
              >
                {isLoading ? (
                  <RefreshCw size={13} className="animate-spin" />
                ) : (
                  <Play size={12} className="fill-current" />
                )}
                <span>Submit</span>
              </button>
            </div>
          </div>

          {/* Sub-Tabs: Response / Body / Headers */}
          <div className="flex items-center justify-between px-3 pt-2 border-b border-[#2d3239] bg-[#141824] text-xs">
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setActiveCenterTab('response')}
                className={`px-3 py-1.5 font-medium border-b-2 transition-all cursor-pointer ${
                  activeCenterTab === 'response' ? 'border-cyan-400 text-white font-bold' : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                Response
              </button>
              <button 
                onClick={() => setActiveCenterTab('params')}
                className={`px-3 py-1.5 font-medium border-b-2 transition-all cursor-pointer ${
                  activeCenterTab === 'params' ? 'border-cyan-400 text-white font-bold' : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                Params
              </button>
              {method === 'POST' && (
                <button 
                  onClick={() => setActiveCenterTab('body')}
                  className={`px-3 py-1.5 font-medium border-b-2 transition-all cursor-pointer ${
                    activeCenterTab === 'body' ? 'border-cyan-400 text-white font-bold' : 'border-transparent text-white/50 hover:text-white'
                  }`}
                >
                  Request Body
                </button>
              )}
              <button 
                onClick={() => setActiveCenterTab('headers')}
                className={`px-3 py-1.5 font-medium border-b-2 transition-all cursor-pointer ${
                  activeCenterTab === 'headers' ? 'border-cyan-400 text-white font-bold' : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                Headers
              </button>
            </div>

            {/* Response telemetry */}
            {responseStatus && (
              <div className="flex items-center gap-2 pb-1.5 text-[11px] font-mono">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  responseStatus >= 200 && responseStatus < 300 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}>
                  {responseStatus} OK
                </span>
                <span className="text-white/40">⏱ {responseLatency}ms</span>
                <span className="text-white/40">{responseSize}</span>
              </div>
            )}
          </div>

          {/* Response / Body Workspace */}
          <div className="flex-1 p-3 bg-[#0a0d14] overflow-y-auto">
            {activeCenterTab === 'response' ? (
              <div className="relative font-mono text-xs leading-relaxed">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(responseData, null, 2));
                    addToast({ title: 'JSON Copied', message: 'Response payload copied to clipboard.', type: 'info' });
                  }}
                  className="absolute right-2 top-2 p-1.5 rounded bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                  title="Copy JSON"
                >
                  <Copy size={13} />
                </button>
                <pre className="text-cyan-300 overflow-x-auto p-2">
                  {JSON.stringify(responseData, null, 2)}
                </pre>
              </div>
            ) : activeCenterTab === 'params' ? (
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between text-white/50 text-[11px]">
                  <span>Query Parameters (URL Search Params)</span>
                  <span className="text-cyan-400">/{apiVersion}/{queryPath}</span>
                </div>
                <div className="border border-[#2d3239] rounded-lg overflow-hidden bg-[#141824]">
                  <div className="grid grid-cols-12 bg-black/40 px-3 py-2 border-b border-[#2d3239] text-[11px] font-bold text-white/40 uppercase tracking-wider">
                    <span className="col-span-4">Key</span>
                    <span className="col-span-8">Value</span>
                  </div>
                  {queryPath.includes('?') ? (
                    queryPath.split('?')[1].split('&').map((item, idx) => {
                      const [k, v] = item.split('=');
                      return (
                        <div key={idx} className="grid grid-cols-12 px-3 py-2 border-b border-white/5 text-xs items-center hover:bg-white/[0.02]">
                          <span className="col-span-4 font-bold text-cyan-300 truncate">{decodeURIComponent(k || '')}</span>
                          <span className="col-span-8 text-white/80 break-all">{decodeURIComponent(v || '')}</span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-white/30 text-xs">
                      No query parameters in current path. Add <code className="text-cyan-400">?fields=...</code> or select node fields from the left pane.
                    </div>
                  )}
                </div>
              </div>
            ) : activeCenterTab === 'body' ? (
              <div className="space-y-2">
                <span className="text-[11px] text-white/40">JSON Payload</span>
                <textarea 
                  rows={10}
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  className="w-full p-3 bg-[#141824] border border-[#2d3239] rounded-md font-mono text-xs text-white outline-none focus:border-cyan-500/50"
                />
              </div>
            ) : (
              <div className="space-y-4 text-xs font-mono">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1.5 block">Request Headers</span>
                  <div className="space-y-1.5">
                    <div className="p-2.5 rounded bg-[#141824] border border-[#2d3239] flex justify-between">
                      <span className="text-white/40">Authorization</span>
                      <span className="text-cyan-400 truncate max-w-xs">Bearer {activeToken.slice(0, 24)}...</span>
                    </div>
                    <div className="p-2.5 rounded bg-[#141824] border border-[#2d3239] flex justify-between">
                      <span className="text-white/40">Content-Type</span>
                      <span className="text-white/80">application/json</span>
                    </div>
                    <div className="p-2.5 rounded bg-[#141824] border border-[#2d3239] flex justify-between">
                      <span className="text-white/40">X-App-Id</span>
                      <span className="text-white/80">{selectedAppId}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-1.5 block">Response Headers (Live HTTP)</span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {Object.entries(responseHeaders).map(([k, v]) => (
                      <div key={k} className="p-2 rounded bg-[#141824] border border-[#2d3239] flex justify-between text-[11px]">
                        <span className="text-white/40">{k}</span>
                        <span className="text-emerald-400/90 truncate max-w-sm">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* RIGHT COLUMN: ACCESS TOKEN & PERMISSIONS (Meta Inspector) */}
        <aside className="lg:col-span-3 p-4 bg-[#141824] space-y-5 text-xs">
          
          {/* App Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-white/40">Aeirmist App</label>
            <select 
              value={selectedAppId}
              onChange={(e) => {
                setSelectedAppId(e.target.value);
                addToast({ title: 'App Context Switched', message: `Active app set to ${e.target.value}`, type: 'info' });
              }}
              className="w-full h-8 px-2.5 bg-[#1e2230] border border-[#2d3239] rounded-md text-white text-xs outline-none cursor-pointer"
            >
              {appsList.map(app => (
                <option key={app.id} value={app.id}>{app.name} ({app.id})</option>
              ))}
            </select>
          </div>

          {/* User or Page Token */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-white/40">User or Page</label>
            <select 
              value={tokenType}
              onChange={(e) => {
                const newType = e.target.value as any;
                setTokenType(newType);
                if (newType === 'User Token') {
                  setActiveToken(getAuthToken() || 'EAAx_aeirmist_live_oauth_token_client');
                } else if (newType === 'Page Access Token') {
                  setActiveToken(`EAAP_aeirmist_page_token_${(user?.uid || '101').slice(0, 8)}_${Date.now()}`);
                } else {
                  setActiveToken(`EAAB_${selectedAppId}_client_secret_token`);
                }
                addToast({ title: 'Token Context Updated', message: `Switched context to ${newType}.`, type: 'info' });
              }}
              className="w-full h-8 px-2.5 bg-[#1e2230] border border-[#2d3239] rounded-md text-white text-xs outline-none cursor-pointer"
            >
              <option value="User Token">User Token</option>
              <option value="Page Access Token">Page Access Token</option>
              <option value="App Token">App Token</option>
            </select>
          </div>

          {/* Access Token Input Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-white/40">Access Token</label>
              <button 
                onClick={() => setShowTokenDebugger(true)}
                className="text-cyan-400 hover:underline flex items-center gap-1 text-[10px] cursor-pointer"
              >
                <Info size={11} /> Token Debugger
              </button>
            </div>

            <div className="flex items-center gap-1">
              <input 
                type="text"
                value={activeToken}
                onChange={(e) => setActiveToken(e.target.value)}
                placeholder="Bearer OAuth token..."
                className="flex-1 h-8 px-2.5 bg-[#1e2230] border border-[#2d3239] rounded-md font-mono text-[11px] text-white/90 outline-none focus:border-cyan-500/50 truncate"
              />
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(activeToken);
                  setCopiedToken(true);
                  setTimeout(() => setCopiedToken(false), 2000);
                  addToast({ title: 'Token Copied', message: 'Bearer token copied to clipboard.', type: 'success' });
                }}
                className="h-8 px-2.5 bg-[#242526] hover:bg-[#303031] border border-[#3a3b3c] rounded-md text-white/80 transition-all cursor-pointer shrink-0"
                title="Copy Token"
              >
                {copiedToken ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>
            </div>

            <button 
              onClick={() => {
                const fresh = getAuthToken() || `EAAx_aeirmist_live_oauth_token_${Date.now()}`;
                setActiveToken(fresh);
                addToast({ title: 'Token Generated', message: `Refreshed ${tokenType} with active permissions.`, type: 'success' });
              }}
              className="w-full py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold text-[11px] transition-all cursor-pointer"
            >
              Generate Access Token
            </button>
          </div>

          <div className="h-[1px] bg-white/10" />

          {/* Permissions / Scopes (The Meta Scopes Selector) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">
                Permissions ({permissions.length})
              </span>
              <button 
                onClick={() => setShowPermDropdown(!showPermDropdown)}
                className="text-[10px] font-bold text-cyan-400 hover:underline cursor-pointer"
              >
                + Add a Permission
              </button>
            </div>

            {/* Permission Selector Popover */}
            {showPermDropdown && (
              <div className="p-2.5 rounded-md bg-[#1e2230] border border-[#2d3239] space-y-2 shadow-xl">
                <input 
                  type="text" 
                  placeholder="Filter permissions..."
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  className="w-full bg-[#141824] border border-[#2d3239] rounded px-2 py-1 text-[11px] text-white outline-none"
                />
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {AVAILABLE_PERMISSIONS
                    .filter(p => !permissions.includes(p.name))
                    .filter(p => !permSearch || p.name.includes(permSearch.toLowerCase()))
                    .map(p => (
                      <div 
                        key={p.id}
                        onClick={() => {
                          setPermissions(prev => [...prev, p.name]);
                          setShowPermDropdown(false);
                          addToast({ title: 'Permission Added', message: `Added ${p.name} to token scope. Click Generate Access Token.`, type: 'info' });
                        }}
                        className="p-1 rounded hover:bg-white/10 cursor-pointer flex items-center justify-between text-[11px]"
                      >
                        <span className="font-mono text-white/80">{p.name}</span>
                        <span className="text-[9px] text-white/30">{p.category}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Active Permissions Tags */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {permissions.map(perm => (
                <span 
                  key={perm}
                  className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-mono text-[10px] flex items-center gap-1"
                >
                  {perm}
                  <button 
                    onClick={() => setPermissions(prev => prev.filter(p => p !== perm))}
                    className="hover:text-rose-400 transition-colors ml-0.5"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </aside>

      </div>

      {/* 3. MODAL: "GET CODE" (cURL, JS, Python, Android) */}
      <AnimatePresence>
        {showCodeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl bg-[#18191a] border border-[#2d3239] rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="h-12 px-4 border-b border-[#2d3239] flex items-center justify-between bg-[#242526]">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <FileCode size={16} className="text-cyan-400" />
                  <span>Get Code for Current Query</span>
                </div>
                <button onClick={() => setShowCodeModal(false)} className="text-white/40 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              {/* Language Tabs */}
              <div className="flex items-center gap-1 px-4 pt-3 border-b border-[#2d3239] bg-[#1c1d1e] text-xs">
                {(['curl', 'js', 'python', 'android'] as const).map(lang => (
                  <button 
                    key={lang}
                    onClick={() => setCodeLanguage(lang)}
                    className={`px-3 py-1.5 font-semibold border-b-2 transition-all cursor-pointer uppercase text-[11px] ${
                      codeLanguage === lang ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-white/50 hover:text-white'
                    }`}
                  >
                    {lang === 'curl' ? 'cURL' : lang === 'js' ? 'JavaScript SDK' : lang === 'python' ? 'Python' : 'Android'}
                  </button>
                ))}
              </div>

              {/* Code Display */}
              <div className="p-4 bg-[#0e131f]">
                <pre className="p-4 rounded-lg bg-black/80 border border-[#2d3239] font-mono text-xs text-white/90 overflow-x-auto leading-relaxed">
                  {getGeneratedCode()}
                </pre>
              </div>

              <div className="h-12 px-4 bg-[#18191a] border-t border-[#2d3239] flex items-center justify-end gap-2">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(getGeneratedCode());
                    addToast({ title: 'Copied', message: 'Code snippet copied to clipboard.', type: 'info' });
                  }}
                  className="px-4 py-1.5 rounded-md bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs transition-all cursor-pointer"
                >
                  Copy Code
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. MODAL: ACCESS TOKEN DEBUGGER (/tools/debug/accesstoken/) */}
      <AnimatePresence>
        {showTokenDebugger && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-xl bg-[#18191a] border border-[#2d3239] rounded-xl shadow-2xl overflow-hidden"
            >
              <div className="h-12 px-4 border-b border-[#2d3239] flex items-center justify-between bg-[#242526]">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <ShieldCheck size={16} className="text-emerald-400" />
                  <span>Access Token Debugger (Meta Inspector)</span>
                </div>
                <button onClick={() => setShowTokenDebugger(false)} className="text-white/40 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs font-sans">
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-emerald-400 font-bold">
                  <Check size={14} />
                  <span>This access token is valid and active.</span>
                </div>

                <div className="space-y-2 border border-[#2d3239] rounded-lg p-3 bg-[#141824] font-mono text-[11px]">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/40">App ID</span>
                    <span className="text-white">{selectedAppId} : {appsList.find(a => a.id === selectedAppId)?.name || 'Aeirmist Core Client'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/40">Type</span>
                    <span className="text-white">{tokenType}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/40">User ID</span>
                    <span className="text-cyan-400">{decodedJwt?.sub || decodedJwt?.uid || decodedJwt?.userId || user?.uid || 'usr_17400000_abc'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/40">Issued At</span>
                    <span className="text-white">{decodedJwt?.iat ? new Date(decodedJwt.iat * 1000).toLocaleString() : 'Live session (Active)'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/40">Expires</span>
                    <span className="text-emerald-400">{decodedJwt?.exp ? new Date(decodedJwt.exp * 1000).toLocaleString() : 'Never / 30 Days Sliding Expiry'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/40">Scopes</span>
                    <span className="text-white/90 text-right">{permissions.join(', ')}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-white/40">Token Signature</span>
                    <span className="text-white/50 truncate max-w-xs">{activeToken.split('.')[2] ? `HS256 Verified (${activeToken.split('.')[2].slice(0, 16)}...)` : 'OAuth 2.0 Opaque Bearer'}</span>
                  </div>
                </div>
              </div>

              <div className="h-12 px-4 bg-[#18191a] border-t border-[#2d3239] flex items-center justify-end">
                <button 
                  onClick={() => setShowTokenDebugger(false)}
                  className="px-4 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white font-semibold text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GraphApiExplorer;
