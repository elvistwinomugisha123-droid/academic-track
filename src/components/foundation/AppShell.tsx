import Link from "next/link";
import { Activity, BookOpen, CalendarDays, CircleHelp, ClipboardCheck, Settings2, ShieldCheck } from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";

const navigation = [
  { href: "/workspace", label: "Teacher Home", icon: BookOpen },
  { href: "/workspace/academic-operations", label: "Academic operations", icon: CalendarDays },
  { href: "/workspace/classroom", label: "Classroom", icon: ClipboardCheck },
  { href: "/workspace/leadership/hod", label: "Department Pulse", icon: Activity, role: "HOD" },
  { href: "/workspace/leadership/dos", label: "Academic Operations", icon: Activity, role: "DOS" },
  { href: "/workspace/leadership/principal", label: "Academic Assurance", icon: ShieldCheck, role: "PRINCIPAL" },
  { href: "/design-system", label: "Design system", icon: Settings2 },
];

type ShellAccess = { displayName: string; roles: string[]; schoolId: string } | null;

export function AppShell({ children, activePath, access }: { children: React.ReactNode; activePath?: string; access?: ShellAccess }) {
  const canViewClassroom = Boolean(access?.roles.some((role) => ["TEACHER", "HOD", "DOS", "PRINCIPAL"].includes(role)));
  const visibleNavigation = navigation.filter((item) => item.href === "/workspace" || item.href === "/design-system" || (item.href === "/workspace/classroom" ? canViewClassroom : item.role ? Boolean(access?.roles.includes(item.role)) : access));
  return <div className="ate-shell"><a className="skip-link" href="#main-content">Skip to content</a><header className="mobile-header"><Link className="brand" href="/workspace" aria-label="ATE workspace home"><span className="brand-mark">A</span><span><strong>ATE</strong><small>Academic Track Engine</small></span></Link>{access ? <SignOutButton /> : null}</header><aside className="sidebar" aria-label="Primary navigation"><Link className="brand" href="/workspace" aria-label="ATE workspace home"><span className="brand-mark">A</span><span><strong>ATE</strong><small>Academic Track Engine</small></span></Link><div className="sidebar-kicker">Academic workspace</div><nav className="nav-list">{visibleNavigation.map(({ href, label, icon: Icon }) => <Link className={`nav-link${activePath === href ? " active" : ""}`} href={href} key={href}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></Link>)}</nav><div className="sidebar-footer"><CircleHelp size={16} /><span>{access?.roles.join(" · ") || "Welcome"}</span>{access ? <SignOutButton /> : null}</div></aside><div className="shell-main"><header className="topbar"><div><span className="topbar-label">Academic workspace</span><strong>{access?.displayName || "Welcome to ATE"}</strong></div><div className="topbar-actions"><span className="environment-badge">{access ? "Connected" : "Welcome"}</span>{access ? <SignOutButton /> : null}</div></header><main id="main-content" className="content">{children}</main></div></div>;
}
