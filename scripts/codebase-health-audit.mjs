import fs from 'fs';
import path from 'path';

const srcDir = path.resolve('src');

function getAllFiles(dir, exts = ['.ts', '.tsx']) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, exts));
    } else if (exts.includes(path.extname(fullPath))) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = getAllFiles(srcDir);
console.log(`Auditing ${files.length} files...`);

const issues = {
  emptyCatches: [],
  uncleanedIntervals: [],
  uncleanedListeners: [],
  unsubscribedSnapshots: [],
  unhandledStreams: [],
  suspiciousStorageOrFirestoreRefs: [],
  unsafeWindowOrDocumentUsage: []
};

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const relPath = path.relative(process.cwd(), f);

  // 1. Empty catch blocks: catch (...) { } or catch { }
  const emptyCatchRegex = /catch\s*(?:\([^)]*\))?\s*\{\s*\}/g;
  let match;
  while ((match = emptyCatchRegex.exec(content)) !== null) {
    const line = content.substring(0, match.index).split('\n').length;
    issues.emptyCatches.push({ file: relPath, line, snippet: match[0] });
  }

  // 2. onSnapshot without unsubscribe or return
  // Find useEffects containing onSnapshot
  const useEffectRegex = /useEffect\s*\(\s*(?:async\s*)?\(\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\[([\s\S]*?)\]\)/g;
  while ((match = useEffectRegex.exec(content)) !== null) {
    const body = match[1];
    const line = content.substring(0, match.index).split('\n').length;
    
    if (body.includes('onSnapshot(')) {
      if (!body.includes('return') || (!body.includes('unsub') && !body.includes('() =>'))) {
        issues.unsubscribedSnapshots.push({ file: relPath, line, reason: 'onSnapshot in useEffect without clear cleanup' });
      }
    }
    
    if (body.includes('setInterval(') && !body.includes('clearInterval')) {
      issues.uncleanedIntervals.push({ file: relPath, line, reason: 'setInterval without clearInterval in cleanup' });
    }

    if (body.includes('addEventListener(') && !body.includes('removeEventListener')) {
      issues.uncleanedListeners.push({ file: relPath, line, reason: 'addEventListener without removeEventListener in cleanup' });
    }
  }

  // 3. getUserMedia without track stopping in cleanup or component
  if (content.includes('getUserMedia') && !content.includes('stop()')) {
    issues.unhandledStreams.push({ file: relPath, reason: 'getUserMedia used but track.stop() is never called' });
  }
}

console.log(`\n--- AUDIT RESULTS ---`);
console.log(`Empty Catch Blocks: ${issues.emptyCatches.length}`);
issues.emptyCatches.forEach(c => console.log(`  - ${c.file}:${c.line}`));

console.log(`\nUnsubscribed Snapshots: ${issues.unsubscribedSnapshots.length}`);
issues.unsubscribedSnapshots.forEach(s => console.log(`  - ${s.file}:${s.line} (${s.reason})`));

console.log(`\nUncleaned Intervals: ${issues.uncleanedIntervals.length}`);
issues.uncleanedIntervals.forEach(i => console.log(`  - ${i.file}:${i.line} (${i.reason})`));

console.log(`\nUncleaned Listeners: ${issues.uncleanedListeners.length}`);
issues.uncleanedListeners.forEach(l => console.log(`  - ${l.file}:${l.line} (${l.reason})`));

console.log(`\nUnhandled MediaStreams: ${issues.unhandledStreams.length}`);
issues.unhandledStreams.forEach(m => console.log(`  - ${m.file} (${m.reason})`));
