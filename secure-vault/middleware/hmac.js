import crypto from "crypto";
import { ENV } from "../config/env.js";

export const hmacMiddleware = (req, res, next) => {
  const clientSignature = req.headers["x-signature"];

  if (!req.rawBody) {
    return res.status(400).json({ error: "Request body required for signature verification." });
  }

  if (!clientSignature) {
    return res.status(401).json({ error: "Missing signature header." });
  }

  const payload = JSON.stringify(req.body);

  console.log("------------------------------------------------");
  console.log("🟢 Server Payload (İmzalanan Veri):", payload);
  console.log("🟢 Server Secret:", process.env.HMAC_SECRET);

  const serverSignature = crypto.createHmac("sha256", ENV.HMAC_SECRET).update(req.rawBody).digest("hex");

  console.log("🔹 Client Signature:", clientSignature);
  console.log("🔹 Server Signature:", serverSignature);

  try {
    const hash1 = Buffer.from(clientSignature);
    const hash2 = Buffer.from(serverSignature);

    if (hash1.length !== hash2.length || !crypto.timingSafeEqual(hash1, hash2)) {
      return res.status(403).json({ error: "Invalid signature." });
    }
  } catch (error) {
    return res.status(403).json({ error: "Signature validation failed." });
  }

  console.log("HMAC Signature Verified");
  next();
};
