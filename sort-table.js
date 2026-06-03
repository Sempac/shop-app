/* sort-table.js — tri colonnes ascendant/descendant */
(function () {
  'use strict';

  const css = document.createElement('style');
  css.textContent = `
    thead th.sortable { cursor:pointer !important; user-select:none; white-space:nowrap; padding-right:24px !important; position:relative !important; }
    thead th.sortable::after { content:'⇅'; position:absolute !important; right:5px; top:50%; transform:translateY(-50%); font-size:14px; opacity:.3; color:inherit; }
    thead th.sort-asc::after  { content:'▲' !important; font-size:12px !important; opacity:1 !important; color:#2563eb !important; text-shadow:0 0 4px #2563eb88; }
    thead th.sort-desc::after { content:'▼' !important; font-size:12px !important; opacity:1 !important; color:#dc2626 !important; text-shadow:0 0 4px #dc262688; }
    thead th.sort-asc  { background:rgba(37,99,235,.12) !important; color:#1d4ed8 !important; }
    thead th.sort-desc { background:rgba(220,38,38,.10) !important; color:#b91c1c !important; }
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

    // Marquer les th triables
    function markThs() {
      Array.from(thead.querySelectorAll('th')).forEach(th => {
        if (th.textContent.trim() && !th.classList.contains('no-sort')) {
          th.classList.add('sortable');
        }
      });
    }
    markThs();

    // État du tri (un seul par table)
    const state = { col: -1, asc: true, sorting: false };

    // UN seul listener sur le thead — délégation, jamais dupliqué
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

      // Flag pour ignorer les mutations causées par le tri lui-même
      state.sorting = true;
      doSort(table, colIndex, state.asc);
      state.sorting = false;
    });

    // Quand le tbody est rechargé (vrai rechargement de données), reset visuel
    function watchTbody(tbody) {
      if (tbody._sortWatched) return;
      tbody._sortWatched = true;
      new MutationObserver(() => {
        if (state.sorting) return; // ignorer les mutations du tri lui-même
        thead.querySelectorAll('th').forEach(t => t.classList.remove('sort-asc', 'sort-desc'));
        state.col = -1;
        state.asc = true;
      }).observe(tbody, { childList: true });
    }

    const tbody = table.querySelector('tbody');
    if (tbody) watchTbody(tbody);

    // Cas lots.html : un nouveau tbody peut être appendé après coup
    new MutationObserver(mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.tagName === 'TBODY') watchTbody(node);
        });
      });
    }).observe(table, { childList: true });
  }

  function processAll() {
    document.querySelectorAll('table').forEach(t => {
      if (t.querySelector('thead')) initTable(t);
    });
  }

  // Observer pour les tables ajoutées dynamiquement (ex: modals, lots détail)
  new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        const tables = node.tagName === 'TABLE' ? [node] : Array.from(node.querySelectorAll ? node.querySelectorAll('table') : []);
        tables.forEach(t => { if (t.querySelector('thead')) initTable(t); });
      });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('DOMContentLoaded', processAll);
})();
