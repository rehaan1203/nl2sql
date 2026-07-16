export const schema = {
  users: [
    { name: 'id', type: 'integer', nullable: false, primary_key: true },
    { name: 'name', type: 'varchar(255)', nullable: false, primary_key: false },
    { name: 'email', type: 'varchar(255)', nullable: false, primary_key: false },
    { name: 'state', type: 'varchar(2)', nullable: true, primary_key: false },
    { name: 'plan_type', type: 'varchar(50)', nullable: false, primary_key: false },
    { name: 'created_at', type: 'timestamp', nullable: false, primary_key: false },
    { name: 'last_login', type: 'timestamp', nullable: true, primary_key: false }
  ],
  orders: [
    { name: 'id', type: 'integer', nullable: false, primary_key: true },
    { name: 'user_id', type: 'integer', nullable: false, primary_key: false },
    { name: 'product_id', type: 'integer', nullable: false, primary_key: false },
    { name: 'quantity', type: 'integer', nullable: false, primary_key: false },
    { name: 'total_amount', type: 'decimal(10,2)', nullable: false, primary_key: false },
    { name: 'status', type: 'varchar(50)', nullable: false, primary_key: false },
    { name: 'ordered_at', type: 'timestamp', nullable: false, primary_key: false }
  ],
  products: [
    { name: 'id', type: 'integer', nullable: false, primary_key: true },
    { name: 'name', type: 'varchar(255)', nullable: false, primary_key: false },
    { name: 'category', type: 'varchar(100)', nullable: false, primary_key: false },
    { name: 'price', type: 'decimal(10,2)', nullable: false, primary_key: false },
    { name: 'stock_quantity', type: 'integer', nullable: false, primary_key: false },
    { name: 'created_at', type: 'timestamp', nullable: false, primary_key: false }
  ]
};

export const mockQueries = {
  "Top 10 customers by revenue": {
    sql: `SELECT u.name, u.email, SUM(o.total_amount) as total_revenue
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE o.status = 'completed'
GROUP BY u.id, u.name, u.email
ORDER BY total_revenue DESC
LIMIT 10;`,
    data: [
      { name: "Alice Smith", email: "alice@example.com", total_revenue: 12450.50 },
      { name: "Bob Johnson", email: "bob.j@example.com", total_revenue: 9800.75 },
      { name: "Charlie Davis", email: "charlie.d@example.com", total_revenue: 8500.00 },
      { name: "Diana Prince", email: "diana@example.com", total_revenue: 7200.25 },
      { name: "Evan Wright", email: "evan.w@example.com", total_revenue: 6500.00 },
      { name: "Fiona Gallagher", email: "fiona@example.com", total_revenue: 5900.50 },
      { name: "George Costanza", email: "george@example.com", total_revenue: 5400.00 },
      { name: "Hannah Abbott", email: "hannah@example.com", total_revenue: 4800.25 },
      { name: "Ian Malcolm", email: "ian@example.com", total_revenue: 4200.00 },
      { name: "Julia Roberts", email: "julia@example.com", total_revenue: 3900.50 }
    ],
    execution_time_ms: 142,
    explanation: "This query joins the users and orders tables, sums the total amount for completed orders per user, and returns the top 10 users by total revenue."
  },
  "Monthly signups in 2024": {
    sql: `SELECT DATE_TRUNC('month', created_at) as month, COUNT(*) as signup_count
FROM users
WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'
GROUP BY month
ORDER BY month;`,
    data: [
      { month: "2024-01-01", signup_count: 145 },
      { month: "2024-02-01", signup_count: 162 },
      { month: "2024-03-01", signup_count: 198 },
      { month: "2024-04-01", signup_count: 185 },
      { month: "2024-05-01", signup_count: 210 },
      { month: "2024-06-01", signup_count: 254 }
    ],
    execution_time_ms: 45,
    explanation: "This query truncates the signup date to the month and counts the number of users created in each month of 2024."
  },
  "Products with low inventory": {
    sql: `SELECT name, category, stock_quantity, price
FROM products
WHERE stock_quantity < 20
ORDER BY stock_quantity ASC
LIMIT 5;`,
    data: [
      { name: "Wireless Earbuds", category: "Electronics", stock_quantity: 2, price: 99.99 },
      { name: "Mechanical Keyboard", category: "Electronics", stock_quantity: 5, price: 149.99 },
      { name: "Ergonomic Mouse", category: "Electronics", stock_quantity: 8, price: 79.99 },
      { name: "USB-C Hub", category: "Accessories", stock_quantity: 12, price: 49.99 },
      { name: "Laptop Stand", category: "Accessories", stock_quantity: 15, price: 39.99 }
    ],
    execution_time_ms: 24,
    explanation: "This query retrieves products where the stock quantity is less than 20, sorting them from lowest to highest stock."
  },
  "Revenue by state last quarter": {
    sql: `SELECT u.state, SUM(o.total_amount) as revenue
FROM users u
JOIN orders o ON u.id = o.user_id
WHERE o.ordered_at >= '2024-04-01' AND o.ordered_at < '2024-07-01'
AND o.status = 'completed'
GROUP BY u.state
ORDER BY revenue DESC
LIMIT 10;`,
    data: [
      { state: "CA", revenue: 45200.50 },
      { state: "NY", revenue: 38500.25 },
      { state: "TX", revenue: 32100.00 },
      { state: "FL", revenue: 28400.75 },
      { state: "IL", revenue: 24500.50 },
      { state: "WA", revenue: 19800.00 },
      { state: "MA", revenue: 17200.25 },
      { state: "PA", revenue: 15400.00 },
      { state: "GA", revenue: 14100.50 },
      { state: "NC", revenue: 12800.00 }
    ],
    execution_time_ms: 115,
    explanation: "This query calculates the total revenue grouped by user state for completed orders placed in Q2 2024."
  },
  "Users who haven't ordered in 30 days": {
    sql: `SELECT id, name, email, last_login
FROM users
WHERE id NOT IN (
    SELECT DISTINCT user_id 
    FROM orders 
    WHERE ordered_at >= CURRENT_DATE - INTERVAL '30 days'
)
ORDER BY last_login DESC
LIMIT 5;`,
    data: [
      { id: 1045, name: "Samuel L.", email: "samuel@example.com", last_login: "2024-06-15T08:22:00Z" },
      { id: 2198, name: "Jessica K.", email: "jessica@example.com", last_login: "2024-06-10T14:45:00Z" },
      { id: 3451, name: "Michael T.", email: "michael@example.com", last_login: "2024-06-05T09:12:00Z" },
      { id: 4892, name: "Sarah B.", email: "sarah@example.com", last_login: "2024-05-28T16:30:00Z" },
      { id: 5120, name: "David R.", email: "david@example.com", last_login: "2024-05-20T11:05:00Z" }
    ],
    execution_time_ms: 89,
    explanation: "This query identifies users who do not have any associated orders placed within the last 30 days, sorted by their most recent login."
  }
};
