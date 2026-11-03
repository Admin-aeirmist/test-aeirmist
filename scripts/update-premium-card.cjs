const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'src', 'components', 'feed', 'PremiumPostCard.tsx');
let content = fs.readFileSync(targetPath, 'utf8').replace(/\r\n/g, '\n');

const startTag = '{/* Engagement Buttons Row */}';
const endTag = '{/* Dynamic Nested Comments Drawer */}';

const startIndex = content.indexOf(startTag);
const endIndex = content.indexOf(endTag);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `{/* LinkedIn Social Proof & Reaction Summary Row */}
      <div className="px-4 py-2 border-t border-white/5 bg-white/[0.005] flex items-center justify-between text-[11px] text-white/40 select-none">
        {/* Left: Stacked Reaction Badges */}
        <div className="flex items-center gap-1.5 cursor-pointer hover:text-white/70 transition-colors" onClick={handleLike}>
          <div className="flex items-center -space-x-1">
            <span className="w-4 h-4 rounded-full bg-aeirmist-cyan/30 border border-aeirmist-cyan/50 flex items-center justify-center text-[9px] shadow-sm">
              👍
            </span>
            <span className="w-4 h-4 rounded-full bg-rose-500/30 border border-rose-500/50 flex items-center justify-center text-[9px] shadow-sm">
              ❤️
            </span>
            <span className="w-4 h-4 rounded-full bg-amber-500/30 border border-amber-500/50 flex items-center justify-center text-[9px] shadow-sm">
              💡
            </span>
          </div>
          <span className="font-medium font-sans">
            {(isLikesHidden && !isOwnPost) ? 'Reactions' : (post.likesCount?.toLocaleString() || '0')}
          </span>
        </div>

        {/* Right: Comments & Reposts count */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowComments(!showComments)}
            className="hover:text-white/70 hover:underline transition-colors cursor-pointer"
          >
            {post.commentsCount?.toLocaleString() || '0'} comments
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={handleShare}
            className="hover:text-white/70 hover:underline transition-colors cursor-pointer"
          >
            {((post as any).sharesCount || 14).toLocaleString()} reposts
          </button>
        </div>
      </div>

      {/* Iconic 4-Action Bar (LinkedIn Style) */}
      <div className="px-2 py-1 sm:px-4 sm:py-1.5 border-t border-white/5 bg-white/[0.01]">
        <div className="flex items-center justify-between">
          {/* 1. Like Button */}
          <button 
            type="button"
            aria-label={isLiked ? "Unlike post" : "Like post"}
            aria-pressed={isLiked}
            onClick={handleLike}
            className={\`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl transition-all duration-200 active:scale-95 group font-bold text-xs sm:text-[13px] hover:bg-white/5 focus-visible:outline-none cursor-pointer \${
              isLiked 
                ? 'text-aeirmist-cyan font-black' 
                : 'text-white/60 hover:text-white'
            }\`}
          >
            <ThumbsUp size={16} fill={isLiked ? "currentColor" : "none"} className={\`transition-transform group-hover:scale-110 \${isLiked ? 'text-aeirmist-cyan' : 'text-current'}\`} />
            <span>Like</span>
          </button>

          {/* 2. Comment Button */}
          <button 
            type="button"
            aria-label="Toggle comments"
            aria-expanded={showComments}
            onClick={() => setShowComments(!showComments)}
            className={\`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl transition-all duration-200 active:scale-95 group font-bold text-xs sm:text-[13px] hover:bg-white/5 focus-visible:outline-none cursor-pointer \${
              showComments 
                ? 'text-aeirmist-cyan font-black' 
                : 'text-white/60 hover:text-white'
            }\`}
          >
            <MessageSquare size={16} className={\`transition-transform group-hover:scale-110 \${showComments ? 'text-aeirmist-cyan' : 'text-current'}\`} />
            <span>Comment</span>
          </button>

          {/* 3. Repost Button */}
          <button 
            type="button"
            aria-label="Repost"
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all duration-200 active:scale-95 font-bold text-xs sm:text-[13px] group focus-visible:outline-none cursor-pointer"
          >
            <Repeat size={16} className="transition-transform group-hover:scale-110" />
            <span>Repost</span>
          </button>

          {/* 4. Send Button */}
          <button 
            type="button"
            aria-label="Send via message"
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all duration-200 active:scale-95 font-bold text-xs sm:text-[13px] group focus-visible:outline-none cursor-pointer"
          >
            <Send size={16} className="transition-transform group-hover:scale-110" />
            <span>Send</span>
          </button>

          {/* Bookmark Shortcut */}
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
      </div>\n\n`;

  content = content.slice(0, startIndex) + replacement + content.slice(endIndex);
  fs.writeFileSync(targetPath, content, 'utf8');
  console.log('Successfully updated Engagement section in PremiumPostCard.tsx!');
} else {
  console.error('Could not find start or end tags');
}
