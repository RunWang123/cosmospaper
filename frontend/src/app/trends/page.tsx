"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ArrowLeft, Play, Pause, RotateCcw } from "lucide-react";
import Link from "next/link";
import {
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, AreaChart, Area, RadarChart, Radar,
    PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    Legend, LineChart, Line,
} from "recharts";

const API_BASE = "";

const COLORS = [
    "#0062ff", "#fe0000", "#00ff5e", "#f59e0b", "#7600e4",
    "#01d9ff", "#ff2c96", "#ff6a00", "#00ffe1", "#6d30fc",
    "#474aff", "#ff3460", "#00aeff", "#99ff00", "#e228ff",
];

interface TrendData {
    keyword: string;
    data: { year: number; count: number }[];
}

interface CooccurrenceData {
    nodes: { id: string }[];
    edges: { source: string; target: string; weight: number }[];
}

// Bar chart race frame type
interface RaceFrame {
    year: number;
    items: { keyword: string; count: number; color: string }[];
}

export default function TrendsPage() {
    const [trends, setTrends] = useState<TrendData[]>([]);
    const [conferences, setConferences] = useState<Record<string, Record<string, number>>>({});
    const [cooccurrence, setCooccurrence] = useState<CooccurrenceData>({ nodes: [], edges: [] });
    const [availableKeywords, setAvailableKeywords] = useState<string[]>([]);
    const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"stream" | "heatmap" | "race" | "radar" | "network">("stream");
    const [activeConferences, setActiveConferences] = useState<string[]>([]);

    // Bar chart race state
    const [raceFrames, setRaceFrames] = useState<RaceFrame[]>([]);
    const [raceIndex, setRaceIndex] = useState(0);
    const [racePlaying, setRacePlaying] = useState(false);
    const raceTimer = useRef<NodeJS.Timeout | null>(null);

    const fetchData = useCallback(async (keywords?: string[]) => {
        setLoading(true);
        try {
            const kwParam = keywords && keywords.length > 0 ? `keywords=${keywords.join(",")}` : "top_n=50";
            // Pass keywords query to BERTopic endpoints so it can filter specific mid-tier topics
            const [trendsRes, confRes, coRes] = await Promise.all([
                fetch(`${API_BASE}/api/trends/topics/over-time?${kwParam}`),
                fetch(`${API_BASE}/api/trends/topics/by-conference?${kwParam}`),
                Promise.resolve({ json: () => ({ nodes: [], edges: [] }) }), // Network dropped
            ]);
            const trendsData = await trendsRes.json();
            const confData = await confRes.json();
            const coData = await coRes.json();

            setTrends(trendsData.trends || []);
            setAvailableKeywords(trendsData.available_keywords || []);
            setConferences(confData.conferences || {});
            setCooccurrence(coData);

            // By default, no conferences are active (user must click to include)
            setActiveConferences([]);

            // Build race frames
            if (trendsData.trends) {
                buildRaceFrames(trendsData.trends);
            }
        } catch (err) {
            console.error("Failed to fetch trends:", err);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const toggleKeyword = (kw: string) => {
        setSelectedKeywords(prev => {
            const next = prev.includes(kw) ? prev.filter(k => k !== kw) : [...prev, kw];
            fetchData(next.length > 0 ? next : undefined);
            return next;
        });
    };

    // Build race frames from trend data
    const buildRaceFrames = (trendData: TrendData[]) => {
        const allYears = new Set<number>();
        trendData.forEach(t => t.data.forEach(d => allYears.add(d.year)));
        const years = Array.from(allYears).sort();

        const frames: RaceFrame[] = years.map(year => {
            const items = trendData.map((t, i) => {
                const cumulative = t.data
                    .filter(d => d.year <= year)
                    .reduce((sum, d) => sum + d.count, 0);
                return { keyword: t.keyword, count: cumulative, color: COLORS[i % COLORS.length] };
            })
                .filter(item => item.count > 0)
                .sort((a, b) => b.count - a.count)
                .slice(0, 20); // Show top 20 at a time for readability in the race
            return { year, items };
        });
        setRaceFrames(frames);
        setRaceIndex(0);
    };

    // Race animation controls
    useEffect(() => {
        if (racePlaying && raceFrames.length > 0) {
            raceTimer.current = setInterval(() => {
                setRaceIndex(prev => {
                    if (prev >= raceFrames.length - 1) {
                        setRacePlaying(false);
                        return prev;
                    }
                    return prev + 1;
                });
            }, 800);
        }
        return () => { if (raceTimer.current) clearInterval(raceTimer.current); };
    }, [racePlaying, raceFrames.length]);

    // Prepare stream chart data
    const streamData = (() => {
        const allYears = new Set<number>();
        trends.forEach(t => t.data.forEach(d => allYears.add(d.year)));
        const years = Array.from(allYears).sort();
        return years.map(year => {
            const point: Record<string, number> = { year };
            trends.forEach(t => {
                const match = t.data.find(d => d.year === year);
                point[t.keyword] = match ? match.count : 0;
            });
            return point;
        });
    })();

    // Prepare heatmap data
    const heatmapData = (() => {
        const allYears = new Set<number>();
        trends.forEach(t => t.data.forEach(d => allYears.add(d.year)));
        const years = Array.from(allYears).sort();
        return { years, keywords: trends.map(t => t.keyword), trends };
    })();

    // Prepare radar data
    const radarData = (() => {
        const topConfs = Object.entries(conferences)
            .sort((a, b) => {
                const sumA = Object.values(a[1]).reduce((s, v) => s + v, 0);
                const sumB = Object.values(b[1]).reduce((s, v) => s + v, 0);
                return sumB - sumA;
            });

        const allKws = new Set<string>(selectedKeywords);

        // Backfill with top global keywords (availableKeywords is pre-sorted from Postgres by total volume) if we have less than 15 selected
        availableKeywords.forEach(k => allKws.add(k));

        return Array.from(allKws).slice(0, 15).map(kw => {
            const point: Record<string, string | number> = { keyword: kw };
            topConfs.forEach(([conf]) => {
                point[conf] = conferences[conf]?.[kw] || 0;
            });
            return point;
        });
    })();

    const radarConfs = Object.entries(conferences)
        .sort((a, b) => {
            const sumA = Object.values(a[1]).reduce((s, v) => s + v, 0);
            const sumB = Object.values(b[1]).reduce((s, v) => s + v, 0);
            return sumB - sumA;
        })
        .map(([c]) => c);

    // Dynamic radar domain based on selected conferences
    const radarDomainMax = useMemo(() => {
        if (radarData.length === 0) return 100;
        const active = activeConferences.length > 0 ? activeConferences : radarConfs;
        let max = 0;
        radarData.forEach((d: Record<string, unknown>) => {
            active.forEach(conf => {
                const val = Number(d[conf]) || 0;
                if (val > max) max = val;
            });
        });
        return Math.ceil(max * 1.15) || 100;
    }, [radarData, activeConferences, radarConfs]);

    const currentRaceFrame = raceFrames[raceIndex];
    const maxRaceCount = currentRaceFrame ? Math.max(...currentRaceFrame.items.map(i => i.count), 1) : 1;

    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 640);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    return (
        <div style={{ minHeight: "100vh", background: "#000" }}>
            {/* Navbar */}
            <nav className="px-4 py-3 lg:px-8 lg:py-4" style={{
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                background: "transparent",
            }}>
                <div style={{ maxWidth: "1400px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "8px", color: "#94a3b8", textDecoration: "none", fontSize: "13px" }}>
                            <ArrowLeft style={{ width: "16px", height: "16px" }} />
                            Papers
                        </Link>
                        <div style={{ width: "1px", height: "20px", background: "#334155" }} />
                        <img src="/cosmospaper-logo.png" alt="CosmosPapers" style={{ width: '36px', height: '36px', borderRadius: '10px' }} />
                        <div>
                            <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#e2e8f0", letterSpacing: "-0.02em" }}>
                                Research Trends
                            </h1>
                            <p className="hidden sm:block" style={{ fontSize: "11px", color: "#64748b" }}>
                                Discover what&apos;s trending in CS research
                            </p>
                        </div>
                    </div>
                    <Link href="/" style={{
                        display: "flex", alignItems: "center", gap: "6px",
                        padding: "7px 14px", borderRadius: "8px",
                        border: "1px solid rgba(51,65,85,0.5)",
                        fontSize: "13px", color: "#94a3b8", textDecoration: "none",
                    }}>
                        <img src="/cosmospaper-logo.png" alt="CosmosPapers" style={{ width: '18px', height: '18px', borderRadius: '4px' }} />
                        <span className="hidden sm:inline">CosmosPapers</span>
                    </Link>
                </div>
            </nav>

            <div className="px-4 py-4 lg:px-8 lg:py-6 mx-auto" style={{ maxWidth: "1400px" }}>
                {/* Searchable Dropdown Filter */}
                <div style={{ marginBottom: "24px", position: "relative", zIndex: 50 }}>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "14px", fontWeight: 600, color: "#e2e8f0" }}>Compare Topics:</span>

                        {/* Selected Pills Container */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", flex: 1, alignItems: "center" }}>

                            {/* The Dropdown Trigger (Moved to the start) */}
                            <div style={{ position: "relative" }}>
                                <DropdownFilter
                                    available={availableKeywords}
                                    selected={selectedKeywords}
                                    onToggle={toggleKeyword}
                                />
                            </div>

                            {/* The Selected Topic Pills (Populate to the right) */}
                            {selectedKeywords.map(kw => (
                                <div key={kw} onClick={() => toggleKeyword(kw)} style={{
                                    display: "flex", alignItems: "center", gap: "6px",
                                    padding: "6px 12px", borderRadius: "16px", fontSize: "12px", fontWeight: 500,
                                    background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", color: "#fff",
                                    cursor: "pointer", boxShadow: "0 2px 8px rgba(59, 130, 246, 0.25)"
                                }}>
                                    {kw}
                                    <span style={{ fontSize: "14px", opacity: 0.8 }}>×</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Tab navigation */}
                <div style={{
                    display: "flex", gap: "4px", marginBottom: "24px",
                    background: "transparent", borderRadius: "10px", padding: "4px",
                    border: "1px solid rgba(255,255,255,0.06)",
                    overflowX: "auto", WebkitOverflowScrolling: "touch",
                }}>
                    {[
                        { id: "stream" as const, label: "Stream" },
                        { id: "heatmap" as const, label: "Heatmap" },
                        { id: "race" as const, label: "Bar Race" },
                        { id: "radar" as const, label: "Radar" }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                flex: 1,
                                padding: "10px 12px",
                                borderRadius: "8px",
                                fontSize: "13px",
                                fontWeight: 600,
                                border: "none",
                                cursor: "pointer",
                                transition: "all 0.2s",
                                whiteSpace: "nowrap",
                                flexShrink: 0,
                                background: activeTab === tab.id
                                    ? "linear-gradient(135deg, #3b82f6, #8b5cf6)" : "transparent",
                                color: activeTab === tab.id ? "#fff" : "#94a3b8",
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div style={{
                        display: "flex", justifyContent: "center", alignItems: "center",
                        height: "400px", color: "#64748b", fontSize: "14px",
                    }}>
                        Loading trends data...
                    </div>
                ) : (
                    <>
                        {/* Stream Graph */}
                        {activeTab === "stream" && (
                            <div className="p-3 lg:p-6" style={{
                                background: "transparent", borderRadius: "12px",
                                border: "1px solid rgba(255,255,255,0.06)",
                            }}>
                                <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#e2e8f0", marginBottom: "20px" }}>
                                    Topic Evolution Over Time
                                </h2>
                                <ResponsiveContainer width="100%" height={isMobile ? 300 : 500}>
                                    <AreaChart data={streamData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                        <XAxis
                                            dataKey="year"
                                            stroke="#64748b"
                                            fontSize={12}
                                            type="number"
                                            domain={["dataMin", "dataMax"]}
                                            tickCount={streamData.length}
                                        />
                                        <YAxis
                                            stroke="#64748b"
                                            fontSize={12}
                                            domain={[0, "auto"]}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                background: "#0a0a0a", border: "1px solid #1a1a1a",
                                                borderRadius: "8px", color: "#e2e8f0", fontSize: "12px",
                                                maxHeight: "300px", overflowY: "auto",
                                            }}
                                            wrapperStyle={{ zIndex: 100, pointerEvents: "auto" }}
                                            cursor={{ stroke: "#64748b", strokeDasharray: "3 3" }}
                                            itemSorter={(item) => -(item.value as number)}
                                            position={{ y: 0 }}
                                        />
                                        <Legend
                                            wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }}
                                            content={isMobile ? () => null : undefined}
                                        />
                                        {trends.slice(0, 25).map((t, i) => (
                                            <Area
                                                key={t.keyword}
                                                type="monotone"
                                                dataKey={t.keyword}
                                                stroke={COLORS[i % COLORS.length]}
                                                fill={COLORS[i % COLORS.length]}
                                                fillOpacity={0.15}
                                                strokeWidth={2}
                                            />
                                        ))}
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Heatmap */}
                        {activeTab === "heatmap" && (
                            <div className="p-3 lg:p-6" style={{
                                background: "transparent", borderRadius: "12px",
                                border: "1px solid rgba(255,255,255,0.06)",
                                overflowX: "auto",
                            }}>
                                <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#e2e8f0", marginBottom: "20px" }}>
                                    Keyword Intensity by Year
                                </h2>
                                <div style={{ display: "grid", gap: "2px" }}>
                                    {/* Header row */}
                                    <div style={{ display: "flex", gap: "2px" }}>
                                        <div style={{ width: "160px", minWidth: "160px", padding: "8px", fontSize: "11px", color: "#64748b" }} />
                                        {heatmapData.years.map(y => (
                                            <div key={y} style={{
                                                flex: 1, minWidth: "60px", padding: "8px",
                                                textAlign: "center", fontSize: "11px", color: "#64748b", fontWeight: 600,
                                            }}>
                                                {y}
                                            </div>
                                        ))}
                                    </div>
                                    {/* Data rows */}
                                    {heatmapData.trends.slice(0, 15).map((t, ki) => {
                                        const maxCount = Math.max(...t.data.map(d => d.count), 1);
                                        return (
                                            <div key={t.keyword} style={{ display: "flex", gap: "2px" }}>
                                                <div style={{
                                                    width: "160px", minWidth: "160px", padding: "8px",
                                                    fontSize: "12px", color: "#e2e8f0", fontWeight: 500,
                                                    display: "flex", alignItems: "center",
                                                }}>
                                                    <span style={{
                                                        width: "8px", height: "8px", borderRadius: "50%",
                                                        background: COLORS[ki % COLORS.length],
                                                        marginRight: "8px", flexShrink: 0,
                                                    }} />
                                                    {t.keyword}
                                                </div>
                                                {heatmapData.years.map(y => {
                                                    const match = t.data.find(d => d.year === y);
                                                    const count = match ? match.count : 0;
                                                    const intensity = count / maxCount;
                                                    return (
                                                        <div key={y} style={{
                                                            flex: 1, minWidth: "60px", padding: "8px",
                                                            textAlign: "center", fontSize: "11px",
                                                            background: count > 0
                                                                ? `rgba(59, 130, 246, ${0.1 + intensity * 0.8})` : "#1e293b",
                                                            borderRadius: "4px",
                                                            color: intensity > 0.5 ? "#fff" : "#94a3b8",
                                                            fontWeight: intensity > 0.5 ? 600 : 400,
                                                            cursor: "default",
                                                            transition: "background 0.3s",
                                                        }}
                                                            title={`${t.keyword} (${y}): ${count} papers`}
                                                        >
                                                            {count || ""}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Bar Chart Race */}
                        {activeTab === "race" && currentRaceFrame && (
                            <div className="p-3 lg:p-6" style={{
                                background: "transparent", borderRadius: "12px",
                                border: "1px solid rgba(255,255,255,0.06)",
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                                    <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#e2e8f0" }}>
                                        Cumulative Paper Count Race
                                    </h2>
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                        <span style={{
                                            fontSize: "32px", fontWeight: 700,
                                            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                                            WebkitBackgroundClip: "text",
                                            WebkitTextFillColor: "transparent",
                                        }}>
                                            {currentRaceFrame.year}
                                        </span>
                                        <div style={{ display: "flex", gap: "4px" }}>
                                            <button
                                                onClick={() => { setRacePlaying(!racePlaying); }}
                                                style={{
                                                    padding: "8px", borderRadius: "8px",
                                                    background: "#1e293b", border: "1px solid rgba(255,255,255,0.06)",
                                                    color: "#e2e8f0", cursor: "pointer",
                                                }}
                                            >
                                                {racePlaying ? <Pause style={{ width: "16px", height: "16px" }} /> : <Play style={{ width: "16px", height: "16px" }} />}
                                            </button>
                                            <button
                                                onClick={() => { setRaceIndex(0); setRacePlaying(false); }}
                                                style={{
                                                    padding: "8px", borderRadius: "8px",
                                                    background: "#1e293b", border: "1px solid rgba(255,255,255,0.06)",
                                                    color: "#e2e8f0", cursor: "pointer",
                                                }}
                                            >
                                                <RotateCcw style={{ width: "16px", height: "16px" }} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                {/* Scrubber */}
                                <input
                                    type="range"
                                    min={0}
                                    max={raceFrames.length - 1}
                                    value={raceIndex}
                                    onChange={e => { setRaceIndex(parseInt(e.target.value)); setRacePlaying(false); }}
                                    style={{ width: "100%", marginBottom: "20px", accentColor: "#3b82f6" }}
                                />
                                {/* Bars */}
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    {currentRaceFrame.items.map((item, i) => (
                                        <div key={item.keyword} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                            <span style={{ width: "24px", fontSize: "12px", color: "#64748b", textAlign: "right" }}>
                                                {i + 1}
                                            </span>
                                            <span className="w-[80px] lg:w-[160px] text-xs lg:text-[13px] text-[#e2e8f0] font-medium text-right truncate" style={{ flexShrink: 0 }}>
                                                {item.keyword}
                                            </span>
                                            <div style={{ flex: 1, position: "relative", height: "28px" }}>
                                                <div style={{
                                                    position: "absolute", top: 0, left: 0,
                                                    height: "100%",
                                                    width: `${(item.count / maxRaceCount) * 100}%`,
                                                    background: `linear-gradient(90deg, ${item.color}, ${item.color}88)`,
                                                    borderRadius: "4px",
                                                    transition: "width 0.6s ease-out",
                                                    display: "flex", alignItems: "center", justifyContent: "flex-end",
                                                    paddingRight: "8px",
                                                }}>
                                                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#fff" }}>
                                                        {item.count.toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Conference Radar */}
                        {activeTab === "radar" && radarData.length > 0 && (
                            <div className="p-3 lg:p-6" style={{
                                background: "transparent", borderRadius: "12px",
                                border: "1px solid rgba(255,255,255,0.06)",
                            }}>
                                <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#e2e8f0", marginBottom: "20px" }}>
                                    Conference Research Focus
                                </h2>
                                <ResponsiveContainer width="100%" height={isMobile ? 300 : 500}>
                                    <RadarChart data={radarData}>
                                        <PolarGrid stroke="#334155" />
                                        <PolarAngleAxis dataKey="keyword" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                                        <PolarRadiusAxis
                                            tick={{ fontSize: 10, fill: "#64748b" }}
                                            domain={[0, radarDomainMax]}
                                        />

                                        {/* Map over all conferences so the Legend sees them, but hide unselected ones. */}
                                        {radarConfs.map((conf, i) => {
                                            const isActive = activeConferences.length === 0 || activeConferences.includes(conf);
                                            return (
                                                <Radar
                                                    key={conf}
                                                    name={conf}
                                                    dataKey={conf}
                                                    stroke={COLORS[i % COLORS.length]}
                                                    fill={COLORS[i % COLORS.length]}
                                                    fillOpacity={isActive ? 0.15 : 0}
                                                    strokeOpacity={isActive ? 1 : 0}
                                                />
                                            );
                                        })}

                                        <Legend
                                            wrapperStyle={{ fontSize: "11px", cursor: "pointer" }}
                                            onClick={(e) => {
                                                const confName = String(e.dataKey);
                                                setActiveConferences(prev =>
                                                    prev.includes(confName)
                                                        ? prev.filter(c => c !== confName)
                                                        : [...prev, confName]
                                                );
                                            }}
                                            formatter={(value) => {
                                                const isActive = activeConferences.includes(value);
                                                return (
                                                    <span style={{
                                                        color: isActive ? "#e2e8f0" : "#475569",
                                                        fontWeight: isActive ? 600 : 400,
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        gap: "4px"
                                                    }}>
                                                        {isActive && <span style={{ color: "#3b82f6" }}>✓</span>}
                                                        {value}
                                                    </span>
                                                )
                                            }}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                background: "#1e293b", border: "1px solid rgba(255,255,255,0.06)",
                                                borderRadius: "8px", color: "#e2e8f0", fontSize: "12px",
                                            }}
                                        />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function DropdownFilter({ available, selected, onToggle }: { available: string[], selected: string[], onToggle: (kw: string) => void }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filtered = available.filter(kw =>
        kw.toLowerCase().includes(search.toLowerCase()) && !selected.includes(kw)
    );

    return (
        <div ref={dropdownRef} style={{ position: "relative" }}>
            <button
                onClick={() => setOpen(!open)}
                style={{
                    padding: "6px 16px", borderRadius: "16px", fontSize: "13px", fontWeight: 500,
                    background: open ? "#1e293b" : "transparent", color: "#e2e8f0",
                    border: "1px dashed #475569", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px"
                }}
            >
                + Add Topic
            </button>

            {open && (
                <div style={{
                    position: "absolute", top: "100%", left: 0, marginTop: "8px",
                    width: "300px", maxHeight: "400px", background: "#0f172a",
                    border: "1px solid #334155", borderRadius: "12px", boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                    display: "flex", flexDirection: "column", overflow: "hidden"
                }}>
                    <input
                        type="text"
                        placeholder="Search 150 topics..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                        style={{
                            padding: "12px 16px", background: "transparent", border: "none",
                            borderBottom: "1px solid #334155", color: "#e2e8f0", fontSize: "13px",
                            outline: "none"
                        }}
                    />
                    <div style={{ overflowY: "auto", flex: 1, padding: "8px" }}>
                        {filtered.length === 0 ? (
                            <div style={{ padding: "12px", color: "#64748b", fontSize: "12px", textAlign: "center" }}>
                                No topics found
                            </div>
                        ) : (
                            filtered.map(kw => (
                                <div
                                    key={kw}
                                    onClick={() => { onToggle(kw); setOpen(false); setSearch(""); }}
                                    style={{
                                        padding: "8px 12px", fontSize: "12px", color: "#94a3b8",
                                        cursor: "pointer", borderRadius: "6px", transition: "background 0.2s"
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = "#1e293b"}
                                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                >
                                    {kw}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
// D3 force-directed network graph component
function NetworkGraph({ data }: { data: CooccurrenceData }) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current || data.nodes.length === 0) return;

        import("d3").then(d3 => {
            const svg = d3.select(svgRef.current);
            svg.selectAll("*").remove();

            const width = svgRef.current!.clientWidth;
            const height = 500;

            const maxWeight = Math.max(...data.edges.map(e => e.weight));

            const nodeMap = new Map<string, number>();
            data.edges.forEach(e => {
                nodeMap.set(e.source, (nodeMap.get(e.source) || 0) + e.weight);
                nodeMap.set(e.target, (nodeMap.get(e.target) || 0) + e.weight);
            });

            const nodes = data.nodes
                .filter(n => nodeMap.has(n.id))
                .map(n => ({ ...n, weight: nodeMap.get(n.id) || 1 }));

            const nodeIds = new Set(nodes.map(n => n.id));
            const edges = data.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

            const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
                .force("link", d3.forceLink(edges as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[])
                    .id((d: unknown) => (d as { id: string }).id)
                    .distance(100)
                )
                .force("charge", d3.forceManyBody().strength(-200))
                .force("center", d3.forceCenter(width / 2, height / 2))
                .force("collision", d3.forceCollide().radius(30));

            const g = svg.append("g");

            // Zoom
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (svg as any).call(
                d3.zoom()
                    .scaleExtent([0.3, 3])
                    .on("zoom", (event: any) => g.attr("transform", event.transform))
            );

            const link = g.append("g")
                .selectAll("line")
                .data(edges)
                .join("line")
                .attr("stroke", "#334155")
                .attr("stroke-width", d => Math.max(1, (d.weight / maxWeight) * 4))
                .attr("stroke-opacity", 0.6);

            const node = g.append("g")
                .selectAll("circle")
                .data(nodes)
                .join("circle")
                .attr("r", (d: any) => Math.max(5, Math.min(20, Math.sqrt(d.weight) * 2)))
                .attr("fill", (_: any, i: number) => COLORS[i % COLORS.length])
                .attr("fill-opacity", 0.8)
                .attr("stroke", "#0f1729")
                .attr("stroke-width", 1.5);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (node as any).call(d3.drag()
                .on("start", (event: any, d: any) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on("drag", (event: any, d: any) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on("end", (event: any, d: any) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                })
            );

            const label = g.append("g")
                .selectAll("text")
                .data(nodes)
                .join("text")
                .text((d: any) => d.id)
                .attr("font-size", (d: any) => Math.max(8, Math.min(13, Math.sqrt(d.weight))))
                .attr("fill", "#e2e8f0")
                .attr("text-anchor", "middle")
                .attr("dy", (d: any) => -Math.max(8, Math.min(22, Math.sqrt(d.weight) * 2)) - 4)
                .attr("pointer-events", "none");

            simulation.on("tick", () => {
                link
                    .attr("x1", (d: any) => d.source.x)
                    .attr("y1", (d: any) => d.source.y)
                    .attr("x2", (d: any) => d.target.x)
                    .attr("y2", (d: any) => d.target.y);
                node
                    .attr("cx", (d: any) => d.x)
                    .attr("cy", (d: any) => d.y);
                label
                    .attr("x", (d: any) => d.x)
                    .attr("y", (d: any) => d.y);
            });
        });
    }, [data]);

    return (
        <svg
            ref={svgRef}
            style={{ width: "100%", height: "500px", background: "#0f1729", borderRadius: "8px" }}
        />
    );
}
