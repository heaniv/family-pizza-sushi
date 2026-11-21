CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  idempotency_key UUID NOT NULL UNIQUE,
  order_number BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  fulfillment_type TEXT NOT NULL CHECK (fulfillment_type IN ('delivery', 'pickup')),
  delivery_address TEXT,
  customer_note TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (
    status IN ('new', 'accepted', 'preparing', 'ready', 'on_delivery', 'delivered', 'cancelled')
  ),
  subtotal_uah INTEGER NOT NULL CHECK (subtotal_uah >= 0),
  delivery_fee_uah INTEGER CHECK (delivery_fee_uah >= 0),
  telegram_user_id BIGINT,
  admin_message_id BIGINT,
  assigned_courier_id BIGINT,
  assigned_courier_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (fulfillment_type = 'delivery' AND delivery_address IS NOT NULL)
    OR (fulfillment_type = 'pickup' AND delivery_address IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  item_group TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  unit_price_uah INTEGER NOT NULL CHECK (unit_price_uah >= 0),
  line_total_uah INTEGER NOT NULL CHECK (line_total_uah >= 0)
);

CREATE TABLE IF NOT EXISTS order_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  actor_telegram_id BIGINT,
  event_type TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_fee_requests (
  prompt_message_id BIGINT PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  admin_telegram_id BIGINT NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_status_created_at_idx
  ON orders (status, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_admin_message_idx
  ON orders (admin_message_id)
  WHERE admin_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS order_items_order_id_idx
  ON order_items (order_id);

CREATE INDEX IF NOT EXISTS order_events_order_id_created_at_idx
  ON order_events (order_id, created_at DESC);
