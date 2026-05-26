const {exec} = require('child_process');
const sumatra = 'C:\\tools\\SumatraPDF.exe';
const printer = 'Brother HL-L6300DW series Printer';
const fp = 'C:\\apps\\shop-app\\uploads\\1779800940021-25056.pdf';
const cmd = `"${sumatra}" -print-to "${printer}" -print-settings "1x" "${fp}"`;
console.log('CMD:', cmd);
exec(cmd, (err, stdout, stderr) => {
  console.log('err:', err && err.message);
  console.log('stdout:', stdout);
  console.log('stderr:', stderr);
  setTimeout(()=>process.exit(0), 500);
});
