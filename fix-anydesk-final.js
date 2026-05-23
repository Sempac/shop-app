const fs = require('fs');

// Profile _default hex (all permissions = 1) — issue des profils originaux
const profileHex = '000000085f64656661756c74000000440100000001000000010000000100000001000000010000000100000001000000010000000000000001000000000000000100000001000000010000000100000000000000000000110000000000000000000000000000000001000000440100000001000000010000000100000001000000010000000100000001000000010000000100000001000000010000000100000001000000010000000100000001000000000000010000000100000001000000010000000000000000';

// --- user.conf ---
const userConf = 'C:/Users/PC/AppData/Roaming/AnyDesk/user.conf';
let u = fs.readFileSync(userConf, 'utf8');
u = u.replace(/ad\.security\.permission_profiles\..*/mg, '');
u = u.replace(/ad\.security\.interactive_access=.*/mg, '');
u = u.replace(/\n{3,}/g, '\n\n').trimEnd();
u += '\nad.security.interactive_access=1';
u += '\nad.security.permission_profiles.address_to_profile=1932093211:' + profileHex + ';1008741222:' + profileHex + ';1895381065:' + profileHex;
u += '\n';
fs.writeFileSync(userConf, u, 'utf8');
console.log('user.conf OK');

// --- service.conf ---
const svcConf = 'C:/ProgramData/AnyDesk/service.conf';
let s = fs.readFileSync(svcConf, 'utf8');
s = s.replace(/ad\.security\.interactive_access=.*/mg, '');
s = s.replace(/\n{3,}/g, '\n\n').trimEnd();
s += '\nad.security.interactive_access=1\n';
fs.writeFileSync(svcConf, s, 'utf8');
console.log('service.conf OK');

console.log('\n=== user.conf security ===');
console.log(u.split('\n').filter(l => l.match(/security\./)).join('\n'));
console.log('\n=== service.conf security ===');
console.log(s.split('\n').filter(l => l.match(/security\./)).join('\n'));
