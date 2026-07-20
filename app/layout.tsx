import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#07111f",
  colorScheme: "light",
};

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    title: "AuthLab — Passwords, Phishing, MFA and Passkeys",
    description: "An interactive security engineering guide that makes modern authentication protocols visible.",
    openGraph: {
      title: "AuthLab — See the system behind the sign-in",
      description: "Explore credential stuffing, phishing, MFA trade-offs and a live WebAuthn passkey ceremony.",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "AuthLab authentication learning guide" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "AuthLab — See the system behind the sign-in",
      description: "Interactive authentication, phishing, MFA and passkey learning lab.",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
