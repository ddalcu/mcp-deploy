import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

// Track what docker.loadImage receives
let capturedImageData: Buffer | null = null;

// Mock dockerode before importing docker.ts — the mock class replaces Docker
// so that `new Docker(...)` in docker.ts creates our fake instance
mock.module("dockerode", {
  defaultExport: class {
    loadImage(stream: NodeJS.ReadableStream) {
      return new Promise((resolve) => {
        const chunks: Buffer[] = [];
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
        stream.on("end", () => {
          capturedImageData = Buffer.concat(chunks);
          const response = new Readable({ read() {} });
          response.push("Loaded image\n");
          response.push(null);
          resolve(response);
        });
      });
    }
  },
});

const { loadImage } = await import("../src/docker.ts");

describe("loadImage", () => {
  beforeEach(() => {
    capturedImageData = null;
  });

  it("should capture all stream data without loss", async () => {
    const testData = Buffer.alloc(1024 * 100, 0x41); // 100KB of 'A'
    const stream = Readable.from(testData);

    const result = await loadImage(stream, 1024 * 1024);

    assert.ok(capturedImageData, "docker.loadImage should have received data");
    assert.equal(capturedImageData.length, testData.length);
    assert.ok(capturedImageData.equals(testData), "data should match byte-for-byte");
    assert.ok(result.includes("Loaded image"));
  });

  it("should reject streams exceeding maxBytes", async () => {
    const testData = Buffer.alloc(1024 * 100); // 100KB
    const stream = Readable.from(testData);

    await assert.rejects(
      () => loadImage(stream, 1024 * 50), // 50KB limit
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /byte limit/);
        return true;
      },
    );
  });

  it("should handle many small chunks without data loss", async () => {
    const chunkSize = 64;
    const numChunks = 1000;
    const expectedSize = chunkSize * numChunks;

    let sent = 0;
    const stream = new Readable({
      read() {
        if (sent < numChunks) {
          this.push(Buffer.alloc(chunkSize, sent % 256));
          sent++;
        } else {
          this.push(null);
        }
      },
    });

    await loadImage(stream, expectedSize + 1);

    assert.ok(capturedImageData, "docker.loadImage should have received data");
    assert.equal(capturedImageData.length, expectedSize);
  });

  it("should reject exactly at the byte limit boundary", async () => {
    const limit = 1024;
    const testData = Buffer.alloc(limit + 1); // 1 byte over
    const stream = Readable.from(testData);

    await assert.rejects(
      () => loadImage(stream, limit),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /byte limit/);
        return true;
      },
    );
  });

  it("should accept data exactly at the byte limit", async () => {
    const limit = 1024;
    const testData = Buffer.alloc(limit, 0xff);
    const stream = Readable.from(testData);

    await loadImage(stream, limit);

    assert.ok(capturedImageData);
    assert.equal(capturedImageData.length, limit);
    assert.ok(capturedImageData.equals(testData));
  });
});
