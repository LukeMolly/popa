"use client";

export type DownloadCard = { id: string; firstName: string; lastName: string; status: string; branch?: string };
// CR80 portrait card for Evolis Badgy100: 53.98 × 85.60 mm at 300 dpi.
const WIDTH = 638;
const HEIGHT = 1011;
const ARTWORK = "/rollers-membership-card.webp";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Card artwork or QR code could not be loaded."));
    image.src = src;
  });
}

export async function renderMembershipCardBlob(member: DownloadCard, qr: string): Promise<Blob> {
  if (!qr) throw new Error("Verification QR code is not ready yet.");
  const [artwork, code] = await Promise.all([
    loadImage(ARTWORK),
    loadImage(qr),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot export the card.");
  ctx.drawImage(artwork, 0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#082563";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 31px Arial, sans-serif";
  const name = `${member.firstName} ${member.lastName}`.trim().toUpperCase();
  ctx.fillText(name, WIDTH / 2, 459, WIDTH - 48);

  ctx.fillStyle = "#092b70";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(88, 496, 462, 42, 21);
  ctx.fill();
  ctx.stroke();
  const label = "Membership Branch: ";
  const branch = member.branch?.trim() || "No Branch";
  ctx.font = "bold 20px Arial, sans-serif";
  const labelWidth = ctx.measureText(label).width;
  const textWidth = labelWidth + ctx.measureText(branch).width;
  ctx.save();
  ctx.translate(WIDTH / 2, 518);
  ctx.scale(Math.min(1, 436 / textWidth), 1);
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, -textWidth / 2, 0);
  ctx.fillStyle = "#ffdc05";
  ctx.fillText(branch, labelWidth - textWidth / 2, 0);
  ctx.restore();

  ctx.fillStyle = "#082563";
  ctx.font = "bold 25px Arial, sans-serif";
  ctx.fillText(`Membership ID: ${member.id}`, WIDTH / 2, 578, WIDTH - 48);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(code, 218, 615, 202, 202);

  if (member.status.toLowerCase() !== "active") {
    ctx.fillStyle = "#812b24";
    ctx.font = "bold 16px Arial, sans-serif";
    ctx.fillText(member.status.toUpperCase(), WIDTH / 2, 839, WIDTH - 48);
  }

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Card image could not be generated.");
  return blob;
}

export async function downloadMembershipCard(member: DownloadCard, qr: string): Promise<void> {
  const blob = await renderMembershipCardBlob(member, qr);
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
