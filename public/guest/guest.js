const matches = (dish, tag) => {
  const tags = (dish.dataset.tags ?? '').split(' ');
  return tags.includes(tag) || (tag === 'vegetarian' && tags.includes('vegan'));
};

function spy(root) {
  const track = root.querySelector('.sm-nav-track');
  if (!track) return;
  const links = new Map([...track.querySelectorAll('a')].map((link) => [link.hash.slice(1), link]));
  const visible = new Set();
  let current;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) visible[entry.isIntersecting ? 'add' : 'delete'](entry.target);
    const reading = [...root.querySelectorAll('.sm-section')].findLast((section) => visible.has(section));
    const link = reading && links.get(reading.id);
    if (!link || link === current) return;
    current?.removeAttribute('aria-current');
    link.setAttribute('aria-current', 'true');
    current = link;
    track.scrollTo({ left: link.offsetLeft - (track.clientWidth - link.offsetWidth) / 2, behavior: 'smooth' });
  }, { rootMargin: '0px 0px -50% 0px' });
  for (const section of root.querySelectorAll('.sm-section')) observer.observe(section);
}

function filters(root) {
  const bar = root.querySelector('.sm-filters');
  if (!bar) return;
  bar.hidden = false;
  bar.addEventListener('click', (event) => {
    const button = event.target.closest('.sm-filter');
    if (!button) return;
    const tag = button.getAttribute('aria-pressed') === 'true' ? '' : button.dataset.tag;
    for (const other of bar.querySelectorAll('.sm-filter')) other.setAttribute('aria-pressed', String(other.dataset.tag === tag));
    for (const section of root.querySelectorAll('.sm-section')) {
      let shown = 0;
      for (const dish of section.querySelectorAll('.sm-dish')) {
        dish.hidden = Boolean(tag) && !matches(dish, tag);
        if (!dish.hidden) shown++;
      }
      section.hidden = !shown;
    }
  });
}

function sheet(root) {
  const dialog = document.createElement('dialog');
  dialog.className = 'sm-sheet';
  dialog.innerHTML = '<button type="button" class="sm-sheet-close" aria-label="Close">✕</button><div class="sm-sheet-body"></div>';
  root.append(dialog);
  const body = dialog.querySelector('.sm-sheet-body');
  for (const dish of root.querySelectorAll('.sm-dish')) {
    if (!dish.querySelector('.sm-photo, .sm-desc, .sm-facts')) continue;
    dish.classList.add('can-open');
    dish.tabIndex = 0;
    dish.setAttribute('aria-haspopup', 'dialog');
  }
  const open = (dish) => {
    body.replaceChildren(...[...dish.children].map((child) => child.cloneNode(true)));
    body.querySelector('img')?.removeAttribute('loading');
    dialog.classList.toggle('is-cutout', dish.classList.contains('is-cutout'));
    dialog.showModal();
    body.scrollTop = 0;
  };
  root.addEventListener('click', (event) => {
    if (event.target === dialog || event.target.closest('.sm-sheet-close')) { dialog.close(); return; }
    const dish = event.target.closest('.sm-dish.can-open');
    if (dish && !dialog.contains(dish) && !String(getSelection()).trim()) open(dish);
  });
  root.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches?.('.sm-dish.can-open')) {
      event.preventDefault();
      open(event.target);
    }
  });
}

export function enhance(root) {
  if (!root?.classList.contains('sm')) return;
  root.classList.add('is-enhanced');
  spy(root);
  filters(root);
  sheet(root);
}

enhance(document.querySelector('.sm'));
