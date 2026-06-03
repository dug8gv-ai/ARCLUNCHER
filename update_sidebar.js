const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace standard sidebar link classes with new simple logic
const sidebarRegex = /className=\{`w-full flex items-center[^\}]+`\}/g;
content = content.replace(sidebarRegex, (match) => {
  if (match.includes('currentView ===')) {
    const viewName = match.match(/currentView === '([^']+)'/)[1];
    return `className={\`sidebar-link w-full flex items-center gap-3.5 px-4.5 py-3 rounded-2xl text-xs font-bold \${currentView === '${viewName}' ? 'active' : ''}\`}`;
  }
  return match;
});

// Replace "Your Wallet Balances" Card wrapper
content = content.replace(/className="bg-white border border-slate-100 rounded-3xl p-5 space-y-3 shadow-sm select-none"/g, 'className="card p-5 space-y-3 select-none"');

// Replace Bottom Sidebar Staking Card
content = content.replace(/className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 hover:border-blue-200 rounded-3xl p-5 space-y-3.5 shadow-sm cursor-pointer group transition-all text-left"/g, 'className="card p-5 space-y-3.5 cursor-pointer group text-left"');

// Save it back
fs.writeFileSync(filePath, content, 'utf8');
console.log('Sidebar links and some cards updated');
