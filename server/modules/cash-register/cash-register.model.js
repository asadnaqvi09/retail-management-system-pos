const { query, getClient } = require('../../config/database');
const AppError = require('../../utils/AppError');

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function mapSessionRow(row) {
  return {
    id: row.id,
    user: { id: row.user_id, name: row.user_name },
    openingAmount: Number(row.opening_amount),
    expectedClosingAmount:
      row.expected_closing_amount != null ? Number(row.expected_closing_amount) : null,
    actualClosingAmount:
      row.actual_closing_amount != null ? Number(row.actual_closing_amount) : null,
    variance: row.variance != null ? Number(row.variance) : null,
    varianceNote: row.variance_note,
    totalTransactions: Number(row.total_transactions || 0),
    totalRevenue: Number(row.total_revenue || 0),
    totalDiscounts: Number(row.total_discounts || 0),
    totalReturns: Number(row.total_returns || 0),
    cashSalesTotal: Number(row.cash_sales_total || 0),
    status: row.status,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
  };
}

async function loadSessionStats(client, sessionId) {
  const result = await client.query(
    `SELECT
      COUNT(s.id) FILTER (WHERE s.status = 'completed') AS total_transactions,
      COALESCE(SUM(s.total) FILTER (WHERE s.status = 'completed'), 0) AS total_revenue,
      COALESCE(SUM(s.discount_total) FILTER (WHERE s.status = 'completed'), 0) AS total_discounts,
      COALESCE(SUM(p.amount) FILTER (
        WHERE s.status = 'completed' AND p.method = 'cash'
      ), 0) AS cash_sales_total
     FROM cash_register_sessions crs
     LEFT JOIN sales s ON s.cash_register_session_id = crs.id
     LEFT JOIN payments p ON p.sale_id = s.id
     WHERE crs.id = $1
     GROUP BY crs.id`,
    [sessionId]
  );
  return result.rows[0] || {
    total_transactions: 0,
    total_revenue: 0,
    total_discounts: 0,
    cash_sales_total: 0,
  };
}

async function getOpenSession(storeId) {
  const result = await query(
    `SELECT
      crs.id,
      crs.user_id,
      u.name AS user_name,
      crs.opening_amount,
      crs.expected_closing_amount,
      crs.actual_closing_amount,
      crs.variance,
      crs.variance_note,
      crs.total_transactions,
      crs.total_revenue,
      crs.total_discounts,
      crs.total_returns,
      crs.status,
      crs.opened_at,
      crs.closed_at,
      COALESCE(stats.cash_sales_total, 0) AS cash_sales_total
     FROM cash_register_sessions crs
     JOIN users u ON u.id = crs.user_id
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(p.amount), 0) AS cash_sales_total
       FROM sales s
       JOIN payments p ON p.sale_id = s.id
       WHERE s.cash_register_session_id = crs.id
         AND s.status = 'completed'
         AND p.method = 'cash'
     ) stats ON TRUE
     WHERE crs.store_id = $1 AND crs.status = 'open'
     ORDER BY crs.opened_at DESC
     LIMIT 1`,
    [storeId]
  );
  if (!result.rows[0]) {
    return null;
  }
  return mapSessionRow(result.rows[0]);
}

async function getSessionById(sessionId, storeId) {
  const result = await query(
    `SELECT
      crs.id,
      crs.user_id,
      u.name AS user_name,
      crs.opening_amount,
      crs.expected_closing_amount,
      crs.actual_closing_amount,
      crs.variance,
      crs.variance_note,
      crs.total_transactions,
      crs.total_revenue,
      crs.total_discounts,
      crs.total_returns,
      crs.status,
      crs.opened_at,
      crs.closed_at,
      COALESCE(stats.cash_sales_total, 0) AS cash_sales_total
     FROM cash_register_sessions crs
     JOIN users u ON u.id = crs.user_id
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(p.amount), 0) AS cash_sales_total
       FROM sales s
       JOIN payments p ON p.sale_id = s.id
       WHERE s.cash_register_session_id = crs.id
         AND s.status = 'completed'
         AND p.method = 'cash'
     ) stats ON TRUE
     WHERE crs.id = $1 AND crs.store_id = $2
     LIMIT 1`,
    [sessionId, storeId]
  );
  if (!result.rows[0]) {
    throw new AppError('Cash register session not found', 404);
  }
  return mapSessionRow(result.rows[0]);
}

async function openSession(storeId, userId, openingAmount) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const existingResult = await client.query(
      `SELECT id, user_id FROM cash_register_sessions
       WHERE store_id = $1 AND status = 'open'
       LIMIT 1 FOR UPDATE`,
      [storeId]
    );
    if (existingResult.rows[0]) {
      if (existingResult.rows[0].user_id === userId) {
        await client.query('COMMIT');
        return getSessionById(existingResult.rows[0].id, storeId);
      }
      throw new AppError('Cash register is already open for this store', 409);
    }
    const insertResult = await client.query(
      `INSERT INTO cash_register_sessions (
        store_id,
        user_id,
        opening_amount,
        status
      ) VALUES ($1, $2, $3, 'open')
      RETURNING id`,
      [storeId, userId, roundMoney(openingAmount)]
    );
    await client.query('COMMIT');
    return getSessionById(insertResult.rows[0].id, storeId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function closeSession(sessionId, storeId, userId, payload) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const sessionResult = await client.query(
      `SELECT id, user_id, opening_amount, status
       FROM cash_register_sessions
       WHERE id = $1 AND store_id = $2
       LIMIT 1 FOR UPDATE`,
      [sessionId, storeId]
    );
    if (!sessionResult.rows[0]) {
      throw new AppError('Cash register session not found', 404);
    }
    const session = sessionResult.rows[0];
    if (session.status !== 'open') {
      throw new AppError('Cash register session is already closed', 400);
    }
    if (session.user_id !== userId) {
      throw new AppError('Only the cashier who opened this register can close it', 403);
    }
    const stats = await loadSessionStats(client, sessionId);
    const openingAmount = Number(session.opening_amount);
    const cashSalesTotal = Number(stats.cash_sales_total);
    const expectedClosing = roundMoney(openingAmount + cashSalesTotal);
    const actualClosing = roundMoney(payload.actualClosingAmount);
    const variance = roundMoney(actualClosing - expectedClosing);
    await client.query(
      `UPDATE cash_register_sessions
       SET
         expected_closing_amount = $1,
         actual_closing_amount = $2,
         variance = $3,
         variance_note = $4,
         total_transactions = $5,
         total_revenue = $6,
         total_discounts = $7,
         status = 'closed',
         closed_at = NOW()
       WHERE id = $8`,
      [
        expectedClosing,
        actualClosing,
        variance,
        payload.varianceNote || null,
        Number(stats.total_transactions),
        roundMoney(stats.total_revenue),
        roundMoney(stats.total_discounts),
        sessionId,
      ]
    );
    await client.query('COMMIT');
    return getSessionById(sessionId, storeId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function incrementSessionTotals(client, sessionId, saleTotal, discountTotal) {
  await client.query(
    `UPDATE cash_register_sessions
     SET
       total_transactions = total_transactions + 1,
       total_revenue = total_revenue + $1,
       total_discounts = total_discounts + $2
     WHERE id = $3 AND status = 'open'`,
    [roundMoney(saleTotal), roundMoney(discountTotal), sessionId]
  );
}

async function decrementSessionTotals(client, sessionId, saleTotal, discountTotal) {
  await client.query(
    `UPDATE cash_register_sessions
     SET
       total_transactions = GREATEST(total_transactions - 1, 0),
       total_revenue = GREATEST(total_revenue - $1, 0),
       total_discounts = GREATEST(total_discounts - $2, 0)
     WHERE id = $3`,
    [roundMoney(saleTotal), roundMoney(discountTotal), sessionId]
  );
}

module.exports = {
  getOpenSession,
  getSessionById,
  openSession,
  closeSession,
  incrementSessionTotals,
  decrementSessionTotals,
};
