import { describe, expect, it, vi } from "vitest";

import { fetchJson } from "../src/counties.ts";

const sourceUrl = "https://example.test/arcgis/query";

function response(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

describe("bounded upstream JSON requests", () => {
  it("retries transient responses and returns a later success", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({}, { status: 503 }))
      .mockResolvedValueOnce(response({ value: 42 }));
    const sleep = vi.fn(async () => undefined);

    await expect(
      fetchJson<{ value: number }>(sourceUrl, {
        fetch: fetchImplementation,
        sleep,
      }),
    ).resolves.toEqual({ value: 42 });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);
  });

  it("reports retry exhaustion with URL, status, and attempts", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({}, { status: 503, statusText: "Busy" }));

    const request = fetchJson(sourceUrl, {
      fetch: fetchImplementation,
      sleep: async () => undefined,
    });
    await expect(request).rejects.toMatchObject({
      attempts: 3,
      message: expect.stringContaining(
        `GET ${sourceUrl} failed after 3 attempts (HTTP 503): Busy`,
      ),
      status: 503,
      url: sourceUrl,
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(3);
  });

  it("honors Retry-After within the capped delay", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({}, { status: 429, headers: { "retry-after": "1.5" } }),
      )
      .mockResolvedValueOnce(response({ ok: true }));
    const sleep = vi.fn(async () => undefined);

    await fetchJson(sourceUrl, { fetch: fetchImplementation, sleep });
    expect(sleep).toHaveBeenCalledWith(1_500);
  });

  it("caps large Retry-After values", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({}, { status: 503, headers: { "retry-after": "60" } }),
      )
      .mockResolvedValueOnce(response({ ok: true }));
    const sleep = vi.fn(async () => undefined);

    await fetchJson(sourceUrl, { fetch: fetchImplementation, sleep });
    expect(sleep).toHaveBeenCalledWith(2_000);
  });

  it("fails permanent HTTP errors without retrying", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({}, { status: 404, statusText: "Missing" }));

    await expect(
      fetchJson(sourceUrl, { fetch: fetchImplementation }),
    ).rejects.toMatchObject({ attempts: 1, status: 404 });
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("fails malformed JSON without retrying", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("not json", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(
      fetchJson(sourceUrl, { fetch: fetchImplementation }),
    ).rejects.toMatchObject({
      attempts: 1,
      message: expect.stringContaining("returned malformed JSON"),
      status: 200,
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("surfaces ArcGIS error payloads returned with HTTP 200", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        error: {
          code: 400,
          message: "Invalid query",
          details: ["Unknown field"],
        },
      }),
    );

    await expect(
      fetchJson(sourceUrl, { fetch: fetchImplementation }),
    ).rejects.toMatchObject({
      attempts: 1,
      message: expect.stringContaining(
        "ArcGIS error 400: Invalid query: Unknown field",
      ),
      status: 200,
      url: sourceUrl,
    });
  });

  it("aborts timed-out attempts and stops at the attempt limit", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(
      async (_input, init) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const request = fetchJson(sourceUrl, {
      fetch: fetchImplementation,
      maxAttempts: 2,
      sleep: async () => undefined,
      timeoutMs: 5,
    });
    await expect(request).rejects.toMatchObject({
      attempts: 2,
      message: expect.stringContaining("timed out after 5ms"),
      url: sourceUrl,
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });
});
