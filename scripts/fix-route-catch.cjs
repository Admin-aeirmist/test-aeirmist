const fs = require('fs');
const path = require('path');

const file = path.resolve('D:/Aeirmist/functions/api/[[route]].ts');
let content = fs.readFileSync(file, 'utf8');

const badPattern = `    } catch (e: any) {
      return new Response(JSON.stringify({ error: e?.message || "Failed to create group" }), {
        status: 500,
        headers: CORS_HEADERS
      });
    }
  } catch {
      return new Response(JSON.stringify({ error: "Failed to create group conversation" }), { status: 400, headers: CORS_HEADERS });
    }
  }`;

const goodReplacement = `    } catch (e: any) {
      return new Response(JSON.stringify({ error: e?.message || "Failed to create group" }), {
        status: 500,
        headers: CORS_HEADERS
      });
    }
  }`;

// Handle CRLF or LF
const normalizedContent = content.replace(/\r\n/g, '\n');
const normalizedBad = badPattern.replace(/\r\n/g, '\n');
const normalizedGood = goodReplacement.replace(/\r\n/g, '\n');

if (normalizedContent.includes(normalizedBad)) {
  const fixed = normalizedContent.replace(normalizedBad, normalizedGood);
  fs.writeFileSync(file, fixed.replace(/\n/g, '\r\n'), 'utf8');
  console.log('✔ Successfully removed duplicate catch block in functions/api/[[route]].ts');
} else {
  console.log('Pattern not directly matched, trying regex');
  const regex = /}\s*catch\s*\(e:\s*any\)\s*\{[\s\S]*?\}\s*catch\s*\{[\s\S]*?return new Response\(JSON\.stringify\(\{\s*error:\s*"Failed to create group conversation"\s*\}\)[\s\S]*?\}\s*\}/;
  if (regex.test(content)) {
    content = content.replace(regex, `} catch (e: any) {
      return new Response(JSON.stringify({ error: e?.message || "Failed to create group" }), {
        status: 500,
        headers: CORS_HEADERS
      });
    }`);
    fs.writeFileSync(file, content, 'utf8');
    console.log('✔ Successfully replaced via regex');
  } else {
    console.log('Regex did not match');
  }
}
