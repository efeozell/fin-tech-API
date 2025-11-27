import express from "express";
import exchangeRateService from "../service/exchangeRateService.js";

const router = express.Router();

router.get("/rate", async (req, res) => {
  const { base, target } = req.query;

  if (!base || !target) {
    return res.status(400).json({ error: "Base and target query parameters are required." });
  }

  const baseStr = String(base).toUpperCase();
  const targetStr = String(target).toUpperCase();

  if (baseStr === targetStr) {
    return res.status(200).json({
      success: true,
      data: {
        base: baseStr,
        target: targetStr,
        rate: 1,
        timestamp: new Date().toString(),
      },
    });
  }

  try {
    const rateData = await exchangeRateService.getRate(baseStr, targetStr);
    return res.status(200).json({
      success: true,
      data: rateData,
    });
  } catch (error) {
    console.error("Error fetching exchange rate:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("invalid API key")) {
      return res.status(401).json({
        success: false,
        error: "Invalid API key provided for exchange rate service.",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to fetch exchange rate data.",
      message: errorMessage,
    });
  }
});

export default router;
