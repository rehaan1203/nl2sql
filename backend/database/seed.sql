-- Seed users
INSERT INTO users (name, email, state, signup_date, last_login) VALUES
('John Doe', 'john@example.com', 'California', '2023-01-15', '2024-03-01 10:00:00'),
('Jane Smith', 'jane@example.com', 'New York', '2023-02-20', '2024-03-02 11:30:00'),
('Bob Johnson', 'bob@example.com', 'Texas', '2024-01-05', '2024-03-05 09:15:00'),
('Alice Brown', 'alice@example.com', 'California', '2024-01-10', '2024-02-20 14:00:00'),
('Charlie Davis', 'charlie@example.com', 'Florida', '2023-11-12', '2024-03-01 08:45:00'),
('Eve Wilson', 'eve@example.com', 'Texas', '2024-02-01', '2024-03-06 16:20:00');

-- Seed products
INSERT INTO products (name, category, price, stock_quantity) VALUES
('Laptop Pro', 'Electronics', 1299.99, 50),
('Wireless Mouse', 'Accessories', 29.99, 200),
('Mechanical Keyboard', 'Accessories', 149.99, 75),
('4K Monitor', 'Electronics', 399.99, 30),
('USB-C Hub', 'Accessories', 45.00, 150),
('Desk Chair', 'Furniture', 249.99, 20),
('Coffee Mug', 'Office Supplies', 12.50, 8),
('Notebook', 'Office Supplies', 5.99, 300);

-- Seed orders
INSERT INTO orders (user_id, order_date, status, total_amount) VALUES
(1, '2024-01-20 10:30:00', 'delivered', 1329.98),
(2, '2024-02-15 14:45:00', 'shipped', 249.99),
(3, '2024-03-01 09:00:00', 'processing', 399.99),
(4, '2024-01-25 16:20:00', 'delivered', 149.99),
(1, '2024-03-05 11:10:00', 'delivered', 45.00),
(6, '2024-02-28 13:15:00', 'shipped', 1299.99);

-- Seed order_items
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
(1, 1, 1, 1299.99),
(1, 2, 1, 29.99),
(2, 6, 1, 249.99),
(3, 4, 1, 399.99),
(4, 3, 1, 149.99),
(5, 5, 1, 45.00),
(6, 1, 1, 1299.99);
