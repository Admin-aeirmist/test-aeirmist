const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'src', 'components', 'feed', 'HomeFeedSystem.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Add imports if not present
if (!content.includes('LinkedInProfileCard')) {
  content = content.replace(
    "import { PremiumPostCard } from './PremiumPostCard';",
    "import { PremiumPostCard } from './PremiumPostCard';\nimport { LinkedInProfileCard } from './LinkedInProfileCard';\nimport { LinkedInPostComposer } from './LinkedInPostComposer';"
  );
}

if (!content.includes('ChevronDown')) {
  content = content.replace(
    '  Compass\n} from \'lucide-react\';',
    '  Compass,\n  ChevronDown\n} from \'lucide-react\';'
  );
  if (!content.includes('ChevronDown')) {
    content = content.replace(
      '  Compass\r\n} from \'lucide-react\';',
      '  Compass,\r\n  ChevronDown\r\n} from \'lucide-react\';'
    );
  }
}

// 2. Replace the feed container with the 3-column LinkedIn structure
const oldContainer = `<div className="w-full flex justify-center">
          
          {/* MAIN FEED COLUMN */}
          <div className="w-full max-w-[700px]">
            {/* NOTES & STORIES RESTORED */}
            <div className="mb-1">
              <StoriesSystem />
            </div>`;

const newContainer = `<div className="w-full flex justify-center gap-6 px-1 sm:px-4">
          
          {/* LEFT COLUMN: LinkedIn Profile & Identity Card */}
          <div className="hidden xl:block w-56 2xl:w-64 shrink-0">
            <LinkedInProfileCard onUserClick={onUserClick} onNavigate={onNavigate} />
          </div>

          {/* MAIN FEED COLUMN */}
          <div className="w-full max-w-[620px] min-w-0">
            {/* Top LinkedIn-Style Post Composer */}
            <LinkedInPostComposer onCreate={onCreate} onNavigate={onNavigate} />

            {/* NOTES & STORIES RESTORED */}
            <div className="mb-2">
              <StoriesSystem />
            </div>

            {/* LinkedIn Sort By Row */}
            <div className="flex items-center justify-between px-2 py-1 mb-2 text-white/40">
              <div className="h-[1px] flex-1 bg-white/10" />
              <div className="px-3 flex items-center gap-1.5 text-[11px] font-medium font-sans">
                <span>Sort by:</span>
                <span className="font-bold text-white/80 flex items-center gap-1 cursor-pointer hover:text-aeirmist-cyan transition-colors">
                  Top <ChevronDown size={12} />
                </span>
              </div>
              <div className="h-[1px] w-4 bg-white/10" />
            </div>`;

// Normalize line endings for replacement
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedOld = oldContainer.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedOld)) {
  const updated = normalizedContent.replace(normalizedOld, newContainer);
  fs.writeFileSync(targetPath, updated, 'utf8');
  console.log('Successfully updated HomeFeedSystem.tsx with LinkedIn layout!');
} else {
  console.error('Could not find old container in HomeFeedSystem.tsx');
}
