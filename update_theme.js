const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir(path.join(__dirname, 'src'), function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Backgrounds and Borders to Card
    content = content.replace(/bg-white border border-slate-[0-9]{3}(?:\/[0-9]{2})?/g, 'card');
    content = content.replace(/bg-white border-t border-slate-[0-9]{3}/g, 'card');
    content = content.replace(/bg-white rounded/g, 'card rounded');
    content = content.replace(/bg-white shadow/g, 'card shadow');
    content = content.replace(/bg-white/g, 'bg-[var(--bg-card)]');

    // Text Colors
    content = content.replace(/text-slate-900/g, 'text-[var(--text-primary)]');
    content = content.replace(/text-slate-800/g, 'text-[var(--text-primary)]');
    content = content.replace(/text-slate-700/g, 'text-[var(--text-primary)]');
    content = content.replace(/text-slate-600/g, 'text-[var(--text-secondary)]');
    content = content.replace(/text-slate-500/g, 'text-[var(--text-secondary)]');
    content = content.replace(/text-slate-400/g, 'text-[var(--text-secondary)]');

    // Blue Backgrounds and Borders
    content = content.replace(/bg-blue-50(?:\/[0-9]{2})?/g, 'bg-[rgba(0,242,254,0.05)]');
    content = content.replace(/bg-blue-100/g, 'bg-[rgba(0,242,254,0.1)]');
    content = content.replace(/border-blue-100(?:\/[0-9]{2})?/g, 'border-[var(--border-dim)]');
    content = content.replace(/border-blue-200(?:\/[0-9]{2})?/g, 'border-[var(--border-dim)]');
    content = content.replace(/text-blue-600/g, 'text-[var(--accent-cyan)]');
    content = content.replace(/text-blue-700/g, 'text-[var(--accent-cyan)]');
    content = content.replace(/text-blue-500/g, 'text-[var(--accent-cyan)]');

    // Gray borders
    content = content.replace(/border-slate-[0-9]{3}(?:\/[0-9]{2})?/g, 'border-[var(--border-dim)]');
    
    // Gradients
    content = content.replace(/bg-gradient-to-r from-blue-600 to-indigo-600/g, 'btn-primary');
    content = content.replace(/bg-gradient-to-r from-blue-500 to-indigo-500/g, 'btn-primary');
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated:', filePath);
    }
  }
});
