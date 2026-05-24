const j=require('jimp');
const {Jimp}=j;
console.log('jimp version:', require('./node_modules/jimp/package.json').version);
console.log('Jimp type:', typeof Jimp);
// Static methods
const staticMethods=Object.getOwnPropertyNames(Jimp).filter(k=>typeof Jimp[k]==='function');
console.log('Jimp static methods:', staticMethods.join(', '));
// Instance methods (from prototype)
const protoMethods=Object.getOwnPropertyNames(Jimp.prototype).filter(k=>k!=='constructor');
console.log('Jimp prototype methods (first 20):', protoMethods.slice(0,20).join(', '));
