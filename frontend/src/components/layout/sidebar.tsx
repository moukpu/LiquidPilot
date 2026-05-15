"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radar, Plane, Network, History } from "lucide-react";
import Logo from "@/components/brand/logo";

const nav = [
  { href: "/radar", label: "Radar", icon: Radar },
  { href: "/autopilot", label: "Autopilot", icon: Plane },
  { href: "/contagion", label: "Contagion", icon: Network },
  { href: "/timemachine", label: "Time Machine", icon: History },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-border">
        <Link href="/" className="flex items-center gap-3">
          <Logo className="w-8 h-8" />
          <span className="font-bold text-lg">LiquidPilot</span>
        </Link>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {nav.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
