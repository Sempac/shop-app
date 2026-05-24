const j=require('jimp');
console.log('version:', j.Jimp?.version || 'unknown');
console.log('keys:', Object.keys(j).slice(0,20).join(', '));
console.log('has read:', typeof j.read);
console.log('has Jimp:', typeof j.Jimp);
console.log('has fromFile:', typeof j.fromFile);
if(j.Jimp) console.log('Jimp keys:', Object.keys(j.Jimp).slice(0,10).join(', '));
