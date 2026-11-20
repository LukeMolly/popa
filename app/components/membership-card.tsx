"use client";

import { useEffect, useState } from "react";
import { renderMembershipCardBlob, type DownloadCard } from "../member/[token]/download-card";

export function MembershipCard({ member, qr }: { member: DownloadCard; qr: string }) {
  const { id, firstName, lastName, branch, status } = member;
  const [image, setImage] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let url = "";
    setImage("");
    setFailed(false);
    if (qr) {
      renderMembershipCardBlob({ id, firstName, lastName, branch, status }, qr)
        .then(blob => {
          if (cancelled) return;
          url = URL.createObjectURL(blob);
          setImage(url);
        })
        .catch(() => { if (!cancelled) setFailed(true); });
    }
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, firstName, lastName, branch, status, qr]);

  return image ? <img src={image} width={638} height={1011}
    style={{ display: "block", width: "100%", maxWidth: 510, height: "auto", margin: "0 auto" }}
    alt={`Township Rollers membership card for ${firstName} ${lastName}, ${branch || "No Branch"}, ${id}, ${status}`} />
    : <p role="status">{failed ? "Card preview unavailable." : qr ? "Preparing membership card…" : "Verification QR unavailable."}</p>;
}
