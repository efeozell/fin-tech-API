import express from "express";
import { ApolloServer } from "apollo-server-express";
import { typeDefs } from "./secure-vault/graphql/schema.js";
import { resolvers } from "./secure-vault/graphql/resolves.js";
import { ENV } from "./secure-vault/config/env.js";
import { hmacMiddleware } from "./secure-vault/middleware/hmac.js";
import rateRouter from "./secure-vault/src/routes/rateRouter.js";

async function startServer() {
  console.log("🔧 startServer() called");
  try {
    const app = express();
    const PORT = ENV.SERVER_PORT || 4000;

    // Body parsing middleware - idempotency'den önce
    app.use(
      express.json({
        verify: (req, res, buf) => {
          req.rawBody = buf;
        },
      })
    );
    app.use(express.urlencoded({ extended: true }));

    // Logging middleware
    app.use((req, res, next) => {
      console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });

    // Redis bağlantısını başlat (opsiyonel)
    try {
      const { connectRedis } = await import("./secure-vault/config/redis.js");
      await connectRedis();
      console.log("✅ Redis connected successfully");

      // Idempotency middleware - sadece Redis bağlıysa aktif
      const { idempotencyMiddleware } = await import("./secure-vault/middleware/idempotency.js");
      app.use("/graphql", hmacMiddleware, idempotencyMiddleware);
      console.log("🔒 Idempotency middleware activated");
    } catch (error) {
      console.warn("⚠️  Redis connection failed - Idempotency disabled");
      console.warn("   Server will continue without caching");
    }

    const server = new ApolloServer({
      typeDefs,
      resolvers,
      introspection: true,
      playground: true,
      context: ({ req, res }) => ({
        req,
        res,
        user: req.user,
        token: req.headers.authorization || req.headers.token,
      }),
      formatError: (err) => {
        console.error("GraphQL Error:", err);
        return err;
      },
    });

    await server.start();
    console.log("✅ Apollo Server 3 started successfully");

    // Apollo middleware'i Express'e uygula
    server.applyMiddleware({
      app,
      path: "/graphql",
      cors: {
        origin: "*",
        credentials: true,
      },
    });

    // Test endpoints
    app.use("/api", rateRouter);

    app.get("/health", (req, res) => {
      res.json({
        status: "OK",
        apollo: "Ready",
        version: "Apollo Server 3",
        reqBodyIssue: "RESOLVED! 🎉",
      });
    });

    // Server'ı başlat
    console.log(`🔧 Attempting to listen on port ${PORT}...`);
    const httpServer = app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server ready at http://localhost:${PORT}`);
      console.log(`🚀 GraphQL endpoint at http://localhost:${PORT}${server.graphqlPath}`);
      console.log(`🔧 Process ID: ${process.pid}`);
    });

    httpServer.on("error", (err) => {
      console.error("❌ Server listen error:", err);
      process.exit(1);
    });

    httpServer.on("listening", () => {
      console.log("✅ HTTP server is now listening");
    });
  } catch (error) {
    console.error("❌ Server başlatılırken hata:", error);
    process.exit(1);
  }
}

// Server'ı başlat
startServer();
