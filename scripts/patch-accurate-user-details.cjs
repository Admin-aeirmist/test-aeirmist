const fs = require('fs');
const path = require('path');

function normalize(s) {
  return s.replace(/\r\n/g, '\n');
}

// 1. Patch src/utils/identityUtils.ts to extract all avatar fields and accountId
const idUtilsPath = path.join(__dirname, '..', 'src', 'utils', 'identityUtils.ts');
let idUtilsContent = normalize(fs.readFileSync(idUtilsPath, 'utf8'));

const oldPhotoLine = `photoURL: isAnonymized ? null : (record.photoURL || null),`;
const newPhotoLine = `photoURL: isAnonymized ? null : (
      record.photoURL || 
      record.avatarUrl || 
      record.avatar_url || 
      record.profilePicture || 
      record.profilePic || 
      record.avatar || 
      record.avatarKey || 
      record.image || 
      record.picture || 
      null
    ),
    accountId: record.accountId || record.id_num || record.idNum || record.account_id || null,`;

if (idUtilsContent.includes(oldPhotoLine)) {
  idUtilsContent = idUtilsContent.replace(oldPhotoLine, newPhotoLine);
  fs.writeFileSync(idUtilsPath, idUtilsContent, 'utf8');
  console.log('✅ Enhanced normalizeAdminUser in identityUtils.ts');
} else {
  console.log('ℹ️ Photo line in identityUtils already patched or different');
}

// 2. Patch src/components/admin/AdminPanel.tsx
const adminPanelPath = path.join(__dirname, '..', 'src', 'components', 'admin', 'AdminPanel.tsx');
let adminContent = normalize(fs.readFileSync(adminPanelPath, 'utf8'));

// A. Ensure Copy and resolveAvatarSrc are imported
if (!adminContent.includes('resolveAvatarSrc')) {
  adminContent = adminContent.replace(
    "import { getAvatarUrl } from '../../lib/avatar';",
    "import { getAvatarUrl, resolveAvatarSrc } from '../../lib/avatar';"
  );
  console.log('✅ Imported resolveAvatarSrc');
}

if (!adminContent.includes('  Copy,\n')) {
  adminContent = adminContent.replace(
    '  MapPin\n} from \'lucide-react\';',
    '  MapPin,\n  Copy\n} from \'lucide-react\';'
  );
  console.log('✅ Imported Copy icon');
}

// B. Add UserAvatarBadge helper component right above UsersTab
const userAvatarBadgeComponent = `// Ultra-clean accurate User Avatar Badge with real photo + vibrant initial gradient fallback
const UserAvatarBadge = ({ user, className = '' }: { user: any; className?: string }) => {
  const [imgError, setImgError] = useState(false);

  const rawPhoto = user?.photoURL || 
    user?.avatarUrl || 
    user?.avatar_url || 
    user?.profilePicture || 
    user?.profilePic || 
    user?.avatar || 
    user?.avatarKey || 
    user?.image || 
    user?.picture ||
    (user?.rawRecord && (user.rawRecord.photoURL || user.rawRecord.avatarUrl || user.rawRecord.profilePicture || user.rawRecord.avatarKey));

  const resolvedPhoto = resolveAvatarSrc(rawPhoto);
  const isRealPhoto = resolvedPhoto && 
    !resolvedPhoto.includes('BLANK_DP') && 
    !resolvedPhoto.startsWith('data:image/svg+xml') && 
    !resolvedPhoto.includes('blank') &&
    resolvedPhoto !== 'null' &&
    resolvedPhoto !== 'undefined';

  const name = user?.displayName || user?.name || user?.username || 'User';
  const cleanName = String(name).replace(/^@+/, '').trim();
  const initial = (cleanName.charAt(0) || 'U').toUpperCase();

  const gradients = [
    'from-cyan-500 to-blue-600',
    'from-purple-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-pink-500 to-rose-600',
    'from-amber-500 to-orange-600',
    'from-violet-500 to-fuchsia-600',
    'from-teal-500 to-emerald-600',
    'from-blue-500 to-cyan-600'
  ];
  const hash = (cleanName + (user?.id || '')).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const gradientClass = gradients[hash % gradients.length];

  if (isRealPhoto && !imgError) {
    return (
      <img
        src={resolvedPhoto}
        alt={cleanName}
        onError={() => setImgError(true)}
        className={\`w-12 h-12 rounded-2xl object-cover border border-white/10 shadow-md shrink-0 bg-[#0c0f17] \${className}\`}
      />
    );
  }

  return (
    <div 
      className={\`w-12 h-12 rounded-2xl bg-gradient-to-br \${gradientClass} flex items-center justify-center font-bold text-base text-white border border-white/20 shadow-md shrink-0 select-none \${className}\`}
    >
      {initial}
    </div>
  );
};

const UsersTab = ({`;

if (adminContent.includes('const UsersTab = ({')) {
  adminContent = adminContent.replace('const UsersTab = ({', userAvatarBadgeComponent);
  console.log('✅ Added UserAvatarBadge component');
}

// C. Update row rendering in UsersTab
const oldRowRenderStart = `<img src={getAvatarUrl(u.photoURL, u.id)} alt="" className="w-12 h-12 rounded-2xl object-cover" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span 
                      onClick={() => setSelectedUserForDrawer(u)}
                      className="text-sm font-bold text-white hover:text-aeirmist-cyan cursor-pointer transition-colors"
                    >
                      {u.displayName || u.username || 'Anonymous Node'}
                    </span>
                    {u.isVerified && (
                      <span 
                        onClick={(e) => { e.stopPropagation(); setVerificationModalUser(u); }}
                        className={\`inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded font-mono border cursor-pointer hover:scale-105 transition-all \${
                          u.verificationPlan === 'essential' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                          u.verificationPlan === 'business' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                          'bg-cyan-500/20 text-aeirmist-cyan border-cyan-500/30'
                        }\`}
                        title="Click to manage Meta verification plan"
                      >
                        <ShieldCheck size={11} />
                        <span>{u.verificationPlan ? u.verificationPlan.toUpperCase() : 'VERIFIED'}</span>
                      </span>
                    )}
                    <span className="text-[9px] font-mono text-white/30 px-1.5 py-0.5 rounded bg-white/5">@{u.username || 'unknown'}</span>`;

const newRowRenderStart = `<UserAvatarBadge user={u} />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span 
                      onClick={() => setSelectedUserForDrawer(u)}
                      className="text-sm font-bold text-white hover:text-aeirmist-cyan cursor-pointer transition-colors"
                    >
                      {u.displayName || (u.username ? \`@\${String(u.username).replace(/^@+/, '')}\` : 'Aeirmist Member')}
                    </span>
                    {Boolean(u.isVerified || u.verified || u.badge === 'verified' || u.isAdmin) && (
                      <span 
                        onClick={(e) => { e.stopPropagation(); setVerificationModalUser(u); }}
                        className={\`inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded font-mono border cursor-pointer hover:scale-105 transition-all \${
                          u.verificationPlan === 'essential' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                          u.verificationPlan === 'business' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                          'bg-cyan-500/20 text-aeirmist-cyan border-cyan-500/30'
                        }\`}
                        title="Click to manage verification plan"
                      >
                        <ShieldCheck size={11} />
                        <span>{u.verificationPlan ? u.verificationPlan.toUpperCase() : 'VERIFIED'}</span>
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-aeirmist-cyan font-bold px-2 py-0.5 rounded-lg bg-aeirmist-cyan/10 border border-aeirmist-cyan/20 flex items-center gap-0.5">
                      <span className="text-white/40">@</span>
                      <span>{String(u.username || u.handle || 'user').replace(/^@+/, '')}</span>
                    </span>`;

if (adminContent.includes(oldRowRenderStart)) {
  adminContent = adminContent.replace(oldRowRenderStart, newRowRenderStart);
  console.log('✅ Replaced avatar and username header in row');
}

// D. Replace truncated UID with accurate ID & 1-click copy
const oldUidSnippet = `<div className="flex items-center gap-3 mt-1">
                    <p className="text-[9px] font-mono text-white/40 uppercase">UID: {u.uid ? \`\${u.uid.slice(0, 12)}...\` : 'UNKNOWN'}</p>
                    <div className="w-1 h-1 rounded-full bg-white/10" />
                    <p className="text-[9px] font-mono text-white/40 uppercase">Level: {u.aeirmistLevel || 0} AP</p>
                  </div>`;

const newUidSnippet = `<div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        const fullId = String(u.accountId || u.id_num || u.idNum || (u.uid ? (u.uid.startsWith('profile_') ? u.uid.replace('profile_', '') : u.uid) : (u.id ? (u.id.startsWith('profile_') ? u.id.replace('profile_', '') : u.id) : 'N/A')));
                        navigator.clipboard.writeText(fullId);
                        addToast({ title: 'ID Copied', message: \`Copied User ID: \${fullId}\`, type: 'success' });
                      }}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-mono text-white/70 cursor-pointer group/id transition-colors"
                      title="Click to copy exact User ID"
                    >
                      <span className="text-white/30 uppercase text-[9px] font-bold">ID:</span>
                      <span className="text-white/90 group-hover/id:text-aeirmist-cyan font-bold tracking-wide">
                        {String(u.accountId || u.id_num || u.idNum || (u.uid ? (u.uid.startsWith('profile_') ? u.uid.replace('profile_', '') : u.uid) : (u.id ? (u.id.startsWith('profile_') ? u.id.replace('profile_', '') : u.id) : 'N/A')))}
                      </span>
                      <Copy size={10} className="text-white/30 group-hover/id:text-aeirmist-cyan transition-colors" />
                    </div>

                    <div className="w-1 h-1 rounded-full bg-white/10" />
                    <p className="text-[10px] font-mono text-white/40 uppercase">Level: {u.aeirmistLevel || 0} AP</p>
                  </div>`;

if (adminContent.includes(oldUidSnippet)) {
  adminContent = adminContent.replace(oldUidSnippet, newUidSnippet);
  console.log('✅ Replaced truncated UID with accurate ID with 1-click copy');
}

// E. Update Drawer Avatar and ID
const oldDrawerAvatar = `<img 
                      src={getAvatarUrl(selectedUserForDrawer.photoURL, selectedUserForDrawer.id)} 
                      alt="" 
                      className="w-14 h-14 rounded-2xl object-cover border border-white/10" 
                    />`;

const newDrawerAvatar = `<UserAvatarBadge user={selectedUserForDrawer} className="w-14 h-14 text-xl" />`;

if (adminContent.includes(oldDrawerAvatar)) {
  adminContent = adminContent.replace(oldDrawerAvatar, newDrawerAvatar);
  console.log('✅ Updated Drawer avatar');
}

const oldDrawerUid = `<span className="text-[10px] text-aeirmist-cyan font-bold">UID: {selectedUserForDrawer.uid || selectedUserForDrawer.id || 'N/A'}</span>`;
const newDrawerUid = `<span 
                        onClick={() => {
                          const drawerId = String(selectedUserForDrawer.accountId || selectedUserForDrawer.id_num || selectedUserForDrawer.uid || selectedUserForDrawer.id || 'N/A');
                          navigator.clipboard.writeText(drawerId);
                          addToast({ title: 'ID Copied', message: \`Copied ID: \${drawerId}\`, type: 'success' });
                        }}
                        className="text-[10px] text-aeirmist-cyan font-bold hover:underline cursor-pointer flex items-center gap-1"
                        title="Click to copy exact ID"
                      >
                        ID: {String(selectedUserForDrawer.accountId || selectedUserForDrawer.id_num || selectedUserForDrawer.uid || selectedUserForDrawer.id || 'N/A')}
                        <Copy size={9} />
                      </span>`;

if (adminContent.includes(oldDrawerUid)) {
  adminContent = adminContent.replace(oldDrawerUid, newDrawerUid);
  console.log('✅ Updated Drawer ID with copy action');
}

fs.writeFileSync(adminPanelPath, adminContent, 'utf8');
console.log('🎉 Done patching accurate profile picture, username, and user ID!');
