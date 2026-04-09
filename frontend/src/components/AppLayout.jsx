import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/expenses", label: "Expenses" },
  { to: "/transactions", label: "Transactions" },
  { to: "/budgets", label: "Budgets" },
  { to: "/shared", label: "Shared" },
  { to: "/settlements", label: "Settlements" }
];

function AppLayout({ title, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="page-shell">
      <header className="w-full px-6 py-4 border-b border-white/10 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">Expense Forge</h1>
            <p className="text-sm text-zinc-400">{title}</p>
          </div>
          <nav className="flex flex-wrap gap-2">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm ${isActive ? "bg-red-500 text-white" : "bg-zinc-800 text-zinc-300"}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-300">
              {user?.username} ({user?.currency_preference})
            </span>
            <button className="btn btn-secondary" onClick={onLogout}>Logout</button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6">{children}</main>
    </div>
  );
}

export default AppLayout;
