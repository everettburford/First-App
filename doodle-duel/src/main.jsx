import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// Shared storage backed by a Netlify Function + Netlify Blobs,
// matching the window.storage API the game was written against.
const api = (k) => "/api/store?key=" + encodeURIComponent(k);
window.storage = {
  async get(k) {
    const r = await fetch(api(k), { cache: "no-store" });
    if (!r.ok) throw new Error("Storage error " + r.status);
    const j = await r.json();
    if (j.value == null) throw new Error("Key not found");
    return { key: k, value: j.value, shared: true };
  },
  async set(k, v) {
    const r = await fetch(api(k), { method: "PUT", body: v });
    if (!r.ok) throw new Error("Storage error " + r.status);
    return { key: k, value: v, shared: true };
  },
  async delete(k) {
    await fetch(api(k), { method: "DELETE" });
    return { key: k, deleted: true, shared: true };
  },
};

createRoot(document.getElementById("root")).render(<App />);
