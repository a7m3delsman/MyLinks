/* Loads published profile content from Supabase when configured. Local defaults remain as fallback. */
(() => {
  'use strict';
  const config = window.PROFILE_SUPABASE_CONFIG || {};
  const defaults = window.PROFILE_DEFAULTS || {};

  const safeHref = (value) => {
    const href = String(value || '').trim();
    if (!href || /[\u0000-\u001f]/.test(href)) return '';
    try {
      const url = new URL(href, window.location.href);
      return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? href : '';
    } catch (_) { return ''; }
  };

  const safeIcon = (value) => /^[a-zA-Z0-9 _-]{1,90}$/.test(String(value || '')) ? String(value) : 'fa fa-link';
  const safeId = (value, prefix, index) => {
    const id = String(value || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
    return id || `${prefix}-${index + 1}`;
  };

  function iconElement(classes) {
    const icon = document.createElement('i');
    icon.className = safeIcon(classes);
    icon.setAttribute('aria-hidden', 'true');
    return icon;
  }

  function renderLinks(items) {
    const nav = document.querySelector('.links');
    if (!nav || !Array.isArray(items)) return;
    const fragment = document.createDocumentFragment();
    items.forEach((item, index) => {
      const href = safeHref(item && item.href);
      const label = String(item && item.label || '').trim();
      if (!href || !label) return;
      const anchor = document.createElement('a');
      anchor.className = 'link';
      anchor.id = safeId(item.id, 'profile-link', index);
      anchor.href = href;
      anchor.title = label;
      if (/^https?:/i.test(href)) { anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; }
      anchor.append(iconElement(item.icon));
      const text = document.createElement('span');
      text.textContent = label;
      anchor.append(text);
      const arrow = iconElement('fa fa-arrow-right link-arrow');
      anchor.append(arrow);
      fragment.append(anchor);
    });
    nav.replaceChildren(fragment);
  }

  function renderSocialLinks(items) {
    const nav = document.querySelector('.social-links');
    if (!nav || !Array.isArray(items)) return;
    const fragment = document.createDocumentFragment();
    items.forEach((item, index) => {
      const href = safeHref(item && item.href);
      const label = String(item && item.label || '').trim();
      if (!href || !label) return;
      const anchor = document.createElement('a');
      anchor.className = 'social-icon';
      anchor.id = safeId(item.id, 'social-link', index);
      anchor.href = href;
      anchor.title = String(item.title || label).slice(0, 120);
      anchor.setAttribute('aria-label', label);
      if (/^https?:/i.test(href)) { anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; }
      anchor.append(iconElement(item.icon));
      fragment.append(anchor);
    });
    nav.replaceChildren(fragment);
  }

  function applyContent(content) {
    if (!content || typeof content !== 'object') return;
    const image = document.getElementById('profileImage');
    const bio = document.querySelector('[data-i18n="bio"]');
    if (image && typeof content.profileImage === 'string') {
      const safeImage = safeHref(content.profileImage);
      if (safeImage) image.src = safeImage;
    }
    if (bio && typeof content.bio === 'string') bio.textContent = content.bio;
    renderLinks(content.mainLinks);
    renderSocialLinks(content.socialLinks);
    document.dispatchEvent(new CustomEvent('profilecontentloaded', { detail: content }));
  }

  applyContent(defaults);
  if (!config.url || !config.anonKey || /YOUR-PROJECT|YOUR_SUPABASE_ANON_KEY/.test(`${config.url} ${config.anonKey}`)) return;
  if (!window.supabase || typeof window.supabase.createClient !== 'function') return;

  const client = window.supabase.createClient(config.url, config.anonKey);
  client.from('profile_content').select('payload').eq('id', 1).maybeSingle()
    .then(({ data, error }) => {
      if (error) { console.warn('Profile content is using local defaults because published content could not be loaded.'); return; }
      if (data && data.payload) applyContent({ ...defaults, ...data.payload });
    })
    .catch(() => console.warn('Profile content is using local defaults because the remote request failed.'));
})();
