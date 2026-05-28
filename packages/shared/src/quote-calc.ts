/**
 * Quote calculation utility functions.
 * All monetary amounts are in dollars (Float, e.g. 10.99).
 * Discount and tax values are percentages (0–100, e.g. 10 = 10%).
 */

/**
 * Calculate the subtotal for a single line item.
 * @param qty Quantity
 * @param unitPrice Unit price in dollars (Float, e.g. 10.99)
 * @param lineDiscountPct Line-level discount percentage (0–100, e.g. 10 = 10%)
 * @returns Subtotal after discount, rounded to 2 decimal places
 */
export function calcLineSubtotal(qty: number, unitPrice: number, lineDiscountPct = 0): number {
  const gross = qty * unitPrice;
  const discountAmount = Math.round(gross * (lineDiscountPct / 100) * 100) / 100;
  return Math.round((gross - discountAmount) * 100) / 100;
}

export interface QuoteTotals {
  subtotal: number;    // Sum of line subtotals (before order-level discount), in dollars
  discount: number;   // Order-level discount amount, in dollars
  tax: number;        // Tax amount, in dollars
  grandTotal: number; // Final total (subtotal - discount + tax), in dollars
}

export interface CalcLineItem {
  quantity: number;
  /** Unit price in dollars (Float) */
  unitPrice: number;
  discount?: number; // line-level discount % (0-100)
  subtotal?: number; // optional pre-computed subtotal in dollars; if missing, computed from qty * unitPrice * discount
}

/**
 * Calculate totals for the entire quote.
 * @param lineItems Array of line items
 * @param orderDiscountPct Order-level discount percentage (0–100), applied after line subtotals
 * @param taxPct Tax percentage (0–100), applied to discounted subtotal
 * @returns QuoteTotals with subtotal, discount, tax, grandTotal (all in dollars)
 */
export function calcQuoteTotals(
  lineItems: CalcLineItem[],
  orderDiscountPct = 0,
  taxPct = 0,
): QuoteTotals {
  const subtotal = lineItems.reduce((sum, item) => {
    if (item.subtotal !== undefined && item.subtotal !== null) {
      return sum + item.subtotal;
    }
    return sum + calcLineSubtotal(item.quantity, item.unitPrice, item.discount ?? 0);
  }, 0);

  const discount = Math.round(subtotal * (orderDiscountPct / 100) * 100) / 100;
  const discountedSubtotal = Math.round((subtotal - discount) * 100) / 100;
  const tax = Math.round(discountedSubtotal * (taxPct / 100) * 100) / 100;
  const grandTotal = Math.round((discountedSubtotal + tax) * 100) / 100;

  return { subtotal, discount, tax, grandTotal };
}
