const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'src', 'components', 'feed', 'HomeFeedSystem.tsx');
let content = fs.readFileSync(targetPath, 'utf8').replace(/\r\n/g, '\n');

// 1. Remove import
content = content.replace("import { LinkedInProfileCard } from './LinkedInProfileCard';\n", "");

// 2. Remove the left column from JSX and restore clean max-w-[700px]
const oldSnippet = `        <div className="w-full flex justify-center gap-6 px-1 sm:px-4">
          
          {/* LEFT COLUMN: LinkedIn Profile & Identity Card */}
          <div className="hidden xl:block w-56 2xl:w-64 shrink-0">
            <LinkedInProfileCard onUserClick={onUserClick} onNavigate={onNavigate} />
          </div>

          {/* MAIN FEED COLUMN */}
          <div className="w-full max-w-[620px] min-w-0">`;

const newSnippet = `        <div className="w-full flex justify-center">
          
          {/* MAIN FEED COLUMN */}
          <div className="w-full max-w-[700px]">`;

if (content.includes(oldSnippet)) {
  content = content.replace(oldSnippet, newSnippet);
  fs.writeFileSync(targetPath, content, 'utf8');
  console.log('Successfully removed Left Profile Card from HomeFeedSystem.tsx!');
} else {
  console.error('Could not find oldSnippet in HomeFeedSystem.tsx');
}
