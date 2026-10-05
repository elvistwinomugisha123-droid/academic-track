import Link from "next/link";
import { Activity, Bell, BookOpen, CalendarDays, CircleHelp, ClipboardCheck, Home, MoreHorizontal, MessageCircle, ShieldCheck, Users } from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";

const navigation = [
  { href: "/workspace", label: "Home", icon: Home },
  { href: "/workspace/teacher/sections", label: "Classes", icon: Users, role: "TEACHER" },
  { href: "/workspace/teacher/ask", label: "Ask ATE", icon: MessageCircle, role: "TEACHER" },
  { href: "/workspace/classroom", label: "Classroom", icon: ClipboardCheck, roles: ["TEACHER", "HOD", "DOS", "PRINCIPAL"] },
  { href: "/workspace/teacher/assessments", label: "Assessments", icon: BookOpen, role: "TEACHER" },
  { href: "/workspace/notifications", label: "Notifications", icon: Bell, role: "TEACHER" },
  { href: "/workspace/academic-operations", label: "School setup", icon: CalendarDays, role: "SCHOOL_ADMIN" },
  { href: "/workspace/leadership/hod", label: "Department", icon: Activity, role: "HOD" },
  { href: "/workspace/leadership/dos", label: "Academic operations", icon: Activity, role: "DOS" },
  { href: "/workspace/leadership/principal", label: "School overview", icon: ShieldCheck, role: "PRINCIPAL" },
];

type ShellAccess = { displayName: string; roles: string[]; schoolId: string } | null;

export function AppShell({ children, activePath, access, contextLessonId }: { children: React.ReactNode; activePath?: string; access?: ShellAccess; contextLessonId?: string }) {
  const visibleNavigation = navigation.filter((item) => !item.role && !item.roles || item.role && access?.roles.includes(item.role) || item.roles?.some((role) => access?.roles.includes(role)));
  const link = ({ href, label, icon: Icon }: (typeof navigation)[number], className: string) => <Link className={`${className}${activePath === href ? " active" : ""}`} href={href === "/workspace/teacher/ask" && contextLessonId ? `${href}?lessonId=${contextLessonId}` : href} key={href} aria-current={activePath === href ? "page" : undefined}><Icon size={20} strokeWidth={1.8} /><span>{label}</span></Link>;
  const bottomItems = navigation.filter(({ href }) => ["/workspace", "/workspace/teacher/sections", "/workspace/teacher/ask", "/workspace/classroom"].includes(href)).filter((item) => visibleNavigation.includes(item));
  const moreItems = visibleNavigation.filter((item) => !bottomItems.includes(item));
  return <div className="ate-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="mobile-header"><Link className="brand" href="/workspace" aria-label="ATE workspace home"><span className="brand-mark">A</span><span><strong>ATE</strong><small>Academic Track Engine</small></span></Link><span className="mobile-avatar" aria-label={access?.displayName || "Account"}>{access?.displayName?.charAt(0).toUpperCase() || "A"}</span></header>
    <aside className="sidebar" aria-label="Primary navigation"><Link className="brand" href="/workspace" aria-label="ATE workspace home"><span className="brand-mark">A</span><span><strong>ATE</strong><small>Academic Track Engine</small></span></Link><div className="sidebar-kicker">Academic workspace</div><nav className="nav-list">{visibleNavigation.map((item) => link(item, "nav-link"))}</nav><div className="sidebar-footer"><CircleHelp size={16} /><span>{access?.roles.join(" · ") || "Welcome"}</span>{access ? <SignOutButton /> : null}</div></aside>
    <div className="shell-main"><header className="topbar"><div><span className="topbar-label">Academic workspace</span><strong>{access?.displayName || "Welcome to ATE"}</strong></div><span className="environment-badge">{access ? "Connected" : "Welcome"}</span></header><main id="main-content" className="content">{children}</main></div>
    <nav className="mobile-bottom-nav" aria-label="Main navigation" style={{ gridTemplateColumns: `repeat(${bottomItems.length + 1},minmax(0,1fr))` }}>{bottomItems.map((item) => link(item, `bottom-nav-link${item.href === "/workspace/teacher/ask" ? " bottom-nav-ask" : ""}`))}<details className="bottom-more"><summary className={`bottom-nav-link${moreItems.some((item) => item.href === activePath) ? " active" : ""}`} aria-label="More navigation"><MoreHorizontal size={21} /><span>More</span></summary><div className="bottom-more-panel"><strong>{access?.displayName || "Your account"}</strong>{moreItems.map((item) => link(item, "nav-link"))}{access && <div className="more-signout"><SignOutButton /></div>}</div></details></nav>
  </div>;
}
