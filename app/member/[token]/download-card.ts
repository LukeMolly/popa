"use client";

type DownloadCard = { id: string; firstName: string; lastName: string; status: string };
const WIDTH = 1098;
const HEIGHT = 1536;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Card artwork or QR code could not be loaded."));
    image.src = src;
  });
}

export async function downloadMembershipCard(member: DownloadCard, qr: string): Promise<void> {
  if (!qr) throw new Error("Verification QR code is not ready yet.");
  const [artwork, code] = await Promise.all([
    loadImage("/township-rollers-season-ticket.jpg"),
    loadImage(qr),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot export the card.");
  ctx.drawImage(artwork, 0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#102b5a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 28px Arial, sans-serif";
  ctx.fillText("SEASONAL ACCESS PASS", WIDTH / 2, 505, 930);

  const fullName = `${member.firstName} ${member.lastName}`.trim();
  let fontSize = 58;
  do {
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    if (ctx.measureText(fullName).width <= 950) break;
    fontSize -= 2;
  } while (fontSize > 24);
  ctx.fillText(fullName, WIDTH / 2, 598, 950);
  ctx.font = "bold 32px monospace";
  ctx.fillText(member.id, WIDTH / 2, 685, 930);

  const qrSize = 290;
  const qrX = (WIDTH - qrSize) / 2;
  const qrY = 739;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24);
  ctx.drawImage(code, qrX, qrY, qrSize, qrSize);

  const status = member.status.toUpperCase();
  ctx.font = "bold 27px Arial, sans-serif";
  const badgeWidth = Math.max(175, ctx.measureText(status).width + 62);
  const badgeX = (WIDTH - badgeWidth) / 2;
  const badgeY = 1095;
  ctx.fillStyle = status === "ACTIVE" ? "#146747" : status === "EXPIRED" || status === "SUSPENDED" ? "#9f3232" : "#102b5a";
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeWidth, 54, 27);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(status, WIDTH / 2, badgeY + 27);

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Card image could not be generated.");
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = `POPA-membership-${member.id.replace(/[^a-zA-Z0-9_-]/g, "-")}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
