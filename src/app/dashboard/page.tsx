"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { 
  subscribeToIssues, 
  upvoteIssue, 
  Issue, 
  addCommentToIssue, 
  updateIssueStatus, 
  getUserXP, 
  getUserBadges, 
  getUserLevel,
  uploadImage
} from "@/lib/firebase";

const MapComponent = dynamic(() => import("@/components/MapComponent"), { ssr: false });

export default function DashboardPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [activeTab, setActiveTab] = useState<"map" | "feed" | "predictive" | "gamification">("map");
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentNow, setCurrentNow] = useState(0);
  
  // Drawer & Details State
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [commentText, setCommentText] = useState("");
  const [resolutionFile, setResolutionFile] = useState<File | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<"idle" | "uploading" | "analyzing" | "success" | "error">("idle");
  const [resolutionMessage, setResolutionMessage] = useState("");

  // Gamification Stats
  const [xp, setXp] = useState(0);
  const [badges, setBadges] = useState<string[]>([]);
  const [level, setLevel] = useState(1);

  // Predictive Report State
  const [aiReport, setAiReport] = useState("");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Set current time baseline on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentNow(Date.now());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Subscribing to issues real-time
  useEffect(() => {
    const unsubscribe = subscribeToIssues((fetchedIssues) => {
      setIssues(fetchedIssues);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Update selected issue reference if it is open to see new comments/status in real-time
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (selectedIssue) {
      const updated = issues.find(i => i.id === selectedIssue.id);
      if (updated) {
        const hasChanged = 
          updated.status !== selectedIssue.status ||
          updated.upvotes !== selectedIssue.upvotes ||
          (updated.comments?.length || 0) !== (selectedIssue.comments?.length || 0) ||
          updated.resolution?.timestamp !== selectedIssue.resolution?.timestamp;
        
        if (hasChanged) {
          timer = setTimeout(() => {
            setSelectedIssue(updated);
          }, 0);
        }
      }
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [issues, selectedIssue]);

  // Sync Gamification Stats
  useEffect(() => {
    const updateStats = () => {
      setXp(getUserXP());
      setBadges(getUserBadges());
      setLevel(getUserLevel());
    };
    updateStats();
    window.addEventListener("user_gamification_update", updateStats);
    return () => window.removeEventListener("user_gamification_update", updateStats);
  }, []);

  // Format Time Helper
  const formatTimeAgo = (dateStr: string) => {
    try {
      const time = new Date(dateStr).getTime();
      const referenceTime = currentNow || time;
      const diff = referenceTime - time;
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return "Recently";
    }
  };

  const handleUpvote = (id?: string) => {
    if (!id) return;
    upvoteIssue(id);
  };

  const handleResolutionUpload = async (e: React.ChangeEvent<HTMLInputElement>, issue: Issue) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setResolutionFile(file);
    setResolutionStatus("uploading");
    setResolutionMessage("Uploading proof of resolution...");

    try {
      const uploadedUrl = await uploadImage(file);
      
      setResolutionStatus("analyzing");
      setResolutionMessage("Verifying resolution with Gemini...");

      const formData = new FormData();
      formData.append("originalUrl", issue.imageUrl);
      formData.append("resolutionImage", file);
      formData.append("description", `Verify fix for ${issue.subcategory}: ${issue.short_summary}`);

      const response = await fetch("/api/resolve", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to verify resolution. Ensure GEMINI_API_KEY is configured.");
      }

      const result = await response.json();

      if (result.verified) {
        setResolutionStatus("success");
        setResolutionMessage("Fix verified by AI!");
        
        await updateIssueStatus(
          issue.id!,
          "resolved",
          `AI verified resolution: ${result.explanation}`,
          {
            imageUrl: uploadedUrl,
            explanation: result.explanation,
            timestamp: new Date().toISOString(),
            verifiedByAI: true
          }
        );
      } else {
        setResolutionStatus("error");
        setResolutionMessage(`AI rejected fix: ${result.explanation}`);
      }
    } catch (err: unknown) {
      console.error(err);
      setResolutionStatus("error");
      const errMsg = err instanceof Error ? err.message : "Error verifying resolution.";
      setResolutionMessage(errMsg);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent, issueId: string) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      await addCommentToIssue(issueId, commentText.trim(), "Grid Hero Alpha", "Citizen Volunteer");
      setCommentText("");
    } catch (err) {
      console.error("Failed to add comment:", err);
    }
  };

  const generateAIRecommendations = async () => {
    setIsGeneratingReport(true);
    setAiReport("");
    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issues })
      });
      if (!response.ok) {
        throw new Error("Failed to generate recommendations.");
      }
      const data = await response.json();
      setAiReport(data.recommendations || "No recommendations generated.");
    } catch (err: unknown) {
      console.error(err);
      setAiReport("Error generating recommendations. Ensure GEMINI_API_KEY is configured.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Filtering Logic
  const filteredIssues = issues.filter((issue) => {
    const matchesCategory = filterCategory === "All" || issue.category.toLowerCase().includes(filterCategory.toLowerCase()) || issue.subcategory.toLowerCase().includes(filterCategory.toLowerCase());
    const matchesSearch = searchQuery === "" || 
      issue.subcategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.short_summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="bg-[#10131a] text-[#e1e2eb] font-sans min-h-screen flex">
      {/* SideNavBar Anchor */}
      <aside className="w-64 fixed left-0 top-0 h-screen bg-[#0b0e14] border-r border-[#3b494b]/20 shadow-[4px_0px_20px_rgba(0,240,255,0.05)] flex flex-col py-6 z-50">
        <div className="px-6 mb-10">
          <h1 className="text-xl font-bold text-[#dbfcff] tracking-tighter font-mono">Community Hero</h1>
          <p className="text-[10px] font-semibold text-[#b9cacb] uppercase tracking-widest mt-1 font-mono">Vigilant Dashboard</p>
        </div>
        
        <nav className="flex-1 space-y-1">
          <button 
            onClick={() => setActiveTab("map")}
            className={`w-full flex items-center gap-3 px-6 py-3 font-semibold text-sm transition-all duration-200 border-r-2 ${
              activeTab === "map" 
                ? "bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]" 
                : "text-[#b9cacb] hover:bg-[#272a31] hover:text-[#dbfcff] border-transparent"
            }`}
          >
            <span className="material-symbols-outlined">map</span>
            <span className="font-mono">Map View</span>
          </button>
          
          <button 
            onClick={() => setActiveTab("feed")}
            className={`w-full flex items-center gap-3 px-6 py-3 font-semibold text-sm transition-all duration-200 border-r-2 ${
              activeTab === "feed" 
                ? "bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]" 
                : "text-[#b9cacb] hover:bg-[#272a31] hover:text-[#dbfcff] border-transparent"
            }`}
          >
            <span className="material-symbols-outlined">forum</span>
            <span className="font-mono">Issue Feed</span>
          </button>

          <button 
            onClick={() => setActiveTab("predictive")}
            className={`w-full flex items-center gap-3 px-6 py-3 font-semibold text-sm transition-all duration-200 border-r-2 ${
              activeTab === "predictive" 
                ? "bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]" 
                : "text-[#b9cacb] hover:bg-[#272a31] hover:text-[#dbfcff] border-transparent"
            }`}
          >
            <span className="material-symbols-outlined">insights</span>
            <span className="font-mono">Hotspot Forecast</span>
          </button>

          <button 
            onClick={() => setActiveTab("gamification")}
            className={`w-full flex items-center gap-3 px-6 py-3 font-semibold text-sm transition-all duration-200 border-r-2 ${
              activeTab === "gamification" 
                ? "bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]" 
                : "text-[#b9cacb] hover:bg-[#272a31] hover:text-[#dbfcff] border-transparent"
            }`}
          >
            <span className="material-symbols-outlined">military_tech</span>
            <span className="font-mono">Community Rank</span>
          </button>
        </nav>

        <div className="px-6 mb-4">
          <div className="glass-card p-3 rounded-lg border border-[#3b494b]/20">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-mono text-[#b9cacb] font-bold">LVL {level} HERO</span>
              <span className="text-[10px] font-mono text-[#00f0ff] font-bold">{xp} XP</span>
            </div>
            <div className="w-full bg-[#191c22] h-1 rounded-full overflow-hidden">
              <div className="bg-[#00f0ff] h-full transition-all duration-300 shadow-[0_0_8px_#00f0ff]" style={{ width: `${Math.min(100, xp % 100)}%` }}></div>
            </div>
          </div>
        </div>

        <div className="px-6">
          <Link 
            href="/report"
            className="w-full py-3 bg-[#00f0ff] text-[#004f54] font-bold rounded-lg neon-glow-primary active:scale-95 transition-all duration-150 flex items-center justify-center gap-2 text-sm"
          >
            <span className="material-symbols-outlined text-[20px]">report</span>
            Report Incident
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="ml-64 flex-1 min-h-screen flex flex-col">
        {/* TopAppBar Anchor */}
        <header className="fixed top-0 right-0 left-64 h-16 bg-[#10131a]/85 backdrop-blur-xl border-b border-[#3b494b]/20 flex justify-between items-center px-8 z-40">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#2ae500] pulse-live shadow-[0_0_8px_#2ae500]"></div>
              <span className="text-[10px] font-semibold text-[#d7ffc5] uppercase tracking-widest font-mono">System Live</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative">
              <input 
                className="bg-[#191c22] border-b border-[#3b494b]/30 focus:border-[#00f0ff] focus:ring-0 text-on-surface text-xs py-1.5 pl-4 pr-10 w-64 transition-all duration-300 rounded-lg outline-none text-[#e1e2eb]" 
                placeholder="Search incident reports..." 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="material-symbols-outlined absolute right-3 top-1.5 text-[#849495] text-[18px]">search</span>
            </div>
            <div className="flex items-center gap-4 text-[#b9cacb]">
              <button className="hover:text-[#00f0ff] transition-colors">
                <span className="material-symbols-outlined">notifications</span>
              </button>
              <button className="hover:text-[#00f0ff] transition-colors">
                <span className="material-symbols-outlined">settings</span>
              </button>
              <div className="w-8 h-8 rounded-full overflow-hidden border border-[#3b494b]/30">
                <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBIm_25G51CQ7_v7ukZI-8C8RvcCiH1DTTzn88w-ELvAoj8iErUDhjtekvrO-LerExaQap56jtCEpGZF2hKy2Oni7yYfrdnLORUWSONDHUZ-iI9vagyNHKhYemCop1NmXIbD_5n3FvpZIYHonFOoq5o3UkMBqi-a9KwohXkPWJ0fqjCMxNEfOEmEdq28NoEmzdDquFZcZjE36p9ww41Cx2contGoB9J1OOskknDWu4T-wUktWKSiugCGbWp2Auq8y1PsdOi2ezm-nA" alt="Avatar" />
              </div>
            </div>
          </div>
        </header>

        {/* Content Canvas */}
        <div className="pt-24 flex-1 flex flex-col p-8 space-y-8 relative overflow-hidden">
          
          {/* TAB 1: INTERACTIVE MAP */}
          {activeTab === "map" && (
            <div className="flex-1 flex flex-col space-y-4 min-h-[500px]">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-[#dbfcff] font-mono">Live Incident Map</h2>
                  <p className="text-xs text-[#b9cacb] mt-0.5">Real-time geospatial coordinate monitoring system.</p>
                </div>
                <div className="glass-card px-4 py-2 rounded-lg flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#00f0ff] animate-ping" />
                  <span className="text-[10px] font-mono text-[#00f0ff] font-bold">Active Pins: {filteredIssues.length}</span>
                </div>
              </div>
              
              <section className="flex-1 min-h-[460px] rounded-xl overflow-hidden glass-card relative border border-[#3b494b]/30">
                <MapComponent 
                  issues={filteredIssues} 
                  onSelectIssue={(issue) => setSelectedIssue(issue)} 
                />
              </section>
            </div>
          )}

          {/* TAB 2: INCIDENT FEED */}
          {activeTab === "feed" && (
            <section className="space-y-6 flex-1">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-[#e1e2eb] font-mono">Recent Incidents</h2>
                  <p className="text-xs text-[#b9cacb] mt-1">Real-time community health monitoring feed.</p>
                </div>

                {/* Filtering Controls */}
                <div className="flex gap-2 flex-wrap">
                  {["All", "Roads", "Public Safety", "Sanitation"].map((cat) => (
                    <button 
                      key={cat}
                      onClick={() => setFilterCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all border ${
                        filterCategory === cat
                          ? "bg-[#00f0ff]/15 border-[#00f0ff] text-[#00f0ff] font-bold shadow-sm"
                          : "glass-card border-transparent text-[#b9cacb] hover:bg-[#272a31]"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid of Incidents */}
              {filteredIssues.length === 0 ? (
                <div className="glass-card p-10 rounded-xl text-center">
                  <span className="material-symbols-outlined text-4xl text-[#849495] mb-2">info</span>
                  <p className="text-sm text-[#b9cacb]">No reports found matching filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredIssues.map((issue) => {
                    const isHigh = issue.severity.toLowerCase().includes("high") || 
                                   issue.severity.toLowerCase().includes("critical") || 
                                   issue.severity.includes("4") || 
                                   issue.severity.includes("3");

                    return (
                      <div 
                        key={issue.id} 
                        onClick={() => setSelectedIssue(issue)}
                        className="glass-card rounded-xl overflow-hidden flex flex-col group hover:border-[#00f0ff]/40 transition-all duration-300 cursor-pointer"
                      >
                        <div className="h-44 w-full overflow-hidden relative bg-[#0b0e14] flex items-center justify-center">
                          {issue.imageUrl ? (
                            <img 
                              src={issue.imageUrl} 
                              alt={issue.subcategory}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <span className="material-symbols-outlined text-4xl text-[#424754]">image</span>
                          )}
                          <div className="absolute top-3 left-3 px-2 py-0.5 bg-[#0b0e14]/80 backdrop-blur-md rounded text-[9px] font-mono text-[#00f0ff] uppercase tracking-tighter">
                            {issue.category}
                          </div>
                          
                          {issue.status === "resolved" && (
                            <div className="absolute top-3 right-3 px-2.5 py-0.5 bg-emerald-500 text-black rounded text-[9px] font-mono font-bold uppercase tracking-wide">
                              RESOLVED
                            </div>
                          )}
                        </div>
                        
                        <div className="p-5 flex-grow flex flex-col justify-between space-y-4">
                          <div className="space-y-2">
                            <div className="flex justify-between items-start gap-2">
                              <h3 className="font-mono text-xs font-bold text-[#e1e2eb] leading-tight line-clamp-1">
                                {issue.subcategory}
                              </h3>
                              <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase tracking-wide whitespace-nowrap ${
                                issue.status === "resolved"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                  : isHigh 
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 neon-glow-error' 
                                    : 'bg-[#2ae500]/10 text-[#2ae500] border border-[#2ae500]/30'
                              }`}>
                                {issue.severity.includes("LEVEL") ? issue.severity.replace("LEVEL ", "L") : issue.severity}
                              </span>
                            </div>
                            <p className="text-xs text-[#b9cacb] line-clamp-3 leading-relaxed">
                              {issue.short_summary}
                            </p>
                          </div>

                          <div className="pt-2 flex justify-between items-center border-t border-[#3b494b]/10">
                            <div className="flex items-center gap-1 text-[#b9cacb] text-[10px] font-mono">
                              <span className="material-symbols-outlined text-[14px]">schedule</span>
                              <span>{formatTimeAgo(issue.timestamp)}</span>
                            </div>

                            <div className="flex items-center gap-3">
                              {issue.comments && issue.comments.length > 0 && (
                                <div className="flex items-center gap-1 text-[#b9cacb] text-[10px]">
                                  <span className="material-symbols-outlined text-[14px]">forum</span>
                                  <span>{issue.comments.length}</span>
                                </div>
                              )}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpvote(issue.id);
                                }}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] rounded-lg transition-colors border border-[#00f0ff]/20 active:scale-95"
                              >
                                <span className="material-symbols-outlined text-[16px]">thumb_up</span>
                                <span className="text-[10px] font-bold font-mono">{issue.upvotes}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* TAB 3: PREDICTIVE INSIGHTS */}
          {activeTab === "predictive" && (
            <section className="space-y-6 flex-1 max-w-4xl w-full mx-auto">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-[#e1e2eb] font-mono">Predictive Urban Forecasts</h2>
                <p className="text-xs text-[#b9cacb] mt-1">AI modeling of neighborhood hazard vulnerabilities based on report telemetry.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Risk Panel 1 */}
                <div className="glass-card p-5 rounded-xl border border-[#3b494b]/20 relative">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-mono uppercase text-amber-400">Road Erosion Hazard</span>
                    <span className="text-xs font-bold font-mono text-amber-400">74% RISK</span>
                  </div>
                  <h3 className="text-sm font-bold font-mono mt-3 text-[#dbfcff]">Pavement Fatigue (Sector E)</h3>
                  <p className="text-xs text-[#b9cacb] mt-2 leading-relaxed">
                    Elevated moisture indicators and reported potholes suggest accelerated sub-grade degradation. Rainfall forecast within 48h increases threat.
                  </p>
                  <div className="mt-4 w-full bg-[#191c22] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-amber-400 h-full" style={{ width: "74%" }} />
                  </div>
                </div>

                {/* Risk Panel 2 */}
                <div className="glass-card p-5 rounded-xl border border-[#3b494b]/20 relative">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-mono uppercase text-[#00f0ff]">Sanitation Overload</span>
                    <span className="text-xs font-bold font-mono text-[#00f0ff]">15% RISK</span>
                  </div>
                  <h3 className="text-sm font-bold font-mono mt-3 text-[#dbfcff]">Smart Bin Saturation</h3>
                  <p className="text-xs text-[#b9cacb] mt-2 leading-relaxed">
                    Sanitation trucks have completed scheduled routes. Average load factor is 0.22. Risk index remains low for subsequent 72h.
                  </p>
                  <div className="mt-4 w-full bg-[#191c22] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#00f0ff] h-full" style={{ width: "15%" }} />
                  </div>
                </div>

                {/* Risk Panel 3 */}
                <div className="glass-card p-5 rounded-xl border border-[#3b494b]/20 relative">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-mono uppercase text-rose-500">Public Safety Outage</span>
                    <span className="text-xs font-bold font-mono text-rose-500">89% ALERT</span>
                  </div>
                  <h3 className="text-sm font-bold font-mono mt-3 text-[#dbfcff]">Central Park North Corridor</h3>
                  <p className="text-xs text-[#b9cacb] mt-2 leading-relaxed">
                    Multiple unresolved lighting outages detected. Correlated risk indices suggest high dark hazard vulnerability in sector grid.
                  </p>
                  <div className="mt-4 w-full bg-[#191c22] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-rose-500 h-full shadow-[0_0_10px_rgba(239,68,68,0.5)]" style={{ width: "89%" }} />
                  </div>
                </div>
              </div>

              {/* Gemini Recommendations Block */}
              <div className="glass-card p-6 rounded-xl border border-[#3b494b]/30 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#00f0ff] animate-pulse">auto_awesome</span>
                    <h3 className="font-mono text-sm font-bold text-[#dbfcff]">AI Municipal Policy Advisory</h3>
                  </div>
                  
                  <button 
                    onClick={generateAIRecommendations}
                    disabled={isGeneratingReport}
                    className="px-4 py-2 bg-[#00f0ff] text-[#004f54] font-bold text-xs rounded font-mono flex items-center gap-1.5 active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {isGeneratingReport ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-sm">refresh</span>
                        <span>GENERATING PROTOCOL...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">construction</span>
                        <span>GENERATE ADVISORY</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-[#0b0e14] rounded-lg border border-[#3b494b]/20 p-5 min-h-[160px] text-xs font-mono leading-relaxed text-[#c2c6d6]">
                  {isGeneratingReport ? (
                    <div className="flex flex-col items-center justify-center py-10 space-y-2">
                      <div className="w-6 h-6 border-2 border-t-transparent border-[#00f0ff] rounded-full animate-spin" />
                      <p className="text-[10px] text-[#00f0ff]">Querying Gemini 2.5 Policy Engine...</p>
                    </div>
                  ) : aiReport ? (
                    <div className="space-y-4 whitespace-pre-wrap">{aiReport}</div>
                  ) : (
                    <div className="text-center py-10 text-[#849495]">
                      <span className="material-symbols-outlined text-3xl mb-2 text-[#424754]">spatial_tracking</span>
                      <p>Advisory protocol offline. Press &quot;Generate Advisory&quot; to synthesize city infrastructure recommendations using Gemini.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* TAB 4: COMMUNITY RANK (GAMIFICATION) */}
          {activeTab === "gamification" && (
            <section className="space-y-6 flex-1 max-w-4xl w-full mx-auto">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-[#e1e2eb] font-mono">Community Hero Rankings</h2>
                  <p className="text-xs text-[#b9cacb] mt-1">Gamified engagement network for civic resolution advocates.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* User Stats Card */}
                <div className="glass-card p-6 rounded-xl border border-[#3b494b]/30 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden border border-[#00f0ff] shadow-[0_0_10px_rgba(0,240,255,0.2)]">
                        <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBIm_25G51CQ7_v7ukZI-8C8RvcCiH1DTTzn88w-ELvAoj8iErUDhjtekvrO-LerExaQap56jtCEpGZF2hKy2Oni7yYfrdnLORUWSONDHUZ-iI9vagyNHKhYemCop1NmXIbD_5n3FvpZIYHonFOoq5o3UkMBqi-a9KwohXkPWJ0fqjCMxNEfOEmEdq28NoEmzdDquFZcZjE36p9ww41Cx2contGoB9J1OOskknDWu4T-wUktWKSiugCGbWp2Auq8y1PsdOi2ezm-nA" alt="Hero Avatar" />
                      </div>
                      <div>
                        <h3 className="font-mono text-sm font-bold text-[#dbfcff]">Grid Sentinel (You)</h3>
                        <p className="text-[10px] font-mono text-[#adc6ff]">Rank: Civic Guardian</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-[#b9cacb]">XP Progress:</span>
                        <span className="text-[#00f0ff] font-bold">{xp} / {level * 100} XP</span>
                      </div>
                      <div className="w-full bg-[#191c22] h-2 rounded-full overflow-hidden border border-[#3b494b]/20">
                        <div className="bg-[#00f0ff] h-full transition-all duration-300 shadow-[0_0_8px_#00f0ff]" style={{ width: `${Math.min(100, (xp % 100))}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#3b494b]/10 flex justify-between text-center mt-6">
                    <div>
                      <p className="text-lg font-bold font-mono text-[#dbfcff]">{level}</p>
                      <p className="text-[9px] font-mono text-[#b9cacb] uppercase">Hero Level</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold font-mono text-[#dbfcff]">{issues.filter(i => i.user_metadata.reporter.includes("Grid")).length}</p>
                      <p className="text-[9px] font-mono text-[#b9cacb] uppercase">Reports Logged</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold font-mono text-[#dbfcff]">{xp}</p>
                      <p className="text-[9px] font-mono text-[#b9cacb] uppercase">Total XP</p>
                    </div>
                  </div>
                </div>

                {/* User Badges Card */}
                <div className="glass-card p-6 rounded-xl border border-[#3b494b]/30 md:col-span-2">
                  <h3 className="font-mono text-xs font-bold text-[#adc6ff] uppercase tracking-wide mb-4">Unlocked Badges</h3>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {/* Badge 1 */}
                    <div className={`p-3 rounded-lg border flex flex-col items-center text-center transition-all ${
                      badges.includes("roads") 
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 badge-unlocked glow-roads' 
                        : 'bg-[#191c22]/50 border-[#424754]/30 text-[#424754]'
                    }`}>
                      <span className="material-symbols-outlined text-3xl mb-2">construction</span>
                      <span className="text-[10px] font-bold font-mono leading-tight">Pothole Patrol</span>
                      <span className="text-[8px] text-[#b9cacb] mt-1 leading-tight">Reported a road defect</span>
                    </div>

                    {/* Badge 2 */}
                    <div className={`p-3 rounded-lg border flex flex-col items-center text-center transition-all ${
                      badges.includes("safety") 
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 badge-unlocked glow-safety' 
                        : 'bg-[#191c22]/50 border-[#424754]/30 text-[#424754]'
                    }`}>
                      <span className="material-symbols-outlined text-3xl mb-2">emergency</span>
                      <span className="text-[10px] font-bold font-mono leading-tight">Light Bringer</span>
                      <span className="text-[8px] text-[#b9cacb] mt-1 leading-tight">Reported safety outage</span>
                    </div>

                    {/* Badge 3 */}
                    <div className={`p-3 rounded-lg border flex flex-col items-center text-center transition-all ${
                      badges.includes("sanitation") 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 badge-unlocked glow-sanitation' 
                        : 'bg-[#191c22]/50 border-[#424754]/30 text-[#424754]'
                    }`}>
                      <span className="material-symbols-outlined text-3xl mb-2">delete_sweep</span>
                      <span className="text-[10px] font-bold font-mono leading-tight">Eco Shield</span>
                      <span className="text-[8px] text-[#b9cacb] mt-1 leading-tight">Reported trash overflow</span>
                    </div>

                    {/* Badge 4 */}
                    <div className={`p-3 rounded-lg border flex flex-col items-center text-center transition-all ${
                      badges.includes("solver") 
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-300 badge-unlocked glow-solver' 
                        : 'bg-[#191c22]/50 border-[#424754]/30 text-[#424754]'
                    }`}>
                      <span className="material-symbols-outlined text-3xl mb-2">verified</span>
                      <span className="text-[10px] font-bold font-mono leading-tight">Civic Solver</span>
                      <span className="text-[8px] text-[#b9cacb] mt-1 leading-tight">Fixed an issue with AI proof</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Leaderboard Table */}
              <div className="glass-card rounded-xl border border-[#3b494b]/30 overflow-hidden">
                <div className="px-6 py-4 border-b border-[#3b494b]/20 flex items-center justify-between">
                  <h3 className="font-mono text-sm font-bold text-[#dbfcff]">Regional Leaderboard</h3>
                  <span className="text-[10px] font-mono text-[#b9cacb] uppercase">Updated Realtime</span>
                </div>
                
                <div className="divide-y divide-[#3b494b]/10 text-xs">
                  {/* Rank 1 */}
                  <div className="px-6 py-3 flex items-center justify-between hover:bg-[#272a31]/20">
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-bold text-[#00f0ff] w-4">#1</span>
                      <div className="w-7 h-7 rounded-full overflow-hidden border border-amber-500/50">
                        <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAWOr5myR-bJah-I8P0jEtkYYO1agtv89sRT5aDJ1TOlVdHmA6GlV0h7nlfJUDFGTVu4PFgfS2qLYclAiEOpGveXQN8RuVuX7-KvCbysQ488DNVOgWoqXibdC3KPBhe4acBrWDgBJ3iCy8flgDM62txchWLd2cl0s-v8c4Dg8nQ-OQ9QiWNkYuFyUEnRcP6iS4hZuyzef32o9fMebmBzVEzMELzUIeYtqxQCC0CrL-SzAHlM_cfa_ia1CGjwpdImThM0PixyrcHuvs" alt="Rank 1 Avatar" />
                      </div>
                      <span className="font-mono text-[#dbfcff] font-bold">Sarah Connor</span>
                    </div>
                    <div className="flex gap-3 items-center">
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 font-mono text-[9px] rounded font-bold uppercase">LVL 4 ELITE</span>
                      <span className="font-mono font-bold text-[#00f0ff]">385 XP</span>
                    </div>
                  </div>

                  {/* Rank 2 */}
                  <div className="px-6 py-3 flex items-center justify-between hover:bg-[#272a31]/20">
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-bold text-[#b9cacb] w-4">#2</span>
                      <div className="w-7 h-7 rounded-full overflow-hidden border border-slate-500/30">
                        <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC9ctVqrwU-Yk87mr3kGV1LLxV8CD2hQJBH4iXQiXgdvFBi0PS31zEz5IL0d12yCQq6vQpnZpM9_KvSCDwLfU9KMGQ4qiq6M4e-l_V3lrSTAsFKhMkOVzQbSe8XvNsjb_e8-HijzzAD3FhWn6OgFQJ00-b9nIJxFJvZPyAfXz5EMVu0O5yMM3ks2iOXTTPDfexH_b7Bl0Y__9KVbJT7_EscS21l-G1GZ7bVFhD1xHfo-NdDbV8D9RkihL-Byte41cGYGGWji-YtjrM" alt="Rank 2 Avatar" />
                      </div>
                      <span className="font-mono text-[#dbfcff] font-bold">John Doe</span>
                    </div>
                    <div className="flex gap-3 items-center">
                      <span className="px-2 py-0.5 bg-[#b9cacb]/10 text-[#b9cacb] font-mono text-[9px] rounded font-bold uppercase">LVL 2 SENIOR</span>
                      <span className="font-mono font-bold text-[#00f0ff]">210 XP</span>
                    </div>
                  </div>

                  {/* Rank 3 (Current User placement dynamically inserted) */}
                  <div className="px-6 py-3 flex items-center justify-between bg-[#00f0ff]/5 hover:bg-[#00f0ff]/10">
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-bold text-[#00f0ff] w-4">#3</span>
                      <div className="w-7 h-7 rounded-full overflow-hidden border border-[#00f0ff]/60">
                        <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBIm_25G51CQ7_v7ukZI-8C8RvcCiH1DTTzn88w-ELvAoj8iErUDhjtekvrO-LerExaQap56jtCEpGZF2hKy2Oni7yYfrdnLORUWSONDHUZ-iI9vagyNHKhYemCop1NmXIbD_5n3FvpZIYHonFOoq5o3UkMBqi-a9KwohXkPWJ0fqjCMxNEfOEmEdq28NoEmzdDquFZcZjE36p9ww41Cx2contGoB9J1OOskknDWu4T-wUktWKSiugCGbWp2Auq8y1PsdOi2ezm-nA" alt="Rank 3 Avatar" />
                      </div>
                      <span className="font-mono text-[#00f0ff] font-bold">Grid Sentinel (You)</span>
                    </div>
                    <div className="flex gap-3 items-center">
                      <span className="px-2 py-0.5 bg-[#00f0ff]/10 text-[#00f0ff] font-mono text-[9px] rounded font-bold uppercase">LVL {level} HERO</span>
                      <span className="font-mono font-bold text-[#00f0ff]">{xp} XP</span>
                    </div>
                  </div>

                  {/* Rank 4 */}
                  <div className="px-6 py-3 flex items-center justify-between hover:bg-[#272a31]/20">
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-bold text-[#b9cacb] w-4">#4</span>
                      <div className="w-7 h-7 rounded-full overflow-hidden border border-transparent">
                        <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAouAuBdsPc_lQM8Ueq5kbsRpXvaX0shnUJ64HTplwZgppPegTD1IG3tHDGDj9-Hr2_B6A3EAS2GR7-ckcWftgkjAzBVUGanMjYuC9Pvqonbh9zSkYm8bx1_yDX03ylk473K4JHMQ3egGSJL4MDgHAHcCVa20f-yo7v8fi7wc4xgqiuCthvxb3U6PlH83VtgvwYdcFIuqSn7OJXRKMr1s7ZYi0lKpEr63DNuilSURxtKwU6AxX0TLsW6hN3Ge9RCUy_yX-SfBlng8o" alt="Rank 4 Avatar" />
                      </div>
                      <span className="font-mono text-[#b9cacb]">Eco Sentinel</span>
                    </div>
                    <div className="flex gap-3 items-center">
                      <span className="px-2 py-0.5 bg-[#272a31] text-[#b9cacb] font-mono text-[9px] rounded font-bold uppercase">LVL 1 SCOUT</span>
                      <span className="font-mono font-bold text-[#b9cacb]">80 XP</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

        </div>

        {/* DETAILS DRAWER OVERLAY */}
        {selectedIssue && (
          <div className="fixed inset-y-0 right-0 w-[420px] bg-[#0b0e14]/95 backdrop-blur-xl border-l border-[#3b494b]/30 z-50 drawer-shadow flex flex-col transition-all duration-300">
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#3b494b]/20 flex justify-between items-center bg-[#0d1017]">
              <div>
                <span className="text-[10px] font-mono text-[#adc6ff] uppercase tracking-wider">Community Resolution Hub</span>
                <h3 className="font-mono text-sm font-bold text-[#dbfcff] line-clamp-1">{selectedIssue.subcategory}</h3>
              </div>
              <button 
                onClick={() => {
                  setSelectedIssue(null);
                  setResolutionStatus("idle");
                  setResolutionMessage("");
                }}
                className="w-8 h-8 rounded-full bg-[#1c222e] hover:bg-[#272e3d] flex items-center justify-center text-[#b9cacb] hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Drawer Content Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              
              {/* Media Image */}
              <div className="h-48 w-full rounded-lg overflow-hidden border border-[#3b494b]/30 relative bg-[#06080c] flex items-center justify-center">
                {selectedIssue.imageUrl ? (
                  <img src={selectedIssue.imageUrl} alt={selectedIssue.subcategory} className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-4xl text-[#424754]">image</span>
                )}
                <div className="absolute bottom-3 left-3 px-2 py-0.5 bg-[#0b0e14]/90 rounded text-[9px] font-mono text-[#00f0ff] uppercase border border-[#00f0ff]/20">
                  {selectedIssue.category}
                </div>
              </div>

              {/* Severity & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#111c2d] border border-[#3b494b]/20 p-3 rounded-lg text-center">
                  <span className="text-[9px] font-mono text-[#b9cacb] uppercase block">Assessed Severity</span>
                  <span className="text-sm font-bold font-mono text-rose-400 mt-1 block">{selectedIssue.severity}</span>
                </div>
                <div className="bg-[#111c2d] border border-[#3b494b]/20 p-3 rounded-lg text-center">
                  <span className="text-[9px] font-mono text-[#b9cacb] uppercase block">Resolution Status</span>
                  <span className="text-xs font-bold font-mono text-emerald-400 mt-1 block uppercase">{selectedIssue.status}</span>
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-1">
                <h4 className="text-[10px] font-mono text-[#adc6ff] uppercase tracking-wide">AI Analyzer Summary</h4>
                <div className="p-3 bg-[#111c2d]/40 rounded border border-[#3b494b]/15 text-xs leading-relaxed text-[#c2c6d6]">
                  {selectedIssue.short_summary}
                </div>
              </div>

              {/* Location Grid Info */}
              <div className="flex items-center gap-2 text-xs text-[#b9cacb] bg-[#111c2d]/20 p-2.5 rounded border border-[#3b494b]/10">
                <span className="material-symbols-outlined text-[#00f0ff]">location_on</span>
                <span className="font-mono">Grid Coordinate: {selectedIssue.location.grid}</span>
              </div>

              {/* Timeline (Status History) */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-mono text-[#adc6ff] uppercase tracking-wide">Status Progression</h4>
                <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-[#1a2b44]">
                  {/* Timeline Stage: Reported */}
                  <div className="relative">
                    <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-[#00f0ff] border-2 border-[#0b0e14] flex items-center justify-center shadow-[0_0_8px_#00f0ff]">
                      <div className="w-1 h-1 bg-[#0b0e14] rounded-full" />
                    </div>
                    <div className="text-xs">
                      <p className="font-mono font-bold text-[#dbfcff]">Reported</p>
                      <p className="text-[10px] text-[#b9cacb] mt-0.5">Telemetry logged on citizen database.</p>
                      <span className="text-[9px] text-[#849495] font-mono mt-1 block">{formatTimeAgo(selectedIssue.timestamp)}</span>
                    </div>
                  </div>

                  {/* Timeline Stage: Verified */}
                  <div className="relative">
                    <div className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-[#0b0e14] flex items-center justify-center ${
                      selectedIssue.status === "verified" || selectedIssue.status === "in-progress" || selectedIssue.status === "resolved"
                        ? "bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" 
                        : "bg-[#111c2d]"
                    }`}>
                      {(selectedIssue.status === "verified" || selectedIssue.status === "in-progress" || selectedIssue.status === "resolved") && (
                        <div className="w-1 h-1 bg-[#0b0e14] rounded-full" />
                      )}
                    </div>
                    <div className="text-xs">
                      <p className={`font-mono font-bold ${
                        selectedIssue.status === "verified" || selectedIssue.status === "in-progress" || selectedIssue.status === "resolved"
                          ? "text-[#dbfcff]" 
                          : "text-[#424754]"
                      }`}>Verified</p>
                      <p className="text-[10px] text-[#b9cacb] mt-0.5">
                        {selectedIssue.upvotes >= 10 
                          ? "Verification threshold reached. Authenticated by community consensus." 
                          : `Citizen consensus pending (${selectedIssue.upvotes}/10 upvotes).`}
                      </p>
                    </div>
                  </div>

                  {/* Timeline Stage: In-Progress */}
                  <div className="relative">
                    <div className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-[#0b0e14] flex items-center justify-center ${
                      selectedIssue.status === "in-progress" || selectedIssue.status === "resolved"
                        ? "bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" 
                        : "bg-[#111c2d]"
                    }`}>
                      {(selectedIssue.status === "in-progress" || selectedIssue.status === "resolved") && (
                        <div className="w-1 h-1 bg-[#0b0e14] rounded-full" />
                      )}
                    </div>
                    <div className="text-xs">
                      <p className={`font-mono font-bold ${
                        selectedIssue.status === "in-progress" || selectedIssue.status === "resolved"
                          ? "text-[#dbfcff]" 
                          : "text-[#424754]"
                      }`}>In Progress</p>
                      <p className="text-[10px] text-[#b9cacb] mt-0.5">
                        {selectedIssue.status === "in-progress" || selectedIssue.status === "resolved"
                          ? selectedIssue.statusHistory?.find(h => h.status === "in-progress")?.note || "Crews dispatched or volunteer group mobilized."
                          : "Awaiting civic agency or volunteer group mobilization."}
                      </p>
                    </div>
                  </div>

                  {/* Timeline Stage: Resolved */}
                  <div className="relative">
                    <div className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-[#0b0e14] flex items-center justify-center ${
                      selectedIssue.status === "resolved"
                        ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                        : "bg-[#111c2d]"
                    }`}>
                      {selectedIssue.status === "resolved" && (
                        <div className="w-1 h-1 bg-[#0b0e14] rounded-full" />
                      )}
                    </div>
                    <div className="text-xs">
                      <p className={`font-mono font-bold ${
                        selectedIssue.status === "resolved"
                          ? "text-emerald-400" 
                          : "text-[#424754]"
                      }`}>Resolved</p>
                      <p className="text-[10px] text-[#b9cacb] mt-0.5">
                        {selectedIssue.status === "resolved"
                          ? selectedIssue.resolution?.explanation || "Issue resolved and validated by visual evidence."
                          : "Fix confirmation photo required from volunteers/agents."}
                      </p>
                      {selectedIssue.resolution && (
                        <div className="mt-2 h-20 w-32 rounded border border-emerald-500/30 overflow-hidden bg-black">
                          <img src={selectedIssue.resolution.imageUrl} alt="Resolution" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ACTION CENTER */}
              {selectedIssue.status !== "resolved" && (
                <div className="p-4 bg-[#111c2d] border border-[#3b494b]/30 rounded-xl space-y-4">
                  <h4 className="text-[10px] font-mono text-[#adc6ff] uppercase tracking-wide">Volunteer Action Console</h4>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpvote(selectedIssue.id)}
                      className="flex-1 py-2.5 bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/30 font-bold font-mono text-xs rounded transition-all active:scale-95 flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">thumb_up</span>
                      <span>VERIFY INCIDENT (+5 XP)</span>
                    </button>
                  </div>

                  {/* Resolution Photo Upload */}
                  <div className="border-t border-[#3b494b]/10 pt-3 space-y-2">
                    <label className="text-[9px] font-mono text-[#b9cacb] uppercase block">Submit Resolution Proof (+50 XP)</label>
                    <p className="text-[10px] text-[#849495] leading-relaxed">
                      Fixed this issue yourself? Upload a photo of the completed repair. Our AI will analyze it to verify the fix, close the issue, and award you +50 XP and a badge.
                    </p>
                    <div className="flex items-center gap-3 pt-1">
                      <label className="cursor-pointer py-2 px-3 bg-[#4d8eff] text-[#00285d] hover:bg-[#4d8eff]/90 font-bold font-mono text-xs rounded transition-all active:scale-95 inline-flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">upload_file</span>
                        <span>UPLOAD PROOF</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleResolutionUpload(e, selectedIssue)}
                          disabled={resolutionStatus === "uploading" || resolutionStatus === "analyzing"}
                        />
                      </label>
                      <span className="text-[10px] text-[#849495] font-mono">JPG/PNG of completed fix</span>
                    </div>

                    {/* Verification Status Feedback */}
                    {resolutionStatus !== "idle" && (
                      <div className={`mt-2 p-2.5 rounded border text-xs font-mono flex items-center gap-2 ${
                        resolutionStatus === "uploading" || resolutionStatus === "analyzing"
                          ? "bg-[#111c2d]/80 border-[#3b494b]/30 text-[#00f0ff] animate-pulse"
                          : resolutionStatus === "success"
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                      }`}>
                        {(resolutionStatus === "uploading" || resolutionStatus === "analyzing") && (
                          <div className="w-3.5 h-3.5 border border-t-transparent border-[#00f0ff] rounded-full animate-spin" />
                        )}
                        <span>{resolutionMessage}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* COMMENTS PANEL */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-mono text-[#adc6ff] uppercase tracking-wide">Community Discussion Board</h4>
                
                {/* List Comments */}
                <div className="space-y-3">
                  {!selectedIssue.comments || selectedIssue.comments.length === 0 ? (
                    <p className="text-[11px] text-[#849495] font-mono text-center py-2">No transmissions recorded in discussion channel.</p>
                  ) : (
                    selectedIssue.comments.map((comment) => (
                      <div key={comment.id} className="p-3 bg-[#111c2d]/40 rounded border border-[#3b494b]/10 text-xs space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="font-bold text-[#dbfcff]">{comment.user} <span className="text-[8px] text-[#adc6ff] font-normal px-1 bg-[#adc6ff]/10 rounded">{comment.role}</span></span>
                          <span className="text-[#849495]">{formatTimeAgo(comment.timestamp)}</span>
                        </div>
                        <p className="text-[#c2c6d6] leading-relaxed">{comment.text}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment Form */}
                <form onSubmit={(e) => handleCommentSubmit(e, selectedIssue.id!)} className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Share update or discuss repairs..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="flex-grow bg-[#111c2d] border border-[#3b494b]/30 focus:border-[#00f0ff] rounded px-3 py-2 text-xs text-[#e1e2eb] outline-none"
                  />
                  <button 
                    type="submit" 
                    className="px-3 bg-[#00f0ff] text-[#004f54] font-bold text-xs rounded hover:bg-[#00f0ff]/90 active:scale-95 transition-all"
                  >
                    SEND
                  </button>
                </form>
              </div>

            </div>
          </div>
        )}

        {/* Footer / Status Bar */}
        <footer className="mt-auto py-4 px-8 border-t border-[#3b494b]/20 flex justify-between items-center bg-[#0b0e14] z-40">
          <div className="flex gap-6">
            <span className="text-[10px] font-mono text-[#b9cacb]">Nodes: 1,402 Active</span>
            <span className="text-[10px] font-mono text-[#b9cacb]">Latency: 14ms</span>
          </div>
          <div className="text-[10px] font-mono text-[#00f0ff]/60">Community Hero Protocol v4.2.1-stable</div>
        </footer>
      </main>
    </div>
  );
}
