/* NeuronNotes — virtual vault, [[wiki-links]], #tags, backlinks, md import/export (v3 Canonical IDs & Link Refactoring) */
const NotesVault = {
  notes: [], // { id, title, body, updatedAt }
  activeId: null,
  filterTag: null,
  query: '',
};

function getUUID() {
  if (typeof Scoring !== 'undefined' && Scoring.generateUUID) {
    return Scoring.generateUUID();
  }
  return 'n_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

function loadVault() {
  try {
    const r = JSON.parse(localStorage.getItem('neuronnotes_vault_v1') || 'null');
    if (r && Array.isArray(r.notes)) {
      NotesVault.notes = r.notes;
      NotesVault.activeId = r.activeId || (r.notes[0] && r.notes[0].id) || null;
    }
  } catch (_) {}
  if (!NotesVault.notes.length) {
    const id = getUUID();
    NotesVault.notes.push({
      id,
      title: 'Welcome',
      body: '# Welcome to NeuronNotes\n\nUse [[Wiki Links]] and #tags.\n\nLink study ideas while you grind Flipodoro sessions.\n\nPaste images from clipboard — they embed as base64 (portable md).',
      updatedAt: Date.now(),
    });
    NotesVault.activeId = id;
    saveVault();
  }
}

function saveVault() {
  localStorage.setItem('neuronnotes_vault_v1', JSON.stringify({
    notes: NotesVault.notes,
    activeId: NotesVault.activeId,
  }));
}

function getActive() {
  return NotesVault.notes.find(n => n.id === NotesVault.activeId) || null;
}

/** Refactors all occurrences of [[Old Title]] to [[New Title]] across all notes */
function refactorVaultWikiLinks(oldTitle, newTitle) {
  if (!oldTitle || !newTitle || oldTitle.toLowerCase() === newTitle.toLowerCase()) return;
  
  const escapedOld = oldTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('\\[\\[\\s*' + escapedOld + '\\s*\\]\\]', 'gi');

  NotesVault.notes.forEach(note => {
    if (re.test(note.body)) {
      note.body = note.body.replace(re, `[[${newTitle}]]`);
      note.updatedAt = Date.now();
    }
  });
}

function upsertNote(partial) {
  const n = getActive();
  if (!n) return;

  const oldTitle = n.title;
  let titleChanged = false;

  if (partial.title != null) {
    const cleanTitle = partial.title.trim() || 'Untitled';
    if (cleanTitle.toLowerCase() !== oldTitle.toLowerCase()) {
      titleChanged = true;
    }
    n.title = cleanTitle;
  }
  
  if (partial.body != null) n.body = partial.body;
  n.updatedAt = Date.now();

  if (titleChanged) {
    refactorVaultWikiLinks(oldTitle, n.title);
  }

  saveVault();
}

function createNote(title = 'Untitled', body = '') {
  const id = getUUID();
  let t = title.trim() || 'Untitled';
  const exists = NotesVault.notes.some(n => n.title.toLowerCase() === t.toLowerCase());
  if (exists) t = t + ' ' + NotesVault.notes.length;
  NotesVault.notes.unshift({ id, title: t, body, updatedAt: Date.now() });
  NotesVault.activeId = id;
  saveVault();
  return id;
}

function deleteActive() {
  if (NotesVault.notes.length <= 1) return false;
  NotesVault.notes = NotesVault.notes.filter(n => n.id !== NotesVault.activeId);
  NotesVault.activeId = NotesVault.notes[0].id;
  saveVault();
  return true;
}

function openByTitle(title) {
  const found = NotesVault.notes.find(n => n.title.toLowerCase() === title.toLowerCase());
  if (found) {
    NotesVault.activeId = found.id;
    saveVault();
    return found.id;
  }
  return createNote(title, '# ' + title + '\n\n');
}

function extractTags(body) {
  const tags = new Set();
  const re = /(^|[\s(])#([a-zA-Z][\w-]*)/g;
  let m;
  while ((m = re.exec(body))) tags.add(m[2].toLowerCase());
  return [...tags];
}

function extractWikiLinks(body) {
  const links = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m;
  while ((m = re.exec(body))) links.push(m[1].trim());
  return links;
}

function allTags() {
  const map = new Map();
  for (const n of NotesVault.notes) {
    for (const t of extractTags(n.body)) {
      map.set(t, (map.get(t) || 0) + 1);
    }
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function backlinksTo(title) {
  return NotesVault.notes.filter(n => {
    if (n.title.toLowerCase() === title.toLowerCase()) return false;
    return extractWikiLinks(n.body).some(l => l.toLowerCase() === title.toLowerCase());
  });
}

function filteredNotes() {
  let list = [...NotesVault.notes];
  if (NotesVault.filterTag) {
    list = list.filter(n => extractTags(n.body).includes(NotesVault.filterTag));
  }
  if (NotesVault.query.trim()) {
    const q = NotesVault.query.trim().toLowerCase();
    list = list.filter(n =>
      n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
    );
  }
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

function renderMarkdown(md) {
  let html = md;
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />');
  html = html.replace(/\[\[([^\]]+)\]\]/g, (_, t) =>
    '<span class="wiki-link" data-wiki="' + escAttr(t) + '">[[' + esc(t) + ']]</span>'
  );
  html = html.replace(/(^|[\s(])#([a-zA-Z][\w-]*)/g, '$1<span class="hashtag">#$2</span>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.split(/\n{2,}/).map(block => {
    if (/^<h[1-3]>/.test(block)) return block;
    return '<p>' + block.replace(/\n/g, '<br>') + '</p>';
  }).join('');
  return html;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function exportAllMarkdown() {
  for (const n of NotesVault.notes) {
    const safe = n.title.replace(/[^\w\- ]+/g, '').trim() || 'note';
    const blob = new Blob([n.body], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = safe + '.md';
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

function importMarkdownFiles(fileList) {
  [...fileList].forEach(file => {
    const reader = new FileReader();
    reader.onload = () => {
      const body = String(reader.result || '');
      const title = file.name.replace(/\.md$/i, '') || 'Imported';
      createNote(title, body);
      if (window.NotesUI) window.NotesUI.refresh();
    };
    reader.readAsText(file);
  });
}

function handleImagePaste(e, textarea) {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return false;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const md = '\n![pasted-image](' + dataUrl + ')\n';
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const val = textarea.value;
        textarea.value = val.slice(0, start) + md + val.slice(end);
        textarea.selectionStart = textarea.selectionEnd = start + md.length;
        textarea.dispatchEvent(new Event('input'));
      };
      reader.readAsDataURL(file);
      return true;
    }
  }
  return false;
}

window.NeuronNotes = {
  NotesVault, loadVault, saveVault, getActive, upsertNote, createNote, deleteActive,
  openByTitle, extractTags, extractWikiLinks, allTags, backlinksTo, filteredNotes,
  renderMarkdown, exportAllMarkdown, importMarkdownFiles, handleImagePaste, esc,
};