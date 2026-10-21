"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Book, Menu, MessageSquare, Plus, Sparkles } from "lucide-react";
import { LanguageSelector } from "@/components/language-selector";
import { ThemeToggle } from "@/components/theme-toggle";
import Breadcrumb from "@/components/ui/breadcrumb";
import { useI18n } from "@/lib/i18n";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { copy } = useI18n();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isChatWorkspace = pathname.startsWith("/dashboard/chat");

  const navigation = [
    { name: copy.layout.chat, href: "/dashboard/chat", icon: MessageSquare },
    {
      name: copy.layout.knowledgeBase,
      href: "/dashboard/knowledge",
      icon: Book,
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <button
        onClick={() => setIsMobileMenuOpen(true)}
        className="fixed left-4 top-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-full bg-card text-foreground shadow-lg ring-1 ring-border transition hover:scale-105 lg:hidden"
        aria-label={copy.layout.openNavigation}
      >
        <Menu className="h-5 w-5" />
      </button>

      {isMobileMenuOpen && (
        <button
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px] lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label={copy.layout.closeNavigation}
        />
      )}

      <aside
        className={`chatgpt-sidebar fixed inset-y-0 left-0 z-40 w-[272px] transform border-r border-border transition-transform duration-300 ease-out lg:translate-x-0 ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col px-3 py-3">
          <Link
            href="/"
            className="mb-3 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition hover:bg-card"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-card shadow-sm ring-1 ring-border">
              <img src="/logo.svg" alt="ALTBot" className="h-7 w-7 rounded-lg" />
            </span>
            <span>ALTBot</span>
          </Link>

          <Link
            href="/dashboard/chat/new"
            onClick={() => setIsMobileMenuOpen(false)}
            className="chatgpt-card-hover mb-4 flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 text-sm font-medium shadow-sm"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Plus className="h-4 w-4" />
            </span>
            {copy.layout.newChat}
          </Link>

          <nav className="flex-1 space-y-1">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`group flex items-center rounded-xl px-3 py-2.5 text-sm transition duration-200 ${
                    isActive
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:bg-card/75 hover:text-foreground"
                  }`}
                >
                  <item.icon
                    className={`mr-3 h-4 w-4 transition-transform duration-200 ${
                      isActive
                        ? "text-[#10a37f]"
                        : "group-hover:translate-x-0.5"
                    }`}
                  />
                  <span className="font-medium">{item.name}</span>
                  {isActive && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#10a37f]" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <LanguageSelector />
              <ThemeToggle compact />
            </div>
            <div className="rounded-2xl border border-border bg-card/70 p-3 text-xs leading-5 text-muted-foreground">
              <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-[#10a37f]" />
                {copy.layout.localWorkspace}
              </div>
              {copy.layout.localWorkspaceDescription}
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[272px]">
        <main
          className={`min-h-screen ${
            isChatWorkspace
              ? "bg-background px-3 py-3"
              : "chatgpt-surface px-4 py-6 sm:px-6 lg:px-8"
          }`}
        >
          {!isChatWorkspace && <Breadcrumb />}
          {children}
        </main>
      </div>
    </div>
  );
}

export const dashboardConfig = {
  mainNav: [],
  sidebarNav: [
    {
      title: "Knowledge Base",
      href: "/dashboard/knowledge",
      icon: "database",
    },
    {
      title: "Chat",
      href: "/dashboard/chat",
      icon: "messageSquare",
    },
  ],
};
