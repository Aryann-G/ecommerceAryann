/*
 * Order PDF Utility
 * File: scripts/order-pdf.js
 */

const JSPDF_SCRIPT = '/scripts/vendor/jspdf.umd.min.js';
const AUTOTABLE_SCRIPT = '/scripts/vendor/jspdf.plugin.autotable.min.js';

let pdfLibrariesPromise = null;

const DEFAULT_LABELS = {
  'receipt-title': 'ElectroMart Purchase Receipt',
  'order-number-label': 'Order Number',
  'order-date-label': 'Order Date',
  'customer-label': 'Customer Details',
  'delivery-label': 'Delivery Address',
  'payment-label': 'Payment Method',
  'name-label': 'Full Name',
  'email-label': 'Email Address',
  'phone-label': 'Phone Number',
  'postal-code-label': 'Postal Code',
  'product-label': 'Product',
  'quantity-label': 'Quantity',
  'unit-price-label': 'Unit Price',
  'line-total-label': 'Amount',
  'subtotal-label': 'Subtotal',
  'shipping-label': 'Shipping',
  'total-label': 'Total Amount',
  'cod-label': 'Cash on Delivery',
  'demo-payment-label': 'Demo Online Payment',
  'success-message': 'Thank you for shopping with ElectroMart.',
};

/**
 * Dynamically loads one browser script.
 */
function loadScript(src, isReady) {
  if (isReady()) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');

    script.src = src;
    script.async = true;

    script.addEventListener('load', () => {
      if (isReady()) {
        resolve();
        return;
      }

      reject(
        new Error(`The script loaded but was not initialized: ${src}`),
      );
    });

    script.addEventListener('error', () => {
      reject(new Error(`Unable to load PDF script: ${src}`));
    });

    document.head.append(script);
  });
}

/**
 * Loads jsPDF and jsPDF-AutoTable only once.
 */
async function loadPdfLibraries() {
  if (!pdfLibrariesPromise) {
    pdfLibrariesPromise = (async () => {
      await loadScript(
        JSPDF_SCRIPT,
        () => Boolean(window.jspdf?.jsPDF),
      );

      await loadScript(
        AUTOTABLE_SCRIPT,
        () => (
          typeof window.jspdf?.jsPDF?.API?.autoTable === 'function'
          || typeof window.jspdfAutoTable?.autoTable === 'function'
        ),
      );

      if (!window.jspdf?.jsPDF) {
        throw new Error('jsPDF is unavailable.');
      }

      return window.jspdf.jsPDF;
    })();
  }

  return pdfLibrariesPromise;
}

/**
 * Converts a value into safe text.
 */
function getText(value, fallback = '-') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

/**
 * Formats money using INR text.
 *
 * INR is used instead of the rupee symbol because
 * built-in PDF fonts may not display ₹ correctly.
 */
function formatPdfCurrency(value) {
  const amount = Number(value) || 0;

  return `INR ${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Returns the authorable label configuration.
 */
function getLabels(config = {}) {
  return {
    ...DEFAULT_LABELS,
    ...config,
  };
}

/**
 * Converts the internal payment value into a visible label.
 */
function getPaymentLabel(paymentMethod, labels) {
  if (paymentMethod === 'cash-on-delivery') {
    return labels['cod-label'];
  }

  if (paymentMethod === 'demo-online-payment') {
    return labels['demo-payment-label'];
  }

  return getText(paymentMethod);
}

/**
 * Creates the complete delivery-address text.
 */
function getDeliveryAddress(customer, labels) {
  const location = [
    customer.city,
    customer.state,
  ]
    .filter(Boolean)
    .join(', ');

  const postalCode = customer.postalCode
    ? `${labels['postal-code-label']}: ${customer.postalCode}`
    : '';

  return [
    customer.address,
    location,
    postalCode,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Removes unsupported characters from the downloaded filename.
 */
function createSafeFilename(orderNumber) {
  const safeOrderNumber = getText(orderNumber, 'receipt')
    .replace(/[^a-zA-Z0-9-_]/g, '-');

  return `ElectroMart-${safeOrderNumber}.pdf`;
}

/**
 * Adds a heading to the PDF.
 */
function addSectionHeading(doc, text, x, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(text, x, y);

  doc.setFont('helvetica', 'normal');

  return y + 20;
}

/**
 * Adds one label/value line.
 */
function addDetailLine(doc, label, value, x, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`${label}:`, x, y);

  doc.setFont('helvetica', 'normal');
  doc.text(getText(value), x + 100, y);

  return y + 16;
}

/**
 * Starts a new page when there is insufficient space.
 */
function ensurePageSpace(doc, currentY, requiredSpace = 100) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomMargin = 45;

  if (currentY + requiredSpace <= pageHeight - bottomMargin) {
    return currentY;
  }

  doc.addPage();

  return 50;
}

/**
 * Adds the product table using AutoTable.
 */
function addProductTable(doc, options) {
  if (typeof doc.autoTable === 'function') {
    doc.autoTable(options);
    return;
  }

  if (typeof window.jspdfAutoTable?.autoTable === 'function') {
    window.jspdfAutoTable.autoTable(doc, options);
    return;
  }

  throw new Error('jsPDF-AutoTable is unavailable.');
}

/**
 * Downloads the completed order as a PDF receipt.
 *
 * @param {Object} order Complete checkout order information.
 * @param {Object} config AEM-authored checkout labels.
 */
export async function downloadOrderPdf(order, config = {}) {
  if (!order) {
    throw new Error('Order information is missing.');
  }

  if (!Array.isArray(order.products) || order.products.length === 0) {
    throw new Error('The order does not contain any products.');
  }

  const JsPDF = await loadPdfLibraries();
  const labels = getLabels(config);

  const doc = new JsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const customer = order.customer || {};
  const products = order.products || [];

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 42;
  const contentWidth = pageWidth - (margin * 2);

  let y = 48;

  /*
   * Receipt heading
   */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  doc.text(labels['receipt-title'], margin, y);

  y += 28;

  doc.setLineWidth(0.6);
  doc.line(margin, y, pageWidth - margin, y);

  y += 24;

  /*
   * Order details
   */
  y = addDetailLine(
    doc,
    labels['order-number-label'],
    order.orderNumber,
    margin,
    y,
  );

  y = addDetailLine(
    doc,
    labels['order-date-label'],
    order.orderDate,
    margin,
    y,
  );

  y += 12;

  /*
   * Customer details
   */
  y = addSectionHeading(
    doc,
    labels['customer-label'],
    margin,
    y,
  );

  y = addDetailLine(
    doc,
    labels['name-label'],
    customer.fullName,
    margin,
    y,
  );

  y = addDetailLine(
    doc,
    labels['email-label'],
    customer.email,
    margin,
    y,
  );

  y = addDetailLine(
    doc,
    labels['phone-label'],
    customer.phone,
    margin,
    y,
  );

  y += 10;

  /*
   * Delivery address
   */
  y = addSectionHeading(
    doc,
    labels['delivery-label'],
    margin,
    y,
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const addressLines = doc.splitTextToSize(
    getDeliveryAddress(customer, labels),
    contentWidth,
  );

  doc.text(addressLines, margin, y);

  y += (addressLines.length * 14) + 14;

  /*
   * Payment method
   */
  y = addSectionHeading(
    doc,
    labels['payment-label'],
    margin,
    y,
  );

  doc.setFontSize(10);
  doc.text(
    getPaymentLabel(customer.paymentMethod, labels),
    margin,
    y,
  );

  y += 24;

  /*
   * Product table
   */
  const productRows = products.map((product) => {
    const price = Number(product.price) || 0;
    const quantity = Number(product.quantity) || 0;
    const lineTotal = price * quantity;

    return [
      getText(product.name),
      String(quantity),
      formatPdfCurrency(price),
      formatPdfCurrency(lineTotal),
    ];
  });

  addProductTable(doc, {
    startY: y,
    margin: {
      left: margin,
      right: margin,
    },
    head: [[
      labels['product-label'],
      labels['quantity-label'],
      labels['unit-price-label'],
      labels['line-total-label'],
    ]],
    body: productRows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 6,
      overflow: 'linebreak',
    },
    headStyles: {
      fontStyle: 'bold',
    },
    columnStyles: {
      0: {
        cellWidth: 'auto',
      },
      1: {
        cellWidth: 55,
        halign: 'center',
      },
      2: {
        cellWidth: 95,
        halign: 'right',
      },
      3: {
        cellWidth: 100,
        halign: 'right',
      },
    },
  });

  y = doc.lastAutoTable?.finalY
    ? doc.lastAutoTable.finalY + 24
    : y + 80;

  y = ensurePageSpace(doc, y, 120);

  /*
   * Price calculations
   */
  const subtotal = Number(order.subtotal) || 0;
  const shipping = Number(order.shipping) || 0;

  const total = Number.isFinite(Number(order.total))
    ? Number(order.total)
    : subtotal + shipping;

  const summaryLabelX = pageWidth - margin - 175;
  const summaryValueX = pageWidth - margin;

  doc.setFontSize(10);

  doc.setFont('helvetica', 'normal');
  doc.text(labels['subtotal-label'], summaryLabelX, y);
  doc.text(
    formatPdfCurrency(subtotal),
    summaryValueX,
    y,
    { align: 'right' },
  );

  y += 18;

  doc.text(labels['shipping-label'], summaryLabelX, y);
  doc.text(
    formatPdfCurrency(shipping),
    summaryValueX,
    y,
    { align: 'right' },
  );

  y += 12;

  doc.line(summaryLabelX, y, summaryValueX, y);

  y += 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(labels['total-label'], summaryLabelX, y);
  doc.text(
    formatPdfCurrency(total),
    summaryValueX,
    y,
    { align: 'right' },
  );

  y += 40;
  y = ensurePageSpace(doc, y, 50);

  /*
   * Receipt footer
   */
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    labels['success-message'],
    pageWidth / 2,
    y,
    { align: 'center' },
  );

  /*
   * Download PDF
   */
  doc.save(createSafeFilename(order.orderNumber));
}