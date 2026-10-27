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
  const maxPendingEnquiries = 8;
  const correlationPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const digestPattern = /^[0-9a-f]{64}$/;
  // Source-pinned SQL RPC raises only these recognisable errors before INSERT.
  // A generic 4xx/5xx, 503 or timeout is not evidence of non-persistence.
  const rejectedBeforeInsert = new Set([
    'CSA_ENQUIRY_CORRELATION_REQUIRED', 'CSA_ENQUIRY_REJECTED',
    'CSA_ENQUIRY_CONSENT_REQUIRED', 'CSA_ENQUIRY_PATHWAY_INVALID',
    'CSA_ENQUIRY_ORGANISATION_INVALID', 'CSA_ENQUIRY_CONTACT_INVALID',
    'CSA_ENQUIRY_EMAIL_INVALID', 'CSA_ENQUIRY_TIMEFRAME_INVALID',
    'CSA_ENQUIRY_REQUIREMENT_INVALID', 'CSA_ENQUIRY_SOURCE_INVALID',
  ]);
  // Preserve several distinct UNKNOWN submissions, never evict one silently.
  // Only per-tab opaque references and hashes are persisted, not enquiry text.
  const pendingByPayload = new Map();
  let submittingEnquiry = false;

  const digestRequest = async requestBody => {
    try {
      if (typeof TextEncoder !== 'function' || typeof globalThis.crypto?.subtle?.digest !== 'function') return null;
      const bytes = new TextEncoder().encode(JSON.stringify(requestBody));
      const hash = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
      return Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('');
    } catch { return null; }
  };

  const readPendingRecords = () => {
    let raw;
    try {
      raw = window.sessionStorage.getItem(pendingStorageKey);
    } catch {
      // Storage blocked: the current tab can still use memory-only recovery.
      return { records: [], writable: false, corrupt: false };
    }
    if (!raw) return { records: [], writable: true, corrupt: false };
    try {
      const saved = JSON.parse(raw);
      // Preserve pending correlations recorded by the previous single-entry
      // version when upgrading to the bounded multi-entry format.
      const records = saved?.version === 1 ? [saved]
        : saved?.version === 2 ? saved.entries : null;
      if (!Array.isArray(records) || records.length > maxPendingEnquiries ||
          records.some(record =>
            !record || !digestPattern.test(record.digest) ||
            !correlationPattern.test(record.correlationId) ||
            !Number.isSafeInteger(record.createdAt) ||
            record.createdAt > Date.now() || record.createdAt < 0) ||
          new Set(records.map(record => record.digest)).size !== records.length ||
          new Set(records.map(record => record.correlationId)).size !== records.length) {
        return { records: [], writable: true, corrupt: true };
      }
      return { records, writable: true, corrupt: false };
    } catch {
      // Corrupt existing UNKNOWN state must not silently mint new references.
      return { records: [], writable: true, corrupt: true };
    }
  };

  const writePendingRecords = records => {
    try {
      window.sessionStorage.setItem(pendingStorageKey, JSON.stringify({ version: 2, entries: records }));
      return true;
    } catch { return false; }
  };

  const selectPendingCorrelation = (digest, retryKey) => {
    const saved = digest ? readPendingRecords() : { records: [], writable: false, corrupt: false };
    if (saved.corrupt) return {
      reason: 'Saved pending references cannot be verified. Do not resubmit an uncertain enquiry; contact CSA using the email option for reconciliation.'
    };
    const stored = digest ? saved.records.find(record => record.digest === digest) : null;
    const entry = stored || pendingByPayload.get(retryKey);
    if (entry) {
      if (Date.now() - entry.createdAt > retryRetentionMs) return {
        reason: 'The earlier enquiry outcome remains unknown after the 24-hour automatic recovery window. Contact CSA with reference ' + entry.correlationId + ' before resubmitting.'
      };
      pendingByPayload.set(retryKey, entry);
      if (!stored && digest && saved.writable &&
          saved.records.length < maxPendingEnquiries &&
          !saved.records.some(record => record.correlationId === entry.correlationId)) {
        writePendingRecords([...saved.records, entry]);
      }
      return { correlationId: entry.correlationId, stored: Boolean(stored), wasPending: true };
    }
    if (saved.records.length >= maxPendingEnquiries ||
        pendingByPayload.size >= maxPendingEnquiries) return {
      reason: 'Eight enquiries are already awaiting confirmation in this tab. Reconcile an earlier reference or use the email option before creating another request.'
    };
    const correlationId = newCorrelationId();
    if (!correlationId) return {
      reason: 'A secure request reference is unavailable. Use the email option instead.'
    };
    const fresh = { digest, correlationId, createdAt: Date.now() };
    pendingByPayload.set(retryKey, fresh);
    const storedNew = Boolean(digest && saved.writable &&
      writePendingRecords([...saved.records, fresh]));
    return { correlationId, stored: storedNew, wasPending: false };
  };

  const clearPending = (digest, retryKey, correlationId) => {
    if (pendingByPayload.get(retryKey)?.correlationId === correlationId) {
      pendingByPayload.delete(retryKey);
    }
    if (!digest) return;
    const saved = readPendingRecords();
    if (!saved.writable || saved.corrupt) return;
    const remaining = saved.records.filter(entry =>
      !(entry.digest === digest && entry.correlationId === correlationId));
    if (remaining.length === saved.records.length) return;
    try {
      if (remaining.length) writePendingRecords(remaining);
      else window.sessionStorage.removeItem(pendingStorageKey);
    } catch { /* A valid server receipt remains authoritative. */ }
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
    const pendingSelection = selectPendingCorrelation(digest, retryKey);
    const correlationId = pendingSelection.correlationId;
    emailFallback(values);
    fallback.hidden = true;
    if (!correlationId) {
      formStatus.textContent = pendingSelection.reason || 'A secure request reference is unavailable. Use the email option instead.';
      formStatus.dataset.state = 'error';
      fallback.hidden = false;
      submitButton.disabled = false;
      submittingEnquiry = false;
      return;
    }
    formStatus.textContent = 'Submitting your enquiry…';
    formStatus.dataset.state = 'pending';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let definitiveRejection = null;

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
      // PostgREST exposes the named SQLSTATE and exact RPC exception text.
      // Release only responses provably raised before the SQL INSERT in
      // supabase/migrations/20260913020000_csa_commercial_intake.sql.
      // Do not clear after network/503/unknown/out-of-contract outcomes.
      const validationRejected = !response.ok && response.status === 400 &&
        data?.code === '22023' && rejectedBeforeInsert.has(data.message);
      const throttledBeforeInsert = !response.ok && response.status === 500 &&
        data?.code === '54000' && data.message === 'CSA_ENQUIRY_RATE_LIMITED';
      if (validationRejected || throttledBeforeInsert) {
        if (validationRejected) {
          // These exact SQL validation errors are raised before insertion.
          definitiveRejection = 'validation';
          clearPending(digest, retryKey, correlationId);
        } else if (!pendingSelection.wasPending) {
          // An initial rate-limit response cannot have inserted this freshly
          // allocated correlation in an earlier request from this tab.
          definitiveRejection = 'rate_limit';
          clearPending(digest, retryKey, correlationId);
        } else {
          // A retry may overlap an earlier UNKNOWN request using this same
          // correlation. The earlier request could have committed while the
          // SQL rate-limit query was being evaluated. Preserve its identity.
          definitiveRejection = 'uncertain_rate_limit';
        }
        throw new Error('CSA_ENQUIRY_NOT_STORED');
      }
      const receipt = Array.isArray(data) ? data[0] : data;
      if (!response.ok || !correlationPattern.test(receipt?.receipt_id) ||
          receipt.correlation_id !== correlationId || receipt.pathway !== requestBody.p_pathway) {
        throw new Error('CSA_ENQUIRY_RECEIPT_UNCONFIRMED');
      }

      clearPending(digest, retryKey, correlationId);
      formStatus.textContent = `Enquiry captured. Reference: ${receipt.receipt_id}`;
      formStatus.dataset.state = 'success';
      enquiryForm.reset();
    } catch {
      if (definitiveRejection === 'rate_limit') {
        formStatus.textContent = 'CSA intake refused this enquiry before capture because of the recent-request limit. Retry later or use the separate email option.';
      } else if (definitiveRejection === 'validation') {
        formStatus.textContent = 'CSA intake rejected these details before capture. Check the form and try again, or use the email option.';
      } else if (definitiveRejection === 'uncertain_rate_limit') {
        formStatus.textContent = `This retry was rate-limited, but your earlier enquiry may have been received. Original reference ${correlationId} is preserved. Retry unchanged details later or ask CSA to reconcile the reference before sending a new enquiry.`;
      } else {
        formStatus.textContent = `Your enquiry was not confirmed and may have been received. No false success has been recorded. Retrying unchanged details in this tab reuses request reference ${correlationId} (including after reload within 24 hours if secure session storage succeeded). Email creates a separate message.`;
      }
      formStatus.dataset.state = 'error';
      fallback.hidden = false;
    } finally {
      clearTimeout(timeout);
      submitButton.disabled = false;
      submittingEnquiry = false;
    }
  });
})();
