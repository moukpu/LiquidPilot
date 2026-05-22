import Image from "next/image";

export default function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="LiquidPilot Logo"
      width={32}
      height={32}
      className={className}
    />
  );
}
