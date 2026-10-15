'use strict';

(() => {
  const themeInput = document.getElementById('input');
  const infoButton = document.getElementById('toggleButton');
  const infoSection = document.getElementById('infoSection');
  const ageValue = document.getElementById('ageValue');
  const profileImage = document.getElementById('profileImage');
  const modal = document.getElementById('imageModal');
  const modalImage = document.getElementById('modalImage');
  const closeButton = modal.querySelector('.close');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Theme preference: light is the default, matching the original page.
  function applyTheme(theme) {
    const safeTheme = theme === 'dark' ? 'dark' : 'light';
    document.body.dataset.theme = safeTheme;
    themeInput.checked = safeTheme === 'light';
    themeInput.setAttribute('aria-label', safeTheme === 'light' ? 'Use light theme' : 'Use dark theme');
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content', safeTheme === 'dark' ? '#101322' : '#dfe1eb'
    );
  }

  let savedTheme = 'light';
  try {
    savedTheme = localStorage.getItem('theme') || 'light';
  } catch (error) {
    // Private browsing or a strict storage policy should not break the page.
  }
  applyTheme(savedTheme);

  themeInput.addEventListener('change', () => {
    const theme = themeInput.checked ? 'light' : 'dark';
    applyTheme(theme);
    try { localStorage.setItem('theme', theme); } catch (error) { /* Storage is optional. */ }
  });

  // One accessible handler for the More Information button.
  infoButton.addEventListener('click', () => {
    const isOpen = infoSection.classList.toggle('active');
    infoButton.setAttribute('aria-expanded', String(isOpen));
    infoSection.inert = !isOpen;
    if (isOpen) {
      // Let the open animation accommodate the real content height.
      infoSection.style.maxHeight = `${infoSection.scrollHeight + 20}px`;
    } else {
      infoSection.style.maxHeight = '';
    }
  });

  // Calculate the age from the same date already used by the original page.
  function calculateAge(isoDate) {
    const birthDate = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(birthDate.getTime())) return '';
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    const birthdayNotReached = today.getMonth() < birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
    if (birthdayNotReached) years -= 1;
    return years;
  }
  ageValue.textContent = calculateAge('2002-09-18');

  // Lightweight typewriter effect; uses textContent, not HTML injection.
  const typeTarget = document.querySelector('.typewrite');
  const typeSpan = typeTarget?.querySelector('.wrap');
  let typingTimer;
  if (typeTarget && typeSpan) {
    let phrases = [];
    try { phrases = JSON.parse(typeTarget.dataset.type || '[]'); } catch (error) { phrases = []; }
    if (prefersReducedMotion) {
      typeSpan.textContent = phrases[0] || 'Hi , I am Ahmed ELsaman.';
    } else if (phrases.length) {
      let phraseIndex = 0;
      let charIndex = 0;
      let deleting = false;
      const pause = Number.parseInt(typeTarget.dataset.period, 10) || 2000;

      const tick = () => {
        const phrase = phrases[phraseIndex] || '';
        charIndex += deleting ? -1 : 1;
        typeSpan.textContent = phrase.slice(0, Math.max(0, charIndex));
        let delay = deleting ? 42 : 82;
        if (!deleting && charIndex >= phrase.length) {
          deleting = true;
          delay = pause;
        } else if (deleting && charIndex <= 0) {
          deleting = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
          delay = 420;
        }
        typingTimer = window.setTimeout(tick, delay);
      };
      tick();
    }
  }

  // Photo modal supports mouse, keyboard, Escape, and outside-click dismissal.
  function openModal() {
    modalImage.src = profileImage.currentSrc || profileImage.src;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    closeButton.focus({ preventScroll: true });
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    profileImage.focus({ preventScroll: true });
  }

  profileImage.addEventListener('click', openModal);
  profileImage.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openModal();
    }
  });
  closeButton.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });

  // Recalculate the open-panel height on viewport changes (mobile rotation/resizing).
  window.addEventListener('resize', () => {
    if (infoSection.classList.contains('active')) {
      infoSection.style.maxHeight = `${infoSection.scrollHeight + 20}px`;
    }
  }, { passive: true });

  window.addEventListener('pagehide', () => window.clearTimeout(typingTimer));
})();
