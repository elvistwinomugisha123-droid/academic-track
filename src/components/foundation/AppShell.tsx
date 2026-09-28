import Link from "next/link";
import { Activity, BookOpen, CalendarDays, CircleHelp, ClipboardCheck, Menu, ShieldCheck } from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";

const navigation = [
  { href: "/workspace", label: "Home", icon: BookOpen },
  { href: "/workspace/teacher/sections", label: "Teaching sections", icon: BookOpen },
  { href: "/workspace/classroom", label: "Classroom", icon: ClipboardCheck },
  { href: "/workspace/academic-operations", label: "School setup", icon: CalendarDays, role: "SCHOOL_ADMIN" },
  { href: "/workspace/leadership/hod", label: "Department Pulse", icon: Activity, role: "HOD" },
  { href: "/workspace/leadership/dos", label: "Academic Operations", icon: Activity, role: "DOS" },
  { href: "/workspace/leadership/principal", label: "Academic Assurance", icon: ShieldCheck, role: "PRINCIPAL" },
];

type ShellAccess = { displayName: string; roles: string[]; schoolId: string } | null;

export function AppShell({ children, activePath, access }: { children: React.ReactNode; activePath?: string; access?: ShellAccess }) {
  const canViewClassroom = Boolean(access?.roles.some((role) => ["TEACHER", "HOD", "DOS", "PRINCIPAL"].includes(role)));
  const visibleNavigation = navigation.filter((item) => item.href === "/workspace" || (item.href === "/workspace/teacher/sections" ? Boolean(access?.roles.includes("TEACHER")) : item.href === "/workspace/classroom" ? canViewClassroom : item.role ? Boolean(access?.roles.includes(item.role)) : Boolean(access)));
  const links = visibleNavigation.map(({ href, label, icon: Icon }) => <Link className={`nav-link${activePath === href ? " active" : ""}`} href={href} key={href} aria-current={activePath === href ? "page" : undefined}><Icon size={18} strokeWidth={1.8} /><span>{label}</span></Link>);
  return <div className="ate-shell"><a className="skip-link" href="#main-content">Skip to content</a><header className="mobile-header"><Link className="brand" href="/workspace" aria-label="ATE workspace home"><span className="brand-mark">A</span><span><strong>ATE</strong><small>Academic Track Engine</small></span></Link><details className="mobile-menu"><summary aria-label="Open navigation"><Menu size={22} /><span>Menu</span></summary><div className="mobile-menu-panel"><span className="mobile-menu-name">{access?.displayName || "Welcome"}</span><nav aria-label="Mobile navigation">{links}</nav>{access && <div className="mobile-menu-signout"><SignOutButton /></div>}</div></details></header><aside className="sidebar" aria-label="Primary navigation"><Link className="brand" href="/workspace" aria-label="ATE workspace home"><span className="brand-mark">A</span><span><strong>ATE</strong><small>Academic Track Engine</small></span></Link><div className="sidebar-kicker">Academic workspace</div><nav className="nav-list">{links}</nav><div className="sidebar-footer"><CircleHelp size={16} /><span>{access?.roles.join(" · ") || "Welcome"}</span>{access ? <SignOutButton /> : null}</div></aside><div className="shell-main"><header className="topbar"><div><span className="topbar-label">Academic workspace</span><strong>{access?.displayName || "Welcome to ATE"}</strong></div><span className="environment-badge">{access ? "Connected" : "Welcome"}</span></header><main id="main-content" className="content">{children}</main></div></div>;
}
