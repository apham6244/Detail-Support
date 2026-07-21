import { Search, Bell, Menu, Sun, Moon, LogIn, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { theme, toggle } = useTheme();
  const { isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center gap-4 border-b border-line bg-panel px-4 md:px-[26px]">
      <button
        onClick={onMenu}
        aria-label="Open menu"
        className="flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-line text-ink2 transition-[transform,border-color,color] duration-150 ease-out hover:border-brand-500 active:scale-90 md:hidden"
      >
        <Menu className="h-[18px] w-[18px]" />
      </button>

      <div className="relative max-w-[440px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-[18px] w-[18px] text-ink3" />
        <input
          placeholder="Search customers, vehicles, invoices…"
          className="h-[38px] w-full rounded-lg border border-line bg-panel2 pl-9 pr-3 text-[13.5px] text-ink placeholder:text-ink3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span
          className={cn(
            "hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold sm:inline-flex",
            isAuthenticated ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
          )}
          title={isAuthenticated ? "Connected to your data" : "Showing sample data"}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {isAuthenticated ? "Live" : "Demo"}
        </span>

        <button
          onClick={toggle}
          aria-label="Toggle theme"
          className="flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-line bg-panel2 text-ink2 transition-[transform,border-color,color] duration-150 ease-out hover:border-brand-500 hover:text-brand-500 active:scale-90"
        >
          {theme === "dark" ? (
            <Sun className="h-[18px] w-[18px]" />
          ) : (
            <Moon className="h-[18px] w-[18px]" />
          )}
        </button>

        <button
          aria-label="Notifications"
          className="relative flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-line bg-panel2 text-ink2 hover:border-brand-500 hover:text-brand-500"
        >
          <span className="absolute right-2.5 top-2 h-[7px] w-[7px] rounded-full border-2 border-panel bg-danger" />
          <Bell className="h-[18px] w-[18px]" />
        </button>

        {isAuthenticated ? (
          <button
            onClick={logout}
            aria-label="Log out"
            title="Log out"
            className="flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-line bg-panel2 text-ink2 transition-[transform,border-color,color] duration-150 ease-out hover:border-danger hover:text-danger active:scale-90"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        ) : (
          <Link
            to="/login"
            aria-label="Sign in"
            title="Sign in"
            className="flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-line bg-panel2 text-ink2 transition-[transform,border-color,color] duration-150 ease-out hover:border-brand-500 hover:text-brand-500 active:scale-90"
          >
            <LogIn className="h-[18px] w-[18px]" />
          </Link>
        )}

        <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-brand-500/[0.15] text-[12.5px] font-bold text-brand-500">
          AM
        </div>
      </div>
    </header>
  );
}
