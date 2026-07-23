import {
  addToCart,
  getCart,
  updateCartQuantity,
} from '../../scripts/cart.js';

/**
 * Converts an authored field name into a consistent key.
 *
 * Examples:
 * "Product Name"  -> "product-name"
 * "product_name"  -> "product-name"
 */
function normalizeKey(value = '') {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

/**
 * Creates a URL-safe product identifier.
 */
function slugify(value = '') {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Converts an authored price such as:
 * ₹ 1,20,000/-
 * ₹99,900
 * 58000
 *
 * into a number.
 */
function parsePrice(value = '') {
  const cleanedValue = value
    .replace(/,/g, '')
    .replace(/[^\d.]/g, '');

  const price = Number.parseFloat(cleanedValue);

  return Number.isFinite(price) ? price : 0;
}

/**
 * Creates an HTML element with optional class and text.
 */
function createElement(tagName, className = '', text = '') {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (text !== undefined && text !== null && text !== '') {
    element.textContent = text;
  }

  return element;
}

/**
 * Copies authored content into the generated PDP layout.
 */
function appendCellContent(target, sourceCell) {
  if (!target || !sourceCell) return;

  [...sourceCell.childNodes].forEach((node) => {
    target.append(node.cloneNode(true));
  });
}

/**
 * Returns the current quantity of a product in the cart.
 */
function getProductQuantity(productId) {
  const cart = getCart();

  const cartItem = cart.find(
    (item) => String(item.id) === String(productId),
  );

  return Number(cartItem?.quantity) || 0;
}

/**
 * Reads the key/value rows authored inside the Product Detail block.
 */
function readBlockData(block) {
  const data = new Map();
  const keyOrder = [];

  [...block.children].forEach((row) => {
    const cells = [...row.children];

    if (cells.length < 2) return;

    const key = normalizeKey(cells[0].textContent);

    if (!key) return;

    const valueCell = cells[1];
    const valueText = valueCell.textContent.trim();

    data.set(key, {
      key,
      text: valueText,
      cell: valueCell,
    });

    keyOrder.push(key);
  });

  return {
    data,
    keyOrder,
  };
}

/**
 * Finds authored specification rows.
 *
 * Example:
 * processor-label | Processor
 * processor-value | Apple M4
 */
function getSpecifications(data, keyOrder) {
  const excludedLabels = new Set([
    'add-label',
    'stock-label',
    'quantity-label',
    'delivery-label',
    'no-image-label',
    'increase-label',
    'decrease-label',
  ]);

  const specifications = [];

  keyOrder.forEach((key) => {
    if (!key.endsWith('-label')) return;
    if (excludedLabels.has(key)) return;

    const baseKey = key.replace(/-label$/, '');
    const valueKey = `${baseKey}-value`;

    const labelEntry = data.get(key);
    const valueEntry = data.get(valueKey);

    if (!labelEntry?.text || !valueEntry?.text) return;

    specifications.push({
      id: baseKey,
      label: labelEntry.text,
      valueEntry,
    });
  });

  return specifications;
}

/**
 * Creates the product image section.
 */
function createProductGallery(data, productName) {
  const gallery = createElement(
    'div',
    'product-detail__gallery',
  );

  const imageWrapper = createElement(
    'div',
    'product-detail__image-wrapper',
  );

  const imageEntry = data.get('image');
  const originalPicture = imageEntry?.cell.querySelector('picture');
  const originalImage = imageEntry?.cell.querySelector('img');

  let imageElement = null;

  if (originalPicture) {
    imageElement = originalPicture.cloneNode(true);
  } else if (originalImage) {
    imageElement = originalImage.cloneNode(true);
  }

  if (imageElement) {
    const image = imageElement.matches?.('img')
      ? imageElement
      : imageElement.querySelector('img');

    if (image) {
      const authoredAlt = data.get('image-alt')?.text;

      image.alt = authoredAlt || image.alt || productName;
      image.loading = 'eager';
      image.decoding = 'async';
    }

    imageWrapper.append(imageElement);
  } else {
    const noImageLabel = data.get('no-image-label')?.text
      || 'No image available';

    const placeholder = createElement(
      'div',
      'product-detail__image-placeholder',
      noImageLabel,
    );

    imageWrapper.append(placeholder);
  }

  gallery.append(imageWrapper);

  return gallery;
}

/**
 * Creates the brand and category information.
 */
function createProductMeta(brand, category) {
  const values = [brand, category].filter(Boolean);

  if (!values.length) return null;

  const meta = createElement(
    'div',
    'product-detail__meta',
  );

  values.forEach((value, index) => {
    const item = createElement(
      'span',
      'product-detail__meta-item',
      value,
    );

    meta.append(item);

    if (index < values.length - 1) {
      const separator = createElement(
        'span',
        'product-detail__meta-separator',
        '•',
      );

      separator.setAttribute('aria-hidden', 'true');
      meta.append(separator);
    }
  });

  return meta;
}

/**
 * Creates the quantity control.
 */
function createQuantityControl({
  product,
  quantity,
  quantityLabel,
  increaseLabel,
  decreaseLabel,
  onQuantityChange,
}) {
  const section = createElement(
    'div',
    'product-detail__quantity-section',
  );

  const label = createElement(
    'span',
    'product-detail__quantity-label',
    quantityLabel,
  );

  const controls = createElement(
    'div',
    'product-detail__quantity-controls',
  );

  const decreaseButton = createElement(
    'button',
    'product-detail__quantity-button product-detail__quantity-button--decrease',
    '−',
  );

  decreaseButton.type = 'button';
  decreaseButton.setAttribute(
    'aria-label',
    `${decreaseLabel} ${product.name}`,
  );

  const quantityValue = createElement(
    'span',
    'product-detail__quantity-value',
    String(quantity),
  );

  quantityValue.setAttribute('aria-live', 'polite');

  const increaseButton = createElement(
    'button',
    'product-detail__quantity-button product-detail__quantity-button--increase',
    '+',
  );

  increaseButton.type = 'button';
  increaseButton.setAttribute(
    'aria-label',
    `${increaseLabel} ${product.name}`,
  );

  decreaseButton.addEventListener('click', () => {
    const currentQuantity = getProductQuantity(product.id);
    const nextQuantity = Math.max(currentQuantity - 1, 0);

    updateCartQuantity(product.id, nextQuantity);
    onQuantityChange();
  });

  increaseButton.addEventListener('click', () => {
    const currentQuantity = getProductQuantity(product.id);

    updateCartQuantity(product.id, currentQuantity + 1);
    onQuantityChange();
  });

  controls.append(
    decreaseButton,
    quantityValue,
    increaseButton,
  );

  section.append(label, controls);

  return section;
}

/**
 * Creates either the Add to Cart button or quantity controls.
 */
function createPurchaseSection({
  product,
  addLabel,
  quantityLabel,
  increaseLabel,
  decreaseLabel,
  priceIsValid,
}) {
  const purchaseSection = createElement(
    'div',
    'product-detail__purchase',
  );

  const renderPurchaseControl = () => {
    purchaseSection.replaceChildren();

    const quantity = getProductQuantity(product.id);

    if (quantity > 0) {
      const quantityControl = createQuantityControl({
        product,
        quantity,
        quantityLabel,
        increaseLabel,
        decreaseLabel,
        onQuantityChange: renderPurchaseControl,
      });

      purchaseSection.append(quantityControl);
      return;
    }

    const addButton = createElement(
      'button',
      'product-detail__add-button',
      addLabel,
    );

    addButton.type = 'button';

    if (!priceIsValid) {
      addButton.disabled = true;
      addButton.setAttribute(
        'aria-disabled',
        'true',
      );
    }

    addButton.addEventListener('click', () => {
      if (!priceIsValid) return;

      addToCart({
        ...product,
        quantity: 1,
      });

      renderPurchaseControl();
    });

    purchaseSection.append(addButton);
  };

  renderPurchaseControl();

  /*
   * Keeps the PDP synchronized when the cart is updated
   * from another block, such as the Columns block.
   */
  window.addEventListener(
    'cart:updated',
    renderPurchaseControl,
  );

  /*
   * Keeps the page synchronized when localStorage changes
   * from another browser tab.
   */
  window.addEventListener('storage', (event) => {
    if (event.key === 'electromart-cart') {
      renderPurchaseControl();
    }
  });

  return purchaseSection;
}

/**
 * Creates the specifications section.
 */
function createSpecificationsSection(
  specifications,
  headingText,
) {
  if (!specifications.length) return null;

  const section = createElement(
    'section',
    'product-detail__specifications',
  );

  const heading = createElement(
    'h2',
    'product-detail__specifications-heading',
    headingText,
  );

  const specificationList = createElement(
    'dl',
    'product-detail__specifications-list',
  );

  specifications.forEach((specification) => {
    const row = createElement(
      'div',
      'product-detail__specification-row',
    );

    const term = createElement(
      'dt',
      'product-detail__specification-label',
      specification.label,
    );

    const description = createElement(
      'dd',
      'product-detail__specification-value',
    );

    appendCellContent(
      description,
      specification.valueEntry.cell,
    );

    row.append(term, description);
    specificationList.append(row);
  });

  section.append(heading, specificationList);

  return section;
}

/**
 * Decorates the Product Detail block.
 */
export default function decorate(block) {
  const { data, keyOrder } = readBlockData(block);

  const productName = data.get('product-name')?.text
    || 'Product';

  const brand = data.get('brand')?.text || '';
  const category = data.get('category')?.text || '';

  const priceText = data.get('price')?.text || '';
  const price = parsePrice(priceText);
  const priceIsValid = price > 0;

  /*
   * To keep the same product synchronized between the
   * listing card and PDP, use the same ID convention.
   *
   * Example:
   * MacBook Air M4 + ₹99,900
   * becomes macbook-air-m4-99900
   */
  const generatedProductId = [
    slugify(productName),
    String(price || ''),
  ]
    .filter(Boolean)
    .join('-');

  const productId = data.get('product-id')?.text
    || generatedProductId;

  const imageEntry = data.get('image');
  const authoredImage = imageEntry?.cell.querySelector('img');

  const imageUrl = authoredImage?.currentSrc
    || authoredImage?.src
    || '';

  const imageAlt = data.get('image-alt')?.text
    || authoredImage?.alt
    || productName;

  const product = {
    id: productId,
    name: productName,
    brand,
    category,
    price,
    priceText,
    image: imageUrl,
    imageAlt,
    pageUrl: window.location.pathname,
  };

  const addLabel = data.get('add-label')?.text
    || 'Add to Cart';

  const quantityLabel = data.get('quantity-label')?.text
    || 'Quantity';

  const increaseLabel = data.get('increase-label')?.text
    || 'Increase quantity of';

  const decreaseLabel = data.get('decrease-label')?.text
    || 'Decrease quantity of';

  const stockLabel = data.get('stock-label')?.text || '';
  const deliveryLabel = data.get('delivery-label')?.text || '';

  const specificationsHeading = data.get('specs-heading')?.text
    || 'Product Specifications';

  const specifications = getSpecifications(
    data,
    keyOrder,
  );

  const component = createElement(
    'div',
    'product-detail__component',
  );

  const mainSection = createElement(
    'div',
    'product-detail__main',
  );

  const gallery = createProductGallery(
    data,
    productName,
  );

  const information = createElement(
    'div',
    'product-detail__information',
  );

  const meta = createProductMeta(
    brand,
    category,
  );

  const title = createElement(
    'h1',
    'product-detail__title',
    productName,
  );

  const priceElement = createElement(
    'p',
    'product-detail__price',
    priceText,
  );

  if (!priceIsValid) {
    priceElement.classList.add(
      'product-detail__price--invalid',
    );

    // eslint-disable-next-line no-console
    console.warn(
      `Product Detail: invalid price authored for "${productName}".`,
    );
  }

  if (meta) {
    information.append(meta);
  }

  information.append(title, priceElement);

  const descriptionEntry = data.get('description');

  if (descriptionEntry) {
    const description = createElement(
      'div',
      'product-detail__description',
    );

    appendCellContent(
      description,
      descriptionEntry.cell,
    );

    information.append(description);
  }

  if (stockLabel) {
    const stock = createElement(
      'p',
      'product-detail__stock',
      stockLabel,
    );

    information.append(stock);
  }

  if (deliveryLabel) {
    const delivery = createElement(
      'p',
      'product-detail__delivery',
      deliveryLabel,
    );

    information.append(delivery);
  }

  const purchaseSection = createPurchaseSection({
    product,
    addLabel,
    quantityLabel,
    increaseLabel,
    decreaseLabel,
    priceIsValid,
  });

  information.append(purchaseSection);

  mainSection.append(gallery, information);
  component.append(mainSection);

  const specificationsSection = createSpecificationsSection(
    specifications,
    specificationsHeading,
  );

  if (specificationsSection) {
    component.append(specificationsSection);
  }

  block.replaceChildren(component);
}