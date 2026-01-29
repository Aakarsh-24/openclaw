import { LayoutDashboard, ScrollText, Users } from "lucide-react";
import { cn } from "../utils";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Audit Log", icon: ScrollText, active: false },
  { label: "Sessions", icon: Users, active: false },
];

export default function Sidebar() {
  return (
    <nav aria-label="Main navigation" className="hidden lg:flex fixed top-14 left-0 bottom-0 w-56 flex-col gap-1 p-3 bg-neutral-900/50 border-r border-neutral-800 z-40">
      {navItems.map((item) => (
        <button
          key={item.label}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-default select-none transition-colors text-left",
            item.active
              ? "bg-neutral-800 text-white"
              : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200",
          )}
        >
          <item.icon className="w-4 h-4" aria-hidden="true" />
          {item.label}
        </button>
      ))}
    </nav>
  );
}
