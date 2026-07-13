-- Zyro RMS — Sample catalog seed (idempotent)
-- Categories, brands, products, and real image URLs for demo/dev.

INSERT INTO categories (store_id, name, description, is_active)
SELECT s.id, c.name, c.description, TRUE
FROM stores s
CROSS JOIN (
  VALUES
    ('Men''s Shirts', 'Polos, tees, and casual shirts'),
    ('Men''s Trousers', 'Jeans, chinos, and formal pants'),
    ('Women''s Dresses', 'Casual and party dresses'),
    ('Women''s Ethnic', 'Kurtas and eastern wear'),
    ('Unisex Outerwear', 'Hoodies, jackets, and layers'),
    ('Kids Wear', 'Clothing for children'),
    ('Women''s Accessories', 'Shawls, scarves, and add-ons')
) AS c(name, description)
WHERE NOT EXISTS (
  SELECT 1 FROM categories cat
  WHERE cat.store_id = s.id AND cat.name = c.name
);

INSERT INTO brands (store_id, name, is_active)
SELECT s.id, b.name, TRUE
FROM stores s
CROSS JOIN (
  VALUES
    ('Zyro Basics'),
    ('Cotton Co'),
    ('Urban Stitch')
) AS b(name)
WHERE NOT EXISTS (
  SELECT 1 FROM brands br
  WHERE br.store_id = s.id AND br.name = b.name
);

INSERT INTO products (
  store_id,
  category_id,
  brand_id,
  tax_class_id,
  name,
  description,
  base_sku,
  default_selling_price,
  default_cost_price,
  status
)
SELECT
  s.id,
  cat.id,
  br.id,
  tax.id,
  item.name,
  item.description,
  item.base_sku,
  item.selling_price,
  item.cost_price,
  item.status::product_status
FROM stores s
JOIN tax_classes tax ON tax.store_id = s.id AND tax.is_default = TRUE
CROSS JOIN (
  VALUES
    ('Classic Polo Shirt', 'Premium cotton polo with ribbed collar', 'POLO-001', 'Men''s Shirts', 'Zyro Basics', 2499.00, 1200.00, 'active'),
    ('Slim Fit Denim Jeans', 'Mid-wash stretch denim for everyday wear', 'JEAN-001', 'Men''s Trousers', 'Urban Stitch', 3999.00, 2100.00, 'active'),
    ('Cotton Crew Neck Tee', 'Soft breathable tee for daily use', 'TEE-001', 'Men''s Shirts', 'Cotton Co', 1299.00, 650.00, 'active'),
    ('Floral Summer Dress', 'Lightweight dress with floral print', 'DRESS-001', 'Women''s Dresses', 'Zyro Basics', 5499.00, 2800.00, 'active'),
    ('Embroidered Kurta', 'Festive kurta with thread embroidery', 'KURTA-001', 'Women''s Ethnic', 'Zyro Basics', 6999.00, 3500.00, 'active'),
    ('Linen Casual Shirt', 'Relaxed fit linen shirt for summer', 'SHIRT-001', 'Men''s Shirts', 'Cotton Co', 3299.00, 1650.00, 'active'),
    ('Zip Hoodie', 'Fleece-lined hoodie with front zip', 'HOOD-001', 'Unisex Outerwear', 'Urban Stitch', 4499.00, 2300.00, 'active'),
    ('Chino Trousers', 'Tailored chinos in neutral beige', 'CHINO-001', 'Men''s Trousers', 'Zyro Basics', 3599.00, 1800.00, 'active'),
    ('Kids Cotton Set', 'Two-piece cotton set for ages 4-8', 'KIDS-001', 'Kids Wear', 'Cotton Co', 2199.00, 1100.00, 'active'),
    ('Velvet Shawl', 'Evening shawl with soft velvet finish', 'SHAWL-001', 'Women''s Accessories', 'Zyro Basics', 8999.00, 4500.00, 'active'),
    ('Oxford Formal Shirt', 'Crisp white shirt for office wear', 'OXFD-001', 'Men''s Shirts', 'Urban Stitch', 4199.00, 2200.00, 'draft'),
    ('Printed Maxi Dress', 'Long maxi with geometric print', 'MAXI-001', 'Women''s Dresses', 'Cotton Co', 6299.00, 3200.00, 'active')
) AS item(name, description, base_sku, category_name, brand_name, selling_price, cost_price, status)
JOIN categories cat ON cat.store_id = s.id AND cat.name = item.category_name
JOIN brands br ON br.store_id = s.id AND br.name = item.brand_name
WHERE NOT EXISTS (
  SELECT 1 FROM products p
  WHERE p.store_id = s.id AND p.base_sku = item.base_sku
);

INSERT INTO product_images (product_id, file_path, is_primary, display_order)
SELECT p.id, img.url, TRUE, 0
FROM products p
JOIN stores s ON s.id = p.store_id
JOIN (
  VALUES
    ('POLO-001', 'https://images.unsplash.com/photo-1581655353564-d78313708293?auto=format&fit=crop&w=800&q=80'),
    ('JEAN-001', 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=800&q=80'),
    ('TEE-001', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80'),
    ('DRESS-001', 'https://images.unsplash.com/photo-1595777458103-95e059d581b8?auto=format&fit=crop&w=800&q=80'),
    ('KURTA-001', 'https://images.unsplash.com/photo-1617137968427-85924c800a44?auto=format&fit=crop&w=800&q=80'),
    ('SHIRT-001', 'https://images.unsplash.com/photo-1602810318383-5c7c98bce953?auto=format&fit=crop&w=800&q=80'),
    ('HOOD-001', 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=800&q=80'),
    ('CHINO-001', 'https://images.unsplash.com/photo-1473966968600-fa801b869a91?auto=format&fit=crop&w=800&q=80'),
    ('KIDS-001', 'https://images.unsplash.com/photo-1503341459072-6e9f67a74656?auto=format&fit=crop&w=800&q=80'),
    ('SHAWL-001', 'https://images.unsplash.com/photo-1601925260368-ae2f83ebd122?auto=format&fit=crop&w=800&q=80'),
    ('OXFD-001', 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=800&q=80'),
    ('MAXI-001', 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=800&q=80')
) AS img(base_sku, url) ON img.base_sku = p.base_sku
WHERE NOT EXISTS (
  SELECT 1 FROM product_images pi WHERE pi.product_id = p.id
);
