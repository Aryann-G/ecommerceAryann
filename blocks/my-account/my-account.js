/*
 * My Account Block
 * File: blocks/my-account/my-account.js
 */

import {
  formatPrice,
} from '../../scripts/cart.js';

const ORDERS_STORAGE_KEY = 'electromart-orders';

/*
 * Default values are used when a value is not
 * authored inside the My Account block.
 */
const DEFAULT_CONFIG = {
  heading: 'My Account',
  'orders-heading': 'Previous Orders',
  'empty-title': 'No orders found',
  'empty-message': 'You have not placed any orders yet.',
  'continue-label': 'Continue Shopping',
  'continue-link': '/',
  'order-number-label': 'Order Number',
  'order-date-label': 'Placed On',
  'order-status-label': 'Status',
  'order-status-value': 'Order Placed',
  'customer-label': 'Customer',
  'delivery-label': 'Delivery Address',
  'payment-label': 'Payment Method',
  'quantity-label': 'Quantity',
  'subtotal-label': 'Subtotal',
  'shipping-label': 'Shipping',
  'total-label': 'Total Amount',
  'items-label': 'Total Items',
};

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
 * Reads key/value rows authored in AEM.
 *
 * Example:
 * heading | My Account
 */
function getMyAccountConfig(block) {
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

  return {
    ...DEFAULT_CONFIG,
    ...authoredConfig,
  };
}

/**
 * Reads all completed orders from localStorage.
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

    return Array.isArray(orders)
      ? orders
      : [];
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      'Unable to read order history:',
      error,
    );

    return [];
  }
}

/**
 * Calculates the total quantity in an order.
 */
function calculateTotalItems(order) {
  if (Number(order.totalItems) > 0) {
    return Number(order.totalItems);
  }

  const products = Array.isArray(order.products)
    ? order.products
    : [];

  return products.reduce(
    (total, product) => (
      total + Number(product.quantity || 0)
    ),
    0,
  );
}

/**
 * Formats an order date.
 */
function formatOrderDate(order) {
  if (order.orderDate) {
    return order.orderDate;
  }

  if (!order.createdAt) {
    return '';
  }

  const date = new Date(order.createdAt);

  if (Number.isNaN(date.getTime())) {
    return order.createdAt;
  }

  return date.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * Converts the stored payment method into a
 * readable label.
 */
function formatPaymentMethod(value = '') {
  const paymentMethods = {
    'cash-on-delivery': 'Cash on Delivery',
    'demo-online-payment': 'Demo Online Payment',
  };

  return paymentMethods[value]
    || String(value)
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (character) => (
        character.toUpperCase()
      ));
}

/**
 * Creates one product row inside an order.
 */
function createOrderProduct(product, config) {
  const productRow = createElement(
    'div',
    'my-account-product',
  );

  const imageWrapper = createElement(
    'div',
    'my-account-product-image-wrapper',
  );

  if (product.image) {
    const image = createElement(
      'img',
      'my-account-product-image',
    );

    image.src = product.image;
    image.alt = (
      product.imageAlt
      || product.name
      || 'Product image'
    );

    image.loading = 'lazy';

    imageWrapper.append(image);
  } else {
    const placeholder = createElement(
      'div',
      'my-account-product-placeholder',
      'No image',
    );

    imageWrapper.append(placeholder);
  }

  const information = createElement(
    'div',
    'my-account-product-information',
  );

  const name = createElement(
    'h4',
    'my-account-product-name',
    product.name || 'Product',
  );

  const quantity = Number(
    product.quantity || 0,
  );

  const quantityText = createElement(
    'p',
    'my-account-product-quantity',
    `${config['quantity-label']}: ${quantity}`,
  );

  const unitPrice = createElement(
    'p',
    'my-account-product-unit-price',
    formatPrice(Number(product.price || 0)),
  );

  information.append(
    name,
    quantityText,
    unitPrice,
  );

  const lineTotal = (
    Number(product.price || 0)
    * quantity
  );

  const total = createElement(
    'strong',
    'my-account-product-total',
    formatPrice(lineTotal),
  );

  productRow.append(
    imageWrapper,
    information,
    total,
  );

  return productRow;
}

/**
 * Creates one label and value row.
 */
function createDetailRow(
  label,
  value,
  extraClass = '',
) {
  const className = (
    `my-account-detail-row ${extraClass}`
  ).trim();

  const row = createElement(
    'div',
    className,
  );

  const labelElement = createElement(
    'span',
    'my-account-detail-label',
    label,
  );

  const valueElement = createElement(
    'strong',
    'my-account-detail-value',
    value,
  );

  row.append(
    labelElement,
    valueElement,
  );

  return row;
}

/**
 * Creates the delivery-address text.
 */
function getDeliveryAddress(customer = {}) {
  return [
    customer.address,
    customer.city,
    customer.state,
    customer.postalCode,
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * Creates one complete previous-order card.
 */
function createOrderCard(order, config) {
  const card = createElement(
    'article',
    'my-account-order',
  );

  const header = createElement(
    'div',
    'my-account-order-header',
  );

  const headerInformation = createElement(
    'div',
    'my-account-order-header-information',
  );

  const orderNumber = createElement(
    'h3',
    'my-account-order-number',
    `${config['order-number-label']}: ${
      order.orderNumber || 'Not available'
    }`,
  );

  const orderDate = createElement(
    'p',
    'my-account-order-date',
    `${config['order-date-label']}: ${
      formatOrderDate(order)
    }`,
  );

  headerInformation.append(
    orderNumber,
    orderDate,
  );

  const status = createElement(
    'span',
    'my-account-order-status',
    config['order-status-value'],
  );

  header.append(
    headerInformation,
    status,
  );

  const productsContainer = createElement(
    'div',
    'my-account-order-products',
  );

  const products = Array.isArray(order.products)
    ? order.products
    : [];

  products.forEach((product) => {
    productsContainer.append(
      createOrderProduct(
        product,
        config,
      ),
    );
  });

  const orderDetails = createElement(
    'div',
    'my-account-order-details',
  );

  const customer = order.customer || {};

  const customerName = customer.fullName
    || customer.email
    || 'Not available';

  const deliveryAddress = getDeliveryAddress(
    customer,
  );

  const paymentMethod = formatPaymentMethod(
    customer.paymentMethod || '',
  );

  const customerSection = createElement(
    'div',
    'my-account-customer-details',
  );

  customerSection.append(
    createDetailRow(
      config['customer-label'],
      customerName,
    ),
  );

  if (customer.email) {
    customerSection.append(
      createDetailRow(
        'Email',
        customer.email,
      ),
    );
  }

  if (customer.phone) {
    customerSection.append(
      createDetailRow(
        'Phone',
        customer.phone,
      ),
    );
  }

  if (deliveryAddress) {
    customerSection.append(
      createDetailRow(
        config['delivery-label'],
        deliveryAddress,
      ),
    );
  }

  if (paymentMethod) {
    customerSection.append(
      createDetailRow(
        config['payment-label'],
        paymentMethod,
      ),
    );
  }

  const summary = createElement(
    'div',
    'my-account-order-summary',
  );

  summary.append(
    createDetailRow(
      config['items-label'],
      String(calculateTotalItems(order)),
    ),
    createDetailRow(
      config['subtotal-label'],
      formatPrice(
        Number(order.subtotal || 0),
      ),
    ),
    createDetailRow(
      config['shipping-label'],
      formatPrice(
        Number(order.shipping || 0),
      ),
    ),
    createDetailRow(
      config['total-label'],
      formatPrice(
        Number(order.total || 0),
      ),
      'my-account-order-total',
    ),
  );

  orderDetails.append(
    customerSection,
    summary,
  );

  card.append(
    header,
    productsContainer,
    orderDetails,
  );

  return card;
}

/**
 * Displays the empty order-history state.
 */
function renderEmptyState(block, config) {
  const emptyState = createElement(
    'div',
    'my-account-empty',
  );

  const title = createElement(
    'h2',
    'my-account-empty-title',
    config['empty-title'],
  );

  const message = createElement(
    'p',
    'my-account-empty-message',
    config['empty-message'],
  );

  const continueLink = createElement(
    'a',
    'my-account-continue-shopping',
    config['continue-label'],
  );

  continueLink.href = config['continue-link'];

  emptyState.append(
    title,
    message,
    continueLink,
  );

  block.append(emptyState);
}

/**
 * Sorts newest orders first.
 */
function sortOrders(orders) {
  return [...orders].sort((firstOrder, secondOrder) => {
    const firstDate = new Date(
      firstOrder.createdAt || 0,
    ).getTime();

    const secondDate = new Date(
      secondOrder.createdAt || 0,
    ).getTime();

    return secondDate - firstDate;
  });
}

/**
 * Renders the complete My Account block.
 */
function renderMyAccount(block, config) {
  block.replaceChildren();
  block.classList.add('my-account');

  const heading = createElement(
    'h1',
    'my-account-heading',
    config.heading,
  );

  block.append(heading);

  const orders = sortOrders(
    getSavedOrders(),
  );

  if (orders.length === 0) {
    renderEmptyState(
      block,
      config,
    );

    return;
  }

  const ordersHeading = createElement(
    'h2',
    'my-account-orders-heading',
    config['orders-heading'],
  );

  const ordersContainer = createElement(
    'div',
    'my-account-orders',
  );

  orders.forEach((order) => {
    ordersContainer.append(
      createOrderCard(
        order,
        config,
      ),
    );
  });

  block.append(
    ordersHeading,
    ordersContainer,
  );
}

/**
 * Main EDS My Account block decoration.
 */
export default function decorate(block) {
  /*
   * Read authored configuration before replacing
   * the original block content.
   */
  const config = getMyAccountConfig(block);

  renderMyAccount(
    block,
    config,
  );

  /*
   * Update the page if an order is placed while
   * this page remains open.
   */
  window.addEventListener(
    'orders:updated',
    () => {
      renderMyAccount(
        block,
        config,
      );
    },
  );

  /*
   * Update when another browser tab changes
   * the order history.
   */
  window.addEventListener(
    'storage',
    (event) => {
      if (
        event.key
        && event.key !== ORDERS_STORAGE_KEY
      ) {
        return;
      }

      renderMyAccount(
        block,
        config,
      );
    },
  );
}