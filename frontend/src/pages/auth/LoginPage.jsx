import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    try {
      await login(identifier, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="page-shell grid place-items-center p-6">
      <form onSubmit={submit} className="panel w-full max-w-md p-6 space-y-4">
        <h1 className="text-3xl font-bold">Welcome Back</h1>
        <p className="text-zinc-400">Track personal and shared expenses with live settlement insight.</p>
        <input className="input" placeholder="Email or Username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        <input className="input" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error ? <p className="text-red-400 text-sm">{error}</p> : null}
        <button className="btn w-full" disabled={loading}>{loading ? "Signing in..." : "Login"}</button>
        <p className="text-sm text-zinc-400">
          Need an account? <Link className="text-red-300" to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
}

export default LoginPage;
