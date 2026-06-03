/* sort-table.js — tri colonnes ascendant/descendant */
(function () {
  'use strict';

  const css = document.createElement('style');
  css.textContent = `
    thead th.sortable { cursor:pointer !important; user-select:none; white-space:nowrap; padding-right:24px !important; position:relative !important; }
    thead th.sortable::after { content:'⇅'; position:absolute !important; right:5px; top:50%; transform:translateY(-50%); font-size:14px; opacity:.3; color:inherit; }
    thead th.sort-asc::after  { content:'▲' !important; font-size:12px !important; opacity:1 !important; color:#38bdf8 !important; text-shadow:0 0 5px #38bdf8; }
    thead th.sort-desc::after { content:'▼' !important; font-size:12px !important; opacity:1 !important; color:#f87171 !important; text-shadow:0 0 5px #f87171; }
    thead th.sort-asc  { box-shadow:inset 0 -3px 0 #38bdf8 !important; }
    thead th.sort-desc { box-shadow:inset 0 -3px 0 #f87171 !important; }
  `;
  document.head.appendChild(css);

  function parseVal(text) {
    if (!text) return '';
    const t = text.trim();
    const raw = t.replace(/[€$\s%]/g, '').replace(',', '.');
    const n = parseFloat(raw);
    if (!isNaN(n) && raw !== '') return n;
    const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return new Date(t).getTime();
    return t.toLowerCase();
  }

  function doSort(table, colIndex, asc) {
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length < 2) return;
    rows.sort((a, b) => {
      const va = parseVal(a.cells[colIndex] ? a.cells[colIndex].innerText : '');
      const vb = parseVal(b.cells[colIndex] ? b.cells[colIndex].innerText : '');
      if (typeof va === 'number' && typeof vb === 'number') return asc ? va - vb : vb - va;
      return asc
        ? String(va).localeCompare(String(vb), 'fr', { numeric: true })
        : String(vb).localeCompare(String(va), 'fr', { numeric: true });
    });
    rows.forEach(r => tbody.appendChild(r));
  }

  function initTable(table) {
    if (table._sortInited) return;
    const thead = table.querySelector('thead');
    if (!thead) return;
    table._sortInited = true;

    Array.from(thead.querySelectorAll('th')).forEach(th => {
      if (th.textContent.trim() && !th.classList.contains('no-sort'))
        th.classList.add('sortable');
    });

    const state = { col: -1, asc: true, sorting: false };

    thead.addEventListener('click', function (e) {
      const th = e.target.closest('th.sortable');
      if (!th) return;
      const ths = Array.from(thead.querySelectorAll('th'));
      const colIndex = ths.indexOf(th);
      if (colIndex === -1) return;

      state.asc = state.col === colIndex ? !state.asc : true;
      state.col = colIndex;

      ths.forEach(t => t.classList.remove('sort-asc', 'sort-desc'));
      th.classList.add(state.asc ? 'sort-asc' : 'sort-desc');

      // Le flag doit rester vrai jusqu'APRES que les microtasks MutationObserver
      // aient fini — on le remet à false via setTimeout (macro-task suivante)
      state.sorting = true;
      doSort(table, colIndex, state.asc);
      setTimeout(() => { state.sorting = false; }, 0);
    });

    // Reset visuel quand les données sont rechargées (pas lors d'un tri)
    function watchTbody(tbody) {
      if (tbody._sortWatched) return;
      tbody._sortWatched = true;
      new MutationObserver(() => {
        if (state.sorting) return;
        thead.querySelectorAll('th').forEach(t => t.classList.remove('sort-asc', 'sort-desc'));
        state.col = -1;
        state.asc = true;
      }).observe(tbody, { childList: true });
    }

    const tbody = table.querySelector('tbody');
    if (tbody) watchTbody(tbody);

    // Nouveau tbody ajouté dynamiquement (ex: renderLotStockProds dans lots.html)
    new MutationObserver(mutations => {
      mutations.forEach(m => m.addedNodes.forEach(node => {
        if (node.tagName === 'TBODY') watchTbody(node);
      }));
    }).observe(table, { childList: true });
  }

  // Scan toutes les tables avec thead dans le document
  function processAll() {
    document.querySelectorAll('table').forEach(t => {
      if (t.querySelector('thead')) initTable(t);
    });
  }

  // API publique : à appeler après un rendu dynamique si besoin
  window.initSortable = processAll;

  // Observer pour les tables ajoutées dynamiquement
  new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        const tables = node.tagName === 'TABLE'
          ? [node]
          : Array.from(node.querySelectorAll ? node.querySelectorAll('table') : []);
        tables.forEach(t => { if (t.querySelector('thead')) initTable(t); });
      });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('DOMContentLoaded', processAll);
})();
