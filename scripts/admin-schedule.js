// Admin tool for the broadcast schedule (/admin/schedule/).
// One page, two kinds of event sharing the /api/admin/schedule endpoints:
//   - recurring rules (the monthly show, editable)  -> #recurring-form / #recurring-list
//   - one-off ad-hoc shows & specials               -> #oneoff-form    / #oneoff-list
// Mirrors the conventions in scripts/admin-shows.js (api() helper + Cloudflare Access).
(function () {
  'use strict';

  const API = '/api/admin';
  const $ = (id) => document.getElementById(id);
  const authEl = $('auth-status');

  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th'];

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

  // ---------- Shared list rendering ----------

  function describeRecurring(e) {
    const day = WEEKDAYS[e.recWeekday] || '?';
    const when = e.recFreq === 'monthly'
      ? `Monthly · ${ORDINALS[e.recWeek] || e.recWeek + 'th'} ${day}`
      : `Weekly · ${day}`;
    const skips = e.skips && e.skips.length ? ` · ${e.skips.length} skip${e.skips.length !== 1 ? 's' : ''}` : '';
    return `${when} · ${e.recTime} (${e.durationMin}m) · ${e.timezone}${skips}`;
  }

  function describeOneoff(e) {
    const d = new Date(e.startsAt);
    const when = isNaN(d) ? e.startsAt : d.toLocaleString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: e.timezone || 'Europe/London',
    });
    return `${when} (${e.durationMin}m)${e.linkUrl ? ' · has link' : ''}`;
  }

  function renderList(listEl, events, describe, onEdit, onDelete) {
    if (!events.length) {
      listEl.innerHTML = '<p>None yet.</p>';
      return;
    }
    listEl.innerHTML = '';
    events.forEach((e) => {
      const row = document.createElement('div');
      row.className = 'sched-row';
      const info = document.createElement('div');
      info.innerHTML = `<strong>${escapeHtml(e.title)}</strong>` +
        `<div class="meta">${escapeHtml(describe(e))}` +
        (e.isActive === false ? ' · <span class="inactive">inactive</span>' : '') + '</div>';
      const edit = document.createElement('button');
      edit.textContent = 'Edit';
      edit.className = 'secondary';
      edit.onclick = () => onEdit(e);
      const del = document.createElement('button');
      del.textContent = 'Delete';
      del.className = 'danger';
      del.onclick = () => onDelete(e);
      row.append(info, edit, del);
      listEl.appendChild(row);
    });
  }

  async function deleteEvent(e) {
    if (!confirm(`Delete "${e.title}"? This cannot be undone.`)) return;
    try {
      await api('/schedule/' + encodeURIComponent(e.id), { method: 'DELETE' });
      await loadAll();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  async function loadAll() {
    const recEl = $('recurring-list');
    const oneEl = $('oneoff-list');
    recEl.textContent = 'Loading…';
    oneEl.textContent = 'Loading…';
    try {
      const events = await api('/schedule');
      renderList(recEl, events.filter((e) => e.kind === 'recurring'),
        describeRecurring, loadIntoRecurring, deleteEvent);
      renderList(oneEl, events.filter((e) => e.kind === 'oneoff'),
        describeOneoff, loadIntoOneoff, deleteEvent);
    } catch (err) {
      recEl.innerHTML = '<p>Failed to load: ' + escapeHtml(err.message) + '</p>';
      oneEl.innerHTML = '';
    }
  }

  // ---------- Recurring form ----------

  function syncRecWeekVisibility() {
    $('rec-week-wrap').style.display = $('rec-freq').value === 'monthly' ? '' : 'none';
  }

  function resetRecurring() {
    $('recurring-form').reset();
    $('rec-editing-id').value = '';
    $('rec-title').value = 'Bog Factor';
    $('rec-freq').value = 'monthly';
    $('rec-week').value = '1';
    $('rec-weekday').value = '5';
    $('rec-time').value = '13:00';
    $('rec-duration').value = '60';
    $('rec-timezone').value = 'Europe/London';
    $('rec-active').checked = true;
    $('recurring-form-title').textContent = 'New recurring rule';
    syncRecWeekVisibility();
    setStatus($('rec-status'), '');
  }

  function loadIntoRecurring(e) {
    $('rec-editing-id').value = e.id;
    $('rec-title').value = e.title || '';
    $('rec-description').value = e.description || '';
    $('rec-freq').value = e.recFreq || 'monthly';
    $('rec-week').value = e.recWeek || 1;
    $('rec-weekday').value = e.recWeekday != null ? e.recWeekday : 5;
    $('rec-time').value = e.recTime || '13:00';
    $('rec-duration').value = e.durationMin || 60;
    $('rec-timezone').value = e.timezone || 'Europe/London';
    $('rec-from').value = e.recFrom || '';
    $('rec-until').value = e.recUntil || '';
    $('rec-skips').value = (e.skips || []).join('\n');
    $('rec-active').checked = e.isActive !== false;
    $('recurring-form-title').textContent = 'Edit recurring rule';
    syncRecWeekVisibility();
    setStatus($('rec-status'), '');
    $('recurring-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function initRecurringForm() {
    const form = $('recurring-form');
    if (!form) return;
    const statusEl = $('rec-status');
    $('rec-freq').addEventListener('change', syncRecWeekVisibility);
    $('rec-reset-btn').addEventListener('click', resetRecurring);
    syncRecWeekVisibility();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setStatus(statusEl, '');
      const freq = $('rec-freq').value;
      const body = {
        kind: 'recurring',
        title: $('rec-title').value.trim(),
        description: $('rec-description').value.trim() || null,
        recFreq: freq,
        recWeek: freq === 'monthly' ? Number($('rec-week').value) : null,
        recWeekday: Number($('rec-weekday').value),
        recTime: $('rec-time').value,
        durationMin: Number($('rec-duration').value),
        timezone: $('rec-timezone').value.trim() || 'Europe/London',
        recFrom: $('rec-from').value || null,
        recUntil: $('rec-until').value || null,
        isActive: $('rec-active').checked,
        skips: $('rec-skips').value.split('\n').map((s) => s.trim()).filter(Boolean),
      };
      const editingId = $('rec-editing-id').value;
      try {
        $('rec-save-btn').disabled = true;
        if (editingId) {
          await api('/schedule/' + encodeURIComponent(editingId), { method: 'PUT', body: JSON.stringify(body) });
          setStatus(statusEl, 'Rule updated.', 'success');
        } else {
          await api('/schedule', { method: 'POST', body: JSON.stringify(body) });
          setStatus(statusEl, 'Rule created.', 'success');
          resetRecurring();
        }
        await loadAll();
      } catch (err) {
        setStatus(statusEl, err.message, 'error');
      } finally {
        $('rec-save-btn').disabled = false;
      }
    });
  }

  // ---------- One-off form ----------

  function resetOneoff() {
    $('oneoff-form').reset();
    $('one-editing-id').value = '';
    $('one-imageKey').value = '';
    $('one-duration').value = '60';
    $('one-timezone').value = 'Europe/London';
    $('one-active').checked = true;
    const prev = $('one-image-preview');
    prev.removeAttribute('src');
    prev.style.display = 'none';
    $('oneoff-form-title').textContent = 'New ad-hoc show';
    setStatus($('one-status'), '');
  }

  function loadIntoOneoff(e) {
    $('one-editing-id').value = e.id;
    $('one-title').value = e.title || '';
    $('one-description').value = e.description || '';
    $('one-startsAt').value = toLocalInput(e.startsAt);
    $('one-duration').value = e.durationMin || 60;
    $('one-timezone').value = e.timezone || 'Europe/London';
    $('one-link').value = e.linkUrl || '';
    $('one-imageKey').value = e.imageKey || '';
    $('one-active').checked = e.isActive !== false;
    const prev = $('one-image-preview');
    if (e.image) { prev.src = e.image; prev.style.display = 'block'; }
    else { prev.removeAttribute('src'); prev.style.display = 'none'; }
    $('oneoff-form-title').textContent = 'Edit ad-hoc show';
    setStatus($('one-status'), '');
    $('oneoff-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function initOneoffForm() {
    const form = $('oneoff-form');
    if (!form) return;
    const statusEl = $('one-status');
    $('one-reset-btn').addEventListener('click', resetOneoff);

    $('one-image-file').addEventListener('change', async (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      setStatus(statusEl, 'Uploading image…');
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await api('/images', { method: 'POST', body: fd });
        $('one-imageKey').value = res.key;
        const prev = $('one-image-preview');
        prev.src = '/api/images/' + encodeURIComponent(res.key);
        prev.style.display = 'block';
        setStatus(statusEl, 'Image uploaded.', 'success');
      } catch (err) {
        setStatus(statusEl, 'Image upload failed: ' + err.message, 'error');
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setStatus(statusEl, '');
      const startsAt = fromLocalInput($('one-startsAt').value);
      if (!startsAt) { setStatus(statusEl, 'Invalid start datetime', 'error'); return; }
      const body = {
        kind: 'oneoff',
        title: $('one-title').value.trim(),
        description: $('one-description').value.trim() || null,
        startsAt,
        durationMin: Number($('one-duration').value),
        timezone: $('one-timezone').value.trim() || 'Europe/London',
        linkUrl: $('one-link').value.trim() || null,
        imageKey: $('one-imageKey').value || null,
        isActive: $('one-active').checked,
      };
      const editingId = $('one-editing-id').value;
      try {
        $('one-save-btn').disabled = true;
        if (editingId) {
          await api('/schedule/' + encodeURIComponent(editingId), { method: 'PUT', body: JSON.stringify(body) });
          setStatus(statusEl, 'Show updated.', 'success');
        } else {
          await api('/schedule', { method: 'POST', body: JSON.stringify(body) });
          setStatus(statusEl, 'Show created.', 'success');
          resetOneoff();
        }
        await loadAll();
      } catch (err) {
        setStatus(statusEl, err.message, 'error');
      } finally {
        $('one-save-btn').disabled = false;
      }
    });
  }

  initRecurringForm();
  initOneoffForm();
  loadAll();
})();
