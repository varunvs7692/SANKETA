(function () {
  const routes = [
    { href: 'index.html', label: 'Home' },
    { href: 'traffic.html', label: 'Technology' },
    { href: 'services.html', label: 'Features' },
    { href: 'projects.html', label: 'Impact' },
    { href: 'dashboard.html', label: 'Dashboard' },
    { href: 'tracking.html', label: 'Tracking' },
    { href: 'about.html', label: 'Vision' },
    { href: 'contact.html', label: 'Contact' }
  ];

  function makeHeader() {
    const path = location.pathname.split('/').pop() || 'index.html';
    const header = document.getElementById('site-header');
    if (!header) return;
    const links = routes
      .map(r => `<a href="${r.href}" class="${path === r.href ? 'active' : ''}">${r.label}</a>`) 
      .join('');
    header.innerHTML = `
    <nav class="nav">
      <div class="container nav-inner">
        <a class="brand" href="index.html" aria-label="Sanketa Home">
          <img src="assets/img/favicon.svg" alt="Sanketa" class="logo" />
          <span>Sanketa</span>
        </a>
        <div class="menu" id="menu">${links}</div>
        <button class="menu-toggle" id="menuToggle" aria-expanded="false" aria-controls="menu">Menu</button>
      </div>
    </nav>`;

    const toggle = document.getElementById('menuToggle');
    const menu = document.getElementById('menu');
    if (toggle && menu) {
      toggle.addEventListener('click', () => {
        const open = menu.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
      });
    }
  }

  function makeFooter() {
    const footer = document.getElementById('site-footer');
    if (!footer) return;
    const year = new Date().getFullYear();
    footer.innerHTML = `
      <div class="container footer-inner">
        <div>© ${year} Sanketa</div>
        <div class="links">
          <a href="faq.html">FAQ</a>
          <a href="privacy.html">Privacy</a>
          <a href="terms.html">Terms</a>
        </div>
      </div>`;
  }

  // Blog rendering
  async function getPosts() {
    const fallback = [
      { id: 'welcome', title: 'Welcome to Sanketa', date: '2025-11-01', excerpt: 'A quick hello and what to expect from our blog.' },
      { id: 'delivery-principles', title: 'Delivery Principles', date: '2025-11-05', excerpt: 'How we ship quickly without compromising quality.' },
      { id: 'platform-tooling', title: 'Platform & Tooling', date: '2025-11-12', excerpt: 'Our default stack and why it works.' }
    ];
    try {
      const res = await fetch('assets/data/posts.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed posts fetch');
      return await res.json();
    } catch (e) {
      return fallback;
    }
  }

  function renderPostCard(post, { showContent = false } = {}) {
    const date = new Date(post.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    return `
      <article class="card">
        <h3>${post.title}</h3>
        <p class="muted">${date}</p>
        <p>${post.excerpt || ''}</p>
        ${showContent && post.content ? `<div>${post.content}</div>` : ''}
        <a class="btn small" href="#" aria-disabled="true" title="Static demo">Read</a>
      </article>`;
  }

  window.renderLatestPosts = async function ({ targetId, limit = 3, showContent = false }) {
    const el = document.getElementById(targetId);
    if (!el) return;
    const posts = (await getPosts()).slice(0, limit);
    el.innerHTML = posts.map(p => renderPostCard(p, { showContent })).join('');
  }

  // Contact form handler: tries API first, falls back to mailto
  async function setupContactForm() {
    const form = document.querySelector('form[data-contact]');
    if (!form) return;
    const errorEl = form.querySelector('[data-error]');
    async function apiAvailable() {
      try {
        const res = await fetch('http://localhost:4000/api/status', { method: 'GET' });
        return res.ok;
      } catch { return false; }
    }
    const hasApi = await apiAvailable();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const payload = Object.fromEntries(data.entries());
      if (errorEl) errorEl.textContent = '';
      if (!payload.name || !payload.email || !payload.message) {
        if (errorEl) errorEl.textContent = 'Please fill in name, email, and message.';
        return;
      }
      if (hasApi) {
        try {
          const res = await fetch('http://localhost:4000/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const json = await res.json();
          if (json.ok) {
            alert('Message submitted (mail: ' + json.mail + ').');
            form.reset();
            return;
          }
          errorEl && (errorEl.textContent = json.error || 'Submission failed');
          return;
        } catch (apiErr) {
          console.warn('API submission failed; falling back to mailto.', apiErr);
        }
      }
      const mailto = `mailto:info@example.com?subject=${encodeURIComponent('[Sanketa] ' + (payload.subject || 'Contact'))}&body=${encodeURIComponent(`Name: ${payload.name}\nEmail: ${payload.email}\n\n${payload.message}`)}`;
      window.location.href = mailto;
      form.reset();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    makeHeader();
    makeFooter();
    setupContactForm();
  });
})();
