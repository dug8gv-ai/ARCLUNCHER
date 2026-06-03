const fs = require('fs');

const lines = fs.readFileSync('C:\\Users\\dell\\.gemini\\antigravity\\brain\\dc82b705-8cf4-4e15-b189-4c4a986aa397\\.system_generated\\logs\\transcript.jsonl', 'utf-8').split('\n');
let dump = '';
for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.step_index === 1151 && obj.source === 'USER_EXPLICIT') {
      dump = obj.content;
      break;
    }
  } catch (e) {}
}

fs.writeFileSync('C:\\Users\\dell\\Desktop\\ARCLUNCHER\\original_prompt.txt', dump);
console.log('Done writing original prompt');
