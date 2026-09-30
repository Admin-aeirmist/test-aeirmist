const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.scripts['build:pages'] = 'vite build && node -e "import(\'fs\').then(fs => fs.copyFileSync(\'dist/index.html\',\'dist/404.html\'))"';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('Successfully updated package.json build:pages');
