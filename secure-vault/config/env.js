import "dotenv/config";

export const ENV = {
  DB_USER: process.env.DB_USER,
  DB_HOST: process.env.DB_HOST,
  DB_DATABASE: process.env.DB_DATABASE,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_PORT: process.env.DB_PORT,
  SERVER_PORT: process.env.SERVER_PORT,
  REDIS_URL: process.env.REDIS_URL,
  HMAC_SECRET: process.env.HMAC_SECRET,
};
