const g = require('./gmail-send');
g.gmailSendMail({
  to: 'aek.boughari@gmail.com',
  subject: 'Test Gmail API',
  html: '<p>Test</p>',
  attachments: []
}).then(() => console.log('OK')).catch(e => {
  console.error('ERR:', e.message);
  console.error('CODE:', e.code);
  console.error('STATUS:', e.status);
});
