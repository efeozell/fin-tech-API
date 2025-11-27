import { redisClient } from "../config/redis.js";

export const idempotencyMiddleware = async (req, res, next) => {
  const idempotencyKey = req.headers["idempotency-key"];

  if (!idempotencyKey) {
    return next();
  }

  const { query, operationName } = req.body || {};

  if (!req.body || operationName === "IntrospectionQuery" || (query && query.includes("__schema"))) {
    return next();
  }

  if (!idempotencyKey) {
    return next();
  }

  console.log(`🔒 Idempotency key detected: ${idempotencyKey}`);

  try {
    const cachedResponse = await redisClient.get(`idempotency:${idempotencyKey}`);

    if (cachedResponse) {
      console.log("Serving from cache! This request has already been processed.");

      return res.setHeader("Content-Type", "application/json").status(200).send(cachedResponse);
    }

    //Ilk kez geliyor.
    const originalSend = res.send;

    res.send = function (body) {
      const responseBody = body;

      if (res.statusCode >= 200 && res.statusCode < 300) {
        redisClient.set(`idempotency:${idempotencyKey}`, responseBody, {
          EX: 60 * 60 * 24, //24 Saat
        });
      }

      console.log("Saved to idempotency cache");

      return originalSend.call(this, body);
    };

    next();
  } catch (error) {
    console.log("Idempotency Error: ", error);
    next();
  }
};
