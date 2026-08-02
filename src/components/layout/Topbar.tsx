import { Search, Menu, Sun, Moon, LogIn, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { NotificationsBell } from "./NotificationsBell";
import { cn } from "@/lib/cn";

export function Topbar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { theme, toggle } = useTheme();
  const { isAuthenticated, logout, user, profile } = useAuth();

  // Real initials from the signed-in user — not a hardcoded placeholder.
  const name = profile?.full_name?.trim();
  const initials = (name
    ? name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("")
    : (user?.email ?? "D").slice(0, 2)
  ).toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center gap-4 border-b border-line bg-panel px-4 md:px-[26px]">
      <button
        onClick={onMenu}
        aria-label="Open menu"
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-line text-ink2 transition-[transform,border-color,color] duration-150 ease-out hover:border-brand-500 active:scale-90 md:hidden md:h-[38px] md:w-[38px]"
      >
        <Menu className="h-5 w-5" />
      </button>

      <button
        onClick={onSearch}
        aria-label="Search or jump to a page — Command K"
        className="group flex h-11 min-w-0 max-w-[440px] flex-1 items-center gap-2 rounded-lg border border-line bg-panel2 pl-3 pr-2 text-left text-ink3 transition-colors hover:border-brand-500/60 hover:text-ink2 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20 md:h-[38px]"
      >
        <Search className="h-[18px] w-[18px] flex-none" />
        <span className="flex-1 truncate text-[13.5px]">Search or jump to…</span>
        <kbd className="hidden flex-none items-center rounded border border-line bg-panel px-1.5 py-0.5 text-[10.5px] font-semibold text-ink3 sm:flex">⌘K</kbd>
      </button>

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
          className="hidden h-11 w-11 items-center justify-center rounded-lg border border-line bg-panel2 text-ink2 transition-[transform,border-color,color] duration-150 ease-out hover:border-brand-500 hover:text-brand-500 active:scale-90 sm:flex md:h-[38px] md:w-[38px]"
        >
          {theme === "dark" ? (
            <Sun className="h-[18px] w-[18px]" />
          ) : (
            <Moon className="h-[18px] w-[18px]" />
          )}
        </button>

        <NotificationsBell />

        {isAuthenticated ? (
          <button
            onClick={logout}
            aria-label="Log out"
            title="Log out"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-panel2 text-ink2 transition-[transform,border-color,color] duration-150 ease-out hover:border-danger hover:text-danger active:scale-90 md:h-[38px] md:w-[38px]"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        ) : (
          <Link
            to="/login"
            aria-label="Sign in"
            title="Sign in"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-panel2 text-ink2 transition-[transform,border-color,color] duration-150 ease-out hover:border-brand-500 hover:text-brand-500 active:scale-90 md:h-[38px] md:w-[38px]"
          >
            <LogIn className="h-[18px] w-[18px]" />
          </Link>
        )}

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/[0.15] text-[12.5px] font-bold text-brand-500 md:h-[38px] md:w-[38px]" title={name || user?.email || undefined}>
          {initials}
        </div>
      </div>
    </header>
  );
}
