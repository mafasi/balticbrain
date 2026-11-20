/* Progressive enhancement: content, contact links and FAQs also work without JavaScript. */
document.documentElement.classList.add('js');

const menuButton = document.querySelector('.menu-toggle');
const menu = document.querySelector('.navigation-links');

function closeMenu() {
  menuButton.setAttribute('aria-expanded', 'false');
  menu.classList.remove('is-open');
}

menuButton.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  menu.classList.toggle('is-open', !isOpen);
});

menu.addEventListener('click', (event) => {
  if (event.target.closest('a')) closeMenu();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuButton.focus();
  }
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.navigation')) closeMenu();
});

const desktopNavigation = window.matchMedia('(min-width: 62rem)');
desktopNavigation.addEventListener('change', closeMenu);

const sectionLinks = [...menu.querySelectorAll('a[href^="#"]')];
const sections = sectionLinks.map((link) => document.querySelector(link.hash)).filter(Boolean);

if ('IntersectionObserver' in window) {
  const visibleSections = new Set();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) visibleSections.add(entry.target);
      else visibleSections.delete(entry.target);
    }
    const activeSection = sections.find((section) => visibleSections.has(section));
    for (const link of sectionLinks) {
      if (activeSection && link.hash === `#${activeSection.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }, { rootMargin: '-18% 0px -55% 0px', threshold: 0 });

  for (const section of sections) observer.observe(section);
}

document.getElementById('copyright-year').textContent = new Date().getFullYear();
