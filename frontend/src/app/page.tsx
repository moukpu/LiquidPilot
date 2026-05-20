"use client";

import { motion } from "framer-motion";
import { Radar, Plane, Network, History, ArrowRight } from "lucide-react";
import Link from "next/link";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { useLocale } from "@/i18n/locale-context";
import type { MessageKey } from "@/i18n/messages/en";

interface Feature {
  icon: typeof Radar;
  titleKey: MessageKey;
  descKey: MessageKey;
  href: string;
}

const features: Feature[] = [
  {
    icon: Radar,
    titleKey: "home.feature.radar.title",
    descKey: "home.feature.radar.desc",
    href: "/radar",
  },
  {
    icon: Plane,
    titleKey: "home.feature.autopilot.title",
    descKey: "home.feature.autopilot.desc",
    href: "/autopilot",
  },
  {
    icon: Network,
    titleKey: "home.feature.contagion.title",
    descKey: "home.feature.contagion.desc",
    href: "/contagion",
  },
  {
    icon: History,
    titleKey: "home.feature.timemachine.title",
    descKey: "home.feature.timemachine.desc",
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
  const { t } = useLocale();
  return (
    <main className="flex flex-col items-center px-6 py-12 relative overflow-hidden">
      <AnimatedBackground />

      <motion.div
        className="max-w-5xl w-full text-center space-y-12 z-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} className="space-y-6">
          <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary backdrop-blur-sm mb-4">
            <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse mr-2"></span>
            {t("home.badge.live")}
          </div>
          <h1 className="text-5xl sm:text-7xl font-display font-bold tracking-tight text-foreground">
            {t("home.title.line1")} <br className="hidden sm:block" />
            <span className="text-primary">{t("home.title.line2")}</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
            {t("home.subtitle")}
          </p>
        </motion.div>

        <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/radar" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow-lg transition-colors hover:bg-primary/90">
            {t("home.cta.enter")} <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link href="https://github.com/moukpu/LiquidPilot" target="_blank" className="inline-flex h-12 items-center justify-center rounded-md border border-input glass px-8 text-sm font-medium hover:bg-white/10 hover:text-white transition-all">
            {t("home.cta.source")}
          </Link>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-16 text-left"
        >
          {features.map((feature) => (
            <Link href={feature.href} key={feature.titleKey}>
              <div className="group relative h-full rounded-2xl glass-card p-6 transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="relative z-10">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all duration-300">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 font-display text-foreground transition-all">{t(feature.titleKey)}</h3>
                  <p className="text-sm text-muted-foreground group-hover:text-slate-700 transition-colors">
                    {t(feature.descKey)}
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
