import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "@/i18n/locale-context";
import Logo from "@/components/brand/logo";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "LiquidPilot — Predictive Liquidity Cockpit",
  description:
    "Air Traffic Control for your treasury. Radar, Autopilot, Contagion Risk, and Time Machine.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} font-sans antialiased bg-background text-foreground overflow-x-hidden`}
      >
        <LocaleProvider>
          <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5 h-16 flex items-center px-6 justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <Logo className="w-8 h-8 text-primary group-hover:text-accent transition-colors" />
              <span className="font-display font-bold text-lg tracking-tight">LiquidPilot</span>
            </Link>
            <nav className="hidden md:flex gap-6 text-sm font-medium text-muted-foreground">
              <Link href="/radar" className="hover:text-primary transition-colors">Radar</Link>
              <Link href="/autopilot" className="hover:text-primary transition-colors">Autopilot</Link>
              <Link href="/contagion" className="hover:text-primary transition-colors">Contagion</Link>
              <Link href="/timemachine" className="hover:text-primary transition-colors">Time Machine</Link>
            </nav>
            <div className="flex items-center gap-4">
               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
               <span className="text-xs font-mono text-muted-foreground hidden sm:inline-block">SYSTEM ONLINE</span>
            </div>
          </header>
          <div className="pt-16 min-h-screen relative">
            {children}
          </div>
        </LocaleProvider>
      </body>
    </html>
  );
}
