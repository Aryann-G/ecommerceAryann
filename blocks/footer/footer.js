import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/**
 * Detects footer section headings from authored text
 */
function getFooterSectionType(element) {
  const text = element.textContent.trim().toLowerCase();

  if (text.includes('about us') || text === 'about') {
    return 'about';
  }

  if (text.includes('contact us') || text === 'contact') {
    return 'contact';
  }

  if (text.includes('social media') || text.includes('social')) {
    return 'social';
  }

  return null;
}

/**
 * Converts normal footer content into:
 * About us | Contact us | Social Media
 */
function decorateFooterLayout(block) {
  const contentWrapper = block.querySelector('.default-content-wrapper');

  if (!contentWrapper) return;

  const aboutSection = document.createElement('div');
  aboutSection.className = 'footer-section footer-about';

  const contactSection = document.createElement('div');
  contactSection.className = 'footer-section footer-contact';

  const socialSection = document.createElement('div');
  socialSection.className = 'footer-section footer-social';

  const sections = {
    about: aboutSection,
    contact: contactSection,
    social: socialSection,
  };

  let activeSection = aboutSection;

  const children = [...contentWrapper.children];

  children.forEach((child) => {
    const sectionType = getFooterSectionType(child);

    if (sectionType) {
      activeSection = sections[sectionType];
      child.classList.add('footer-section-title');
    }

    activeSection.append(child);
  });

  const footerGrid = document.createElement('div');
  footerGrid.className = 'footer-grid';

  footerGrid.append(aboutSection, contactSection, socialSection);

  const footerBottom = document.createElement('div');
  footerBottom.className = 'footer-bottom';
  footerBottom.textContent = '© 2026 ElectroMart. All rights reserved.';

  contentWrapper.replaceChildren(footerGrid, footerBottom);
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta
    ? new URL(footerMeta, window.location).pathname
    : '/footer';

  const fragment = await loadFragment(footerPath);

  block.textContent = '';

  const footer = document.createElement('div');
  footer.className = 'footer-content';

  while (fragment.firstElementChild) {
    footer.append(fragment.firstElementChild);
  }

  block.append(footer);

  decorateFooterLayout(block);
}