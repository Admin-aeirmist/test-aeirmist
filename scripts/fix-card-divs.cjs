const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'src', 'components', 'feed', 'PremiumPostCard.tsx');
let content = fs.readFileSync(targetPath, 'utf8').replace(/\r\n/g, '\n');

// Replace the action bar closing tags so it doesn't close the outer container prematurely
const oldBar = `      {/* Iconic 4-Action Bar (LinkedIn Style) */}
      <div className="px-2 py-1 sm:px-4 sm:py-1.5 border-t border-white/5 bg-white/[0.01]">
        <div className="flex items-center justify-between">`;

const newBar = `      {/* Engagement Buttons Row Container */}
      <div className="border-t border-white/5 bg-white/[0.01]">
        {/* Iconic 4-Action Bar (LinkedIn Style) */}
        <div className="px-2 py-1 sm:px-4 sm:py-1.5 flex items-center justify-between">`;

const oldClose = `          {/* Bookmark Shortcut */}
          <button 
            type="button"
            aria-label={isBookmarked ? "Remove from bookmarks" : "Save post to bookmarks"}
            aria-pressed={isBookmarked}
            onClick={handleBookmarkToggle}
            className={\`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 hover:bg-white/5 ml-1 cursor-pointer \${
              isBookmarked 
                ? 'text-aeirmist-cyan' 
                : 'text-white/40 hover:text-white'
            }\`}
            title="Save post"
          >
            <Bookmark size={14} fill={isBookmarked ? "currentColor" : "none"} />
          </button>
        </div>
      </div>`;

const newClose = `          {/* Bookmark Shortcut */}
          <button 
            type="button"
            aria-label={isBookmarked ? "Remove from bookmarks" : "Save post to bookmarks"}
            aria-pressed={isBookmarked}
            onClick={handleBookmarkToggle}
            className={\`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 hover:bg-white/5 ml-1 cursor-pointer \${
              isBookmarked 
                ? 'text-aeirmist-cyan' 
                : 'text-white/40 hover:text-white'
            }\`}
            title="Save post"
          >
            <Bookmark size={14} fill={isBookmarked ? "currentColor" : "none"} />
          </button>
        </div>`;

content = content.replace(oldBar, newBar);
content = content.replace(oldClose, newClose);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully adjusted action bar div tags!');
