import { Readable } from "node:stream";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { requireAuth } from "./auth.ts";
import { config } from "./config.ts";
import { loadImage } from "./docker.ts";
import { deployStaticSite } from "./static.ts";
import { validateAppName } from "./validation.ts";
import { registerDeployTool } from "./tools/deploy.ts";
import { registerDeployStaticTool } from "./tools/deploy-static.ts";
import { registerListTool } from "./tools/list.ts";
import { registerLogsTool } from "./tools/logs.ts";
import { registerStopTool } from "./tools/stop.ts";
import { registerStartTool } from "./tools/start.ts";
import { registerRemoveTool } from "./tools/remove.ts";
import { registerStatusTool } from "./tools/status.ts";
import { registerUploadImageTool } from "./tools/upload-image.ts";
import { apiRouter } from "./api.ts";
import { getDashboardHtml } from "./dashboard.ts";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

function createServer(): McpServer {
  const server = new McpServer({
    name: "mcp-deploy",
    version: "1.0.0",
  });

  registerDeployTool(server);
  registerDeployStaticTool(server);
  registerListTool(server);
  registerLogsTool(server);
  registerStopTool(server);
  registerStartTool(server);
  registerRemoveTool(server);
  registerStatusTool(server);
  registerUploadImageTool(server);

  return server;
}

const app = express();

// MCP endpoint — fresh server + transport per request (required by SDK for stateless mode)
app.all("/mcp", express.json(), requireAuth, async (req, res) => {
  const server = createServer();

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    res.on("close", () => {
      transport.close();
      server.close();
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// Upload endpoint — streams raw binary, no JSON parsing
app.post("/upload", requireAuth, (req, res) => {
  const contentLength = parseInt(req.headers["content-length"] || "0", 10);
  if (contentLength > MAX_UPLOAD_BYTES) {
    res.status(413).json({ error: `Upload exceeds ${MAX_UPLOAD_BYTES} byte limit` });
    return;
  }

  loadImage(req, MAX_UPLOAD_BYTES)
    .then((result) => {
      if (!res.headersSent) {
        res.json({ status: "ok", message: result.trim() });
      }
    })
    .catch((err) => {
      if (!res.headersSent) {
        const message = err instanceof Error ? err.message : "Unknown error";
        const status = message.includes("byte limit") ? 413 : 500;
        res.status(status).json({ error: message });
      }
    });
});

// Static site deployment — upload tar.gz of HTML files
// Body is buffered first because deployStaticSite does async setup before consuming the stream
app.post("/deploy-static/:name", requireAuth, (req, res) => {
  const nameError = validateAppName(req.params.name);
  if (nameError) {
    res.status(400).json({ error: nameError });
    return;
  }

  const contentLength = parseInt(req.headers["content-length"] || "0", 10);
  if (contentLength > MAX_UPLOAD_BYTES) {
    res.status(413).json({ error: `Upload exceeds ${MAX_UPLOAD_BYTES} byte limit` });
    return;
  }

  const chunks: Buffer[] = [];
  let received = 0;

  req.on("data", (chunk: Buffer) => {
    received += chunk.length;
    if (received > MAX_UPLOAD_BYTES) {
      req.destroy();
      res.status(413).json({ error: `Upload exceeds ${MAX_UPLOAD_BYTES} byte limit` });
      return;
    }
    chunks.push(chunk);
  });

  req.on("end", () => {
    const tarStream = Readable.from(Buffer.concat(chunks));
    deployStaticSite(req.params.name, tarStream)
      .then((url) => {
        if (!res.headersSent) {
          res.json({ status: "ok", name: req.params.name, url });
        }
      })
      .catch((err) => {
        if (!res.headersSent) {
          const message = err instanceof Error ? err.message : "Unknown error";
          res.status(500).json({ error: message });
        }
      });
  });
});

// REST API for CI/CD (GitHub Actions, scripts, etc.)
app.use("/api", apiRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: "1.0.0" });
});

app.get("/", (_req, res) => {
  res.type("html").send(getDashboardHtml());
});

app.listen(config.port, () => {
  console.log(`mcp-deploy listening on port ${config.port}`);
});
