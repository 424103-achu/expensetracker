import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/api";
import { useAuth } from "../../hooks/useAuth";

const fallbackCurrencies = ["INR", "USD", "EUR", "GBP", "JPY", "AUD", "CAD"];

function RegisterPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
    currencyPreference: "INR"
  });
  const [currencies, setCurrencies] = useState(fallbackCurrencies);
  const [error, setError] = useState("");
  const { register, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/users/currencies")
      .then((res) => setCurrencies(res.data))
      .catch(() => setCurrencies(fallbackCurrencies));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await register(form);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    }
  };

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="page-shell grid place-items-center p-6">
      <form onSubmit={submit} className="panel w-full max-w-md p-6 space-y-4">
        <h1 className="text-3xl font-bold">Create Account</h1>
        <input className="input" placeholder="Name" value={form.name} onChange={(e) => setField("name", e.target.value)} required />
        <input className="input" placeholder="Email" value={form.email} onChange={(e) => setField("email", e.target.value)} required />
        <input className="input" placeholder="Username" value={form.username} onChange={(e) => setField("username", e.target.value)} required />
        <input className="input" placeholder="Password" type="password" value={form.password} onChange={(e) => setField("password", e.target.value)} required />
        <div>
          <label className="text-sm text-zinc-300">Set Currency</label>
          <select className="select mt-1" value={form.currencyPreference} onChange={(e) => setField("currencyPreference", e.target.value)}>
            {currencies.map((currency) => (
              <option key={currency} value={currency}>{currency}</option>
            ))}
          </select>
        </div>
        {error ? <p className="text-red-400 text-sm">{error}</p> : null}
        <button className="btn w-full" disabled={loading}>{loading ? "Creating..." : "Register"}</button>
        <p className="text-sm text-zinc-400">
          Already have an account? <Link className="text-red-300" to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}

export default RegisterPage;
