"use client";

type DownloadCard = { id: string; firstName: string; lastName: string; status: string; branch?: string };
// CR80 portrait card for Evolis Badgy100: 53.98 × 85.60 mm at 300 dpi.
const WIDTH = 638;
const HEIGHT = 1011;
const DESIGN_WIDTH = 1098;
const DESIGN_HEIGHT = 1536;

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
    loadImage("/township-rollers-season-ticket.jpg"),
    loadImage(qr),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot export the card.");
  // Scale the original card artwork and all overlay coordinates together.
  ctx.scale(WIDTH / DESIGN_WIDTH, HEIGHT / DESIGN_HEIGHT);
  ctx.drawImage(artwork, 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  ctx.fillStyle = "#102b5a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 38px Arial, sans-serif";
  ctx.fillText("MEMBERSHIP CARD", DESIGN_WIDTH / 2, 505, 930);

  const fullName = `${member.firstName} ${member.lastName}`.trim();
  let fontSize = 58;
  do {
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    if (ctx.measureText(fullName).width <= 950) break;
    fontSize -= 2;
  } while (fontSize > 24);
  ctx.fillText(fullName, DESIGN_WIDTH / 2, 598, 950);
  ctx.font = "bold 32px monospace";
  ctx.fillText(member.id, DESIGN_WIDTH / 2, 660, 930);

  // Show the recorded branch without changing the original card artwork.
  const branch = (member.branch || "No Branch").trim();
  let branchFontSize = 37;
  do {
    ctx.font = `bold ${branchFontSize}px Arial, sans-serif`;
    if (ctx.measureText(branch).width <= 880) break;
    branchFontSize -= 2;
  } while (branchFontSize > 20);
  ctx.fillStyle = "#b37d00";
  ctx.fillText(branch, DESIGN_WIDTH / 2, 717, 880);
  ctx.fillStyle = "#102b5a";

  const qrSize = 290;
  const qrX = (DESIGN_WIDTH - qrSize) / 2;
  const qrY = 770;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24);
  ctx.drawImage(code, qrX, qrY, qrSize, qrSize);

  const status = member.status.toUpperCase();
  // Approved cards intentionally omit the green ACTIVE pill; the QR remains
  // the authoritative source for live membership verification.
  if (status !== "ACTIVE") {
    ctx.font = "bold 27px Arial, sans-serif";
    const badgeWidth = Math.max(175, ctx.measureText(status).width + 62);
    const badgeX = (DESIGN_WIDTH - badgeWidth) / 2;
    const badgeY = 1095;
    ctx.fillStyle = status === "EXPIRED" || status === "SUSPENDED" ? "#9f3232" : "#102b5a";
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeWidth, 54, 27);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(status, DESIGN_WIDTH / 2, badgeY + 27);
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
