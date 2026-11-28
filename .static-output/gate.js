(() => {
  'use strict';
  const gate = document.querySelector('.entrance');
  const front = document.querySelector('.closed-content');
  const welcome = document.getElementById('welcome');
  const enter = document.querySelector('.enter');
  const close = document.querySelector('.close-entrance');
  const skip = document.querySelector('.skip-link');
  if (!gate || !front || !welcome || !enter || !close || !skip) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let finishTimer;
  function openEntrance() {
    if (gate.dataset.state !== 'closed') return;
    clearTimeout(finishTimer);
    welcome.hidden = false;
    front.hidden = true;
    close.hidden = false;
    enter.setAttribute('aria-expanded', 'true');
    gate.dataset.state = 'opening';
    welcome.focus({preventScroll: true});
    const finish = () => { gate.dataset.state = 'open'; };
    if (reduced.matches) finish();
    else finishTimer = window.setTimeout(finish, 1100);
  }
  function closeEntrance(focus) {
    clearTimeout(finishTimer);
    gate.dataset.state = 'closed';
    welcome.hidden = true;
    front.hidden = false;
    close.hidden = true;
    enter.setAttribute('aria-expanded', 'false');
    if (focus) enter.focus({preventScroll: true});
  }
  enter.addEventListener('click', openEntrance);
  close.addEventListener('click', () => closeEntrance(true));
  skip.addEventListener('click', event => { event.preventDefault(); openEntrance(); welcome.focus(); });
  // The open HTML is the no-script/failure fallback; enhance only after controls exist.
  if (location.hash === '#welcome') {
    gate.dataset.state = 'open';
    close.hidden = false;
    enter.setAttribute('aria-expanded', 'true');
  } else closeEntrance(false);
})();
