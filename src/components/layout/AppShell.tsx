import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, LayoutDashboard, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAlertaBotPausado } from "@/hooks/useAlertaBotPausado";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/cadastros", label: "Cadastros", icon: Settings2, end: false },
];

export default function AppShell() {
  const location = useLocation();
  // Notificação global (toast + bip) ao detectar bot pausado em tempo real
  useAlertaBotPausado();

  return (
    <div className="min-h-screen text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/40 backdrop-blur-2xl backdrop-saturate-150">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
              <Activity className="h-5 w-5" />
              <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight tracking-tight">Clínica Médica</h1>
              <p className="text-xs text-primary/70">Painel de atendimento</p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                    {isActive && (
                      <motion.span
                        layoutId="nav-indicator"
                        className="pointer-events-none absolute inset-x-2 -bottom-[9px] h-0.5 rounded-full bg-gradient-primary"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
