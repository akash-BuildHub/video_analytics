import { useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { TopNavbar } from "./TopNavbar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen w-full bg-background flex flex-col overflow-hidden">
      <TopNavbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex flex-1 min-w-0 overflow-hidden">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-foreground/20 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Mobile sidebar */}
        <div
          className={`fixed inset-y-0 left-0 z-50 md:hidden transform transition-transform duration-200 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <AppSidebar />
        </div>

        {/* Desktop sidebar */}
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <main className="flex-1 p-4 md:p-6 overflow-y-auto no-scrollbar">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
