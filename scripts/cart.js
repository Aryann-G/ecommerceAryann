/*
 * ElectroMart Cart Utilities
 * File: scripts/cart.js
 */

const CART_STORAGE_KEY = 'electromart-cart';

/**
 * Read the cart from localStorage.
 * @returns {Array}
 */
export function getCart() {
  try {
    const storedCart = localStorage.getItem(CART_STORAGE_KEY);

    if (!storedCart) {
      return [];
    }

    const parsedCart = JSON.parse(storedCart);

    return Array.isArray(parsedCart) ? parsedCart : [];
  } catch (error) {
    console.error('Unable to read cart:', error);
    return [];
  }
}

/**
 * Return the total quantity of products in the cart.
 *
 * Example:
 * Samsung quantity = 2
 * iPhone quantity = 1
 * Total cart count = 3
 *
 * @param {Array} cart
 * @returns {number}
 */
export function getCartCount(cart = getCart()) {
  return cart.reduce(
    (total, product) => total + Number(product.quantity || 0),
    0,
  );
}

/**
 * Save the cart and notify the rest of the page.
 *
 * @param {Array} cart
 */
export function saveCart(cart) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));

    window.dispatchEvent(
      new CustomEvent('cart:updated', {
        detail: {
          cart,
          count: getCartCount(cart),
        },
      }),
    );
  } catch (error) {
    console.error('Unable to save cart:', error);
  }
}

/**
 * Add a product to the cart.
 * If it already exists, increase its quantity.
 *
 * @param {Object} product
 * @returns {Object|null}
 */
export function addToCart(product) {
  if (!product?.id) {
    console.error('Cannot add product without an ID.');
    return null;
  }

  const cart = getCart();

  const existingProduct = cart.find(
    (cartProduct) => cartProduct.id === product.id,
  );

  if (existingProduct) {
    existingProduct.quantity += 1;
  } else {
    cart.push({
      ...product,
      quantity: 1,
    });
  }

  saveCart(cart);

  return cart.find((cartProduct) => cartProduct.id === product.id) || null;
}

/**
 * Change the quantity of one product.
 *
 * @param {string} productId
 * @param {number} quantity
 */
export function updateCartQuantity(productId, quantity) {
  let cart = getCart();
  const safeQuantity = Number(quantity);

  if (safeQuantity <= 0) {
    cart = cart.filter((product) => product.id !== productId);
  } else {
    cart = cart.map((product) => (
      product.id === productId
        ? {
          ...product,
          quantity: safeQuantity,
        }
        : product
    ));
  }

  saveCart(cart);
}

/**
 * Remove one product completely.
 *
 * @param {string} productId
 */
export function removeFromCart(productId) {
  const updatedCart = getCart().filter(
    (product) => product.id !== productId,
  );

  saveCart(updatedCart);
}

/**
 * Remove every product from the cart.
 */
export function clearCart() {
  saveCart([]);
}

/**
 * Format an amount as Indian Rupees.
 *
 * @param {number} amount
 * @returns {string}
 */
export function formatPrice(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
}