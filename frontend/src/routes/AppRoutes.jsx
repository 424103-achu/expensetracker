import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import DashboardPage from "../pages/app/DashboardPage";
import ExpensesPage from "../pages/app/ExpensesPage";
import TransactionsPage from "../pages/app/TransactionsPage";
import BudgetsPage from "../pages/app/BudgetsPage";
import SharedExpensesPage from "../pages/app/SharedExpensesPage";
import SettlementPage from "../pages/app/SettlementPage";
import { useAuth } from "../hooks/useAuth";

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/expenses" element={<ProtectedRoute><ExpensesPage /></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
      <Route path="/budgets" element={<ProtectedRoute><BudgetsPage /></ProtectedRoute>} />
      <Route path="/shared" element={<ProtectedRoute><SharedExpensesPage /></ProtectedRoute>} />
      <Route path="/settlements" element={<ProtectedRoute><SettlementPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}

export default AppRoutes;
