"use client";

import { useEffect, useState } from "react";
import { ClubLogo } from "./club-logo";
import { readSignedOutGreeting } from "./post-signout-greeting";

// The server has already established that this visitor has no administrator
// session. A remembered first name only changes the public welcome copy.
export default function RecentlySignedOutGreeting() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setName(readSignedOutGreeting());
    refresh();
    const interval = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(interval);
  }, []);

  if (!name) {
    return (
      <div className="gateway-intro">
        <p className="eyebrow">JOIN THE POPA FAMILY</p>
        <h2>Welcome to POPA Membership</h2>
        <p>Join the Township Rollers family by submitting your membership details. After registration, contact the membership administrator on WhatsApp.</p>
      </div>
    );
  }

  return (
    <div className="gateway-greeting">
      <span className="gateway-greeting-mark"><ClubLogo className="gateway-greeting-crest" /></span>
      <div className="gateway-greeting-copy">
        <p className="gateway-greeting-label">POPA MEMBERSHIP</p>
        <h2>Hi, <span>{name}</span><span aria-hidden="true" className="gateway-greeting-wave"> 👋</span></h2>
        <p>Welcome back to POPA.</p>
      </div>
    </div>
  );
}
