/* sort-table.js — tri universel sur les colonnes de tableaux */
(function () {
  'use strict';

  const css = document.createElement('style');
  css.textContent = `
    thead th.sortable { cursor:pointer; user-select:none; white-space:nowrap; padding-right:20px !important; position:relative; }
    thead th.sortable::after { content:'⇅'; position:absolute; right:5px; top:50%; transform:translateY(-50%); font-size:10px; opacity:.3; }
    thead th.sort-asc::after  { content:'↑'; opacity:1; color:#3b82f6; }
    thead th.sort-desc::after { content:'↓'; opacity:1; color:#3b82f6; }
  `;
  document.head.appendChild(css);

  function parseVal(text) {
    if (!text) return '';
    const t = text.trim();
    // Montant : retire symboles monétaires/espaces, garde chiffres/virgule/point/signe
    const raw = t.replace(/[€$\s%]/g, '').replace(',', '.');
    const n = parseFloat(raw);
    if (!isNaN(n) && raw !== '') return n;
    // Date jj/mm/aaaa
    const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
    // Date ISO yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return new Date(t).getTime();
    return t.toLowerCase();
  }

  function doSort(table, colIndex, asc) {
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
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
    const headerRow = table.querySelector('thead tr');
    if (!headerRow) return;
    const ths = Array.from(headerRow.querySelectorAll('th'));

    ths.forEach((th, colIndex) => {
      if (!th.textContent.trim() || th.classList.contains('no-sort') || th.dataset.sortBound) return;
      th.dataset.sortBound = '1';
      th.classList.add('sortable');
      let asc = true;
      th.addEventListener('click', () => {
        ths.forEach(t => t.classList.remove('sort-asc', 'sort-desc'));
        th.classList.add(asc ? 'sort-asc' : 'sort-desc');
        doSort(table, colIndex, asc);
        asc = !asc;
      });
    });
  }

  function resetAndInit(table) {
    table.querySelectorAll('thead th').forEach(th => {
      th.classList.remove('sortable', 'sort-asc', 'sort-desc');
      delete th.dataset.sortBound;
    });
    initTable(table);
  }

  function watchTbody(table) {
    const tbody = table.querySelector('tbody');
    if (!tbody || tbody._sortWatched) return;
    tbody._sortWatched = true;
    new MutationObserver(() => resetAndInit(table)).observe(tbody, { childList: true });
  }

  function processTable(table) {
    if (!table.querySelector('thead')) return;
    initTable(table);
    watchTbody(table);
  }

  // Observer pour les tables ajoutées dynamiquement
  function observeDOM() {
    new MutationObserver(mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          const tables = node.tagName === 'TABLE' ? [node] : Array.from(node.querySelectorAll ? node.querySelectorAll('table') : []);
          tables.forEach(processTable);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('table').forEach(processTable);
    observeDOM();
  });
})();
