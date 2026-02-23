import { Upload, BarChart3 } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";

const navItems = [
{ title: "Upload Video", url: "/upload", icon: Upload },
{ title: "Analytics", url: "/analytics", icon: BarChart3 }];


export function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="hidden md:flex flex-col w-60 h-full bg-card border-r border-border overflow-hidden">
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
        {navItems.map((item) => {
          const isActive = location.pathname === item.url;
          return (
            <NavLink
              key={item.title}
              to={item.url}
              end
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
              isActive ?
              "" :
              "text-muted-foreground hover:text-foreground hover:bg-secondary"}`
              }
              activeClassName="bg-secondary text-foreground">

              <item.icon className="w-4 h-4 shrink-0" />
              <span className="font-mono tracking-wide">{item.title}</span>
            </NavLink>);

        })}
      </nav>

      <div className="px-3 py-4 border-t border-border">
        <p className="text-xs text-muted-foreground px-3 font-mono tracking-wide">© 2026 OwlYtics</p>
      </div>
    </aside>);

}
