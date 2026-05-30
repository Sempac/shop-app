const fs = require('fs');
const b  = require('./node_modules/bcryptjs');
const hash = b.hashSync('shop2026', 12);
const confPath = 'C:/Users/PC/AppData/Roaming/AnyDesk/user.conf';
let c = fs.readFileSync(confPath, 'utf8');
// Supprimer ancienne entrée password si présente
c = c.replace(/ad\.security\.password=.*/g, '').replace(/\n{3,}/g, '\n\n').trimEnd();
// Ajouter le nouveau hash
c += '\nad.security.password=' + hash + '\n';
fs.writeFileSync(confPath, c, 'utf8');
console.log('OK - hash ecrit: ' + hash);
