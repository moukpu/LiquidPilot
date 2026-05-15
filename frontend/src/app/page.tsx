import { Radar, Plane, Network, History } from "lucide-react";
import Logo from "@/components/brand/logo";

const features = [
  {
    icon: Radar,
    title: "Radar",
    description: "Real-time air-traffic-control view of all money flows across accounts and banks.",
  },
  {
    icon: Plane,
    title: "Autopilot",
    description: "Automated cash rebalancing that keeps liquidity optimal without manual intervention.",
  },
  {
    icon: Network,
    title: "Contagion",
    description: "Bank contagion risk scoring using network graph analytics and exposure maps.",
  },
  {
    icon: History,
    title: "Time Machine",
    description: "Replay historical financial crises and stress-test your treasury against past events.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-4xl w-full text-center space-y-8">
        <div className="flex justify-center">
          <Logo className="w-24 h-24" />
        </div>
        <h1 className="text-5xl font-display font-bold tracking-tight">
          LiquidPilot
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Predictive liquidity cockpit for fintech treasury.
          Air Traffic Control + Autopilot + Bank Contagion + Time Machine.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-border bg-card p-6 text-left hover:border-primary transition-colors"
            >
              <feature.icon className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
