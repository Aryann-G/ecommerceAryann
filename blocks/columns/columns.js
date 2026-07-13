/*
 * Columns Block
 * File: blocks/columns/columns.js
 */

import {
  addToCart,
  getCart,
  updateCartQuantity,
} from '../../scripts/cart.js';

/**
 * Convert a product name into a safe product ID.
 *
 * Example:
 * Samsung S22 Ultra -> samsung-s22-ultra
 */
function createProductId(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Convert authored price text into a number.
 *
 * Example:
 * ₹ 90,000/- -> 90000
 */
function extractPrice(priceText) {
  const cleanedPrice = priceText
    .replace(/,/g, '')
    .replace(/[^\d.]/g, '');

  return Number(cleanedPrice) || 0;
}

/**
 * Find the authored Add to Cart link.
 */
function findAddToCartButton(column) {
  return [...column.querySelectorAll('a')].find((link) => {
    const linkText = link.textContent
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

    return linkText === 'add to cart';
  }) || null;
}

/**
 * Read product details from one Columns cell.
 *
 * Expected structure:
 * Image
 * Product name
 * Price
 * Add to Cart link
 */
function getProductData(column) {
  const image = column.querySelector('img');

  const textElements = [
    ...column.querySelectorAll('h1, h2, h3, h4, h5, h6, p'),
  ].filter((element) => (
    element.textContent.trim()
    && !element.querySelector('a')
  ));

  const priceElement = textElements.find((element) => {
    const text = element.textContent.trim();

    return text.includes('₹')
      || /^rs\.?\s*\d/i.test(text);
  });

  const titleElement = textElements.find(
    (element) => element !== priceElement,
  );

  const productName = titleElement?.textContent.trim()
    || image?.alt?.trim()
    || 'Product';

  const priceText = priceElement?.textContent.trim() || '₹0';
  const price = extractPrice(priceText);

  return {
    id: `${createProductId(productName)}-${price}`,
    name: productName,
    price,
    priceText,
    image: image?.src || '',
    imageAlt: image?.alt || productName,
  };
}

/**
 * Return every individual column from this Columns block.
 */
function getProductColumns(block) {
  const columns = [];

  [...block.children].forEach((row) => {
    [...row.children].forEach((column) => {
      columns.push(column);
    });
  });

  return columns;
}

/**
 * Creates one minus or plus button.
 */
function createQuantityButton({
  type,
  productName,
  symbol,
}) {
  const button = document.createElement('button');

  button.type = 'button';
  button.className = `product-quantity-button product-quantity-${type}`;
  button.dataset.quantityAction = type;
  button.textContent = symbol;

  button.setAttribute(
    'aria-label',
    type === 'increase'
      ? `Increase quantity of ${productName}`
      : `Decrease quantity of ${productName}`,
  );

  return button;
}

/**
 * Creates the - quantity + control.
 */
function createQuantityControls(product) {
  const controls = document.createElement('div');

  controls.className = 'product-quantity-controls';
  controls.hidden = true;

  const decreaseButton = createQuantityButton({
    type: 'decrease',
    productName: product.name,
    symbol: '−',
  });

  const quantityValue = document.createElement('span');

  quantityValue.className = 'product-quantity-value';
  quantityValue.textContent = '0';
  quantityValue.setAttribute('aria-live', 'polite');
  quantityValue.setAttribute('aria-atomic', 'true');

  const increaseButton = createQuantityButton({
    type: 'increase',
    productName: product.name,
    symbol: '+',
  });

  controls.append(
    decreaseButton,
    quantityValue,
    increaseButton,
  );

  return controls;
}

/**
 * Update Add to Cart and quantity controls using localStorage data.
 */
function updateProductControls(block) {
  const cart = getCart();

  block
    .querySelectorAll('.product-cart-action[data-cart-product-id]')
    .forEach((actionArea) => {
      const productId = actionArea.dataset.cartProductId;

      const cartProduct = cart.find(
        (product) => product.id === productId,
      );

      const quantity = Number(cartProduct?.quantity || 0);

      const addButton = actionArea.querySelector(
        '.add-to-cart-button',
      );

      const quantityControls = actionArea.querySelector(
        '.product-quantity-controls',
      );

      const quantityValue = actionArea.querySelector(
        '.product-quantity-value',
      );

      if (!addButton || !quantityControls || !quantityValue) {
        return;
      }

      if (quantity > 0) {
        addButton.hidden = true;
        quantityControls.hidden = false;
        quantityValue.textContent = String(quantity);

        quantityValue.setAttribute(
          'aria-label',
          `Current quantity: ${quantity}`,
        );
      } else {
        addButton.hidden = false;
        quantityControls.hidden = true;
        quantityValue.textContent = '0';
      }
    });
}

/**
 * Preserve the standard EDS Columns decoration.
 */
function decorateColumnsLayout(block) {
  const firstRow = block.firstElementChild;

  if (firstRow) {
    const columns = [...firstRow.children];

    block.classList.add(`columns-${columns.length}-cols`);
  }

  [...block.children].forEach((row) => {
    [...row.children].forEach((column) => {
      const picture = column.querySelector('picture');

      if (!picture) return;

      const pictureWrapper = picture.closest('div');

      if (
        pictureWrapper
        && pictureWrapper.children.length === 1
      ) {
        pictureWrapper.classList.add('columns-img-col');
      }
    });
  });
}

/**
 * Add cart functionality to all product columns.
 */
function decorateProductCart(block) {
  const productColumns = getProductColumns(block);

  productColumns.forEach((column) => {
    const addButton = findAddToCartButton(column);

    if (!addButton) return;

    const product = getProductData(column);

    if (!product?.id) return;

    column.classList.add('product-card');

    addButton.classList.add('add-to-cart-button');
    addButton.setAttribute(
      'aria-label',
      `Add ${product.name} to cart`,
    );

    /*
     * The authored link normally points to /cart.
     * JavaScript prevents navigation for this product button.
     */
    addButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      addToCart(product);
      updateProductControls(block);
    });

    /*
     * Use the existing authored paragraph as the action area.
     */
    let actionArea = addButton.parentElement;

    if (!actionArea) return;

    actionArea.classList.add('product-cart-action');
    actionArea.dataset.cartProductId = product.id;

    const quantityControls = createQuantityControls(product);

    actionArea.append(quantityControls);

    const decreaseButton = quantityControls.querySelector(
      '[data-quantity-action="decrease"]',
    );

    const increaseButton = quantityControls.querySelector(
      '[data-quantity-action="increase"]',
    );

    increaseButton.addEventListener('click', () => {
      addToCart(product);
      updateProductControls(block);
    });

    decreaseButton.addEventListener('click', () => {
      const cart = getCart();

      const cartProduct = cart.find(
        (item) => item.id === product.id,
      );

      if (!cartProduct) return;

      const newQuantity = Number(cartProduct.quantity) - 1;

      updateCartQuantity(product.id, newQuantity);
      updateProductControls(block);
    });
  });

  /*
   * Display quantities already stored before page load.
   */
  updateProductControls(block);

  /*
   * Update this block when the cart changes elsewhere.
   */
  window.addEventListener('cart:updated', () => {
    updateProductControls(block);
  });

  /*
   * Update when another browser tab changes the cart.
   */
  window.addEventListener('storage', (event) => {
    if (
      event.key
      && event.key !== 'electromart-cart'
    ) {
      return;
    }

    updateProductControls(block);
  });
}

export default function decorate(block) {
  decorateColumnsLayout(block);
  decorateProductCart(block);
}