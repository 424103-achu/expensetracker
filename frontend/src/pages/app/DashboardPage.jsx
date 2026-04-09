import { useEffect, useMemo, useState } from "react";
import { Bar, Line, Pie } from "react-chartjs-2";
import "chart.js/auto";
import AppLayout from "../../components/AppLayout";
import api from "../../api/api";

const pieColors = ["#ff5b5b", "#ff8a3d", "#facc15", "#4ade80", "#22d3ee", "#60a5fa", "#a78bfa", "#f472b6"];

const amountFmt = (value) => Number(value || 0).toFixed(2);

function buildLastSixMonthKeys(anchorMonth) {
  const [year, month] = anchorMonth.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const keys = [];

  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(start.getFullYear(), start.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  return keys;
}

function buildMonthDays(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return `${monthKey}-${String(day).padStart(2, "0")}`;
  });
}

function DashboardPage() {
  const [data, setData] = useState(null);
  const month = useMemo(() => new Date().toISOString().slice(0, 7), []);

  useEffect(() => {
    api.get(`/dashboard/summary?month=${month}`).then((res) => setData(res.data));
  }, [month]);

  if (!data) {
    return <AppLayout title="Dashboard">Loading...</AppLayout>;
  }

  const pieTotal = data.pie.reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const pieData = {
    labels: data.pie.map((x) => x.category),
    datasets: [
      {
        data: data.pie.map((x) => Number(x.amount || 0)),
        backgroundColor: pieColors,
        borderColor: "#111217",
        borderWidth: 2
      }
    ]
  };

  const pieOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "bottom",
        labels: { color: "#e4e4e7", boxWidth: 12 }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const value = Number(ctx.raw || 0);
            const pct = pieTotal > 0 ? ((value / pieTotal) * 100).toFixed(1) : "0.0";
            return `${ctx.label}: ${amountFmt(value)} (${pct}%)`;
          }
        }
      }
    }
  };

  const monthKeys = buildLastSixMonthKeys(month);
  const monthTotalsMap = new Map(data.monthlyBar.map((x) => [x.month, Number(x.total || 0)]));
  const barLabels = monthKeys;
  const barValues = monthKeys.map((key) => monthTotalsMap.get(key) || 0);
  const barData = {
    labels: barLabels,
    datasets: [
      {
        label: "Amount",
        data: barValues,
        backgroundColor: "rgba(255,91,91,0.85)",
        borderRadius: 6,
        maxBarThickness: 42
      }
    ]
  };

  const lineDays = buildMonthDays(month);
  const dailyMap = new Map(data.dailyLine.map((x) => [x.date, Number(x.total || 0)]));
  const lineLabels = lineDays.map((d) => d.slice(-2));
  const lineValues = lineDays.map((d) => dailyMap.get(d) || 0);
  const lineData = {
    labels: lineLabels,
    datasets: [
      {
        label: "Daily",
        data: lineValues,
        borderColor: "#22d3ee",
        backgroundColor: "rgba(34,211,238,0.2)",
        fill: true,
        tension: 0.25,
        pointRadius: 2.5,
        pointHoverRadius: 4
      }
    ]
  };

  const axisOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#e4e4e7" } },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${amountFmt(ctx.parsed.y ?? ctx.parsed)}`
        }
      }
    },
    scales: {
      x: {
        ticks: { color: "#a1a1aa", maxRotation: 0, minRotation: 0 },
        grid: { color: "rgba(255,255,255,0.05)" }
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: "#a1a1aa",
          callback: (v) => amountFmt(v)
        },
        grid: { color: "rgba(255,255,255,0.06)" }
      }
    }
  };

  return (
    <AppLayout title="Overview and insights">
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="panel p-4"><p className="text-zinc-400 text-sm">Current Month</p><h3 className="text-2xl">{data.currentMonthTotal.toFixed(2)}</h3></div>
        <div className="panel p-4"><p className="text-zinc-400 text-sm">This Year</p><h3 className="text-2xl">{data.yearTotal.toFixed(2)}</h3></div>
        <div className="panel p-4"><p className="text-zinc-400 text-sm">Transactions</p><h3 className="text-2xl">{data.totalTransactions}</h3></div>
        <div className="panel p-4"><p className="text-zinc-400 text-sm">Top Category</p><h3 className="text-2xl">{data.highestCategory}</h3></div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <section className="panel p-4">
          <h3 className="mb-3">Category Split</h3>
          <div className="h-[320px]">
            {pieTotal > 0 ? <Pie data={pieData} options={pieOptions} /> : <p className="text-zinc-400 text-sm">No spending data for this month.</p>}
          </div>
        </section>
        <section className="panel p-4 lg:col-span-2">
          <h3 className="mb-3">Last 6 Months Spending</h3>
          <div className="h-[320px]">
            <Bar data={barData} options={axisOptions} />
          </div>
        </section>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="panel p-4">
          <h3 className="mb-3">Daily Spend This Month</h3>
          <div className="h-[320px]">
            <Line data={lineData} options={axisOptions} />
          </div>
        </section>
        <section className="panel p-4">
          <div className="flex items-center justify-between mb-3">
            <h3>Recent Transactions</h3>
            <a href="/transactions" className="text-sm text-red-300">View all</a>
          </div>
          <div className="space-y-2">
            {data.recentTransactions.map((t, idx) => (
              <div key={`${t.date}-${idx}`} className="flex justify-between text-sm border-b border-white/10 pb-2">
                <div>
                  <div>
                    {t.title} {t.is_shared ? <span className="badge">Shared</span> : null} {t.transaction_type === "repayment" ? <span className="badge">Repayment</span> : null}
                  </div>
                  <div className="text-zinc-400">{t.date} • {t.category}</div>
                </div>
                <div>{Number(t.amount).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

export default DashboardPage;
