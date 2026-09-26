import { getStore } from "@netlify/blobs";

const KEY_RE = /^(room|lobby):[A-Za-z0-9:]{1,120}$/;

export default async (req) => {
  const store = getStore({ name: "word-duel", consistency: "strong" });
  const key = new URL(req.url).searchParams.get("key");
  if (!key || !KEY_RE.test(key)) return new Response("Invalid key", { status: 400 });

  if (req.method === "GET") {
    const value = await store.get(key);
    return Response.json({ value }, { headers: { "Cache-Control": "no-store" } });
  }
  if (req.method === "PUT") {
    const body = await req.text();
    if (body.length > 20000) return new Response("Too large", { status: 413 });
    await store.set(key, body);
    return Response.json({ ok: true });
  }
  if (req.method === "DELETE") {
    await store.delete(key);
    return Response.json({ ok: true });
  }
  return new Response("Method not allowed", { status: 405 });
};

export const config = { path: "/api/store" };
