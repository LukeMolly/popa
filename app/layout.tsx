import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import "./globals.css";
import "./gateway.css";
import "./fixture-card.css";
import "./member-auth.css";
import "./expiry-settings.css";
import "./verification-status.css";
export const metadata: Metadata = { title: "Township Rollers | Membership", description: "Membership administration for Township Rollers FC", icons: { icon: "/township-rollers-logo.jpg", shortcut: "/township-rollers-logo.jpg", apple: "/township-rollers-logo.jpg" } };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}<Analytics /><SpeedInsights /></body></html> }
