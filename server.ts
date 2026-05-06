import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));

  // In-memory log store (capped at 500 records)
  const logsStore: any[] = [];

  const pushRecord = (record: any) => {
    logsStore.unshift(record);
    if (logsStore.length > 500) logsStore.pop();
    console.log(`[LOG] ${record.level} - ${record.layer}: ${record.message}`);
  };

  // POST /api/logs — single record ingestion
  app.post("/api/logs", async (req, res) => {
    const record = req.body;
    if (!record || !record.record_id) {
      return res.status(400).json({ error: "Invalid log record" });
    }
    pushRecord(record);
    res.status(202).json({ status: "accepted" });
  });

  // POST /api/logs/batch — true batch ingestion (array of records)
  app.post("/api/logs/batch", async (req, res) => {
    const records = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({ error: "Expected an array of log records" });
    }
    records.forEach(pushRecord);
    res.status(202).json({ status: "accepted", count: records.length });
  });

  // GET /api/logs — fetch all logs for the dashboard
  app.get("/api/logs", (req, res) => {
    res.json(logsStore);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
