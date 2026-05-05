const fs = require('fs');
const path = require('path');
const dir = __dirname;

const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
for (const file of files) {
    const p = path.join(dir, file);
    let content = fs.readFileSync(p, 'utf8');
    if (!content.includes('theme.js')) {
        content = content.replace('</body>', '<script src="theme.js"></script>\n</body>');
        fs.writeFileSync(p, content);
    }
}
console.log('Injected theme.js into HTML files.');
