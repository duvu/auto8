-- Manual data migration: convert QuoteLineItem.unitPrice from cents (Int) to dollars (Float)
-- Run this ONCE before deploying the new schema if migrating a production database
-- that has existing quote line items stored in cents.
--
-- The condition "unitPrice > 100" is a heuristic:
--   - values 0-100 are ambiguous (could be cents like $0.01-$1.00 OR dollars like $0-$100)
--   - values > 100 are almost certainly cents (e.g. 2500 = $25.00)
-- Review your data before running. If all values should be converted, remove the WHERE clause.

UPDATE "QuoteLineItem"
SET "unitPrice" = "unitPrice" / 100.0
WHERE "unitPrice" > 100;

-- After conversion, recompute subtotals
UPDATE "QuoteLineItem"
SET "subtotal" = ROUND(("unitPrice" * "quantity" * (1 - "discount" / 100))::numeric, 2);

-- After conversion, recompute quote grandTotals
-- (This is a simplified recompute; for accuracy run saveDraft() via the API after migration)
UPDATE "Quote" q
SET "grandTotal" = (
  SELECT ROUND(
    (SUM(li."subtotal") * (1 - q2."discount" / 100) * (1 + q2."tax" / 100))::numeric, 2
  )
  FROM "QuoteLineItem" li
  JOIN "Quote" q2 ON q2.id = li."quoteId"
  WHERE li."quoteId" = q.id
)
WHERE EXISTS (SELECT 1 FROM "QuoteLineItem" WHERE "quoteId" = q.id);
