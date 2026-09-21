import type { Metadata } from "next";
import "./globals.css";
import "./gateway.css";
import "./fixture-card.css";
import "./member-auth.css";
import "./expiry-settings.css";
import "./verification-status.css";
export const metadata: Metadata = { title: "Township Rollers | Membership", description: "Membership administration for Township Rollers FC", icons: { icon: "/favicon.svg" } };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html> }
