/*
 * Checkout Block
 * File: blocks/checkout/checkout.js
 */

import {
  clearCart,
  formatPrice,
  getCart,
} from '../../scripts/cart.js';

import { downloadOrderPdf } from '../../scripts/order-pdf.js';

/*
 * Completed orders are stored separately from the cart.
 */
const ORDERS_STORAGE_KEY = 'electromart-orders';

/**
 * Reads all previously placed orders from localStorage.
 */
function getSavedOrders() {
  try {
    const storedOrders = localStorage.getItem(
      ORDERS_STORAGE_KEY,
    );

    if (!storedOrders) {
      return [];
    }

    const orders = JSON.parse(storedOrders);

    return Array.isArray(orders) ? orders : [];
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Unable to read saved orders:', error);

    return [];
  }
}

/**
 * Saves a completed order without deleting older orders.
 */
function saveOrderToHistory(order) {
  try {
    const orders = getSavedOrders();

    /*
     * Prevent the same order from being saved twice.
     */
    const alreadySaved = orders.some(
      (savedOrder) => (
        savedOrder.orderNumber === order.orderNumber
      ),
    );

    if (!alreadySaved) {
      /*
       * Add the newest order at the beginning.
       */
      orders.unshift(order);
    }

    localStorage.setItem(
      ORDERS_STORAGE_KEY,
      JSON.stringify(orders),
    );

    window.dispatchEvent(
      new CustomEvent('orders:updated', {
        detail: {
          order,
          orders,
        },
      }),
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Unable to save order history:', error);
  }
}

/**
 * Creates an HTML element.
 */
function createElement(
  tagName,
  className = '',
  text = undefined,
) {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (text !== undefined && text !== null) {
    element.textContent = String(text);
  }

  return element;
}

/**
 * Reads key/value configuration rows authored in AEM.
 *
 * Example:
 * heading | Checkout
 */
function getCheckoutConfig(block) {
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

    const value = link
      ? link.getAttribute('href')
        || link.textContent.trim()
      : valueCell.textContent.trim();

    if (value) {
      authoredConfig[key] = value;
    }
  });

  return authoredConfig;
}

/**
 * Calculates the total product quantity.
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
 * Calculates the cart subtotal.
 */
function calculateSubtotal(cart) {
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
 * Converts the authored shipping value into a number.
 *
 * Examples:
 * 0   -> 0
 * ₹99 -> 99
 */
function getShippingAmount(config) {
  const shippingValue = String(
    config['shipping-value'] || '0',
  )
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '');

  return Number(shippingValue) || 0;
}

/**
 * Creates an input or textarea field.
 */
function createFormField({
  id,
  name,
  label,
  type = 'text',
  autocomplete = '',
  fullWidth = false,
  inputMode = '',
  pattern = '',
  minLength = 0,
  maxLength = 0,
  textarea = false,
}) {
  const wrapperClass = fullWidth
    ? 'checkout-field checkout-field-full'
    : 'checkout-field';

  const wrapper = createElement(
    'div',
    wrapperClass,
  );

  const labelElement = createElement(
    'label',
    '',
    label,
  );

  labelElement.htmlFor = id;

  const field = textarea
    ? document.createElement('textarea')
    : document.createElement('input');

  field.id = id;
  field.name = name;
  field.required = true;

  if (!textarea) {
    field.type = type;
  }

  if (autocomplete) {
    field.autocomplete = autocomplete;
  }

  if (inputMode) {
    field.inputMode = inputMode;
  }

  if (pattern) {
    field.pattern = pattern;
  }

  if (minLength > 0) {
    field.minLength = minLength;
  }

  if (maxLength > 0) {
    field.maxLength = maxLength;
  }

  wrapper.append(
    labelElement,
    field,
  );

  return wrapper;
}

/**
 * Creates the Contact Information section.
 */
function createContactSection(config) {
  const section = createElement(
    'section',
    'checkout-section',
  );

  const heading = createElement(
    'h2',
    'checkout-section-heading',
    config['contact-heading'],
  );

  const fields = createElement(
    'div',
    'checkout-fields',
  );

  const emailField = createFormField({
    id: 'checkout-email',
    name: 'email',
    label: config['email-label'],
    type: 'email',
    autocomplete: 'email',
  });

  const phoneField = createFormField({
    id: 'checkout-phone',
    name: 'phone',
    label: config['phone-label'],
    type: 'tel',
    autocomplete: 'tel',
    inputMode: 'tel',
    pattern: '[0-9+() -]{10,15}',
    minLength: 10,
    maxLength: 15,
  });

  fields.append(
    emailField,
    phoneField,
  );

  section.append(
    heading,
    fields,
  );

  return section;
}

/**
 * Creates the Delivery Address section.
 */
function createDeliverySection(config) {
  const section = createElement(
    'section',
    'checkout-section',
  );

  const heading = createElement(
    'h2',
    'checkout-section-heading',
    config['delivery-heading'],
  );

  const fields = createElement(
    'div',
    'checkout-fields',
  );

  const nameField = createFormField({
    id: 'checkout-name',
    name: 'fullName',
    label: config['name-label'],
    autocomplete: 'name',
    fullWidth: true,
    minLength: 2,
  });

  const addressField = createFormField({
    id: 'checkout-address',
    name: 'address',
    label: config['address-label'],
    autocomplete: 'street-address',
    fullWidth: true,
    textarea: true,
    minLength: 5,
  });

  const cityField = createFormField({
    id: 'checkout-city',
    name: 'city',
    label: config['city-label'],
    autocomplete: 'address-level2',
    minLength: 2,
  });

  const stateField = createFormField({
    id: 'checkout-state',
    name: 'state',
    label: config['state-label'],
    autocomplete: 'address-level1',
    minLength: 2,
  });

  const postalCodeField = createFormField({
    id: 'checkout-postal-code',
    name: 'postalCode',
    label: config['postal-code-label'],
    autocomplete: 'postal-code',
    inputMode: 'numeric',
    pattern: '[0-9]{6}',
    minLength: 6,
    maxLength: 6,
  });

  fields.append(
    nameField,
    addressField,
    cityField,
    stateField,
    postalCodeField,
  );

  section.append(
    heading,
    fields,
  );

  return section;
}

/**
 * Creates one payment-method option.
 */
function createPaymentOption({
  id,
  value,
  label,
  checked = false,
}) {
  const wrapper = createElement(
    'label',
    'checkout-payment-option',
  );

  wrapper.htmlFor = id;

  const radio = document.createElement('input');

  radio.id = id;
  radio.type = 'radio';
  radio.name = 'paymentMethod';
  radio.value = value;
  radio.required = true;
  radio.checked = checked;

  const labelText = createElement(
    'span',
    '',
    label,
  );

  wrapper.append(
    radio,
    labelText,
  );

  return wrapper;
}

/**
 * Creates the Payment Method section.
 */
function createPaymentSection(config) {
  const section = createElement(
    'section',
    'checkout-section',
  );

  const heading = createElement(
    'h2',
    'checkout-section-heading',
    config['payment-heading'],
  );

  const options = createElement(
    'div',
    'checkout-payment-options',
  );

  const cashOnDelivery = createPaymentOption({
    id: 'payment-cod',
    value: 'cash-on-delivery',
    label: config['cod-label'],
    checked: true,
  });

  const demoOnlinePayment = createPaymentOption({
    id: 'payment-online',
    value: 'demo-online-payment',
    label: config['demo-payment-label'],
  });

  options.append(
    cashOnDelivery,
    demoOnlinePayment,
  );

  section.append(
    heading,
    options,
  );

  return section;
}

/**
 * Creates the complete checkout form.
 */
function createCheckoutForm(config) {
  const form = document.createElement('form');

  form.className = 'checkout-form';
  form.id = 'checkout-order-form';
  form.noValidate = true;

  form.append(
    createContactSection(config),
    createDeliverySection(config),
    createPaymentSection(config),
  );

  return form;
}

/**
 * Creates one product row in the order summary.
 */
function createSummaryProduct(product) {
  const row = createElement(
    'div',
    'checkout-summary-product',
  );

  const details = createElement('div');

  const name = createElement(
    'p',
    'checkout-summary-product-name',
    product.name,
  );

  const quantity = createElement(
    'p',
    'checkout-summary-product-quantity',
    `× ${Number(product.quantity || 0)}`,
  );

  const productTotal = (
    Number(product.price || 0)
    * Number(product.quantity || 0)
  );

  const price = createElement(
    'p',
    'checkout-summary-product-price',
    formatPrice(productTotal),
  );

  details.append(
    name,
    quantity,
  );

  row.append(
    details,
    price,
  );

  return row;
}

/**
 * Creates one calculation row in the order summary.
 */
function createSummaryRow(
  label,
  value,
  extraClass = '',
) {
  const classes = (
    `checkout-summary-row ${extraClass}`
  ).trim();

  const row = createElement(
    'div',
    classes,
  );

  const labelElement = createElement(
    'span',
    'checkout-summary-label',
    label,
  );

  const valueElement = createElement(
    'strong',
    'checkout-summary-value',
    value,
  );

  row.append(
    labelElement,
    valueElement,
  );

  return row;
}

/**
 * Creates the order summary.
 */
function createOrderSummary(cart, config) {
  const subtotal = calculateSubtotal(cart);
  const shipping = getShippingAmount(config);
  const total = subtotal + shipping;
  const totalQuantity = calculateTotalQuantity(cart);

  const summary = createElement(
    'aside',
    'checkout-summary',
  );

  const heading = createElement(
    'h2',
    'checkout-summary-heading',
    config['summary-heading'],
  );

  const products = createElement(
    'div',
    'checkout-summary-products',
  );

  cart.forEach((product) => {
    products.append(
      createSummaryProduct(product),
    );
  });

  const itemRow = createSummaryRow(
    config['items-label'],
    String(totalQuantity),
  );

  const subtotalRow = createSummaryRow(
    config['subtotal-label'],
    formatPrice(subtotal),
  );

  const shippingRow = createSummaryRow(
    config['shipping-label'],
    formatPrice(shipping),
  );

  const totalRow = createSummaryRow(
    config['total-label'],
    formatPrice(total),
    'checkout-total',
  );

  const placeOrderButton = createElement(
    'button',
    'checkout-place-order',
    config['place-order-label'],
  );

  placeOrderButton.type = 'submit';

  placeOrderButton.setAttribute(
    'form',
    'checkout-order-form',
  );

  const backToCartLink = createElement(
    'a',
    'checkout-back-cart',
    config['back-cart-label'],
  );

  backToCartLink.href = config['back-cart-link'];

  summary.append(
    heading,
    products,
    itemRow,
    subtotalRow,
    shippingRow,
    totalRow,
    placeOrderButton,
    backToCartLink,
  );

  return summary;
}

/**
 * Displays the empty-cart state.
 */
function renderEmptyCheckout(block, config) {
  const empty = createElement(
    'div',
    'checkout-empty',
  );

  const title = createElement(
    'h2',
    'checkout-empty-title',
    config['empty-title'],
  );

  const message = createElement(
    'p',
    'checkout-empty-message',
    config['empty-message'],
  );

  const continueLink = createElement(
    'a',
    'checkout-continue-shopping',
    config['continue-label'],
  );

  continueLink.href = config['continue-link'];

  empty.append(
    title,
    message,
    continueLink,
  );

  block.append(empty);
}

/**
 * Displays the order-success state.
 */
function renderOrderSuccess(
  block,
  config,
  order,
) {
  block.replaceChildren();

  const success = createElement(
    'div',
    'checkout-success',
  );

  const icon = createElement(
    'div',
    'checkout-success-icon',
    '✓',
  );

  icon.setAttribute(
    'aria-hidden',
    'true',
  );

  const title = createElement(
    'h2',
    'checkout-success-title',
    config['success-title'],
  );

  const message = createElement(
    'p',
    'checkout-success-message',
    config['success-message'],
  );

  const orderNumberElement = createElement(
    'p',
    'checkout-order-number',
    `${config['order-number-label']}: ${order.orderNumber}`,
  );

  const downloadButton = createElement(
    'button',
    'checkout-download-pdf',
    config['download-pdf-label'],
  );

  downloadButton.type = 'button';

  downloadButton.addEventListener(
    'click',
    async () => {
      const originalButtonText = (
        config['download-pdf-label']
      );

      downloadButton.disabled = true;

      downloadButton.textContent = (
        config['preparing-pdf-label']
      );

      try {
        await downloadOrderPdf(
          order,
          config,
        );
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          'Unable to create purchase PDF:',
          error,
        );

        window.alert(
          config['pdf-error-message'],
        );
      } finally {
        downloadButton.disabled = false;

        downloadButton.textContent = (
          originalButtonText
        );
      }
    },
  );

  const continueLink = createElement(
    'a',
    'checkout-continue-shopping',
    config['continue-label'],
  );

  continueLink.href = config['continue-link'];

  success.append(
    icon,
    title,
    message,
    orderNumberElement,
    downloadButton,
    continueLink,
  );

  block.append(success);
}

/**
 * Removes previous validation messages.
 */
function clearValidationErrors(form) {
  form
    .querySelectorAll('.checkout-field')
    .forEach((field) => {
      field.classList.remove('has-error');

      field
        .querySelectorAll(
          '.checkout-field-error',
        )
        .forEach((error) => {
          error.remove();
        });
    });
}

/**
 * Validates all required checkout fields.
 */
function validateCheckoutForm(form) {
  clearValidationErrors(form);

  const requiredFields = [
    ...form.querySelectorAll(
      'input:required, textarea:required, select:required',
    ),
  ];

  let firstInvalidField = null;

  requiredFields.forEach((field) => {
    if (field.checkValidity()) return;

    const wrapper = field.closest(
      '.checkout-field',
    );

    if (wrapper) {
      wrapper.classList.add('has-error');

      const errorMessage = createElement(
        'p',
        'checkout-field-error',
        field.validationMessage,
      );

      wrapper.append(errorMessage);
    }

    if (!firstInvalidField) {
      firstInvalidField = field;
    }
  });

  if (firstInvalidField) {
    firstInvalidField.focus();

    return false;
  }

  return true;
}

/**
 * Creates a simple six-digit order number.
 *
 * Example:
 * EM-438275
 */
function createOrderNumber() {
  const randomNumber = Math.floor(
    100000 + Math.random() * 900000,
  );

  return `EM-${randomNumber}`;
}

/**
 * Creates a complete order object.
 */
function createOrder(form, cart, config) {
  const formData = new FormData(form);
  const subtotal = calculateSubtotal(cart);
  const shipping = getShippingAmount(config);
  const createdAt = new Date();

  return {
    orderNumber: createOrderNumber(),

    /*
     * ISO date used for sorting.
     */
    createdAt: createdAt.toISOString(),

    /*
     * Formatted date used for display and PDF.
     */
    orderDate: createdAt.toLocaleString(
      'en-IN',
    ),

    customer: Object.fromEntries(
      formData.entries(),
    ),

    products: cart.map((product) => ({
      ...product,
    })),

    totalItems: calculateTotalQuantity(cart),
    subtotal,
    shipping,
    total: subtotal + shipping,
  };
}

/**
 * Renders the checkout page.
 */
function renderCheckout(
  block,
  config,
  state,
) {
  block.replaceChildren();

  if (state.order) {
    renderOrderSuccess(
      block,
      config,
      state.order,
    );

    return;
  }

  const heading = createElement(
    'h1',
    'checkout-heading',
    config.heading,
  );

  block.append(heading);

  const cart = getCart();

  if (cart.length === 0) {
    renderEmptyCheckout(
      block,
      config,
    );

    return;
  }

  const content = createElement(
    'div',
    'checkout-content',
  );

  const form = createCheckoutForm(config);

  const summary = createOrderSummary(
    cart,
    config,
  );

  content.append(
    form,
    summary,
  );

  block.append(content);
}

/**
 * Handles checkout form submission.
 */
function handleCheckoutSubmit(
  event,
  block,
  config,
  state,
) {
  const form = event.target.closest(
    '.checkout-form',
  );

  if (!form) return;

  event.preventDefault();

  if (!validateCheckoutForm(form)) {
    return;
  }

  const cart = getCart();

  if (cart.length === 0) {
    renderCheckout(
      block,
      config,
      state,
    );

    return;
  }

  /*
   * Create the complete order before clearing
   * the cart.
   */
  state.order = createOrder(
    form,
    cart,
    config,
  );

  /*
   * Save the completed order permanently.
   */
  saveOrderToHistory(state.order);

  /*
   * Keep a temporary copy of the latest order
   * for the current browser tab.
   */
  try {
    sessionStorage.setItem(
      'electromart-last-order',
      JSON.stringify(state.order),
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      'Unable to save the latest order:',
      error,
    );
  }

  clearCart();

  renderCheckout(
    block,
    config,
    state,
  );
}

/**
 * Removes a validation message after the user
 * enters a valid value.
 */
function handleCheckoutInput(event) {
  const field = event.target.closest(
    'input, textarea, select',
  );

  if (
    !field
    || !field.checkValidity()
  ) {
    return;
  }

  const wrapper = field.closest(
    '.checkout-field',
  );

  if (!wrapper) return;

  wrapper.classList.remove('has-error');

  wrapper
    .querySelectorAll(
      '.checkout-field-error',
    )
    .forEach((error) => {
      error.remove();
    });
}

/**
 * Main EDS Checkout block decoration.
 */
export default function decorate(block) {
  /*
   * Read the AEM-authored values before
   * replacing the original block rows.
   */
  const config = getCheckoutConfig(block);

  const state = {
    order: null,
  };

  renderCheckout(
    block,
    config,
    state,
  );

  block.addEventListener(
    'submit',
    (event) => {
      handleCheckoutSubmit(
        event,
        block,
        config,
        state,
      );
    },
  );

  block.addEventListener(
    'input',
    handleCheckoutInput,
  );

  /*
   * Re-render when the cart changes
   * on the current page.
   */
  window.addEventListener(
    'cart:updated',
    () => {
      renderCheckout(
        block,
        config,
        state,
      );
    },
  );

  /*
   * Re-render when another browser tab
   * changes the cart.
   */
  window.addEventListener(
    'storage',
    (event) => {
      if (
        event.key
        && event.key !== 'electromart-cart'
      ) {
        return;
      }

      renderCheckout(
        block,
        config,
        state,
      );
    },
  );
}