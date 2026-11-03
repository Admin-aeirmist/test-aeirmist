const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../src/index.css');
let content = fs.readFileSync(cssPath, 'utf8');

const normalized = content.replace(/\r\n/g, '\n');
const search = '  html, body {';
const idx = normalized.indexOf(search);

if (idx !== -1) {
  const endBodyIdx = normalized.indexOf('  #root {', idx);
  const replacement = `  html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    background-color: var(--color-aeirmist-bg);
    -webkit-text-size-adjust: 100%;
    -webkit-tap-highlight-color: transparent;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }

  body {
    @apply text-white font-sans antialiased selection:bg-aeirmist-cyan/30;
    cursor: default;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
  }

  /* Prevent UI text selection and accidental drag */
  button, nav, header, footer, aside, [role="button"], [role="tab"], .glass-panel, .glass-card, .glass-button {
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
  }

  /* Prevent image and link dragging across UI */
  img, svg, a {
    -webkit-user-drag: none;
    user-drag: none;
  }

  /* Allow text selection ONLY in input fields and editable areas */
  input, textarea, [contenteditable="true"], .selectable-text, .user-select-text, [data-selectable="true"] {
    -webkit-user-select: text !important;
    -moz-user-select: text !important;
    -ms-user-select: text !important;
    user-select: text !important;
  }

`;
  const result = normalized.slice(0, idx) + replacement + normalized.slice(endBodyIdx);
  fs.writeFileSync(cssPath, result, 'utf8');
  console.log('src/index.css successfully updated with user-select: none!');
} else {
  console.error('search string not found in src/index.css');
}
