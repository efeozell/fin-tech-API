import item from "pg";
const { Pool } = item;
import { ENV } from "../config/env.js";

export const pool = new Pool({
  user: ENV.DB_USER,
  host: ENV.DB_HOST,
  database: ENV.DB_DATABASE,
  password: ENV.DB_PASSWORD,
  port: ENV.DB_PORT,
});

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Error during rollback:", rollbackError);
    }
    await client.query("ROLLBACK");
    throw error;
  } finally {
    try {
      client.release();
    } catch (releaseError) {
      console.error("Error releasing client:", releaseError);
    }
  }
}

export default withTransaction;
export const query = (text, params) => pool.query(text, params);
