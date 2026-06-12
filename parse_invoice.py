import pdfplumber, re, json, sys
sys.stdout.reconfigure(encoding='utf-8')

def detect_fournisseur(text):
    if 'UTOPYA' in text: return 'Utopya'
    if 'SMART GADGET' in text or 'LCD' in text: return 'LCD Phone / Smart Gadget Home'
    return ''

def parse_lcdphone(text, page):
    """Format LCD Phone / Smart Gadget Home"""
    r = {'items': [], 'total_ht': 0, 'total_ttc': 0}
    m = re.search(r'#(FA\d+)', text)
    if m: r['numero'] = m.group(1)
    m = re.search(r'(\d{2}/\d{2}/\d{4})', text)
    if m: r['date'] = m.group(1)
    m = re.search(r'Total \(HT\)\s+([\d\s,\.]+)\s*€', text)
    if m: r['total_ht'] = float(m.group(1).replace(' ','').replace(',','.'))
    matches = re.findall(r'Total\s+([\d\s,\.]+)\s*€', text)
    if matches: r['total_ttc'] = float(matches[-1].replace(' ','').replace(',','.'))
    m = re.search(r'Transporteur\s+([^\n]+)', text)
    if m:
        trans = re.sub(r'\s+Total\s+[\d,\.]+\s*€.*', '', m.group(1)).strip()
        r['transporteur'] = trans
    tables = page.extract_tables()
    for table in tables:
        for row in table:
            if not row or len(row) < 3: continue
            ref = str(row[0] or '').strip()
            if not re.match(r'^[A-Z]{1,3}\d+', ref): continue
            cells = [str(c or '').strip() for c in row]
            prix = None; qty = None; nom = ''
            for cell in cells[1:]:
                cc = cell.replace('\n', ' ').strip()
                if re.match(r'^\d+[\.,]\d+\s*€$', cc):
                    val = float(cc.replace('€','').replace(',','.').strip())
                    if prix is None: prix = val
                elif re.match(r'^\d+$', cc) and qty is None:
                    qty = int(cc)
                elif len(cc) > 5 and not re.match(r'^\d', cc) and not re.match(r'^\d{1,2}\s*%', cc) and not nom:
                    nom = cc.replace('\n', ' ')
            if ref and prix:
                r['items'].append({'reference': ref, 'nom': nom, 'prix_ht': prix, 'quantite': qty or 1})
    return r

def parse_utopya(text):
    """Format UTOPYA"""
    r = {'items': [], 'total_ht': 0, 'total_ttc': 0, 'total_rcp': 0}
    # Numéro facture
    m = re.search(r'Facture\s*#\s*(FA\d+)', text)
    if m: r['numero'] = m.group(1)
    # Date
    m = re.search(r'(?:Date facture\s+|Carte Bancaire\s+)(\d{2}/\d{2}/\d{4})', text)
    if not m: m = re.search(r'(\d{2}/\d{2}/\d{4})', text)
    if m: r['date'] = m.group(1)
    # Transporteur
    m = re.search(r'Méthode de livraison\s+(\S+)', text)
    if m:
        trans = m.group(1).strip()
        if trans not in ['Carte','Virement','Chèque']:
            r['transporteur'] = trans
    m2 = re.search(r'(DPD|Colissimo|Chronopost|UPS|TNT|GLS|Mondial Relay)', text)
    if m2: r['transporteur'] = m2.group(1)
    # Totaux — format flexible: "Total HT : 220,91 €" ou "Total HT:220,91€"
    def _mont(s):
        return float(s.strip().replace(' ','').replace(',','.')) if s and s.strip() else 0
    m = re.search(r'Total HT\s*:\s*([\d\s,\.]+?)\s*€', text)
    if m: r['total_ht'] = _mont(m.group(1))
    m = re.search(r'Total TTC\s*:\s*([\d\s,\.]+?)\s*€', text)
    if m: r['total_ttc'] = _mont(m.group(1))
    m = re.search(r'Total RCP\s*:\s*([\d\s,\.]+?)\s*€', text)
    if m: r['total_rcp'] = _mont(m.group(1))
    # Codes à exclure (frais de port, RCP, transporteurs)
    SKIP_REFS = {'UPS','DPD','TNT','GLS','CHRONOPOST','COLISSIMO','RCP','SHIP','SHIPPING','LIVRA','EXPEDIT'}
    SKIP_NOM  = ['shipping','frais de port',"frais d'exp",'frais exp',
                 'livraison','ups standard','dpd standard','colissimo','chronopost',
                 'remuneration copie','rémunération copie','copie privée','copie prive']
    # Produits — format: SKU Nom Qté P.U. TVA Total
    lines = text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i]
        parts = line.strip().split(' ')
        if not parts: i += 1; continue
        ref = parts[0]
        # SKU valide: alphanumérique avec tirets/@
        if re.match(r'^[A-Z0-9][A-Z0-9\-@_]+$', ref) and len(ref) >= 3 and ref not in ('SKU','EAN','TVA','RCP','TVA%'):
            # Exclure les codes transporteur/frais
            if ref.upper() in SKIP_REFS:
                i += 1; continue
            rest = line[len(ref):].strip()
            # Chercher prix format: N,NN€
            prix_match = re.findall(r'(\d+[,\.]\d+)€', rest)
            # Nom = tout avant le premier chiffre isolé
            nom_match = re.match(r'^(.*?)\s+\d+\s+\d+[,\.]', rest)
            nom = nom_match.group(1).strip() if nom_match else rest.split('  ')[0].strip()
            # Nom multiline: vérifier ligne suivante
            if i+1 < len(lines) and lines[i+1] and not re.match(r'^[A-Z0-9][A-Z0-9\-@_]+\s', lines[i+1]) and not lines[i+1].startswith('EAN'):
                next_line = lines[i+1].strip()
                nll = next_line.lower()
                if (not re.search(r'[\d,\.]+€', next_line)
                        and not nll.startswith('shipping')
                        and not nll.startswith('total')
                        and not nll.startswith('tva')):
                    nom = nom + ' ' + next_line
                    i += 1
            # Prix unitaire = premier prix
            prix_ht = None
            if prix_match:
                prix_ht = float(prix_match[0].replace(',','.'))
            # Quantité
            qty = 1
            q_match = re.search(r'\s(\d+)\s+\d+[,\.]', rest)
            if q_match:
                qty = int(q_match.group(1))
            # Exclure shipping/frais/RCP par le nom
            nom_l = nom.lower()
            if any(kw in nom_l for kw in SKIP_NOM):
                i += 1; continue
            if ref and prix_ht:
                r['items'].append({
                    'reference': ref,
                    'nom': nom.strip(),
                    'prix_ht': prix_ht,
                    'quantite': qty
                })
        i += 1
    return r

def parse(path):
    result = {'numero':'', 'date':'', 'fournisseur':'', 'items':[], 'total_ht':0, 'total_ttc':0, 'total_rcp':0, 'transporteur':''}
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ''
            fournisseur = detect_fournisseur(text)
            result['fournisseur'] = fournisseur
            if 'UTOPYA' in text:
                data = parse_utopya(text)
            else:
                data = parse_lcdphone(text, page)
            # Fusionner
            for k, v in data.items():
                if k == 'items':
                    result['items'].extend(v)
                elif v:
                    result[k] = v
    return result

print(json.dumps(parse(sys.argv[1]), ensure_ascii=False))
