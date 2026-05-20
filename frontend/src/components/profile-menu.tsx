"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, Settings, User } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";

export default function ProfileMenu() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary border border-primary/30 hover:bg-primary/30 hover:border-primary/50 transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        LP
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50"
        >
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                LP
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold text-slate-900">
                  {t("profile.menu.demo")}
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-600">
                  {t("profile.demoBadge")}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            <User className="w-4 h-4 text-slate-500" />
            {t("profile.menu.demo")}
          </button>
          <button
            type="button"
            className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            {t("profile.menu.settings")}
          </button>
          <div className="border-t border-slate-100">
            <button
              type="button"
              className="w-full px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2"
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              <LogOut className="w-4 h-4" />
              {t("profile.menu.signOut")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
