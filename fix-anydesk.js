const fs = require('fs');
const b  = require('./node_modules/bcryptjs');

const confPath = 'C:/Users/PC/AppData/Roaming/AnyDesk/user.conf';
let c = fs.readFileSync(confPath, 'utf8');

// Supprimer les lignes qui posent problème
const linesToRemove = [
  /^ad\.security\.permission_profiles\..*/m,   // règles par appareil → écrasent interactive_access
  /^ad\.security\.interactive_access=.*/m,     // on va le remettre proprement
  /^ad\.security\.password=.*/m,               // idem
];
for (const re of linesToRemove) {
  c = c.replace(re, '');
}
c = c.replace(/\n{3,}/g, '\n\n').trimEnd();

// Ajouter les bons paramètres
const hash = b.hashSync('shop2026', 12);
c += '\nad.security.interactive_access=1';
c += '\nad.security.password=' + hash + '\n';

fs.writeFileSync(confPath, c, 'utf8');
console.log('user.conf réécrit. Hash: ' + hash);
console.log('Vérification:');
console.log(c.split('\n').filter(l => l.includes('security.')).join('\n'));
