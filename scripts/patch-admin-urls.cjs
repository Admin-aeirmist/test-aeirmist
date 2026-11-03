const fs = require('fs');
const path = require('path');

function normalize(s) {
  return s.replace(/\r\n/g, '\n');
}

// 1. Patch src/App.tsx
const appPath = path.join(__dirname, '..', 'src', 'App.tsx');
let appContent = normalize(fs.readFileSync(appPath, 'utf8'));

const oldAdminPathCase = "    case 'admin': return '/admin';";
const newAdminPathCase = `    case 'admin': {
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin/')) {
        return window.location.pathname;
      }
      return '/admin';
    }`;

if (appContent.includes(oldAdminPathCase)) {
  appContent = appContent.replace(oldAdminPathCase, newAdminPathCase);
  console.log('✅ Updated getPathForAppState in App.tsx');
}

const oldAdminInitCheck = "  if (lowerPath === '/admin-panel' || lowerPath === '/admin') {";
const newAdminInitCheck = "  if (lowerPath === '/admin-panel' || lowerPath === '/admin' || lowerPath.startsWith('/admin/')) {";

if (appContent.includes(oldAdminInitCheck)) {
  appContent = appContent.replace(oldAdminInitCheck, newAdminInitCheck);
  console.log('✅ Updated getInitialStateFromPath in App.tsx');
}

fs.writeFileSync(appPath, appContent, 'utf8');

// 2. Patch src/components/admin/AdminPanel.tsx
const adminPanelPath = path.join(__dirname, '..', 'src', 'components', 'admin', 'AdminPanel.tsx');
let adminContent = normalize(fs.readFileSync(adminPanelPath, 'utf8'));

// Replace activeTab state definition with URL-synced activeTab state
const oldStateDef = `export const AdminPanel = () => {
  const { user, profile, loading: authLoading, db, addToast, purgeUser, toggleUserBan, toggleVerification, updateUserStatus, suspendUser } = useAeirmist();
  const [isAdminUser, setIsAdminUser] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'reports' | 'appeals' | 'marketplace' | 'security' | 'roles' | 'flags' | 'logs' | 'verification' | 'tickets' | 'system'>('dashboard');`;

const newStateDef = `type AdminTab = 'dashboard' | 'users' | 'reports' | 'appeals' | 'marketplace' | 'security' | 'roles' | 'flags' | 'logs' | 'verification' | 'tickets' | 'system';

export const AdminPanel = () => {
  const { user, profile, loading: authLoading, db, addToast, purgeUser, toggleUserBan, toggleVerification, updateUserStatus, suspendUser } = useAeirmist();
  const [isAdminUser, setIsAdminUser] = useState<boolean | null>(null);

  // Helper to resolve exact tab from browser URL
  const getAdminTabFromLocation = (): AdminTab => {
    if (typeof window === 'undefined') return 'dashboard';
    const rawPath = window.location.pathname.toLowerCase().replace(/\\/+$/, '');
    const cleanSegment = rawPath.replace(/^\\/admin\\/?/, '');
    
    switch (cleanSegment) {
      case 'users':
      case 'user':
      case 'accounts':
        return 'users';
      case 'reports':
      case 'report':
      case 'moderation':
        return 'reports';
      case 'appeals':
      case 'appeal':
        return 'appeals';
      case 'tickets':
      case 'support':
      case 'inbox':
        return 'tickets';
      case 'verification':
      case 'verify':
      case 'verified':
        return 'verification';
      case 'marketplace':
      case 'pay':
      case 'payments':
      case 'pay-and-sub':
      case 'subscriptions':
        return 'marketplace';
      case 'security':
      case 'shield':
        return 'security';
      case 'roles':
      case 'permissions':
        return 'roles';
      case 'flags':
      case 'features':
        return 'flags';
      case 'logs':
      case 'audit':
      case 'audit-logs':
        return 'logs';
      case 'system':
      case 'health':
      case 'telemetry':
        return 'system';
      case 'dashboard':
      case '':
      default:
        return 'dashboard';
    }
  };

  const getAdminUrlForTab = (tab: AdminTab): string => {
    if (tab === 'dashboard') return '/admin';
    return \`/admin/\${tab}\`;
  };

  const [activeTab, setActiveTabState] = useState<AdminTab>(() => getAdminTabFromLocation());

  // Function to switch tab AND update browser URL
  const setActiveTab = (tab: AdminTab) => {
    setActiveTabState(tab);
    const targetUrl = getAdminUrlForTab(tab);
    if (typeof window !== 'undefined' && window.location.pathname !== targetUrl) {
      window.history.pushState({ _adminTab: tab }, '', targetUrl);
    }
  };

  // Sync with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const tab = getAdminTabFromLocation();
      setActiveTabState(tab);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Ensure current URL reflects the active tab on mount
  useEffect(() => {
    const currentTab = getAdminTabFromLocation();
    const correctUrl = getAdminUrlForTab(currentTab);
    if (window.location.pathname !== correctUrl && (window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/'))) {
      window.history.replaceState({ _adminTab: currentTab }, '', correctUrl);
    }
  }, []);`;

if (adminContent.includes(oldStateDef)) {
  adminContent = adminContent.replace(oldStateDef, newStateDef);
  console.log('✅ Added URL sync and history management in AdminPanel.tsx');
} else {
  console.error('❌ Could not find oldStateDef in AdminPanel.tsx');
}

// Update breadcrumb to show exact direct URL
const oldBreadcrumb = `<div className="flex items-center gap-2 text-[9px] font-mono text-white/40">
                <span>Aeirmist Core</span>
                <span>/</span>
                <span className="text-aeirmist-cyan font-bold uppercase">{activeTab}</span>
              </div>`;

const newBreadcrumb = `<div className="flex items-center gap-2 text-[9px] font-mono text-white/40">
                <span>Aeirmist Core</span>
                <span>/</span>
                <span className="text-aeirmist-cyan font-bold uppercase">{activeTab}</span>
                <span className="text-white/20">•</span>
                <span className="text-aeirmist-cyan/80 font-mono tracking-wider font-semibold">{getAdminUrlForTab(activeTab)}</span>
              </div>`;

if (adminContent.includes(oldBreadcrumb)) {
  adminContent = adminContent.replace(oldBreadcrumb, newBreadcrumb);
  console.log('✅ Updated breadcrumb with exact live URL');
}

fs.writeFileSync(adminPanelPath, adminContent, 'utf8');
console.log('🎉 Done patching exact URLs for every Admin Panel button!');
