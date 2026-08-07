function createElement(tagName, className = '', text = '') {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (
    text !== undefined
    && text !== null
    && text !== ''
  ) {
    element.textContent = text;
  }

  return element;
}

function normalizeValue(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizeSlug(value = '') {
  return normalizeValue(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parse authored block rows for a variation and value.
 * Supports multiple authoring styles:
 * - Two-column rows: key | value
 * - A single row with `plp(type)` followed by a next row containing the value
 * - A single cell with an <img> whose alt or data-key contains the key,
 *   followed by the next row containing the value
 */
function parseBlockAuthoring(block) {
  const rows = [...block.children];

  for (let i = 0; i < rows.length; i += 1) {
    const cells = [...rows[i].children];

    // Two-column key/value row
    if (cells.length >= 2) {
      const keyText = cells[0].textContent.trim();
      const valueText = cells[1].textContent.trim();

      // pattern: plp(type)
      const m = keyText.match(/plp\s*\(\s*([^)]+)\s*\)/i);
      if (m && valueText) {
        return { variation: normalizeValue(m[1]), value: valueText };
      }

      // pattern: key | value (e.g. type | trending gadgets)
      if (/^(brand|category|type|tag)$/i.test(keyText) && valueText) {
        return { variation: normalizeValue(keyText), value: valueText };
      }
    }

    // Single-cell row: check for plp(...) text or image key
    if (cells.length === 1) {
      const cell = cells[0];
      const text = cell.textContent.trim();
      const m = text.match(/plp\s*\(\s*([^)]+)\s*\)/i);
      if (m) {
        const next = rows[i + 1];
        const nextValue = next ? next.textContent.trim() : '';
        if (nextValue) {
          return { variation: normalizeValue(m[1]), value: nextValue };
        }
      }

      const img = cell.querySelector('img');
      if (img) {
        const keyFromAlt = img.getAttribute('data-key') || img.getAttribute('alt') || '';
        const next = rows[i + 1];
        const nextValue = next ? next.textContent.trim() : '';
        if (keyFromAlt && nextValue) {
          return { variation: normalizeValue(keyFromAlt), value: nextValue };
        }
      }
    }
  }

  return {};
}

/**
 * Get the product brand from the current page.
 *
 * Examples:
 * /brands/apple -> apple
 */
function getBrandFromPage() {
  const pathSegments = window.location.pathname
    .split('/')
    .filter(Boolean);

  const brandIndex = pathSegments.findIndex((segment) => (
    [
      'brand',
      'brands',
    ].includes(normalizeValue(segment))
  ));

  /*
   * Prefer the specific value from the URL.
   *
   * For /brands/apple, this returns apple instead of
   * the generic segment brands.
   */
  if (
    brandIndex >= 0
    && pathSegments[brandIndex + 1]
  ) {
    return decodeURIComponent(
      pathSegments[brandIndex + 1],
    );
  }

  const blockBrand = document.body.dataset.plpBrand || '';

  const metaBrand = document
    .querySelector('meta[name="brand"]')
    ?.getAttribute('content') || '';

  if (blockBrand) {
    return blockBrand;
  }

  if (metaBrand) {
    return metaBrand;
  }

  return pathSegments[pathSegments.length - 1] || '';
}

function getCategoryFromPage() {
  const blockCategory = document.body.dataset.plpCategory || '';

  const metaCategory = document
    .querySelector('meta[name="category"]')
    ?.getAttribute('content') || '';

  if (blockCategory) {
    return blockCategory;
  }

  if (metaCategory) {
    return metaCategory;
  }

  return '';
}

function getTemplateFromPage() {
  const blockTemplate = document.body.dataset.plpTemplate || '';

  const metaTemplate = document
    .querySelector('meta[name="template"]')
    ?.getAttribute('content') || '';

  if (blockTemplate) {
    return blockTemplate;
  }

  if (metaTemplate) {
    return metaTemplate;
  }

  return '';
}

/**
 * Check whether a query-index item matches
 * the current brand.
 */
function matchesBrand(item, brand) {
  if (!brand) {
    return true;
  }

  const target = normalizeSlug(brand);

  const values = [
    item.brand,
    item.title,
    item.path,
  ];

  return values.some(
    (value) => normalizeSlug(value) === target,
  );
}

/**
 * Returns true only for indexed items that look like PDP products.
 */
function isProductEntry(item) {
  if (!item) return false;

  const hasProductId = Boolean(item.productId || item.productId === 0);
  const template = normalizeValue(item.template || '');
  const isProductTemplate = /^(product|product-detail|productdetail)$/i.test(template);
  const isProductPath = String(item.path || '').startsWith('/product');

  return hasProductId || isProductTemplate || isProductPath;
}

/**
 * Generic matcher that checks a specified field on the indexed item
 * and falls back to title/path matches. Accepts arrays and strings.
 */
function matchesField(item, field, value) {
  if (!value) return true;

  const target = normalizeSlug(value);

  const candidates = [];

  if (field && item[field]) {
    candidates.push(item[field]);
  }

  candidates.push(item.title, item.path);

  return candidates.some((v) => {
    if (!v) return false;
    if (Array.isArray(v)) {
      return v.some((vv) => normalizeSlug(vv) === target);
    }
    return normalizeSlug(v) === target;
  });
}

/**
 * Format the heading value.
 *
 * Example:
 * apple -> Apple
 * mobile-phones -> Mobile Phones
 */
function formatHeading(value = '') {
  return String(value)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/**
 * Create one product card.
 */
function createProductCard(product) {
  const card = createElement(
    'article',
    'plp-card',
  );

  if (product.image) {
    const image = createElement(
      'img',
      'plp-card__image',
    );

    image.src = product.image;
    image.alt = product.title || 'Product image';
    image.loading = 'lazy';

    card.append(image);
  }

  const title = createElement(
    'h3',
    'plp-card__title',
    product.title || 'Product',
  );

  card.append(title);

  if (product.description) {
    const descriptionText = String(product.description || '').trim();
    const truncated = descriptionText.split(/\s+/).slice(0, 12).join(' ');
    const shortText = descriptionText.length > truncated.length
      ? `${truncated}...`
      : descriptionText;

    const description = createElement(
      'p',
      'plp-card__description',
      shortText,
    );

    card.append(description);
  }

  if (product.price) {
    const numericValue = Number(product.price.toString().replace(/[^0-9.]/g, ''));
    let formattedPrice;

    if (Number.isFinite(numericValue)) {
      formattedPrice = numericValue.toLocaleString('en-IN');
    } else {
      formattedPrice = product.price.toString().trim().replace(/^₹\s*/u, '');
    }

    const price = createElement(
      'p',
      'plp-card__price',
      formattedPrice,
    );

    card.append(price);
  }

  if (product.path) {
    const link = createElement(
      'a',
      'plp-card__link',
      'View product',
    );

    link.href = product.path;

    card.append(link);
  }

  return card;
}

/**
 * Render the filtered products.
 */
function renderProducts(
  block,
  products,
  brand,
) {
  block.innerHTML = '';
  block.classList.add('plp');

  const headingText = brand
    ? `${formatHeading(brand)} Products`
    : 'Products';

  const heading = createElement(
    'h2',
    'plp__heading',
    headingText,
  );

  if (!products.length) {
    const emptyState = createElement(
      'p',
      'plp__empty',
      'No products found for this brand.',
    );

    block.append(
      heading,
      emptyState,
    );

    return;
  }

  const grid = createElement(
    'div',
    'plp__grid',
  );

  products.forEach((product) => {
    grid.append(
      createProductCard(product),
    );
  });

  block.append(
    heading,
    grid,
  );
}

export default async function decorate(block) {
  // prefer block-authoring (variation + value), fall back to URL/meta brand
  const authored = parseBlockAuthoring(block);
  const variation = authored.variation || '';
  const filterValue = authored.value || '';

  // eslint-disable-next-line no-console
  console.log('PLP authored config', { variation, filterValue, blockText: block.textContent.trim() });

  const brand = variation ? '' : getBrandFromPage();
  const category = variation ? '' : getCategoryFromPage();
  const template = variation ? '' : getTemplateFromPage();

  block.innerHTML = '';
  block.classList.add('plp');

  const loadingMessage = createElement(
    'p',
    'plp__loading',
    'Loading products...',
  );

  block.append(loadingMessage);

  try {
    const response = await fetch('/query-index.json');

    if (!response.ok) {
      throw new Error(
        `Failed to load query index: ${response.status}`,
      );
    }

    const payload = await response.json();

    // eslint-disable-next-line no-console
    console.log('PLP query-index payload', payload);

    const items = Array.isArray(payload)
      ? payload
      : payload.data || [];

    // determine matching field and value
    const field = variation || 'brand';
    const value = variation ? filterValue : brand;

    const productItems = items.filter((item) => isProductEntry(item));

    let filteredItems = productItems.filter((item) => matchesField(item, field, value));
    let resolvedValue = value;

    // eslint-disable-next-line no-console
    console.log('PLP filter debug', { field, value, category, variation, totalItems: productItems.length });

    if (!variation && !filteredItems.length && category) {
      filteredItems = productItems.filter((item) => matchesField(item, 'category', category));
      resolvedValue = category;
    }

    if (!variation && !filteredItems.length && template) {
      filteredItems = productItems.filter((item) => matchesField(item, 'template', template));
      resolvedValue = template;
    }

    // eslint-disable-next-line no-console
    console.log('PLP filtered items', filteredItems);

    // limit to top 3 cards for concise display
    const limitedItems = filteredItems.slice(0, 3);

    renderProducts(block, limitedItems, resolvedValue);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('PLP loading failed', error);

    block.innerHTML = '';

    const fallbackMessage = createElement(
      'p',
      'plp__error',
      'Unable to load products right now.',
    );

    block.append(fallbackMessage);
  }
}