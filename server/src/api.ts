import { Router, json } from "express";
import { requireAuth } from "./auth.ts";
import { validateAppName } from "./validation.ts";
import { deployApp, deployInputSchema } from "./tools/deploy.ts";
import { listApps } from "./tools/list.ts";
import { getAppStatus } from "./tools/status.ts";
import { getAppLogs } from "./tools/logs.ts";
import { stopApp } from "./tools/stop.ts";
import { startApp } from "./tools/start.ts";
import { removeApp } from "./tools/remove.ts";

export const apiRouter = Router();
apiRouter.use(requireAuth);
apiRouter.use(json());

function errorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : "Unknown error";
  const status = message.includes("no such container") || message.includes("Not Found") ? 404 : 400;
  return { status, body: { error: message } };
}

apiRouter.post("/deploy", async (req, res) => {
  try {
    const input = deployInputSchema.parse(req.body);
    const result = await deployApp(input);
    res.json(result);
  } catch (err) {
    const { status, body } = errorResponse(err);
    res.status(status).json(body);
  }
});

apiRouter.get("/apps", async (req, res) => {
  try {
    const status = (req.query.status as string) || "all";
    const apps = await listApps(status);
    res.json({ apps });
  } catch (err) {
    const { status, body } = errorResponse(err);
    res.status(status).json(body);
  }
});

apiRouter.get("/apps/:name", async (req, res) => {
  const nameError = validateAppName(req.params.name);
  if (nameError) { res.status(400).json({ error: nameError }); return; }

  try {
    const result = await getAppStatus(req.params.name);
    res.json(result);
  } catch (err) {
    const { status, body } = errorResponse(err);
    res.status(status).json(body);
  }
});

apiRouter.get("/apps/:name/logs", async (req, res) => {
  const nameError = validateAppName(req.params.name);
  if (nameError) { res.status(400).json({ error: nameError }); return; }

  try {
    const tail = req.query.tail ? parseInt(req.query.tail as string, 10) : 100;
    const since = req.query.since as string | undefined;
    const logs = await getAppLogs(req.params.name, tail, since);
    res.json({ logs });
  } catch (err) {
    const { status, body } = errorResponse(err);
    res.status(status).json(body);
  }
});

apiRouter.post("/apps/:name/stop", async (req, res) => {
  const nameError = validateAppName(req.params.name);
  if (nameError) { res.status(400).json({ error: nameError }); return; }

  try {
    const result = await stopApp(req.params.name);
    res.json(result);
  } catch (err) {
    const { status, body } = errorResponse(err);
    res.status(status).json(body);
  }
});

apiRouter.post("/apps/:name/start", async (req, res) => {
  const nameError = validateAppName(req.params.name);
  if (nameError) { res.status(400).json({ error: nameError }); return; }

  try {
    const result = await startApp(req.params.name);
    res.json(result);
  } catch (err) {
    const { status, body } = errorResponse(err);
    res.status(status).json(body);
  }
});

apiRouter.delete("/apps/:name", async (req, res) => {
  const nameError = validateAppName(req.params.name);
  if (nameError) { res.status(400).json({ error: nameError }); return; }

  try {
    const removeVolumes = req.query.remove_volumes === "true";
    const result = await removeApp(req.params.name, removeVolumes);
    res.json(result);
  } catch (err) {
    const { status, body } = errorResponse(err);
    res.status(status).json(body);
  }
});
