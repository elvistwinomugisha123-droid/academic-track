import Link from "next/link";
import { BookOpen, CircleHelp, Settings2 } from "lucide-react";

const navigation = [
  { href: "/", label: "Workspace", icon: BookOpen },
  { href: "/design-system", label: "Design system", icon: Settings2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return <div className="ate-shell"><a className="skip-link" href="#main-content">Skip to content</a><header className="mobile-header"><Link className="brand" href="/" aria-label="ATE workspace home"><span className="brand-mark">A</span><span><strong>ATE</strong><small>Academic Track Engine</small></span></Link></header><aside className="sidebar" aria-label="Primary navigation"><Link className="brand" href="/" aria-label="ATE workspace home"><span className="brand-mark">A</span><span><strong>ATE</strong><small>Academic Track Engine</small></span></Link><div className="sidebar-kicker">Application foundation</div><nav className="nav-list">{navigation.map(({ href, label, icon: Icon }) => <Link className="nav-link" href={href} key={href}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></Link>)}</nav><div className="sidebar-footer"><CircleHelp size={16} /><span>Foundation build</span></div></aside><div className="shell-main"><header className="topbar"><div><span className="topbar-label">Academic workspace</span><strong>Production foundation</strong></div><span className="environment-badge">Development</span></header><main id="main-content" className="content">{children}</main></div></div>;
}
