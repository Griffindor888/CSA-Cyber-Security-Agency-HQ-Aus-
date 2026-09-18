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
  }

  const enquiryForm = document.querySelector('#csa-commercial-enquiry');
  if (!enquiryForm) return;

  const pathwaySelect = enquiryForm.querySelector('[name="pathway"]');
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

  const emailFallback = values => {
    const subject = encodeURIComponent(`CSA ${values.pathway} enquiry`);
    const body = encodeURIComponent(
      `Organisation: ${values.organisation}\nContact: ${values.contact_name}\nTimeframe: ${values.timeframe}\nRequirement: ${values.requirement}`
    );
    fallback.href = `mailto:info@cs-agency.com.au?subject=${subject}&body=${body}`;
  };

  enquiryForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!enquiryForm.reportValidity()) return;

    const values = Object.fromEntries(new FormData(enquiryForm).entries());
    const correlationId = globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-0000-4000-8000-000000000000`;
    emailFallback(values);
    fallback.hidden = true;
    formStatus.textContent = 'Submitting your enquiry…';
    formStatus.dataset.state = 'pending';
    submitButton.disabled = true;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${publishableKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_pathway: values.pathway,
          p_organisation: values.organisation,
          p_contact_name: values.contact_name,
          p_email: values.email,
          p_timeframe: values.timeframe,
          p_requirement: values.requirement,
          p_consent: values.consent === 'on',
          p_correlation_id: correlationId,
          p_source_path: window.location.pathname,
          p_website: values.website || null,
        }),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => null);
      const receipt = Array.isArray(data) ? data[0] : data;
      if (!response.ok || !receipt?.receipt_id) {
        throw new Error('CSA_ENQUIRY_RECEIPT_MISSING');
      }

      formStatus.textContent = `Enquiry captured. Reference: ${receipt.receipt_id}`;
      formStatus.dataset.state = 'success';
      enquiryForm.reset();
    } catch {
      formStatus.textContent = 'Your enquiry was not confirmed. No false success has been recorded.';
      formStatus.dataset.state = 'error';
      fallback.hidden = false;
    } finally {
      clearTimeout(timeout);
      submitButton.disabled = false;
    }
  });
})();
