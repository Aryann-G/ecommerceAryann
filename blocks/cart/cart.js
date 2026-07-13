/*
 * Cart Block
 * File: blocks/cart/cart.js
 */

import {
  clearCart,
  formatPrice,
  getCart,
  removeFromCart,
  updateCartQuantity,
} from '../../scripts/cart.js';

/*
 * Fallbacks are used only when an authored value is missing.
 */
const DEFAULT_CONFIG = {
  heading: 'Shopping Cart',
  'empty-title': 'Your cart is empty',
  'empty-message': 'Add products from the store to see them here.',
  'continue-label': 'Continue Shopping',
  'continue-link': '/',
  'summary-heading': 'Order Summary',
  'items-label': 'Total items',
  'subtotal-label': 'Subtotal',
  'total-label': 'Total amount',
  'checkout-label': 'Proceed to Checkout',
  'checkout-link': '/checkout',
  'clear-label': 'Clear Cart',
};

/**
 * Creates an HTML element.
 */
function createElement(tagName, className = '', text = '') {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (text) {
    element.textContent = text;
  }

  return element;
}

/**
 * Reads the two-column key/value rows authored in AEM.
 *
 * Example:
 * heading | Shopping Cart
 */
function getCartConfig(block) {
  const authoredConfig = {};

  [...block.children].forEach((row) => {
    const cells = [...row.children];

    if (cells.length < 2) return;

    const key = cells[0].textContent
      .trim()
      .toLowerCase();

    if (!key) return;

    const valueCell = cells[1];
    const link = valueCell.querySelector('a');

    /*
     * For link fields, use the authored href.
     * For normal text fields, use the cell text.
     */
    const value = link
      ? link.getAttribute('href') || link.textContent.trim()
      : valueCell.textContent.trim();

    authoredConfig[key] = value;
  });

  return {
    ...DEFAULT_CONFIG,
    ...authoredConfig,
  };
}

/**
 * Creates the product image.
 */
function createProductImage(product) {
  const wrapper = createElement('div', 'cart-item-image');

  if (!product.image) {
    wrapper.textContent = 'No image';
    return wrapper;
  }

  const image = document.createElement('img');

  image.src = product.image;
  image.alt = product.imageAlt || product.name;
  image.loading = 'lazy';

  wrapper.append(image);

  return wrapper;
}

/**
 * Creates a quantity button.
 */
function createQuantityButton(
  action,
  product,
  symbol,
) {
  const button = createElement(
    'button',
    `cart-quantity-button cart-${action}`,
    symbol,
  );

  button.type = 'button';
  button.dataset.action = action;
  button.dataset.productId = product.id;

  button.setAttribute(
    'aria-label',
    action === 'increase'
      ? `Increase quantity of ${product.name}`
      : `Decrease quantity of ${product.name}`,
  );

  return button;
}

/**
 * Creates the minus, quantity and plus controls.
 */
function createQuantityControls(product) {
  const controls = createElement(
    'div',
    'cart-quantity-controls',
  );

  const decreaseButton = createQuantityButton(
    'decrease',
    product,
    '−',
  );

  const quantity = createElement(
    'span',
    'cart-item-quantity',
    String(product.quantity),
  );

  quantity.setAttribute(
    'aria-label',
    `Current quantity: ${product.quantity}`,
  );

  const increaseButton = createQuantityButton(
    'increase',
    product,
    '+',
  );

  controls.append(
    decreaseButton,
    quantity,
    increaseButton,
  );

  return controls;
}

/**
 * Creates the Remove button.
 */
function createRemoveButton(product) {
  const button = createElement(
    'button',
    'cart-remove-button',
    'Remove',
  );

  button.type = 'button';
  button.dataset.action = 'remove';
  button.dataset.productId = product.id;

  button.setAttribute(
    'aria-label',
    `Remove ${product.name} from cart`,
  );

  return button;
}

/**
 * Creates one product row.
 */
function createCartItem(product) {
  const item = createElement('article', 'cart-item');

  item.dataset.productId = product.id;

  const details = createElement(
    'div',
    'cart-item-details',
  );

  const name = createElement(
    'h3',
    'cart-item-name',
    product.name,
  );

  const price = createElement(
    'p',
    'cart-item-price',
    `${formatPrice(product.price)} each`,
  );

  details.append(name, price);

  const itemTotal = createElement(
    'p',
    'cart-item-total',
    formatPrice(
      Number(product.price) * Number(product.quantity),
    ),
  );

  item.append(
    createProductImage(product),
    details,
    createQuantityControls(product),
    itemTotal,
    createRemoveButton(product),
  );

  return item;
}

/**
 * Renders the empty-cart message.
 */
function renderEmptyCart(block, config) {
  const emptyCart = createElement('div', 'cart-empty');

  const heading = createElement(
    'h2',
    'cart-empty-heading',
    config['empty-title'],
  );

  const message = createElement(
    'p',
    'cart-empty-message',
    config['empty-message'],
  );

  const shoppingLink = createElement(
    'a',
    'cart-continue-shopping',
    config['continue-label'],
  );

  shoppingLink.href = config['continue-link'];

  emptyCart.append(
    heading,
    message,
    shoppingLink,
  );

  block.append(emptyCart);
}

/**
 * Calculates the complete item quantity.
 */
function calculateTotalQuantity(cart) {
  return cart.reduce(
    (total, product) => (
      total + Number(product.quantity || 0)
    ),
    0,
  );
}

/**
 * Calculates the complete purchase amount.
 */
function calculateTotalAmount(cart) {
  return cart.reduce(
    (total, product) => (
      total
      + Number(product.price || 0)
      * Number(product.quantity || 0)
    ),
    0,
  );
}

/**
 * Creates one summary row.
 */
function createSummaryRow(label, value, extraClass = '') {
  const row = createElement(
    'div',
    `cart-summary-row ${extraClass}`.trim(),
  );

  row.append(
    createElement(
      'span',
      'cart-summary-label',
      label,
    ),
    createElement(
      'strong',
      'cart-summary-value',
      value,
    ),
  );

  return row;
}

/**
 * Creates the order summary.
 */
function createOrderSummary(cart, config) {
  const totalQuantity = calculateTotalQuantity(cart);
  const totalAmount = calculateTotalAmount(cart);

  const summary = createElement('aside', 'cart-summary');

  const heading = createElement(
    'h2',
    'cart-summary-heading',
    config['summary-heading'],
  );

  const quantityRow = createSummaryRow(
    config['items-label'],
    String(totalQuantity),
  );

  const subtotalRow = createSummaryRow(
    config['subtotal-label'],
    formatPrice(totalAmount),
  );

  const totalRow = createSummaryRow(
    config['total-label'],
    formatPrice(totalAmount),
    'cart-summary-total',
  );

  /*
   * Checkout is an authored link rather than a
   * hardcoded JavaScript alert.
   */
  const checkoutLink = createElement(
    'a',
    'cart-checkout-button',
    config['checkout-label'],
  );

  checkoutLink.href = config['checkout-link'];

  const clearButton = createElement(
    'button',
    'cart-clear-button',
    config['clear-label'],
  );

  clearButton.type = 'button';
  clearButton.dataset.action = 'clear';

  summary.append(
    heading,
    quantityRow,
    subtotalRow,
    totalRow,
    checkoutLink,
    clearButton,
  );

  return summary;
}

/**
 * Renders the complete Cart block.
 */
function renderCart(block, config) {
  const cart = getCart();

  /*
   * Removes the authored configuration table only after
   * getCartConfig() has already read and saved its values.
   */
  block.replaceChildren();

  const heading = createElement(
    'h1',
    'cart-heading',
    config.heading,
  );

  block.append(heading);

  if (cart.length === 0) {
    renderEmptyCart(block, config);
    return;
  }

  const content = createElement('div', 'cart-content');
  const items = createElement('div', 'cart-items');

  cart.forEach((product) => {
    items.append(createCartItem(product));
  });

  content.append(
    items,
    createOrderSummary(cart, config),
  );

  block.append(content);
}

/**
 * Handles product quantity and removal actions.
 */
function handleCartAction(event) {
  const button = event.target.closest(
    'button[data-action]',
  );

  if (!button) return;

  const { action, productId } = button.dataset;
  const cart = getCart();

  const product = cart.find(
    (item) => item.id === productId,
  );

  if (action === 'increase' && product) {
    updateCartQuantity(
      productId,
      Number(product.quantity) + 1,
    );

    return;
  }

  if (action === 'decrease' && product) {
    updateCartQuantity(
      productId,
      Number(product.quantity) - 1,
    );

    return;
  }

  if (action === 'remove' && productId) {
    removeFromCart(productId);
    return;
  }

  if (action === 'clear') {
    clearCart();
  }
}

/**
 * Main EDS Cart block decoration.
 */
export default function decorate(block) {
  /*
   * Read AEM-authored values before renderCart()
   * removes the authored rows.
   */
  const config = getCartConfig(block);

  renderCart(block, config);

  block.addEventListener('click', handleCartAction);

  window.addEventListener('cart:updated', () => {
    renderCart(block, config);
  });

  window.addEventListener('storage', (event) => {
    if (
      event.key
      && event.key !== 'electromart-cart'
    ) {
      return;
    }

    renderCart(block, config);
  });
}