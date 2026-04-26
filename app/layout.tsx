import type { Metadata } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/toast";
import { getToken } from "@/lib/auth-server";
import { ConvexClientProvider } from "./convex-client-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Recruit · Autonomous job-application agent",
  description:
    "Recruit applies to jobs for you, end to end. Sources roles, tailors artifacts, fills forms, and remembers what works.",
  metadataBase: new URL("https://recruit-mockup.vercel.app"),
  openGraph: {
    title: "Recruit · Autonomous job-application agent",
    description:
      "Sources roles, tailors artifacts, fills forms, and remembers what works.",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialToken = await getToken().catch(() => null);

  return (
    <html
      lang="en"
      className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ConvexClientProvider initialToken={initialToken}>
          {children}
        </ConvexClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
