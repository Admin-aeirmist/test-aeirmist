const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'src', 'components', 'feed', 'PremiumPostCard.tsx');
let content = fs.readFileSync(targetPath, 'utf8').replace(/\r\n/g, '\n');

const startTag = '{/* LinkedIn Social Proof & Reaction Summary Row */}';
const endTag = '{/* Dynamic Nested Comments Drawer */}';

const startIndex = content.indexOf(startTag);
const endIndex = content.indexOf(endTag);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `{/* Real Social Proof / Likes & Comments Counter (No Fake Emojis) */}
      {(Boolean(post.likesCount > 0 || post.commentsCount > 0)) && (
        <div className="px-4 py-2 border-t border-white/5 bg-white/[0.005] flex items-center justify-between text-[11px] text-white/50 select-none">
          {/* Left: Real Likes Count with Instagram Heart */}
          <div className="flex items-center gap-1.5 cursor-pointer hover:text-white/80 transition-colors" onClick={handleLike}>
            {post.likesCount > 0 && (
              <span className="flex items-center gap-1 font-semibold text-white/80">
                <Heart size={13} className="text-rose-500 fill-rose-500" />
                <span>{post.likesCount.toLocaleString()} {post.likesCount === 1 ? 'like' : 'likes'}</span>
              </span>
            )}
          </div>

          {/* Right: Real Comments Count */}
          <div className="flex items-center gap-2">
            {post.commentsCount > 0 && (
              <button
                type="button"
                onClick={() => setShowComments(!showComments)}
                className="hover:text-white/80 hover:underline transition-colors cursor-pointer font-medium"
              >
                {post.commentsCount.toLocaleString()} {post.commentsCount === 1 ? 'comment' : 'comments'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Engagement Buttons Row Container */}
      <div className="border-t border-white/5 bg-white/[0.01]">
        {/* Instagram Heart Love Sign + Action Bar */}
        <div className="px-2 py-1 sm:px-4 sm:py-1.5 flex items-center justify-between">
          {/* 1. Instagram-Style Love / Like Button */}
          <button 
            type="button"
            aria-label={isLiked ? "Unlike post" : "Like post"}
            aria-pressed={isLiked}
            onClick={handleLike}
            className={\`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl transition-all duration-200 active:scale-95 group font-bold text-xs sm:text-[13px] hover:bg-white/5 focus-visible:outline-none cursor-pointer \${
              isLiked 
                ? 'text-rose-500' 
                : 'text-white/60 hover:text-white'
            }\`}
          >
            <Heart 
              size={18} 
              fill={isLiked ? "#f43f5e" : "none"} 
              className={\`transition-all duration-200 group-hover:scale-110 \${
                isLiked ? 'text-rose-500 fill-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'text-current group-hover:text-rose-400'
              }\`} 
            />
            <span className={isLiked ? 'text-rose-500 font-black' : 'text-white/70 group-hover:text-white'}>
              {isLiked ? 'Liked' : 'Like'}
            </span>
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
            <MessageSquare size={17} className={\`transition-transform group-hover:scale-110 \${showComments ? 'text-aeirmist-cyan' : 'text-current'}\`} />
            <span>Comment</span>
          </button>

          {/* 3. Repost / Share Button */}
          <button 
            type="button"
            aria-label="Repost"
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all duration-200 active:scale-95 font-bold text-xs sm:text-[13px] group focus-visible:outline-none cursor-pointer"
          >
            <Repeat size={17} className="transition-transform group-hover:scale-110" />
            <span>Repost</span>
          </button>

          {/* 4. Send via Message Button */}
          <button 
            type="button"
            aria-label="Send via message"
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all duration-200 active:scale-95 font-bold text-xs sm:text-[13px] group focus-visible:outline-none cursor-pointer"
          >
            <Send size={17} className="transition-transform group-hover:scale-110" />
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
            <Bookmark size={15} fill={isBookmarked ? "currentColor" : "none"} />
          </button>
        </div>
      </div>\n\n`;

  content = content.slice(0, startIndex) + replacement + content.slice(endIndex);
  fs.writeFileSync(targetPath, content, 'utf8');
  console.log('Successfully updated PremiumPostCard.tsx with real counts and Instagram love sign!');
} else {
  console.error('Could not find start or end tags in PremiumPostCard.tsx');
}
