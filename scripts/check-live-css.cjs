const https = require('https');

function check(url) {
  https.get(url, (res) => {
    let html = '';
    res.on('data', d => html += d);
    res.on('end', () => {
      const m = html.match(/assets\/index-[^"']+\.css/);
      console.log(url, '-> CSS:', m ? m[0] : 'none');
    });
  });
}

check('https://aeirmist.com');
check('https://aeirmist.pages.dev');
check('https://master.aeirmist.pages.dev');
