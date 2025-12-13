const express = require("express");
const cors = require("cors");
const { MODELS_MANIFEST } = require("./modelsManifest");

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"), false);
    },
  })
);

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Backend is alive" });
});

app.get("/api/models", (req, res) => {
  res.json({ models: MODELS_MANIFEST });
});

app.get("/api/example", (req, res) => {
  res.json({ message: "Example API route" });
});

module.exports = app;
