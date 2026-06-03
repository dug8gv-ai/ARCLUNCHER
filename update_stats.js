const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'DashboardStats.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace card classes with stat-box for the dashboard stats
content = content.replace(/className="glass-panel p-6 flex items-center justify-between card"/g, 'className="stat-box p-6 flex items-center justify-between"');

// Unify the text colors inside the stats
content = content.replace(/text-\[var\(--accent-cyan\)\]/g, 'text-[var(--accent-cyan)]');
content = content.replace(/text-amber-600/g, 'text-[var(--accent-cyan)]');
content = content.replace(/text-emerald-600/g, 'text-[var(--accent-cyan)]');
content = content.replace(/text-rose-600/g, 'text-[var(--accent-cyan)]');

// Replace the icon container divs with the neon cyan indicator
const iconDivRegex = /<div className="h-11 w-11 rounded-xl bg-[^"]+"[^>]*>([\s\S]*?)<\/div>/g;
content = content.replace(iconDivRegex, (match, inner) => {
  // Extract just the icon component name
  let newInner = inner.replace(/text-[a-z]+-\d+/g, 'text-[var(--accent-cyan)]');
  return `<div className="h-10 w-10 rounded-lg border border-[var(--border-glow)] flex items-center justify-center flex-shrink-0 shadow-[var(--neon-shadow)] bg-[rgba(0,242,254,0.05)]">
          ${newInner}
        </div>`;
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('DashboardStats updated');
