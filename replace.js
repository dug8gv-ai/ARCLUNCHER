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
  if (filePath.match(/\.(ts|tsx|md|json|html)$/)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    content = content.replace(/ArcLauncher/g, 'ArcOmni');
    content = content.replace(/Arc Launcher/g, 'ArcOmni');
    content = content.replace(/ARC LAUNCHER/g, 'ARCOMNI');
    content = content.replace(/ARCLUNCHER/g, 'ARCOMNI');
    content = content.replace(/Arc Lunacher/g, 'ArcOmni');
    content = content.replace(/arclauncher/g, 'arcomni');
    content = content.replace(/Arc Launcher Alert/gi, 'ArcOmni Alert');
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated', filePath);
    }
  }
});
