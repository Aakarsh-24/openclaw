import { Zap } from "lucide-react";

export default function Header() {
  return (
    <header aria-label="Boltbot" className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-5 bg-neutral-900/80 backdrop-blur border-b border-neutral-800">
      <Zap className="w-5 h-5 text-emerald-400 mr-2" aria-hidden="true" />
      <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
        Boltbot
      </span>
    </header>
  );
}
