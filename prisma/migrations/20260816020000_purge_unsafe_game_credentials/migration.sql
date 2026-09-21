-- Passwords and authentication secrets are outside the game top-up domain.
-- Remove any legacy credential-shaped JSON keys while preserving safe IDs.
UPDATE "cart_items" AS ci
SET "customerInputs" = COALESCE((
  SELECT jsonb_object_agg(entry.key, entry.value)
  FROM jsonb_each(ci."customerInputs") AS entry(key, value)
  WHERE entry.key !~* '(password|passcode|secret|otp|token)'
    AND NOT EXISTS (
      SELECT 1
      FROM "game_top_up_input_fields" AS field
      WHERE field."gameTopUpProductId" = ci."gameTopUpProductId"
        AND field."name" = entry.key
        AND (
          field."name" ~* '(password|passcode|secret|otp|token)'
          OR field."label" ~* '(password|passcode|facebook login|google login|gmail login)'
        )
    )
), '{}'::jsonb)
WHERE ci."productType" = 'GAME_TOP_UP'::"DigitalProductType"
  AND jsonb_typeof(ci."customerInputs") = 'object'
  AND EXISTS (
    SELECT 1
    FROM jsonb_each(ci."customerInputs") AS entry(key, value)
    WHERE entry.key ~* '(password|passcode|secret|otp|token)'
       OR EXISTS (
         SELECT 1
         FROM "game_top_up_input_fields" AS field
         WHERE field."gameTopUpProductId" = ci."gameTopUpProductId"
           AND field."name" = entry.key
           AND (
             field."name" ~* '(password|passcode|secret|otp|token)'
             OR field."label" ~* '(password|passcode|facebook login|google login|gmail login)'
           )
       )
  );

UPDATE "order_items" AS oi
SET "customerInputs" = COALESCE((
  SELECT jsonb_object_agg(entry.key, entry.value)
  FROM jsonb_each(oi."customerInputs") AS entry(key, value)
  WHERE entry.key !~* '(password|passcode|secret|otp|token)'
    AND NOT EXISTS (
      SELECT 1
      FROM "game_top_up_input_fields" AS field
      WHERE field."gameTopUpProductId" = oi."gameTopUpProductId"
        AND field."name" = entry.key
        AND (
          field."name" ~* '(password|passcode|secret|otp|token)'
          OR field."label" ~* '(password|passcode|facebook login|google login|gmail login)'
        )
    )
), '{}'::jsonb)
WHERE oi."productType" = 'GAME_TOP_UP'::"DigitalProductType"
  AND jsonb_typeof(oi."customerInputs") = 'object'
  AND EXISTS (
    SELECT 1
    FROM jsonb_each(oi."customerInputs") AS entry(key, value)
    WHERE entry.key ~* '(password|passcode|secret|otp|token)'
       OR EXISTS (
         SELECT 1
         FROM "game_top_up_input_fields" AS field
         WHERE field."gameTopUpProductId" = oi."gameTopUpProductId"
           AND field."name" = entry.key
           AND (
             field."name" ~* '(password|passcode|secret|otp|token)'
             OR field."label" ~* '(password|passcode|facebook login|google login|gmail login)'
           )
       )
  );
