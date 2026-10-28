const origin = process.env.SERVICE_ORIGIN ?? "http://localhost:3000";

const response = await fetch(`${origin}/uploads/start`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    workOrderId: "WO-1042",
    technicianId: "TECH-17",
    mediaId: "arrival-photo",
    filename: "compressor-panel.jpg",
    contentType: "image/jpeg",
    sizeBytes: 18_000_000,
  }),
});

console.log(JSON.stringify(await response.json(), null, 2));
