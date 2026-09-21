-- The unique queue-date/serial index already supports ordered queue lookups.
DROP INDEX IF EXISTS "game_top_up_order_details_queueDate_dailySerial_idx";
