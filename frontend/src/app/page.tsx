"use client";

import { motion } from "framer-motion";
import { Radar, Plane, Network, History, ArrowRight } from "lucide-react";
import Link from "next/link";
import { AnimatedBackground } from "@/components/ui/animated-background";

const features = [
  {
    icon: Radar,
    title: "Radar",
    description: "Real-time air-traffic-control view of all money flows across accounts and banks.",
    href: "/radar",
  },
  {
    icon: Plane,
    title: "Autopilot",
    description: "Automated cash rebalancing that keeps liquidity optimal without manual intervention.",
    href: "/autopilot",
  },
  {
    icon: Network,
    title: "Contagion",
    description: "Bank contagion risk scoring using network graph analytics and exposure maps.",
    href: "/contagion",
  },
  {
    icon: History,
    title: "Time Machine",
    description: "Replay historical financial crises and stress-test your treasury against past events.",
    href: "/timemachine",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export default function Home() {
  return (
    <main className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-6 py-20 relative overflow-hidden">
      <AnimatedBackground />
      
      <motion.div 
        className="max-w-5xl w-full text-center space-y-12 z-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} className="space-y-6">
          <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary text-glow backdrop-blur-sm mb-4">
            <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse mr-2"></span>
            SynergyX Hackathon 2026
          </div>
          <h1 className="text-5xl sm:text-7xl font-display font-bold tracking-tight text-glow text-white">
            Predictive Liquidity <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Cockpit</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
            The ultimate treasury command center. Real-time radar, autonomous rebalancing, contagion risk analysis, and historical stress-testing.
          </p>
        </motion.div>

        <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/radar" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow-[0_0_20px_rgba(0,190,255,0.4)] transition-colors hover:bg-primary/90 hover:shadow-[0_0_30px_rgba(0,190,255,0.6)]">
            Enter Cockpit <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link href="https://github.com/moukpu/LiquidPilot" target="_blank" className="inline-flex h-12 items-center justify-center rounded-md border border-input glass px-8 text-sm font-medium hover:bg-white/10 hover:text-white transition-all">
            View Source
          </Link>
        </motion.div>

        <motion.div 
          variants={itemVariants}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-16 text-left"
        >
          {features.map((feature) => (
            <Link href={feature.href} key={feature.title}>
              <div className="group relative h-full rounded-2xl glass-card p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(0,190,255,0.15)] hover:border-primary/50 cursor-pointer overflow-hidden">
                {/* Glow effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                
                <div className="relative z-10">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-[0_0_15px_rgba(0,190,255,0.5)] transition-all duration-300">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 font-display text-white group-hover:text-glow transition-all">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground group-hover:text-gray-300 transition-colors">
                    {feature.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </motion.div>
      </motion.div>
    </main>
  );
}
