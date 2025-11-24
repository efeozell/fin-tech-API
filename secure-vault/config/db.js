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

export const query = (text, params) => pool.query(text, params);
