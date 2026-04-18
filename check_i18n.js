import fs from 'fs';

const content = fs.readFileSync('src/i18n.ts', 'utf8');
const resourcesMatch = content.match(/const resources = \{([\s\S]*?)\};/);

if (resourcesMatch) {
  const resourcesStr = resourcesMatch[1];
  // This is a bit naive but might work for finding duplicates
  const languages = resourcesStr.split(/^\s*(\w+): \{/m).filter(Boolean);
  
  for (let i = 0; i < languages.length; i += 2) {
    const lang = languages[i];
    const body = languages[i+1];
    const keys = body.match(/"([^"]+)":/g);
    if (keys) {
      const counts = {};
      keys.forEach(k => {
        counts[k] = (counts[k] || 0) + 1;
      });
      for (const k in counts) {
        if (counts[k] > 1) {
          console.log(`Duplicate key ${k} in language ${lang}: ${counts[k]} times`);
        }
      }
    }
  }
} else {
  console.log('Could not find resources object');
}
