const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

walkDir('src', (filePath) => {
  if (filePath.match(/\.(ts|tsx)$/)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    // Rename image path
    content = content.replace(/\/arcomni-logo\.png/g, '/brand.png');
    // Change object-cover to object-contain p-0.5 for the logo
    content = content.replace(/className="w-full h-full object-cover"/g, 'className="w-full h-full object-contain p-0.5"');
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated', filePath);
    }
  }
});
