const fs = require('fs');
const path = require('path');

function normalize(s) {
  return s.replace(/\r\n/g, '\n');
}

// ==========================================
// 1. PATCH functions/api/[[route]].ts
// ==========================================
const routePath = path.join(__dirname, '..', 'functions', 'api', '[[route]].ts');
let routeContent = normalize(fs.readFileSync(routePath, 'utf8'));

const adminUsersRoute = `  // Admin: Users List (Fast edge response, excluding Era AI & system bots)
  if (path === "/api/v1/admin/users" && method === "GET") {
    const isAi = (u: any) => {
      const id = String(u?.id || u?.uid || u?.accountId || '').toLowerCase();
      const username = String(u?.username || u?.profile?.username || '').toLowerCase();
      const role = String(u?.role || u?.profile?.role || '').toLowerCase();
      const name = String(u?.displayName || u?.profile?.displayName || '').toLowerCase();
      return id.startsWith('00000000-') || id === 'era' || username === 'era' || username === 'era_ai' || role === 'ai_assistant' || name === 'era ai';
    };

    const uniqueUsersMap = new Map<string, any>();
    for (const u of Array.from(usersMap.values())) {
      const uid = u?.id || u?.uid || u?.accountId;
      if (uid && !uniqueUsersMap.has(uid) && !isAi(u)) {
        uniqueUsersMap.set(uid, u);
      }
    }
    const users = Array.from(uniqueUsersMap.values()).map((u: any) => ({
      ...u,
      profile: u.profile || u
    }));
    return new Response(JSON.stringify({ users, total: users.length }), { status: 200, headers: CORS_HEADERS });
  }

  // Admin: Audit Logs`;

if (!routeContent.includes('path === "/api/v1/admin/users" && method === "GET"')) {
  routeContent = routeContent.replace('  // Admin: Audit Logs', adminUsersRoute);
  fs.writeFileSync(routePath, routeContent, 'utf8');
  console.log('✅ Added /api/v1/admin/users endpoint to functions/api/[[route]].ts');
} else {
  console.log('ℹ️ /api/v1/admin/users already present in [[route]].ts');
}

// ==========================================
// 2. PATCH src/components/admin/AdminPanel.tsx
// ==========================================
const adminPanelPath = path.join(__dirname, '..', 'src', 'components', 'admin', 'AdminPanel.tsx');
let adminContent = normalize(fs.readFileSync(adminPanelPath, 'utf8'));

// A. Pass initialUsers={allProfiles} to UsersTab
const usersTabCall = `{activeTab === 'users' && (
            <UsersTab 
              db={db} 
              addToast={addToast} 
              purgeUser={purgeUser} 
              toggleUserBan={toggleUserBan} 
              toggleVerification={toggleVerification} 
              updateUserStatus={updateUserStatus}
              suspendUser={suspendUser}
              onOpenAddAdmin={() => setIsAddAdminOpen(true)}
            />
          )}`;

const usersTabCallWithInitial = `{activeTab === 'users' && (
            <UsersTab 
              db={db} 
              initialUsers={allProfiles}
              addToast={addToast} 
              purgeUser={purgeUser} 
              toggleUserBan={toggleUserBan} 
              toggleVerification={toggleVerification} 
              updateUserStatus={updateUserStatus}
              suspendUser={suspendUser}
              onOpenAddAdmin={() => setIsAddAdminOpen(true)}
            />
          )}`;

if (adminContent.includes(usersTabCall)) {
  adminContent = adminContent.replace(usersTabCall, usersTabCallWithInitial);
  console.log('✅ Passed initialUsers={allProfiles} into UsersTab');
}

// B. Update UsersTab signature and state initialization
const oldUsersTabHeader = `const UsersTab = ({ db, addToast, purgeUser, toggleUserBan, toggleVerification, updateUserStatus, suspendUser, onOpenAddAdmin }: { db: any; addToast: any; purgeUser: any; toggleUserBan: any; toggleVerification: any; updateUserStatus: any; suspendUser: any; onOpenAddAdmin: () => void }) => {
  const { auth } = useAeirmist();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);`;

const newUsersTabHeader = `const UsersTab = ({ 
  db, 
  initialUsers = [],
  addToast, 
  purgeUser, 
  toggleUserBan, 
  toggleVerification, 
  updateUserStatus, 
  suspendUser, 
  onOpenAddAdmin 
}: { 
  db: any; 
  initialUsers?: any[];
  addToast: any; 
  purgeUser: any; 
  toggleUserBan: any; 
  toggleVerification: any; 
  updateUserStatus: any; 
  suspendUser: any; 
  onOpenAddAdmin: () => void;
}) => {
  const { auth } = useAeirmist();

  // Helper to strictly identify Era AI and system bots (they are not regular users)
  const isSystemOrAiUser = (u: any): boolean => {
    if (!u) return false;
    const uid = String(u.id || u.uid || u.accountId || '').toLowerCase().trim();
    const username = String(u.username || '').toLowerCase().trim();
    const displayName = String(u.displayName || u.name || '').toLowerCase().trim();
    const role = String(u.role || '').toLowerCase().trim();
    const email = String(u.email || '').toLowerCase().trim();

    return (
      uid === '00000000-0000-4000-a000-000000000001' ||
      uid.startsWith('00000000-') ||
      uid === 'era' ||
      uid === 'era_ai' ||
      username === 'era' ||
      username === 'era_ai' ||
      username === 'eraai' ||
      username === 'aeirmist_system' ||
      username === 'system' ||
      displayName === 'era ai' ||
      displayName === 'era' ||
      displayName === 'aeirmist system' ||
      role === 'ai_assistant' ||
      role === 'system' ||
      role === 'bot' ||
      email === 'era@aeirmist.com' ||
      email === 'era.ai@aeirmist.com' ||
      email === 'system@aeirmist.com'
    );
  };

  const [users, setUsers] = useState<any[]>(() => {
    if (Array.isArray(initialUsers) && initialUsers.length > 0) {
      return initialUsers.map((u: any) => normalizeAdminUser(u)).filter(u => !isSystemOrAiUser(u));
    }
    try {
      const cached = sessionStorage.getItem('aeirmist_cached_admin_users');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter(u => !isSystemOrAiUser(u));
        }
      }
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState<boolean>(() => users.length === 0);`;

if (adminContent.includes(oldUsersTabHeader)) {
  adminContent = adminContent.replace(oldUsersTabHeader, newUsersTabHeader);
  console.log('✅ Updated UsersTab state and isSystemOrAiUser filter');
} else {
  console.log('⚠️ oldUsersTabHeader not matched directly, checking snippet...');
}

// C. Update UsersTab useEffect
const oldUsersEffect = `  useEffect(() => {
    if (!db) return;
    let isMounted = true;
    const loadFromApi = async () => {
      try {
        const res = await api.admin.getUsers();
        if (res && res.users && res.users.length > 0 && isMounted) {
          setUsers(prev => {
            if (prev.length === 0) {
              return res.users.map((u: any) => normalizeAdminUser(u.profile || u));
            }
            return prev;
          });
        }
      } catch (e) {
        logger.warn('Users fallback load from API:', e);
      }
    };
    loadFromApi();

    const unsub = onSnapshot(collection(db, 'profiles'), (snapshot) => {
      if (snapshot.docs.length > 0) {
        setUsers(snapshot.docs.map(d => normalizeAdminUser({ id: d.id, ...d.data() })));
      } else {
        loadFromApi();
      }
      setLoading(false);
    }, (err) => {
      logger.warn("Profiles list error:", err);
      loadFromApi().finally(() => setLoading(false));
    });
    return () => {
      isMounted = false;
      unsub();
    };
  }, [db]);`;

const newUsersEffect = `  useEffect(() => {
    let isMounted = true;

    // Safety timeout: Maximum 350ms loading spinner so it never hangs
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 350);

    const syncUsersState = (incomingList: any[]) => {
      if (!isMounted || !Array.isArray(incomingList)) return;
      const normalized = incomingList
        .map((u: any) => normalizeAdminUser(u.profile || u))
        .filter(u => !isSystemOrAiUser(u));

      if (normalized.length > 0) {
        setUsers(normalized);
        setLoading(false);
        try {
          sessionStorage.setItem('aeirmist_cached_admin_users', JSON.stringify(normalized.slice(0, 150)));
        } catch {}
      }
    };

    // If initialUsers became available from parent AdminPanel, sync immediately
    if (Array.isArray(initialUsers) && initialUsers.length > 0) {
      syncUsersState(initialUsers);
    }

    // 1. Fast load from edge backend (<15ms)
    api.admin.getUsers()
      .then((res) => {
        if (res && Array.isArray(res.users) && res.users.length > 0) {
          syncUsersState(res.users);
        }
      })
      .catch((err) => {
        logger.warn('Users API load error:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    // 2. Real-time Firestore sync
    if (db) {
      const unsub = onSnapshot(collection(db, 'profiles'), (snapshot) => {
        if (snapshot.docs.length > 0) {
          syncUsersState(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        if (isMounted) setLoading(false);
      }, (err) => {
        logger.warn("Profiles list error:", err);
        if (isMounted) setLoading(false);
      });

      return () => {
        isMounted = false;
        clearTimeout(safetyTimer);
        unsub();
      };
    }

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, [db, initialUsers]);`;

if (adminContent.includes(oldUsersEffect)) {
  adminContent = adminContent.replace(oldUsersEffect, newUsersEffect);
  console.log('✅ Updated UsersTab useEffect with instant edge sync and safety timer');
}

// D. Update filteredUsers and loading return
const oldFilteredUsers = `  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.username?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.accountId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterRole === 'VERIFIED') return matchesSearch && u.isVerified;
    if (filterRole === 'ADMIN') return matchesSearch && (u.isAdmin || (u.role && u.role.toLowerCase() !== 'user'));
    if (filterRole === 'BANNED') return matchesSearch && (u.isBanned || u.status === 'BANNED' || u.status === 'SUSPENDED');
    if (filterRole === 'PREMIUM') return matchesSearch && u.creatorModeEnabled;
    return matchesSearch;
  });

  if (loading) return <div className="p-12 flex justify-center"><RefreshCw className="animate-spin text-aeirmist-cyan" /></div>;`;

const newFilteredUsers = `  const realUsers = users.filter(u => !isSystemOrAiUser(u));

  const filteredUsers = realUsers.filter(u => {
    const matchesSearch = 
      u.username?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.accountId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterRole === 'VERIFIED') return matchesSearch && u.isVerified;
    if (filterRole === 'ADMIN') return matchesSearch && (u.isAdmin || (u.role && u.role.toLowerCase() !== 'user'));
    if (filterRole === 'BANNED') return matchesSearch && (u.isBanned || u.status === 'BANNED' || u.status === 'SUSPENDED');
    if (filterRole === 'PREMIUM') return matchesSearch && u.creatorModeEnabled;
    return matchesSearch;
  });

  if (loading && realUsers.length === 0) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="animate-spin text-aeirmist-cyan" size={24} />
        <span className="text-xs font-mono text-white/40 uppercase tracking-widest">Loading Accounts Telemetry...</span>
      </div>
    );
  }`;

if (adminContent.includes(oldFilteredUsers)) {
  adminContent = adminContent.replace(oldFilteredUsers, newFilteredUsers);
  console.log('✅ Updated filteredUsers and unblocking loading condition');
}

// E. Update dropdown count from {users.length} to {realUsers.length}
const oldOptionAll = `<option value="ALL" className="bg-black">All Statuses ({users.length})</option>`;
const newOptionAll = `<option value="ALL" className="bg-black">All Statuses ({realUsers.length})</option>`;
if (adminContent.includes(oldOptionAll)) {
  adminContent = adminContent.replace(oldOptionAll, newOptionAll);
  console.log('✅ Updated dropdown count to realUsers.length');
}

fs.writeFileSync(adminPanelPath, adminContent, 'utf8');
console.log('🎉 Done patching fast users and removing Era AI!');
