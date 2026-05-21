import pdfplumber, re, json, sys

def parse(path):
    r = {'numero':'','date':'','fournisseur':'','items':[],'total_ht':0,'total_ttc':0}
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ''
            m = re.search(r'#(FA\d+)', text)
            if m: r['numero'] = m.group(1)
            m = re.search(r'(\d{2}/\d{2}/\d{4})', text)
            if m: r['date'] = m.group(1)
            # Total HT
            m = re.search(r'Total \(HT\)\s+([\d\s,\.]+)\s*€', text)
            if m: r['total_ht'] = float(m.group(1).replace(' ','').replace(',','.'))
            # Total TTC - dernière occurrence de "Total" avec montant
            matches = re.findall(r'Total\s+([\d\s,\.]+)\s*€', text)
            if matches:
                r['total_ttc'] = float(matches[-1].replace(' ','').replace(',','.'))
            # Taxe totale
            m = re.search(r'Taxe totale\s+([\d\s,\.]+)\s*€', text)
            if m: r['taxe'] = float(m.group(1).replace(' ','').replace(',','.'))
            # Fournisseur
            if 'SMART GADGET' in text or 'LCD' in text:
                r['fournisseur'] = 'LCD Phone / Smart Gadget Home'
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
                        elif len(cc) > 5 and not re.match(r'^\d', cc) and '%' not in cc and not nom:
                            nom = cc.replace('\n', ' ')
                    if ref and prix:
                        r['items'].append({'reference': ref, 'nom': nom, 'prix_ht': prix, 'quantite': qty or 1})
    # Transporteur
    m = re.search(r'Transporteur\s+([^\n]+)', text)
    if m:
        trans = m.group(1).strip()
        # Nettoyer "Total XXX €" à la fin
        trans = re.sub(r'\s+Total\s+[\d,\.]+\s*€.*', '', trans).strip()
        r['transporteur'] = trans
    return r

print(json.dumps(parse(sys.argv[1]), ensure_ascii=False))
