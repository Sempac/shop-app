const {Jimp}=require('jimp');
// Liste complète des méthodes de l'instance
const all=Object.getOwnPropertyNames(Jimp.prototype).filter(k=>k!=='constructor');
console.log('ALL prototype methods:\n', all.join('\n'));
