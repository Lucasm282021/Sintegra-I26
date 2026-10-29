import crypto from "node:crypto";

export default function paymentWebhook(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "método no permitido" });
  const secret = process.env.SINTEGRA_WEBHOOK_SECRET?.trim();
  const terminal = process.env.TPV_TERMINAL_ID?.trim();
  if (!secret || !terminal) return res.status(503).json({ error: "receptor de pagos sin configurar" });
  const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  if (!payload || payload.event_type !== "payment.confirmed" || payload.terminal_id !== terminal
    || req.headers["x-sintegra-event"] !== payload.event_type || !req.headers["x-sintegra-event-id"]) {
    return res.status(400).json({ error: "evento de pago inválido para este terminal" });
  }
  const signature = req.headers["x-sintegra-signature"];
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex")}`;
  if (typeof signature !== "string" || signature.length !== expected.length
    || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).json({ error: "firma inválida" });
  }
  console.info(JSON.stringify({ type: "sintegra.payment.confirmed", event_id: req.headers["x-sintegra-event-id"], payload }));
  return res.status(200).json({ accepted: true, event_id: req.headers["x-sintegra-event-id"], terminal_id: terminal });
}
