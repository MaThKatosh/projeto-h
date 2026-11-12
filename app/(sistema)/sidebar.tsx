"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type NavItem = {
  label: string;
  icon: string;
  href?: string;
  soon?: string;
  group?: string;
};

export function Sidebar({
  items,
  userName,
  roleLabel,
  logout,
}: {
  items: NavItem[];
  userName: string;
  roleLabel: string;
  logout: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const operation = items.filter((i) => !i.group);
  const admin = items.filter((i) => i.group);

  return (
    <aside className="bg-zinc-900 text-zinc-100 md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:overflow-y-auto">
      {/* Topo (celular: com botão de menu) */}
      <div className="flex items-center justify-between px-4 py-3 md:py-5">
        <Link href="/mapa" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-lg font-black">H</span>
          <span className="font-bold">Sistema do Hotel</span>
        </Link>
        <button
          type="button"
          className="rounded-lg px-3 py-2 text-xl md:hidden"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      <div className={`${open ? "block" : "hidden"} px-3 pb-4 md:block`}>
        <nav className="space-y-0.5">
          {operation.map((item) => (
            <NavLink key={item.label} item={item} active={isActive(item.href, pathname)} onNavigate={() => setOpen(false)} />
          ))}
        </nav>

        {admin.length > 0 && (
          <>
            <p className="mt-5 mb-1 px-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase">Administração</p>
            <nav className="space-y-0.5">
              {admin.map((item) => (
                <NavLink key={item.label} item={item} active={isActive(item.href, pathname)} onNavigate={() => setOpen(false)} />
              ))}
            </nav>
          </>
        )}

        <div className="mt-6 border-t border-zinc-800 pt-4">
          <Link
            href="/perfil"
            onClick={() => setOpen(false)}
            className={`block rounded-lg px-3 py-2 hover:bg-zinc-800 ${pathname === "/perfil" ? "bg-zinc-800" : ""}`}
          >
            <span className="block truncate text-sm font-semibold">{userName}</span>
            <span className="block text-xs text-zinc-400">{roleLabel} · meu perfil</span>
          </Link>
          <form action={logout}>
            <button type="submit" className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white">
              ⏻ Sair
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

function isActive(href: string | undefined, pathname: string) {
  return !!href && (pathname === href || pathname.startsWith(href + "/"));
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: () => void }) {
  if (!item.href) {
    return (
      <div className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-500" title={`Chega na ${item.soon}`}>
        <span className="w-5 text-center opacity-60">{item.icon}</span>
        <span className="flex-1">{item.label}</span>
        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">{item.soon}</span>
      </div>
    );
  }
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
        active ? "bg-blue-600 text-white" : "text-zinc-200 hover:bg-zinc-800"
      }`}
    >
      <span className="w-5 text-center">{item.icon}</span>
      {item.label}
    </Link>
  );
}
