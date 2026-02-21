import { z } from "zod";

const RESERVED_NAMES = new Set(["traefik", "server", "mcp", "mcp-server"]);
const NAME_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

export const appName = z
  .string()
  .regex(
    NAME_REGEX,
    "Lowercase alphanumeric with hyphens, cannot start/end with hyphen"
  )
  .min(1)
  .max(63)
  .refine((name) => !RESERVED_NAMES.has(name), {
    message: "This name is reserved for infrastructure containers",
  })
  .describe("Application name");

export function validateAppName(name: string): string | null {
  if (!name || name.length > 63) return "Name must be 1-63 characters";
  if (!NAME_REGEX.test(name)) return "Lowercase alphanumeric with hyphens, cannot start/end with hyphen";
  if (RESERVED_NAMES.has(name)) return "This name is reserved for infrastructure containers";
  return null;
}
