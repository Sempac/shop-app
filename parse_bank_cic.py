"""
Parseur de relevés bancaires CIC pour IT TECH.
Usage: python parse_bank_cic.py <fichier.pdf>
Output: JSON sur stdout
"""
import pdfplumber, re, json, sys, os
sys.stdout.reconfigure(encoding='utf-8')

DATE_RE   = re.compile(r'^\d{2}/\d{2}/\d{4}$')
AMOUNT_RE = re.compile(r'^\d[\d\.]*,\d{2}$')

def parse_amount(s):
    return float(s.replace('\xa0','').replace(' ','').replace('.','').replace(',','.'))

def to_iso(s):
    d, m, y = s.split('/')
    return f'{y}-{m}-{d}'

def categorize(label):
    u = label.upper()
    if 'REMCB' in u: return 'Recettes TPE (REMCB)'
    if 'COMCB' in u: return 'Commissions TPE (COMCB)'
    if 'URSSAF' in u: return 'Charges sociales (URSSAF)'
    if 'MALAKOFF' in u: return 'Retraite (Malakoff)'
    if 'SOLUPAIE' in u: return 'Gestion paie (Solupaie)'
    if 'ACM IARD' in u and 'SANTE' in u: return 'Mutuelle / Prévoyance'
    if 'ACM IARD' in u or 'MULTI PRO' in u: return 'Assurance pro'
    if 'EPS' in u and ('ASSURANCE' in u or 'EPS REF' in u): return 'Assurance pro'
    if 'ENGIE' in u: return 'Énergie (ENGIE)'
    if 'LYCAMOBILE' in u: return 'Télécom (SFR/FREE)'
    if 'SFR' in u or 'FREE PRO' in u: return 'Télécom (SFR/FREE)'
    if 'ORANGE SA' in u or 'ORANGE' in u and 'FIBRE' in u: return 'Télécom (SFR/FREE)'
    if 'INFOMANIAK' in u or 'CHIMERATOOL' in u: return 'Informatique / Hébergement'
    if 'DGFIP' in u or ('TVA' in u and 'DGFIP' in u): return 'Impôts / TVA (DGFIP)'
    if 'DGFIP' in u and ('CFE' in u or 'IMPOT' in u): return 'Impôts / TVA (DGFIP)'
    if 'DGFIP' in u: return 'Impôts / TVA (DGFIP)'
    if 'LOYER' in u or ('AVOCAT' in u and 'BAIL' in u): return 'Loyers'
    if 'SALAIRE' in u or 'SALAIRES' in u: return 'Salaires'
    if 'FACT SGT' in u or 'FRAIS BANCAIRES' in u or 'FRAIS BANC' in u: return 'Frais bancaires CIC'
    if 'MONDIAL RELAY' in u: return 'Transport / Livraison'
    if 'EURO-INFORMATION' in u or 'LOCATION TPE' in u: return 'Location TPE'
    if 'SMART GADGET' in u or 'UTOPYA' in u or 'UTOPIA' in u or 'LCD' in u: return 'Fournisseurs (achats CB)'
    if 'PAIEMENT CB' in u or 'PAIEMENT PSC' in u: return 'Achats CB'
    if 'PRLV SEPA' in u or u.startswith('PRLV'): return 'Prélèvements divers'
    if 'VIR INST' in u or 'VIR SALAIRE' in u or u.startswith('VIR'): return 'Virements'
    if 'VRST' in u: return 'Versements espèces'
    if 'CHEQUE' in u: return 'Chèques'
    return 'Autres'

def lines_from_page(page):
    """Regroupe les mots d'une page par ligne (top arrondi)."""
    words = page.extract_words(keep_blank_chars=False)
    buckets = {}
    for w in words:
        y = round(w['top'])
        buckets.setdefault(y, []).append(w)
    return [(y, sorted(v, key=lambda x: x['x0'])) for y, v in sorted(buckets.items())]

def find_col_threshold(words):
    """Trouve le seuil X entre colonne Débit et Crédit."""
    debit_x = None
    credit_x = None
    for w in words:
        if w['text'] == 'Débit':
            debit_x = w['x0']
        if w['text'] == 'Crédit' and w['x0'] > 400:
            credit_x = w['x0']
    if debit_x and credit_x:
        return (debit_x + credit_x) / 2
    return 470  # fallback

def parse_pdf(path):
    solde_lines = []       # toutes les lignes SOLDE trouvées
    total_debit = None
    total_credit = None
    transactions = []

    with pdfplumber.open(path) as pdf:
        # Seuil X déterminé sur la 1ère page avec en-tête de colonnes
        threshold = 470
        for pg in pdf.pages:
            ws = pg.extract_words()
            t = find_col_threshold(ws)
            if t != 470:
                threshold = t
                break

        for pg in pdf.pages:
            # Seuil recalculé par page (la mise en page peut varier légèrement)
            pg_threshold = find_col_threshold(pg.extract_words())
            if pg_threshold == 470:
                pg_threshold = threshold

            for y, line_words in lines_from_page(pg):
                texts = [w['text'] for w in line_words]

                # --- SOLDE CREDITEUR AU DD/MM/YYYY XX,XX ---
                if 'SOLDE' in texts and 'CREDITEUR' in texts:
                    amounts = [w for w in line_words if AMOUNT_RE.match(w['text'])]
                    dates   = [w for w in line_words if DATE_RE.match(w['text'])]
                    if amounts and dates:
                        solde_lines.append((to_iso(dates[0]['text']), parse_amount(amounts[0]['text'])))

                # --- Total des mouvements ---
                if 'Total' in texts and 'mouvements' in texts:
                    amounts = sorted(
                        [w for w in line_words if AMOUNT_RE.match(w['text'])],
                        key=lambda w: w['x0']
                    )
                    if len(amounts) >= 2:
                        total_debit  = parse_amount(amounts[0]['text'])
                        total_credit = parse_amount(amounts[1]['text'])

                # --- Ligne de transaction : DD/MM/YYYY DD/MM/YYYY LIBELLÉ MONTANT ---
                if len(texts) >= 2 and DATE_RE.match(texts[0]) and DATE_RE.match(texts[1]):
                    date_op  = to_iso(texts[0])
                    amounts = [w for w in line_words if AMOUNT_RE.match(w['text'])]
                    label_words = [
                        w for w in line_words
                        if not DATE_RE.match(w['text']) and not AMOUNT_RE.match(w['text'])
                    ]
                    label = ' '.join(w['text'] for w in label_words).strip()
                    debit  = 0.0
                    credit = 0.0
                    for aw in amounts:
                        amt = parse_amount(aw['text'])
                        if aw['x0'] < pg_threshold:
                            debit += amt
                        else:
                            credit += amt
                    if label or debit or credit:
                        transactions.append({
                            'transaction_date': date_op,
                            'label': label,
                            'debit': round(debit, 2),
                            'credit': round(credit, 2),
                            'category': categorize(label),
                        })

    # Solde initial = premier SOLDE, final = dernier SOLDE différent
    balance_start = None
    balance_end   = None
    period_start  = None
    period_end    = None

    if solde_lines:
        period_start, balance_start = solde_lines[0]
        if len(solde_lines) > 1:
            period_end, balance_end = solde_lines[-1]
        else:
            period_end = period_start

    # Fallback period_end depuis le nom du fichier
    if period_end is None:
        m = re.search(r'(\d{4}-\d{2}-\d{2})\.pdf$', os.path.basename(path), re.IGNORECASE)
        if m:
            period_end = m.group(1)

    calc_debit  = round(sum(t['debit']  for t in transactions), 2)
    calc_credit = round(sum(t['credit'] for t in transactions), 2)

    return {
        'bank_name':      'CIC',
        'account_number': '00020370701',
        'period_start':   period_start,
        'period_end':     period_end,
        'balance_start':  balance_start,
        'balance_end':    balance_end,
        'total_debit':    total_debit  if total_debit  is not None else calc_debit,
        'total_credit':   total_credit if total_credit is not None else calc_credit,
        'transactions':   transactions,
    }

MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet',
             'Août','Septembre','Octobre','Novembre','Décembre']

def period_notes(period_start):
    """Génère le label mensuel lisible, ex. 'Décembre 2025'."""
    try:
        from datetime import datetime
        dt = datetime.strptime(period_start, '%Y-%m-%d')
        return f"{MONTHS_FR[dt.month-1]} {dt.year}"
    except Exception:
        return period_start

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: parse_bank_cic.py <fichier.pdf>'}))
        sys.exit(1)
    result = parse_pdf(sys.argv[1])
    result['notes'] = period_notes(result.get('period_start') or '')
    print(json.dumps(result, ensure_ascii=False))
