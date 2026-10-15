'use strict';

(() => {
  const $ = (selector) => document.querySelector(selector);
  const config = window.PROFILE_SUPABASE_CONFIG || {};
  const defaults = window.PROFILE_DEFAULTS || {};
  const setupNotice = $('#setupNotice');
  const loginPanel = $('#loginPanel');
  const editorPanel = $('#editorPanel');
  const loginForm = $('#loginForm');
  const loginStatus = $('#loginStatus');
  const saveStatus = $('#saveStatus');
  const loginBtn = $('#loginBtn');
  const saveBtn = $('#saveBtn');
  const imageInput = $('#profileImageFile');
  const imagePreview = $('#imagePreview');
  const mainLinksList = $('#mainLinksList');
  const socialLinksList = $('#socialLinksList');
  let client = null;
  let activeUser = null;
  let currentContent = structuredCloneSafe(defaults);
  let pickedImage = null;
  let previewObjectUrl = null;

  function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function configReady() {
    return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(String(config.url || '')) &&
      typeof config.anonKey === 'string' && config.anonKey.length > 20 && !/YOUR_SUPABASE_ANON_KEY/.test(config.anonKey) &&
      typeof config.adminEmail === 'string' && /.+@.+\..+/.test(config.adminEmail) && !/YOUR-ADMIN-EMAIL/i.test(config.adminEmail);
  }

  function setStatus(node, message, type = '') {
    node.textContent = message;
    node.className = `status${type ? ` ${type}` : ''}`;
  }

  function showLogin(message = '') {
    loginPanel.hidden = false;
    editorPanel.hidden = true;
    if (message) setStatus(loginStatus, message, 'error');
  }

  function showEditor() {
    loginPanel.hidden = true;
    editorPanel.hidden = false;
    setupNotice.hidden = true;
    $('#signedInEmail').textContent = activeUser?.email || config.adminEmail;
  }

  function safeHref(value) {
    const href = String(value || '').trim();
    if (!href || /[\u0000-\u001f]/.test(href)) return '';
    try {
      const parsed = new URL(href, window.location.href);
      return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol) ? href : '';
    } catch (_) { return ''; }
  }

  function safeIcon(value) {
    const candidate = String(value || '').trim();
    return /^[a-zA-Z0-9 _-]{1,90}$/.test(candidate) ? candidate : 'fa fa-link';
  }

  function slug(value, fallback) {
    const result = String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    return result || fallback;
  }

  function makeInput(value, field, placeholder, ariaLabel) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = String(value || '');
    input.dataset.field = field;
    input.placeholder = placeholder;
    input.setAttribute('aria-label', ariaLabel);
    input.autocomplete = 'off';
    return input;
  }

  function addRow(kind, item = {}) {
    const container = kind === 'main' ? mainLinksList : socialLinksList;
    const row = document.createElement('div');
    row.className = 'editor-row';
    row.dataset.kind = kind;
    row.append(makeInput(item.label, 'label', kind === 'main' ? 'Contact label' : 'Platform name', 'Link label'));
    row.append(makeInput(item.href, 'href', kind === 'main' ? 'https://… / mailto: / tel:' : 'https://your-profile…', 'Link URL'));
    row.append(makeInput(item.icon, 'icon', 'fab fa-link', 'Icon classes'));
    const remove = document.createElement('button');
    remove.className = 'remove-button';
    remove.type = 'button';
    remove.setAttribute('aria-label', 'Remove this link');
    remove.title = 'Remove this link';
    const icon = document.createElement('i');
    icon.className = 'bi bi-trash3';
    icon.setAttribute('aria-hidden', 'true');
    remove.append(icon);
    remove.addEventListener('click', () => row.remove());
    row.append(remove);
    container.append(row);
  }

  function fillRows(content) {
    mainLinksList.replaceChildren();
    socialLinksList.replaceChildren();
    (Array.isArray(content.mainLinks) ? content.mainLinks : []).forEach((item) => addRow('main', item));
    (Array.isArray(content.socialLinks) ? content.socialLinks : []).forEach((item) => addRow('social', item));
    $('#bioField').value = String(content.bio || '');
    imagePreview.src = String(content.profileImage || './images/myphoto_1.jpeg');
    pickedImage = null;
    imageInput.value = '';
  }

  function readRows(container, kind) {
    const rows = [...container.querySelectorAll('.editor-row')];
    const result = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const read = (field) => row.querySelector(`[data-field="${field}"]`).value.trim();
      const label = read('label');
      const href = read('href');
      const icon = safeIcon(read('icon'));
      if (!label && !href) continue;
      if (!label || !href) throw new Error(`${kind === 'main' ? 'Contact link' : 'Social profile'} #${index + 1}: enter both a label and a URL, or remove the empty row.`);
      if (!safeHref(href)) throw new Error(`The URL for “${label}” is not valid. Use https://, http://, mailto: or tel:.`);
      const id = slug(read('label'), `${kind}-${index + 1}`);
      result.push(kind === 'main'
        ? { id, label: label.slice(0, 100), href, icon }
        : { id, label: label.slice(0, 60), title: label.slice(0, 100), href, icon });
    }
    return result;
  }

  async function loadContent() {
    setStatus(saveStatus, 'Loading saved profile…');
    const { data, error } = await client.from('profile_content').select('payload, updated_at').eq('id', 1).maybeSingle();
    if (error) throw error;
    currentContent = { ...structuredCloneSafe(defaults), ...(data?.payload || {}) };
    fillRows(currentContent);
    if (data?.updated_at) {
      const date = new Date(data.updated_at);
      setStatus(saveStatus, `Saved version loaded · ${date.toLocaleString()}`, 'success');
    } else {
      setStatus(saveStatus, 'No published database version yet. The original links are loaded as a starting point. Publish once to connect the public page.', '');
    }
  }

  async function establishSession(session) {
    const user = session?.user;
    if (!user) {
      activeUser = null;
      loginPanel.hidden = false;
      editorPanel.hidden = true;
      setupNotice.hidden = true;
      return;
    }
    if (String(user.email || '').toLowerCase() !== String(config.adminEmail).toLowerCase()) {
      await client.auth.signOut();
      showLogin('This account is not the configured owner account. Sign in using the owner email.');
      return;
    }
    activeUser = user;
    showEditor();
    try { await loadContent(); }
    catch (error) {
      console.error(error);
      setStatus(saveStatus, 'Could not load profile data. Check the table and SELECT policy in SETUP_AR.md.', 'error');
    }
  }

  if (!configReady()) {
    setupNotice.hidden = false;
    loginPanel.hidden = true;
    editorPanel.hidden = true;
    loginBtn.disabled = true;
  } else if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    setupNotice.hidden = false;
    setupNotice.querySelector('h2').textContent = 'Could not load the secure sign-in library';
    setupNotice.querySelector('p').textContent = 'Check your internet connection and reload this page. The editor depends on the Supabase JavaScript library.';
    loginPanel.hidden = true;
    editorPanel.hidden = true;
  } else {
    setupNotice.hidden = true;
    client = window.supabase.createClient(config.url, config.anonKey);
    loginPanel.hidden = false;
    client.auth.getSession().then(({ data }) => establishSession(data.session)).catch(() => showLogin('Could not check your session. Reload and try again.'));
    client.auth.onAuthStateChange((_event, session) => {
      // Defer database work to avoid doing Supabase calls inside the auth callback.
      Promise.resolve().then(() => establishSession(session));
    });
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!client) return;
    loginBtn.disabled = true;
    loginBtn.querySelector('span').textContent = 'Signing in…';
    setStatus(loginStatus, 'Checking owner credentials…');
    const email = $('#email').value.trim();
    const password = $('#password').value;
    try {
      if (email.toLowerCase() !== String(config.adminEmail).toLowerCase()) throw new Error('Use the owner email configured in javascript/supabase-config.js.');
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (String(data.user?.email || '').toLowerCase() !== String(config.adminEmail).toLowerCase()) throw new Error('This account does not have owner access.');
      setStatus(loginStatus, 'Signed in successfully.', 'success');
      await establishSession(data.session);
    } catch (error) {
      setStatus(loginStatus, error.message || 'Sign in failed. Check your email and password.', 'error');
    } finally {
      loginBtn.disabled = false;
      loginBtn.querySelector('span').textContent = 'Sign in securely';
    }
  });

  imageInput.addEventListener('change', () => {
    const file = imageInput.files?.[0];
    if (!file) { pickedImage = null; return; }
    const accepted = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!accepted.includes(file.type)) {
      setStatus(saveStatus, 'Choose a JPG, PNG, WEBP or AVIF image.', 'error');
      imageInput.value = '';
      pickedImage = null;
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setStatus(saveStatus, 'The picture is larger than 8 MB. Choose a smaller image.', 'error');
      imageInput.value = '';
      pickedImage = null;
      return;
    }
    pickedImage = file;
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = URL.createObjectURL(file);
    imagePreview.src = previewObjectUrl;
    setStatus(saveStatus, 'New picture selected. Publish changes to upload it and apply it to the public profile.');
  });

  $('#addMainLink').addEventListener('click', () => addRow('main', { icon: 'fa fa-link' }));
  $('#addSocialLink').addEventListener('click', () => addRow('social', { icon: 'fab fa-link' }));
  $('#reloadBtn').addEventListener('click', async () => {
    const button = $('#reloadBtn');
    button.disabled = true;
    try { await loadContent(); }
    catch (error) { setStatus(saveStatus, 'Could not reload. Check your connection and database policies.', 'error'); }
    finally { button.disabled = false; }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    if (!client) return;
    await client.auth.signOut();
    activeUser = null;
    showLogin('You have signed out.');
  });

  $('#editorForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!client || !activeUser) {
      setStatus(saveStatus, 'Sign in with the owner account before publishing.', 'error');
      return;
    }
    saveBtn.disabled = true;
    saveBtn.querySelector('span').textContent = 'Publishing…';
    setStatus(saveStatus, 'Validating your changes…');
    try {
      const mainLinks = readRows(mainLinksList, 'main');
      const socialLinks = readRows(socialLinksList, 'social');
      let profileImage = currentContent.profileImage || './images/myphoto_1.jpeg';
      if (pickedImage) {
        setStatus(saveStatus, 'Uploading your new profile picture…');
        const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' })[pickedImage.type] || 'jpg';
        const unique = (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        const path = `profile-${unique}.${extension}`;
        const { error: uploadError } = await client.storage.from('profile-assets').upload(path, pickedImage, {
          cacheControl: '3600', contentType: pickedImage.type, upsert: false
        });
        if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}. Check the profile-assets bucket policies in SETUP_AR.md.`);
        const { data: publicData } = client.storage.from('profile-assets').getPublicUrl(path);
        profileImage = publicData.publicUrl;
      }
      const payload = {
        version: 1,
        profileImage,
        bio: $('#bioField').value.trim().slice(0, 240),
        mainLinks,
        socialLinks
      };
      setStatus(saveStatus, 'Saving the published profile…');
      const { error } = await client.from('profile_content').upsert({
        id: 1,
        payload,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
      if (error) throw new Error(`${error.message}. Check the table and owner write policies in SETUP_AR.md.`);
      currentContent = payload;
      pickedImage = null;
      imageInput.value = '';
      setStatus(saveStatus, 'Published successfully. Open the public page and refresh it to see your changes.', 'success');
    } catch (error) {
      console.error(error);
      setStatus(saveStatus, error.message || 'Could not publish these changes.', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.querySelector('span').textContent = 'Publish changes';
    }
  });
})();
