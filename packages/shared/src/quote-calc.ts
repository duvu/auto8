/**
 * Quote calculation utility functions.
 * All prices are stored as integers (cents).
 */

/**
 * Calculate the subtotal for a single line item.
 * @param qty Quantity
 * @param unitPrice Unit price (in smallest currency unit, e.g. cents)
 * @param lineDiscountPct Line-level discount percentage (0–100)
 * @returns Subtotal after discount, rounded to nearest integer
 */
export function calcLineSubtotal(qty: number, unitPrice: number, lineDiscountPct = 0): number {
  const gross = qty * unitPrice;
  const discountAmount = Math.round(gross * (lineDiscountPct / 100));
  return gross - discountAmount;
}

export interface QuoteTotals {
  subtotal: number;    // Sum of line subtotals (before order-level discount)
  discount: number;   // Order-level discount amount (in cents)
  tax: number;        // Tax amount (in cents)
  grandTotal: number; // Final total (subtotal - discount + tax)
}

export interface CalcLineItem {
  quantity: number;
  unitPrice: number;
  discount?: number; // line-level discount % (0-100)
  subtotal?: number; // optional pre-computed subtotal; if missing, computed from qty * unitPrice * discount
}

/**
 * Calculate totals for the entire quote.
 * @param lineItems Array of line items
 * @param orderDiscountPct Order-level discount percentage (0–100), applied after line subtotals
 * @param taxPct Tax rate percentage (0–100), applied to discounted subtotal
 * @returns QuoteTotals with subtotal, discount, tax, grandTotal
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

  const discount = Math.round(subtotal * (orderDiscountPct / 100));
  const discountedSubtotal = subtotal - discount;
  const tax = Math.round(discountedSubtotal * (taxPct / 100));
  const grandTotal = discountedSubtotal + tax;

  return { subtotal, discount, tax, grandTotal };
}
