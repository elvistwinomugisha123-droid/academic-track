import Link from "next/link";
import { BookOpen, CalendarDays, CircleHelp, ClipboardCheck, Settings2 } from "lucide-react";

const navigation = [
  { href: "/", label: "Workspace", icon: BookOpen },
  { href: "/workspace/academic-operations", label: "Academic operations", icon: CalendarDays },
  { href: "/workspace/classroom", label: "Classroom", icon: ClipboardCheck },
  { href: "/design-system", label: "Design system", icon: Settings2 },
];

type ShellAccess = { displayName: string; roles: string[]; schoolId: string } | null;

export function AppShell({ children, activePath, access }: { children: React.ReactNode; activePath?: string; access?: ShellAccess }) {
  const canViewClassroom = Boolean(access?.roles.some((role) => ["TEACHER", "HOD", "DOS", "PRINCIPAL"].includes(role)));
  const visibleNavigation = navigation.filter((item) => item.href === "/" || item.href === "/design-system" || (item.href === "/workspace/classroom" ? canViewClassroom : access));
  return <div className="ate-shell"><a className="skip-link" href="#main-content">Skip to content</a><header className="mobile-header"><Link className="brand" href="/" aria-label="ATE workspace home"><span className="brand-mark">A</span><span><strong>ATE</strong><small>Academic Track Engine</small></span></Link></header><aside className="sidebar" aria-label="Primary navigation"><Link className="brand" href="/" aria-label="ATE workspace home"><span className="brand-mark">A</span><span><strong>ATE</strong><small>Academic Track Engine</small></span></Link><div className="sidebar-kicker">Academic workspace</div><nav className="nav-list">{visibleNavigation.map(({ href, label, icon: Icon }) => <Link className={`nav-link${activePath === href ? " active" : ""}`} href={href} key={href}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></Link>)}</nav><div className="sidebar-footer"><CircleHelp size={16} /><span>{access?.roles.join(" · ") || "Foundation build"}</span></div></aside><div className="shell-main"><header className="topbar"><div><span className="topbar-label">Academic workspace</span><strong>{access?.displayName || "Production foundation"}</strong></div><span className="environment-badge">{access ? "Connected" : "Development"}</span></header><main id="main-content" className="content">{children}</main></div></div>;
}
