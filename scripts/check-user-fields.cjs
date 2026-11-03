const fs = require('fs');

const routeContent = fs.readFileSync('functions/api/[[route]].ts', 'utf8');
const lines = routeContent.split('\n');
console.log('Searching for users in route.ts...');
lines.forEach((l, i) => {
  if (l.toLowerCase().includes('tawsif') || l.toLowerCase().includes('salman') || l.toLowerCase().includes('samiul') || l.toLowerCase().includes('jihan')) {
    console.log((i+1) + ': ' + l.trim().substring(0, 120));
  }
});
