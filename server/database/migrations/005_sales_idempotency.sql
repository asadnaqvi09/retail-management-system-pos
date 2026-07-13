ALTER TABLE sales
ADD COLUMN IF NOT EXISTS client_request_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_store_client_request_id
ON sales(store_id, client_request_id)
WHERE client_request_id IS NOT NULL;

