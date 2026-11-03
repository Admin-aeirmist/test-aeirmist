const fs = require('fs');
const path = require('path');

function normalize(s) {
  return s.replace(/\r\n/g, '\n');
}

const adminPanelPath = path.join(__dirname, '..', 'src', 'components', 'admin', 'AdminPanel.tsx');
let adminContent = normalize(fs.readFileSync(adminPanelPath, 'utf8'));

const startTag = '// Ultra-clean accurate User Avatar Badge';
const endTag = 'const UsersTab = ({';

const startIdx = adminContent.indexOf(startTag);
const endIdx = adminContent.indexOf(endTag);

if (startIdx === -1 || endIdx === -1) {
  console.error('Slice boundaries not found!');
  process.exit(1);
}

const newAvatarBadge = `// Accurate User Avatar Badge: real photo if uploaded, otherwise sleek clean blank silhouette
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

  if (isRealPhoto && !imgError) {
    return (
      <img
        src={resolvedPhoto}
        alt=""
        onError={() => setImgError(true)}
        className={\`w-12 h-12 rounded-2xl object-cover border border-white/10 shadow-md shrink-0 bg-[#0c0f17] \${className}\`}
      />
    );
  }

  // Blank avatar for accounts without an uploaded picture (as requested)
  return (
    <div 
      className={\`w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-white/30 shrink-0 select-none \${className}\`}
    >
      <User size={22} className="text-white/30" />
    </div>
  );
};

`;

adminContent = adminContent.substring(0, startIdx) + newAvatarBadge + adminContent.substring(endIdx);
fs.writeFileSync(adminPanelPath, adminContent, 'utf8');
console.log('✅ Updated UserAvatarBadge to keep blank fallback for users without photos!');
