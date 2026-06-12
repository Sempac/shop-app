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
    """Format UTOPYA — supporte inline (tout sur une ligne) et multi-ligne (un champ par ligne)"""
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
        if trans not in ['Carte', 'Virement', 'Chèque']:
            r['transporteur'] = trans
    m2 = re.search(r'(DPD|Colissimo|Chronopost|UPS|TNT|GLS|Mondial Relay)', text)
    if m2: r['transporteur'] = m2.group(1)

    # Totaux — tolère espaces autour de ":" et avant "€"
    def _mont(s):
        return float(s.strip().replace(' ', '').replace(',', '.')) if s and s.strip() else 0
    m = re.search(r'Total HT\s*:\s*([\d\s,\.]+?)\s*€', text)
    if m: r['total_ht'] = _mont(m.group(1))
    m = re.search(r'Total TTC\s*:\s*([\d\s,\.]+?)\s*€', text)
    if m: r['total_ttc'] = _mont(m.group(1))
    m = re.search(r'Total RCP\s*:\s*([\d\s,\.]+?)\s*€', text)
    if m: r['total_rcp'] = _mont(m.group(1))

    SKIP_REFS = {
        'UPS', 'DPD', 'TNT', 'GLS', 'CHRONOPOST', 'COLISSIMO',
        'RCP', 'SHIP', 'SHIPPING', 'LIVRA', 'EXPEDIT',
        'TOTAL', 'REMISE', 'MONTANT', 'EAN', 'SKU', 'TVA', 'TAUX', 'REF',
    }
    SKIP_NOM = [
        'shipping', 'frais de port', "frais d'exp", 'frais exp',
        'ups standard', 'dpd standard', 'colissimo', 'chronopost', 'livraison',
    ]

    lines = text.split('\n')

    # Trouver toutes les lignes qui COMMENCENT par un SKU valide
    # (couvre les formats: "SKU seul" ET "SKU nom prix...")
    sku_starts = []  # liste de (line_idx, ref, reste_de_la_ligne)
    for idx, line in enumerate(lines):
        stripped = line.strip()
        if not stripped: continue
        parts = stripped.split(' ', 1)
        ref  = parts[0]
        rest = parts[1].strip() if len(parts) > 1 else ''
        if (re.match(r'^[A-Z0-9][A-Z0-9\-@_]+$', ref)
                and len(ref) >= 3
                and ref.upper() not in SKIP_REFS):
            sku_starts.append((idx, ref, rest))

    if not sku_starts:
        return r

    sku_starts.append((len(lines), None, None))  # sentinelle

    for k in range(len(sku_starts) - 1):
        idx, ref, rest = sku_starts[k]
        next_idx = sku_starts[k + 1][0]

        # ── Format inline: le prix (avec €) est sur la même ligne que le SKU ──
        inline_prix = re.findall(r'(\d+[,\.]\d+)\s*€', rest)
        if inline_prix:
            nom_match = re.match(r'^(.*?)\s+\d+\s+\d+[,\.]', rest)
            nom = nom_match.group(1).strip() if nom_match else rest.split('  ')[0].strip()
            # Ligne suivante éventuellement continuation du nom
            if idx + 1 < next_idx:
                nxt = lines[idx + 1].strip()
                if nxt and not re.search(r'[\d,\.]+[€%]', nxt) and not re.match(r'^[A-Z0-9][A-Z0-9\-@_]', nxt):
                    nom = (nom + ' ' + nxt).strip()
            prix_ht = float(inline_prix[0].replace(',', '.'))
            qty = 1
            q_match = re.search(r'\s(\d+)\s+\d+[,\.]', rest)
            if q_match: qty = int(q_match.group(1))

        else:
            # ── Format multi-ligne: données numériques sur les lignes suivantes ──
            nom_parts = [rest] if rest else []
            nums      = []
            in_nums   = False

            for j in range(idx + 1, next_idx):
                bl = lines[j].strip()
                if not bl: continue
                if bl.endswith('%'):
                    in_nums = True
                elif re.match(r'^\d+[,\.]\d+\s*€?$', bl):
                    in_nums = True
                    nums.append(float(bl.rstrip('€').strip().replace(',', '.')))
                elif re.match(r'^\d+$', bl) and in_nums:
                    nums.append(int(bl))
                elif not in_nums:
                    nom_parts.append(bl)

            nom = ' '.join(nom_parts).strip()
            if not nums:
                continue
            prix_ht = nums[0]
            qty     = 1
            if len(nums) >= 2:
                n1 = nums[1]
                if isinstance(n1, int) or (isinstance(n1, float) and n1 == int(n1)):
                    qty = int(n1)

        nom = nom.strip()
        if any(kw in nom.lower() for kw in SKIP_NOM):
            continue
        if ref and prix_ht:
            r['items'].append({'reference': ref, 'nom': nom, 'prix_ht': prix_ht, 'quantite': qty})

    return r

def parse(path):
    result = {
        'numero': '', 'date': '', 'fournisseur': '', 'transporteur': '',
        'items': [], 'total_ht': 0, 'total_ttc': 0, 'total_rcp': 0,
    }
    pages_text = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ''
            pages_text.append(text)
            fournisseur = detect_fournisseur(text)
            result['fournisseur'] = fournisseur
            if 'UTOPYA' in text:
                data = parse_utopya(text)
            else:
                data = parse_lcdphone(text, page)
            for k, v in data.items():
                if k == 'items':
                    result['items'].extend(v)
                elif v:
                    result[k] = v
    # Champ debug: premières lignes de chaque page (temporaire, pour diagnostic)
    result['_dbg'] = [p[:800] for p in pages_text]
    return result

print(json.dumps(parse(sys.argv[1]), ensure_ascii=False))
