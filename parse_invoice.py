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
    """Format UTOPYA — chaque champ sur sa propre ligne:
       SKU
       Nom produit
       (ligne vide)
       20,00%
       6,70        ← prix HT unitaire
       2           ← quantité
       13.40       ← total HT
    """
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

    # Codes/mots à exclure (transport, résumé, taxes séparées)
    SKIP_REFS = {
        'UPS', 'DPD', 'TNT', 'GLS', 'CHRONOPOST', 'COLISSIMO',
        'RCP', 'SHIP', 'SHIPPING', 'LIVRA', 'EXPEDIT',
        'TOTAL', 'REMISE', 'EAN', 'SKU', 'TVA', 'TAUX', 'MONTANT',
    }
    SKIP_NOM = [
        'shipping', 'frais de port', "frais d'exp", 'frais exp',
        'ups standard', 'dpd standard', 'colissimo', 'chronopost', 'livraison',
    ]

    lines = text.split('\n')

    # Identifier les indices de lignes qui contiennent uniquement un SKU valide
    sku_indices = []
    for idx, line in enumerate(lines):
        s = line.strip()
        if (re.match(r'^[A-Z0-9][A-Z0-9\-@_]+$', s)
                and len(s) >= 3
                and s not in SKIP_REFS
                and s.upper() not in SKIP_REFS):
            sku_indices.append(idx)

    if not sku_indices:
        return r

    # Détecter le format: multi-ligne (SKU seul) vs inline (SKU + données sur même ligne)
    first_parts = lines[sku_indices[0]].strip().split(' ', 1)
    first_rest  = first_parts[1].strip() if len(first_parts) > 1 else ''
    is_multiline = (len(first_rest) == 0)

    if is_multiline:
        # Format multi-ligne: regrouper les lignes par bloc SKU→SKU suivant
        sku_indices.append(len(lines))  # sentinelle de fin
        for k in range(len(sku_indices) - 1):
            ref     = lines[sku_indices[k]].strip()
            end_idx = sku_indices[k + 1]
            # Lignes non vides du bloc (après le SKU, avant le prochain SKU)
            block   = [lines[j].strip() for j in range(sku_indices[k] + 1, end_idx)
                       if lines[j].strip()]

            nom_parts = []
            nums      = []
            in_nums   = False

            for bl in block:
                if bl.endswith('%'):
                    # Ligne TVA% — bascule en section numérique
                    in_nums = True
                elif re.match(r'^\d+[,\.]\d+€?$', bl):
                    # Nombre décimal (avec ou sans €) : prix ou total
                    in_nums = True
                    nums.append(float(bl.rstrip('€').replace(',', '.')))
                elif re.match(r'^\d+$', bl) and in_nums:
                    # Entier en section numérique : quantité
                    nums.append(int(bl))
                elif not in_nums:
                    # Texte avant les données numériques : partie du nom
                    nom_parts.append(bl)
                # Les autres lignes (TOTAL, HT TAUX…, texte hors-produit) sont ignorées

            nom = ' '.join(nom_parts).strip()
            if any(kw in nom.lower() for kw in SKIP_NOM):
                continue
            if not nums:
                continue

            prix_ht = nums[0]
            qty = 1
            if len(nums) >= 2:
                n1 = nums[1]
                if isinstance(n1, int) or (isinstance(n1, float) and n1 == int(n1)):
                    qty = int(n1)

            r['items'].append({
                'reference': ref,
                'nom':       nom,
                'prix_ht':   prix_ht,
                'quantite':  qty,
            })

    else:
        # Format inline (ancien format Utopya): tout sur une seule ligne
        i = 0
        while i < len(lines):
            line  = lines[i]
            parts = line.strip().split(' ')
            if not parts: i += 1; continue
            ref = parts[0]
            if (re.match(r'^[A-Z0-9][A-Z0-9\-@_]+$', ref)
                    and len(ref) >= 3
                    and ref not in SKIP_REFS
                    and ref.upper() not in SKIP_REFS):
                rest        = line[len(ref):].strip()
                prix_match  = re.findall(r'(\d+[,\.]\d+)€', rest)
                nom_match   = re.match(r'^(.*?)\s+\d+\s+\d+[,\.]', rest)
                nom         = nom_match.group(1).strip() if nom_match else rest.split('  ')[0].strip()
                if (i + 1 < len(lines) and lines[i + 1]
                        and not re.match(r'^[A-Z0-9][A-Z0-9\-@_]+\s', lines[i + 1])
                        and not lines[i + 1].startswith('EAN')):
                    nxt = lines[i + 1].strip()
                    nll = nxt.lower()
                    if (not re.search(r'[\d,\.]+€', nxt)
                            and not nll.startswith('shipping')
                            and not nll.startswith('total')
                            and not nll.startswith('tva')):
                        nom = nom + ' ' + nxt
                        i += 1
                prix_ht = float(prix_match[0].replace(',', '.')) if prix_match else None
                qty     = 1
                q_match = re.search(r'\s(\d+)\s+\d+[,\.]', rest)
                if q_match: qty = int(q_match.group(1))
                if any(kw in nom.lower() for kw in SKIP_NOM):
                    i += 1; continue
                if ref and prix_ht:
                    r['items'].append({
                        'reference': ref,
                        'nom':       nom.strip(),
                        'prix_ht':   prix_ht,
                        'quantite':  qty,
                    })
            i += 1

    return r

def parse(path):
    result = {
        'numero': '', 'date': '', 'fournisseur': '', 'transporteur': '',
        'items': [], 'total_ht': 0, 'total_ttc': 0, 'total_rcp': 0,
    }
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            text       = page.extract_text() or ''
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
    return result

print(json.dumps(parse(sys.argv[1]), ensure_ascii=False))
