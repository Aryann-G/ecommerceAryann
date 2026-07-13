/*
 * Electronics Store Header
 * File: blocks/header/header.js
 *
 * Expected AEM nav structure:
 *
 * Section 1: Logo / website name
 * Section 2: Main navigation
 * Section 3: Cart, Contact and About
 */

import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { getCartCount } from '../../scripts/cart.js';

const mobileMedia = window.matchMedia('(max-width: 900px)');

/**
 * Returns the content wrapper inside an AEM section.
 *
 * @param {HTMLElement} section
 * @returns {HTMLElement|null}
 */
function getSectionContent(section) {
  if (!section) return null;

  return section.querySelector('.default-content-wrapper')
    || section.firstElementChild
    || section;
}

/**
 * Moves authored content into a new navigation container.
 *
 * @param {HTMLElement} section
 * @param {string} className
 * @returns {HTMLDivElement}
 */
function createNavPart(section, className) {
  const container = document.createElement('div');
  container.className = className;

  const content = getSectionContent(section);

  if (content) {
    while (content.firstChild) {
      container.append(content.firstChild);
    }
  }

  return container;
}

/**
 * Removes default EDS button styling.
 *
 * @param {HTMLElement} container
 */
function removeDefaultButtonStyles(container) {
  if (!container) return;

  container.querySelectorAll('.button-container').forEach((element) => {
    element.classList.remove('button-container');
  });

  container.querySelectorAll('a.button').forEach((link) => {
    link.classList.remove('button', 'primary', 'secondary');
  });
}

/**
 * Closes all dropdowns inside the supplied container.
 *
 * @param {HTMLElement} container
 * @param {HTMLElement|null} ignoredDropdown
 */
function closeDropdowns(container, ignoredDropdown = null) {
  if (!container) return;

  container.querySelectorAll('.nav-drop').forEach((dropdown) => {
    if (dropdown === ignoredDropdown) return;

    dropdown.setAttribute('aria-expanded', 'false');

    const button = dropdown.querySelector(
      ':scope > .nav-drop-button',
    );

    if (button) {
      button.setAttribute('aria-expanded', 'false');
    }
  });
}

/**
 * Creates a dropdown button from an authored list item.
 *
 * @param {HTMLLIElement} listItem
 * @param {HTMLUListElement} submenu
 * @returns {HTMLButtonElement}
 */
function createDropdownButton(listItem, submenu) {
  const directLink = listItem.querySelector(':scope > a');
  const directParagraph = listItem.querySelector(':scope > p');

  let label = '';

  if (directLink) {
    label = directLink.textContent.trim();
    directLink.remove();
  } else if (directParagraph) {
    label = directParagraph.textContent.trim();
    directParagraph.remove();
  } else {
    const textNodes = [...listItem.childNodes].filter(
      (node) => node.nodeType === Node.TEXT_NODE,
    );

    label = textNodes
      .map((node) => node.textContent.trim())
      .filter(Boolean)
      .join(' ');

    textNodes.forEach((node) => node.remove());
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'nav-drop-button';
  button.textContent = label || 'Menu';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-haspopup', 'true');

  const submenuId = `submenu-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  submenu.id = submenuId;
  button.setAttribute('aria-controls', submenuId);

  listItem.insertBefore(button, submenu);

  return button;
}

/**
 * Converts nested AEM list items into dropdown menus.
 *
 * @param {HTMLElement} container
 */
function decorateDropdowns(container) {
  const topLevelItems = container.querySelectorAll(
    ':scope > ul > li',
  );

  topLevelItems.forEach((listItem) => {
    const submenu = listItem.querySelector(':scope > ul');

    if (!submenu) return;

    listItem.classList.add('nav-drop');
    listItem.setAttribute('aria-expanded', 'false');

    const button = createDropdownButton(listItem, submenu);

    button.addEventListener('click', (event) => {
      event.stopPropagation();

      const isOpen = listItem.getAttribute('aria-expanded') === 'true';

      /*
       * Close all other dropdowns in the complete navbar.
       */
      const completeNav = listItem.closest('.navigation');
      closeDropdowns(completeNav, listItem);

      listItem.setAttribute(
        'aria-expanded',
        isOpen ? 'false' : 'true',
      );

      button.setAttribute(
        'aria-expanded',
        isOpen ? 'false' : 'true',
      );
    });

    /*
     * Close the dropdown using Escape.
     */
    listItem.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;

      listItem.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-expanded', 'false');
      button.focus();
    });
  });
}

/**
 * Prepares Home, Categories, New Arrivals and Brands.
 *
 * @param {HTMLElement} navSections
 */
function decorateMainNavigation(navSections) {
  removeDefaultButtonStyles(navSections);

  const mainList = navSections.querySelector('ul');

  if (!mainList) return;

  navSections.replaceChildren(mainList);

  /*
   * Apply shared styling to normal navigation links,
   * such as Home and New Arrivals.
   */
  mainList
    .querySelectorAll(
      ':scope > li > a, :scope > li > p > a',
    )
    .forEach((link) => {
      link.classList.add('nav-item-link');
    });

  /*
   * Convert Categories and Brands into dropdowns.
   */
  decorateDropdowns(navSections);
}

/**
 * Prepares Cart, Contact and About.
 *
 * Cart remains a normal link.
 * Contact and About become dropdowns when nested items exist.
 *
 * @param {HTMLElement} navTools
 */
function decorateTools(navTools) {
  removeDefaultButtonStyles(navTools);

  const toolsList = navTools.querySelector('ul');

  if (!toolsList) return;

  navTools.replaceChildren(toolsList);

  /*
   * Convert Contact and About into dropdowns.
   */
  decorateDropdowns(navTools);

  /*
   * Apply shared styling to normal links such as Cart.
   */
  navTools
    .querySelectorAll(':scope > ul > li')
    .forEach((listItem) => {
      const submenu = listItem.querySelector(':scope > ul');

      const link = listItem.querySelector(
        ':scope > a, :scope > p > a',
      );

      if (!link || submenu) return;

      link.classList.add('nav-item-link');

      const text = link.textContent
        .trim()
        .toLowerCase();

      if (text.includes('cart')) {
        link.classList.add('nav-cart');
      }
    });
}

/**
 * Finds the Cart link in the navigation.
 *
 * It first looks for the nav-cart class added inside decorateTools().
 * A text and URL check is used as a fallback.
 *
 * @param {HTMLElement} navigation
 * @returns {HTMLAnchorElement|null}
 */
function findCartLink(navigation) {
  const decoratedCartLink = navigation.querySelector('a.nav-cart');

  if (decoratedCartLink) {
    return decoratedCartLink;
  }

  return [...navigation.querySelectorAll('a')].find((link) => {
    const text = link.textContent
      .trim()
      .toLowerCase();

    const href = link.getAttribute('href') || '';

    let pathname = href;

    try {
      pathname = new URL(
        href,
        window.location.origin,
      ).pathname;
    } catch (error) {
      pathname = href;
    }

    return text.includes('cart')
      || pathname === '/cart'
      || pathname === '/cart/';
  }) || null;
}

/**
 * Creates or updates the quantity badge beside Cart.
 *
 * @param {HTMLElement} navigation
 */
function updateCartBadge(navigation) {
  const cartLink = findCartLink(navigation);

  if (!cartLink) {
    return;
  }

  let badge = cartLink.querySelector('.cart-count');

  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'cart-count';
    badge.setAttribute(
      'aria-label',
      'Number of products in cart',
    );

    cartLink.append(badge);
  }

  const count = getCartCount();

  badge.textContent = String(count);
  badge.hidden = count === 0;

  cartLink.setAttribute(
    'aria-label',
    count > 0
      ? `Cart, ${count} ${count === 1 ? 'item' : 'items'}`
      : 'Cart',
  );
}

/**
 * Connects the Cart badge to cart update events.
 *
 * @param {HTMLElement} navigation
 */
function initializeCartBadge(navigation) {
  updateCartBadge(navigation);

  /*
   * Runs when a product is added, removed,
   * increased or decreased on the current page.
   */
  window.addEventListener('cart:updated', () => {
    updateCartBadge(navigation);
  });

  /*
   * Runs when the cart changes in another browser tab.
   */
  window.addEventListener('storage', (event) => {
    if (
      event.key
      && event.key !== 'electromart-cart'
    ) {
      return;
    }

    updateCartBadge(navigation);
  });
}

/**
 * Creates the mobile hamburger button.
 *
 * @param {HTMLElement} nav
 * @returns {HTMLDivElement}
 */
function createHamburger(nav) {
  const wrapper = document.createElement('div');
  wrapper.className = 'nav-hamburger';

  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', 'Open navigation');
  button.setAttribute('aria-expanded', 'false');

  const icon = document.createElement('span');
  icon.className = 'nav-hamburger-icon';
  icon.setAttribute('aria-hidden', 'true');

  button.append(icon);
  wrapper.append(button);

  button.addEventListener('click', () => {
    const isOpen = nav.getAttribute('aria-expanded') === 'true';

    nav.setAttribute(
      'aria-expanded',
      isOpen ? 'false' : 'true',
    );

    button.setAttribute(
      'aria-expanded',
      isOpen ? 'false' : 'true',
    );

    button.setAttribute(
      'aria-label',
      isOpen
        ? 'Open navigation'
        : 'Close navigation',
    );

    if (isOpen) {
      closeDropdowns(nav);
    }
  });

  return wrapper;
}

/**
 * Closes the mobile navigation.
 *
 * @param {HTMLElement} nav
 */
function closeMobileMenu(nav) {
  nav.setAttribute('aria-expanded', 'false');

  const hamburgerButton = nav.querySelector(
    '.nav-hamburger button',
  );

  if (hamburgerButton) {
    hamburgerButton.setAttribute(
      'aria-expanded',
      'false',
    );

    hamburgerButton.setAttribute(
      'aria-label',
      'Open navigation',
    );
  }

  closeDropdowns(nav);
}

/**
 * Main EDS header decoration function.
 *
 * @param {HTMLElement} block
 */
export default async function decorate(block) {
  /*
   * Uses /nav by default.
   * The path can be changed using nav metadata.
   */
  const navMetadata = getMetadata('nav');

  const navPath = navMetadata
    ? new URL(
      navMetadata,
      window.location.href,
    ).pathname
    : '/nav';

  const fragment = await loadFragment(navPath);

  if (!fragment) {
    // eslint-disable-next-line no-console
    console.error(
      `Navigation fragment could not be loaded: ${navPath}`,
    );

    return;
  }

  /*
   * Read all authored sections from the nav page.
   */
  const sections = [...fragment.children].filter(
    (element) => element.classList.contains('section'),
  );

  let brandSection;
  let mainSection;
  let toolsSection;

  if (sections.length >= 3) {
    [brandSection, mainSection, toolsSection] = sections;
  } else {
    [mainSection, toolsSection] = sections;
  }

  const nav = document.createElement('nav');
  nav.className = 'navigation';
  nav.setAttribute('aria-label', 'Main navigation');
  nav.setAttribute('aria-expanded', 'false');

  const navBrand = createNavPart(
    brandSection,
    'nav-brand',
  );

  const navSections = createNavPart(
    mainSection,
    'nav-sections',
  );

  const navTools = createNavPart(
    toolsSection,
    'nav-tools',
  );

  /*
   * Fallback website name when the brand section is empty.
   */
  if (
    !navBrand.textContent.trim()
    && !navBrand.querySelector('img')
  ) {
    navBrand.innerHTML = '<a href="/">ElectroStore</a>';
  }

  removeDefaultButtonStyles(navBrand);
  decorateMainNavigation(navSections);
  decorateTools(navTools);

  const hamburger = createHamburger(nav);

  nav.append(
    hamburger,
    navBrand,
    navSections,
    navTools,
  );

  const wrapper = document.createElement('div');
  wrapper.className = 'nav-wrapper';
  wrapper.append(nav);

  block.replaceChildren(wrapper);

  /*
   * Create the Cart quantity badge after the navigation
   * has been added to the page.
   */
  initializeCartBadge(nav);

  /*
   * Close dropdowns when clicking outside the navbar.
   */
  document.addEventListener('click', (event) => {
    if (nav.contains(event.target)) return;

    closeDropdowns(nav);

    if (mobileMedia.matches) {
      closeMobileMenu(nav);
    }
  });

  /*
   * Close dropdowns and mobile menu with Escape.
   */
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    closeDropdowns(nav);

    if (mobileMedia.matches) {
      closeMobileMenu(nav);
    }
  });

  /*
   * Reset the menu when changing screen size.
   */
  mobileMedia.addEventListener('change', () => {
    closeMobileMenu(nav);
  });
}