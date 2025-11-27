import axios from "axios";
import { ENV } from "../../config/env.js";

class ExchangeRateService {
  constructor() {
    this.apiKey = ENV.EXCHANGE_API_KEY || "";
    this.baseUrl = "https://v6.exchangerate-api.com/v6/";
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 dakika
  }

  getCacheKey(base, target) {
    return `${base}_${target}`;
  }

  async getRate(base, target) {
    const cacheKey = this.getCacheKey(base.toUpperCase(), target.toUpperCase());

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`Cache hit for ${cacheKey}`);
      return cached.data;
    }

    console.log(`Cache miss for ${cacheKey}, fetching from API... `);

    try {
      const response = await axios.get(`${this.baseUrl}${this.apiKey}/pair/${base}/${target}`);
      if (response.data.result !== "success") {
        throw new Error(response.data["error-type"] || "API error");
      }

      const data = {
        base,
        target,
        rate: response.data.conversion_rate,
        timestamp: new Date().toString(),
      };

      this.cache.set(cacheKey, {
        data,
        expiresAt: Date.now() + this.cacheTTL,
      });

      return data;
    } catch (error) {
      if (axios.isAxiosError && axios.isAxiosError(error)) {
        const errorType = error.response?.data?.["error-type"];
        if (errorType === "unsupported-code") {
          throw new Error(`Unsupported currency code: ${base} or ${target}`);
        }
      }
      throw error;
    }
  }
}

const exchangeRateService = new ExchangeRateService();

export default exchangeRateService;
