// Shared logic for the show admin tools. One script, two pages:
//   - "Add New Show" (/admin/add-show/)        — has #show-form (create, or edit via ?id=)
//   - "Manage Previous Shows" (/admin/shows/)   — has #shows-list (list + delete)
// Each block below only runs if its DOM is present, so the same file drives both.
// Requires tools/rekordbox-to-tracklist.js to be loaded first on the form page.
(function () {
  'use strict';

  const API = '/api/admin';
  const $ = (id) => document.getElementById(id);
  const authEl = $('auth-status');

  function setStatus(el, msg, kind = '') {
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'status' + (kind ? ' ' + kind : '');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function toLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fromLocalInput(v) {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d) ? null : d.toISOString();
  }

  function extractKey(url) {
    const m = url.match(/\/api\/images\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  async function api(path, opts = {}) {
    const res = await fetch(API + path, {
      credentials: 'include',
      headers: opts.body && !(opts.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : undefined,
      ...opts,
    });
    if (res.status === 401 || res.status === 403) {
      setStatus(authEl, 'Not authenticated. Refresh to log in via Cloudflare Access.', 'error');
      throw new Error('Unauthorized');
    }
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error((data && data.error) || res.statusText);
    return data;
  }

  // ---------- Add / Edit form (Add New Show page) ----------

  const form = $('show-form');
  if (form) {
    const statusEl = $('form-status');
    const imgPreview = $('image-preview');
    let editingExisting = false;

    const loadIntoForm = (s) => {
      editingExisting = true;
      $('form-title').textContent = 'Edit Show';
      $('editing-id').value = s.id;
      $('id').value = s.id;
      $('id').disabled = true;
      $('title').value = s.title || '';
      $('description').value = s.description || '';
      $('mixcloudPath').value = s.mixcloudPath || '';
      $('soundcloudUrl').value = s.soundcloudUrl || '';
      $('airedAt').value = toLocalInput(s.airedAt);
      $('durationMin').value = s.durationMin || '';
      $('producer').value = s.producer || '';
      $('isPublished').checked = s.isPublished !== false;
      $('tracklist').value = (s.tracklist || []).join('\n');
      $('imageKey').value = s.image ? extractKey(s.image) : '';
      if (s.image) {
        imgPreview.src = s.image;
        imgPreview.style.display = 'block';
      } else {
        imgPreview.removeAttribute('src');
        imgPreview.style.display = 'none';
      }
      setStatus(statusEl, '');
    };

    const resetForm = () => {
      editingExisting = false;
      form.reset();
      $('form-title').textContent = 'New Show';
      $('editing-id').value = '';
      $('id').disabled = false;
      $('imageKey').value = '';
      imgPreview.removeAttribute('src');
      imgPreview.style.display = 'none';
      setStatus(statusEl, '');
    };

    const uploadImage = async (file) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api('/images', { method: 'POST', body: fd });
      return res.key;
    };

    $('image-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setStatus(statusEl, 'Uploading image…');
      try {
        const key = await uploadImage(file);
        $('imageKey').value = key;
        imgPreview.src = '/api/images/' + encodeURIComponent(key);
        imgPreview.style.display = 'block';
        setStatus(statusEl, 'Image uploaded.', 'success');
      } catch (err) {
        setStatus(statusEl, 'Image upload failed: ' + err.message, 'error');
      }
    });

    rekordboxToTracklist.attach($('rekordbox-file'), (tracks) => {
      $('tracklist').value = tracks.join('\n');
    });

    $('reset-btn').addEventListener('click', resetForm);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setStatus(statusEl, '');
      const airedIso = fromLocalInput($('airedAt').value);
      if (!airedIso) { setStatus(statusEl, 'Invalid aired-at datetime', 'error'); return; }

      const body = {
        id: $('id').value.trim(),
        title: $('title').value.trim(),
        description: $('description').value.trim(),
        mixcloudPath: $('mixcloudPath').value.trim(),
        soundcloudUrl: $('soundcloudUrl').value.trim() || null,
        airedAt: airedIso,
        durationMin: $('durationMin').value ? Number($('durationMin').value) : null,
        producer: $('producer').value.trim() || null,
        imageKey: $('imageKey').value || null,
        isPublished: $('isPublished').checked,
        tracklist: $('tracklist').value.split('\n').map((l) => l.trim()).filter(Boolean),
      };

      try {
        $('save-btn').disabled = true;
        if (editingExisting) {
          await api('/shows/' + encodeURIComponent($('editing-id').value), {
            method: 'PUT',
            body: JSON.stringify(body),
          });
          setStatus(statusEl, 'Show updated. Return to Manage Previous Shows to see it.', 'success');
        } else {
          await api('/shows', { method: 'POST', body: JSON.stringify(body) });
          setStatus(statusEl, 'Show created.', 'success');
          resetForm();
        }
      } catch (err) {
        setStatus(statusEl, err.message, 'error');
      } finally {
        $('save-btn').disabled = false;
      }
    });

    // Edit mode: /admin/add-show/?id=<showId> loads that show into the form.
    const editId = new URLSearchParams(window.location.search).get('id');
    if (editId) {
      setStatus(authEl, 'Loading show…');
      api('/shows')
        .then((shows) => {
          const s = shows.find((x) => x.id === editId);
          if (s) { loadIntoForm(s); setStatus(authEl, ''); }
          else setStatus(authEl, `Show "${editId}" not found.`, 'error');
        })
        .catch((err) => setStatus(authEl, err.message, 'error'));
    }
  }

  // ---------- List (Manage Previous Shows page) ----------

  const listEl = $('shows-list');
  if (listEl) {
    const deleteShow = async (id, title) => {
      if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
      try {
        await api('/shows/' + encodeURIComponent(id), { method: 'DELETE' });
        await loadShows();
      } catch (err) {
        alert('Delete failed: ' + err.message);
      }
    };

    async function loadShows() {
      listEl.textContent = 'Loading…';
      try {
        const shows = await api('/shows');
        if (!shows.length) {
          listEl.innerHTML = '<p>No shows yet.</p>';
          return;
        }
        listEl.innerHTML = '';
        shows.forEach((s) => {
          const row = document.createElement('div');
          row.className = 'show-row';
          const info = document.createElement('div');
          const aired = new Date(s.airedAt);
          info.innerHTML = `<strong>${escapeHtml(s.title)}</strong>` +
            `<div class="meta">${s.id} · ${isNaN(aired) ? s.airedAt : aired.toLocaleString()}` +
            (s.isPublished === false ? ' · <em>unpublished</em>' : '') + '</div>';
          const edit = document.createElement('button');
          edit.textContent = 'Edit';
          edit.className = 'secondary';
          edit.onclick = () => {
            window.location.href = '/admin/add-show/index.html?id=' + encodeURIComponent(s.id);
          };
          const del = document.createElement('button');
          del.textContent = 'Delete';
          del.className = 'danger';
          del.onclick = () => deleteShow(s.id, s.title);
          row.append(info, edit, del);
          listEl.appendChild(row);
        });
      } catch (err) {
        listEl.innerHTML = '<p>Failed to load: ' + escapeHtml(err.message) + '</p>';
      }
    }

    loadShows();
  }
})();
