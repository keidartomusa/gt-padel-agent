// Unit-test store where every user already has a saved name (the name step itself is covered in player-identity.test.js).
import { memoryStore as base } from "../src/store.js";
export function memoryStore() { const s = base(); return { ...s, async get(key) { const v = await s.get(key); if (key.startsWith("profile/") && !v?.name) return { ...(v || { userId: key.slice(8) }), name: "שחקן/ית" }; return v; } }; }
export async function named(store, userId, name) { const p = (await store.get(`profile/${userId}`)) || { userId }; await store.set(`profile/${userId}`, { ...p, name }); }
