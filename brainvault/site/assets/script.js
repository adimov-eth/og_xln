// Three editorial options share installation and safety behavior.
const variants = {
  a: { hero: 'Your wallet.\nFrom memory.', thesis: 'Nothing to carry.', how: 'Hard to guess.\nYours to recover.', explain: 'Argon2id makes guessing expensive. Not weak passwords strong.', safety: 'Recover first.\nFund second.' },
  b: { hero: 'Carry less.\nRemember more.', thesis: 'Your secret becomes your wallet.', how: 'One secret.\nA costly guess.', explain: 'You wait to recover. Attackers work for every guess.', safety: 'Prove recovery.\nThen trust it.' },
  c: { hero: 'Make every\nguess expensive.', thesis: 'A wallet derived from what you remember.', how: 'Memory,\nput to work.', explain: 'Argon2id adds work. Your password supplies the strength.', safety: 'Test it.\nThen fund it.' },
};
const variantButtons = [...document.querySelectorAll('[data-variant-button]')];
function selectVariant(name) {
  if (!Object.hasOwn(variants, name)) return;
  for (const node of document.querySelectorAll('[data-copy-key]')) {
    node.textContent = variants[name][node.dataset.copyKey];
  }
  for (const button of variantButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.variantButton === name));
  }
  document.body.dataset.variant = name;
}
for (const button of variantButtons) {
  button.addEventListener('click', () => selectVariant(button.dataset.variantButton));
}

const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#nav');

menuButton?.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  navigation?.classList.toggle('open', !isOpen);
});

navigation?.addEventListener('click', (event) => {
  if (!(event.target instanceof HTMLAnchorElement)) {
    return;
  }
  menuButton?.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('open');
});

const installTabs = Array.from(document.querySelectorAll('[data-install-tab]'));

function selectInstallTab(tab) {
  const selected = tab.getAttribute('data-install-tab');
  for (const candidate of installTabs) {
    candidate.setAttribute('aria-selected', String(candidate === tab));
  }
  for (const panel of document.querySelectorAll('[data-install-panel]')) {
    panel.hidden = panel.getAttribute('data-install-panel') !== selected;
  }
}

for (const tab of installTabs) {
  tab.addEventListener('click', () => selectInstallTab(tab));
  tab.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const next = installTabs[(installTabs.indexOf(tab) + offset + installTabs.length) % installTabs.length];
    next?.focus();
    if (next) {
      selectInstallTab(next);
    }
  });
}

for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const value = button.getAttribute('data-copy');
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      button.textContent = 'Copied';
      window.setTimeout(() => {
        button.textContent = 'Copy';
      }, 1500);
    } catch {
      button.textContent = 'Select';
    }
  });
}

for (const button of document.querySelectorAll('[data-copy-target]')) {
  button.addEventListener('click', async () => {
    const selector = button.getAttribute('data-copy-target');
    const target = selector ? document.querySelector(selector) : null;
    const value = target?.textContent?.trim();
    if (!value) {
      return;
    }

    const label = button.textContent;
    try {
      await navigator.clipboard.writeText(value);
      button.textContent = 'Copied';
      window.setTimeout(() => {
        button.textContent = label;
      }, 1500);
    } catch {
      button.textContent = 'Select prompt';
    }
  });
}

const demoVideo = document.querySelector('.demo-frame video');
if (demoVideo instanceof HTMLVideoElement && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  demoVideo.autoplay = false;
  demoVideo.pause();
}

const year = document.querySelector('#year');
if (year) {
  year.textContent = String(new Date().getFullYear());
}
