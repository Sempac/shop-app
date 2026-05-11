/**
 * contact-buttons.js — The SMARTPHONE POS
 * Boutons d'appel / SMS / WhatsApp réutilisables dans tous les modules
 * 
 * Usage : contactButtons('0612345678', 'Jean Dupont')
 * Retourne du HTML avec 3 boutons cliquables
 */

function formatPhone(phone) {
  if (!phone) return null;
  // Nettoyer le numéro
  let clean = phone.replace(/[\s\.\-\(\)]/g, '');
  // Convertir format français vers international
  if (clean.startsWith('0')) clean = '33' + clean.slice(1);
  if (clean.startsWith('+')) clean = clean.slice(1);
  return clean;
}

function contactButtons(phone, name = '') {
  if (!phone || phone.trim() === '' || phone === '—') return '';
  const intl = formatPhone(phone);
  if (!intl) return '';

  const displayPhone = phone;
  const encodedMsg = encodeURIComponent(
    `Bonjour ${name ? name : ''}, c'est The SMARTPHONE. `
  );

  return `
    <div class="contact-btns" style="display:inline-flex;gap:4px;align-items:center;flex-wrap:wrap">
      <!-- Appel téléphonique -->
      <a href="tel:${phone.replace(/\s/g,'')}"
         title="Appeler ${displayPhone}"
         style="display:inline-flex;align-items:center;gap:3px;padding:4px 9px;
                background:#16a34a;color:white;border-radius:6px;text-decoration:none;
                font-size:11px;font-weight:bold;font-family:Arial;white-space:nowrap">
        📞 Appeler
      </a>
      <!-- SMS -->
      <a href="sms:${phone.replace(/\s/g,'')}&body=${encodedMsg}"
         title="Envoyer un SMS"
         style="display:inline-flex;align-items:center;gap:3px;padding:4px 9px;
                background:#2563eb;color:white;border-radius:6px;text-decoration:none;
                font-size:11px;font-weight:bold;font-family:Arial;white-space:nowrap">
        💬 SMS
      </a>
      <!-- WhatsApp -->
      <a href="https://wa.me/${intl}?text=${encodedMsg}"
         target="_blank"
         title="Ouvrir WhatsApp"
         style="display:inline-flex;align-items:center;gap:3px;padding:4px 9px;
                background:#25d366;color:white;border-radius:6px;text-decoration:none;
                font-size:11px;font-weight:bold;font-family:Arial;white-space:nowrap">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        WhatsApp
      </a>
    </div>`;
}

/**
 * Version compacte — juste les icônes sans texte
 * Pour les tableaux où la place est limitée
 */
function contactButtonsCompact(phone, name = '') {
  if (!phone || phone.trim() === '' || phone === '—') return '';
  const intl = formatPhone(phone);
  if (!intl) return '';
  const encodedMsg = encodeURIComponent(`Bonjour ${name}, c'est The SMARTPHONE. `);

  return `
    <span style="display:inline-flex;gap:3px">
      <a href="tel:${phone.replace(/\s/g,'')}" title="Appeler ${phone}"
         style="padding:3px 7px;background:#16a34a;color:white;border-radius:5px;
                text-decoration:none;font-size:12px">📞</a>
      <a href="sms:${phone.replace(/\s/g,'')}&body=${encodedMsg}" title="SMS"
         style="padding:3px 7px;background:#2563eb;color:white;border-radius:5px;
                text-decoration:none;font-size:12px">💬</a>
      <a href="https://wa.me/${intl}?text=${encodedMsg}" target="_blank" title="WhatsApp"
         style="padding:3px 7px;background:#25d366;color:white;border-radius:5px;
                text-decoration:none;font-size:12px">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="white" style="vertical-align:middle">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>
    </span>`;
}
