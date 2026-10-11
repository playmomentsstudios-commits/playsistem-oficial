// Bundle-only probe. No WhatsApp connections, login, credentials or messages.
import makeWASocket, { Browsers } from "@whiskeysockets/baileys";
export default { fetch(){ return Response.json({ bundled: typeof makeWASocket === "function", browserApi: typeof Browsers === "object", noSessionStarted: true }); } };
