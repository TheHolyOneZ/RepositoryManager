import React, { useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Legend,
} from "recharts";
import { LayoutDashboard, BarChart3, Star, GitFork, Globe, Lock, Activity, Tag } from "lucide-react";
import { useRepoStore } from "../../stores/repoStore";

const CHART_COLORS = ["#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#3B82F6", "#F97316"];
const tooltipStyle = {
  contentStyle: {
    background: "rgba(8,10,20,0.97)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12, fontSize: 12, color: "#D4D8E8",
    boxShadow: "0 8px 32px rgba(0,0,0,0.50)",
  },
  labelStyle: { color: "#D4D8E8", fontWeight: 700, marginBottom: 4 },
  itemStyle: { color: "#A78BFA" },
  cursor: { fill: "rgba(255,255,255,0.04)" },
};

interface StatCardProps { label: string; value: string | number; sub?: string; color?: string; icon?: React.ReactNode }
const StatCard: React.FC<StatCardProps> = ({ label, value, sub, color = "#D4D8E8", icon }) => (
  <div style={{
    padding: "16px 18px", borderRadius: 12,
    background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}>
      {icon && <span style={{ color, opacity: 0.7 }}>{icon}</span>}
      <p style={{
        fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.12em",
        textTransform: "uppercase", color: "#2D3650",
      }}>{label}</p>
    </div>
    <p style={{
      fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.04em",
      fontVariantNumeric: "tabular-nums", lineHeight: 1, color,
    }}>{value}</p>
    {sub && <p style={{ fontSize: "0.6875rem", color: "#3A4560", marginTop: 4 }}>{sub}</p>}
  </div>
);

const ChartCard: React.FC<{ kicker: string; title: string; children: React.ReactNode }> = ({ kicker, title, children }) => (
  <div style={{
    padding: "20px", borderRadius: 14,
    background: "rgba(255,255,255,0.022)", border: "1px solid rgba(255,255,255,0.07)",
  }}>
    <p style={{ fontSize: "0.5625rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#3A4560", marginBottom: 2 }}>
      {kicker}
    </p>
    <p style={{ fontSize: "1rem", fontWeight: 800, color: "#D4D8E8", letterSpacing: "-0.03em", marginBottom: 20 }}>
      {title}
    </p>
    {children}
  </div>
);

export const AnalyticsPage: React.FC = () => {
  const repos = useRepoStore((s) => s.repos);

  const total = repos.length;
  const publicCount = repos.filter((r) => !r.private).length;
  const privateCount = repos.filter((r) => r.private).length;
  const activeCount = repos.filter((r) => r.health?.status === "active").length;
  const dormantCount = repos.filter((r) => r.health?.status === "dormant").length;
  const deadCount = repos.filter((r) => r.health?.status === "dead").length;
  const emptyCount = repos.filter((r) => r.health?.status === "empty").length;
  const totalStars = repos.reduce((sum, r) => sum + r.stars, 0);
  const totalSizeKb = repos.reduce((sum, r) => sum + r.size_kb, 0);
  const sizeLabel = totalSizeKb >= 1048576
    ? `${(totalSizeKb / 1048576).toFixed(1)} GB`
    : totalSizeKb >= 1024
    ? `${(totalSizeKb / 1024).toFixed(0)} MB`
    : `${totalSizeKb} KB`;

  const langMap = new Map<string, number>();
  repos.forEach((r) => {
    if (r.language) langMap.set(r.language, (langMap.get(r.language) ?? 0) + 1);
  });
  const langData = Array.from(langMap.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, value]) => ({ name, value }));

  const healthData = useMemo(() => [
    { name: "Active", value: activeCount, fill: "#10B981" },
    { name: "Dormant", value: dormantCount, fill: "#F59E0B" },
    { name: "Dead", value: deadCount, fill: "#EF4444" },
    { name: "Empty", value: emptyCount, fill: "#6B7280" },
  ].filter((d) => d.value > 0), [activeCount, dormantCount, deadCount, emptyCount]);

  const topStarred = [...repos]
    .sort((a, b) => b.stars - a.stars).slice(0, 8)
    .map((r) => ({ name: r.name.slice(0, 22), stars: r.stars }));

  const forksCount = repos.filter((r) => r.fork).length;
  const originalsCount = total - forksCount;
  const archivedCount = repos.filter((r) => r.archived).length;
  const avgStars = total > 0 ? Math.round(totalStars / total) : 0;

  const topicMap = new Map<string, number>();
  repos.forEach((r) => r.topics.forEach((t) => topicMap.set(t, (topicMap.get(t) ?? 0) + 1)));
  const topTopics = Array.from(topicMap.entries())
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  if (total === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <div style={{
          padding: "20px 24px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.01)", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#A78BFA",
            }}>
              <LayoutDashboard size={15} />
            </div>
            <h1 style={{ fontSize: "1.0625rem", fontWeight: 800, color: "#D4D8E8", letterSpacing: "-0.03em" }}>Analytics</h1>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, margin: "0 auto 14px",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#2D3650",
            }}>
              <BarChart3 size={22} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#4A5580", marginBottom: 6 }}>No data yet</p>
            <p style={{ fontSize: "0.75rem", color: "#2D3650" }}>Open Repositories and run Refresh after signing in.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{
        padding: "20px 24px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.01)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#A78BFA",
          }}>
            <LayoutDashboard size={15} />
          </div>
          <div>
            <p style={{ fontSize: "0.5rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#3A4560" }}>Insights</p>
            <h1 style={{ fontSize: "1.0625rem", fontWeight: 800, color: "#D4D8E8", letterSpacing: "-0.03em", lineHeight: 1 }}>Analytics</h1>
          </div>
        </div>
        <p style={{ fontSize: "0.75rem", color: "#3A4560", marginTop: 6 }}>
          Derived from repos loaded in ZRepoManager — not a live GitHub billing view.
        </p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
          <StatCard label="Total repos"   value={total}                      icon={<Activity size={11} />} />
          <StatCard label="Public"        value={publicCount}  color="#22D3EE" icon={<Globe size={11} />} />
          <StatCard label="Private"       value={privateCount} color="#A78BFA" icon={<Lock size={11} />} />
          <StatCard label="Active"        value={activeCount}  color="#10B981" />
          <StatCard label="Total stars"   value={totalStars.toLocaleString()} color="#F59E0B" icon={<Star size={11} />} />
          <StatCard label="Disk (approx)" value={sizeLabel} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
          <StatCard label="Forks"     value={forksCount}      color="#F59E0B" icon={<GitFork size={11} />} />
          <StatCard label="Originals" value={originalsCount}  color="#10B981" />
          <StatCard label="Archived"  value={archivedCount}   color="#6B7280" />
          <StatCard label="Dead"      value={deadCount}       color="#EF4444" />
          <StatCard label="Avg stars" value={avgStars}        color="#F59E0B" icon={<Star size={11} />} />
          <StatCard label="Topics used" value={topicMap.size} color="#8B5CF6" icon={<Tag size={11} />} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <ChartCard kicker="Distribution" title="Primary languages">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={langData} cx="50%" cy="50%" innerRadius={60} outerRadius={92} paddingAngle={3} dataKey="value">
                  {langData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend iconType="circle" iconSize={8} formatter={(v) => (
                  <span style={{ fontSize: 11, color: "#8991A4" }}>{v}</span>
                )} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard kicker="Health" title="Lifecycle mix">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={healthData} cx="50%" cy="50%" innerRadius={60} outerRadius={92} paddingAngle={3} dataKey="value">
                  {healthData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend iconType="circle" iconSize={8} formatter={(v) => (
                  <span style={{ fontSize: 11, color: "#8991A4" }}>{v}</span>
                )} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {topStarred.length > 0 && (
          <ChartCard kicker="Attention" title="Most starred (top 8)">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topStarred} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fill: "#4A5166", fontSize: 11 }} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#8991A4", fontSize: 11 }} axisLine={false} width={110} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="stars" radius={[0, 6, 6, 0]}>
                  {topStarred.map((_, i) => <Cell key={i} fill={`hsl(${36 + i * 5}, 88%, ${56 - i * 2}%)`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {topTopics.length > 0 && (
          <ChartCard kicker="Taxonomy" title="Most-used topics">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topTopics} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fill: "#4A5166", fontSize: 11 }} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#8991A4", fontSize: 11 }} axisLine={false} width={100} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {topTopics.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        <ChartCard kicker="Summary" title="Health share of estate">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
            {[
              { label: "Active", value: activeCount, color: "#10B981" },
              { label: "Dormant", value: dormantCount, color: "#F59E0B" },
              { label: "Dead", value: deadCount, color: "#EF4444" },
              { label: "Empty", value: emptyCount, color: "#6B7280" },
            ].map(({ label, value, color }) => {
              const pct = total > 0 ? (value / total) * 100 : 0;
              return (
                <div key={label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: "0.6875rem", color: "#8991A4" }}>{label}</span>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", color }}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 3, background: color,
                      width: `${pct}%`, transition: "width 700ms ease",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>

      </div>
    </div>
  );
};
