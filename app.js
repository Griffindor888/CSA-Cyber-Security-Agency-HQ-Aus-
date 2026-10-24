(() => {
  const ensureStylesheet = (href) => {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = href;
    document.head.appendChild(stylesheet);
  };

  ensureStylesheet('/a11y.css');
  ensureStylesheet('/mobile-nav.css');

  const main = document.querySelector('main');
  if (main && !main.id) main.id = 'main-content';

  if (main && !document.querySelector('.skiplink')) {
    const skip = document.createElement('a');
    skip.className = 'skiplink';
    skip.href = '#main-content';
    skip.textContent = 'Skip to main content';
    document.body.prepend(skip);
  }

  const menu = document.querySelector('.menu');
  const links = document.querySelector('.navlinks');
  if (menu && links) {
    const quietLink = document.querySelector('.navright .quietlink');
    if (quietLink && !links.querySelector('.mobileEngagement')) {
      const mobileEngagement = quietLink.cloneNode(true);
      mobileEngagement.classList.remove('quietlink');
      mobileEngagement.classList.add('mobileEngagement');
      links.appendChild(mobileEngagement);
    }
  if (!links.id) links.id = 'primary-navigation';
  menu.setAttribute('type', 'button');
  menu.setAttribute('aria-controls', links.id);
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', 'Open primary navigation');

  const isMobile = () => window.matchMedia('(max-width: 980px)').matches;

  const closeMenu = ({ restoreFocus = false } = {}) => {
    links.classList.remove('navlinks-open');
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-label', 'Open primary navigation');
    if (restoreFocus) menu.focus();
  };

  const openMenu = () => {
    links.classList.add('navlinks-open');
    menu.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-label', 'Close primary navigation');
    const first = links.querySelector('a');
    if (first) first.focus({ preventScroll: true });
  };

  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') === 'true';
    open ? closeMenu() : openMenu();
  });

  links.addEventListener('click', event => {
    if (isMobile() && event.target.closest('a')) closeMenu();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
      closeMenu({ restoreFocus: true });
    }
  });

  document.addEventListener('click', event => {
    if (!isMobile() || menu.getAttribute('aria-expanded') !== 'true') return;
    if (!links.contains(event.target) && !menu.contains(event.target)) closeMenu();
  });

  window.addEventListener('resize', () => {
    if (!isMobile()) closeMenu();
  });
  // Pages may opt into progressive enhancement with a hidden menu button.
  // Reveal it only after the complete interaction has been initialized.
  menu.hidden = false;
  }

  const pagePicker = document.querySelector('.journey-menu');
  if (pagePicker) {
    pagePicker.addEventListener('click', event => {
      if (event.target.closest('a')) pagePicker.open = false;
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && pagePicker.open) {
        pagePicker.open = false;
        pagePicker.querySelector('summary').focus();
      }
    });
    document.addEventListener('click', event => {
      if (pagePicker.open && !pagePicker.contains(event.target)) pagePicker.open = false;
    });
  }

  const enquiryForm = document.querySelector('#csa-commercial-enquiry');
  if (!enquiryForm) return;

  const pathwaySelect = enquiryForm.querySelector('[name="pathway"]');
  const productPaths = { wardale: ['WARDALE OS', '/platforms/wardale/'], solurius: ['Solurius', '/platforms/solurius/'], autto: ['AUTTO Connect', '/platforms/autto-connect/'], csia: ['CS Insurance', '/platforms/csia/'] };
  const requestedPathway = new URLSearchParams(window.location.search).get('pathway');
  if (requestedPathway && Object.prototype.hasOwnProperty.call(productPaths, requestedPathway)) {
    pathwaySelect.value = requestedPathway;
    const [productName, productPath] = productPaths[requestedPathway];
    const returnLine = document.createElement('p');
    returnLine.className = 'product-return';
    const returnLink = document.createElement('a');
    returnLink.href = productPath;
    returnLink.textContent = `Return to ${productName}`;
    returnLine.appendChild(returnLink);
    enquiryForm.prepend(returnLine);
  }
  const submitButton = enquiryForm.querySelector('[type="submit"]');
  const formStatus = enquiryForm.querySelector('[data-form-status]');
  const fallback = enquiryForm.querySelector('[data-email-fallback]');
  const endpoint = 'https://vphbnwzjcfxgmtyggwxl.supabase.co/rest/v1/rpc/submit_csa_commercial_enquiry';
  const publishableKey = 'sb_publishable_1s33D12mZl_9jPBwMkIfqQ_OyPfzKur';

  document.querySelectorAll('[data-pathway]').forEach(action => {
    action.addEventListener('click', () => {
      pathwaySelect.value = action.dataset.pathway;
      document.querySelector('#enquiry')?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => enquiryForm.querySelector('[name="organisation"]')?.focus(), 250);
    });
  });

  // The server-side correlation-id unique constraint is the recovery authority.
  // Store only an opaque UUID + SHA-256 fingerprint in this tab while a request
  // may have committed. No names, emails, requirement text, or consent are stored.
  // Session storage survives reload in the same tab; it is NOT off-device custody.
  const pendingStorageKey = 'csa.enquiry.pending.v1';
  const retryRetentionMs = 24 * 60 * 60 * 1000;
  const correlationPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let pendingEnquiry = null;
  let submittingEnquiry = false;

  const digestRequest = async requestBody => {
    try {
      if (typeof TextEncoder !== 'function' || typeof globalThis.crypto?.subtle?.digest !== 'function') return null;
      const bytes = new TextEncoder().encode(JSON.stringify(requestBody));
      const hash = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
      return Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('');
    } catch { return null; }
  };

  const readPendingCorrelation = digest => {
    if (!digest) return null;
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(pendingStorageKey) || 'null');
      const age = Date.now() - saved?.createdAt;
      return saved?.version === 1 && saved.digest === digest &&
        correlationPattern.test(saved.correlationId) &&
        Number.isSafeInteger(saved.createdAt) && age >= 0 && age <= retryRetentionMs
        ? saved.correlationId : null;
    } catch { return null; }
  };

  const rememberPending = (digest, correlationId) => {
    if (!digest) return;
    try {
      window.sessionStorage.setItem(pendingStorageKey, JSON.stringify({
        version: 1, digest, correlationId, createdAt: Date.now(),
      }));
    } catch { /* Private mode or storage restrictions: in-memory retry still works. */ }
  };

  const clearPending = correlationId => {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(pendingStorageKey) || 'null');
      if (saved?.correlationId === correlationId) window.sessionStorage.removeItem(pendingStorageKey);
    } catch { /* Never turn a confirmed server response into a client error. */ }
  };
  const newCorrelationId = () => {
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
    if (typeof globalThis.crypto?.getRandomValues !== 'function') return null;
    try {
      const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 15) | 64;
      bytes[8] = (bytes[8] & 63) | 128;
      const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    } catch { return null; }
  };

  const emailFallback = values => {
    const subject = encodeURIComponent(`CSA ${values.pathway} enquiry`);
    const body = encodeURIComponent(
      `Organisation: ${values.organisation}\nContact: ${values.contact_name}\nEmail: ${values.email}\nTimeframe: ${values.timeframe}\nRequirement: ${values.requirement}`
    );
    fallback.href = `mailto:info@cs-agency.com.au?subject=${subject}&body=${body}`;
  };

  enquiryForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (submittingEnquiry || !enquiryForm.reportValidity()) return;
    // Lock before the asynchronous digest; otherwise a double click can
    // dispatch two different random correlation IDs in the same tab.
    submittingEnquiry = true;
    submitButton.disabled = true;

    const values = Object.fromEntries(new FormData(enquiryForm).entries());
    const requestBody = {
      p_pathway: values.pathway,
      p_organisation: values.organisation,
      p_contact_name: values.contact_name,
      p_email: values.email,
      p_timeframe: values.timeframe,
      p_requirement: values.requirement,
      p_consent: values.consent === 'on',
      p_source_path: window.location.pathname,
      p_website: values.website || null,
    };
    const retryKey = JSON.stringify(requestBody);
    const digest = await digestRequest(requestBody);
    const correlationId = (pendingEnquiry?.retryKey === retryKey && pendingEnquiry.correlationId) ||
      readPendingCorrelation(digest) || newCorrelationId();
    emailFallback(values);
    fallback.hidden = true;
    if (!correlationId) {
      formStatus.textContent = 'A secure request reference is unavailable. Use the email option instead.';
      formStatus.dataset.state = 'error';
      fallback.hidden = false;
      submitButton.disabled = false;
      submittingEnquiry = false;
      return;
    }
    pendingEnquiry = { retryKey, correlationId };
    rememberPending(digest, correlationId);
    formStatus.textContent = 'Submitting your enquiry…';
    formStatus.dataset.state = 'pending';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apikey: publishableKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...requestBody, p_correlation_id: correlationId }),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => null);
      const receipt = Array.isArray(data) ? data[0] : data;
      if (!response.ok || !correlationPattern.test(receipt?.receipt_id) ||
          receipt.correlation_id !== correlationId || receipt.pathway !== requestBody.p_pathway) {
        throw new Error('CSA_ENQUIRY_RECEIPT_UNCONFIRMED');
      }

      pendingEnquiry = null;
      clearPending(correlationId);
      formStatus.textContent = `Enquiry captured. Reference: ${receipt.receipt_id}`;
      formStatus.dataset.state = 'success';
      enquiryForm.reset();
    } catch {
      formStatus.textContent = `Your enquiry was not confirmed and may have been received. No false success has been recorded. Retrying unchanged details in this tab reuses request reference ${correlationId} (including after reload when secure session storage is available). Email creates a separate message.`;
      formStatus.dataset.state = 'error';
      fallback.hidden = false;
    } finally {
      clearTimeout(timeout);
      submitButton.disabled = false;
      submittingEnquiry = false;
    }
  });
})();
