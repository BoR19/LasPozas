import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes
  app.use(express.json());
  
  app.post("/api/sync/readings", (req, res) => {
    console.log("Syncing readings:", req.body);
    res.json({ status: "ok" });
  });

  app.post("/api/sync/users", (req, res) => {
    console.log("Syncing users:", req.body);
    res.json({ status: "ok" });
  });

  app.post("/api/sync/tarifas", (req, res) => {
    console.log("Syncing tarifas:", req.body);
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
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
