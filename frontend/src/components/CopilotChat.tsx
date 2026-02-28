"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Sparkles, FileText, BookOpen } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface Message {
    role: "user" | "assistant";
    content: string;
    type?: "search" | "bibtex" | "summary" | "text";
}

export function CopilotChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content: "Hi! I'm your **CosmosPapers Copilot Agent**.\n\nI can help you:\n• **Search papers** — _\"Find papers on adversarial attacks\"_\n• **Summarize papers** — _\"Summarize paper 12345\"_\n• **Generate BibTeX** — _\"Generate BibTeX for my bookmarks\"_\n\nWhat would you like to do?",
            type: "text",
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Listen for "Ask AI" clicks from PaperCard
    useEffect(() => {
        const handleCopilotSummarize = async (e: Event) => {
            const { paperId, title } = (e as CustomEvent).detail;
            setIsOpen(true);
            setMessages((prev) => [
                ...prev,
                { role: "user", content: `Summarize paper ${paperId}` },
            ]);
            setIsLoading(true);

            try {
                const res = await fetch(`${API_BASE}/api/copilot/summarize-pdf`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ paper_id: paperId, query: `Summarize the paper "${title}"` }),
                });
                const data = await res.json();
                if (data.detail) {
                    setMessages((prev) => [
                        ...prev,
                        { role: "assistant", content: `${data.detail}`, type: "text" },
                    ]);
                } else {
                    setMessages((prev) => [
                        ...prev,
                        { role: "assistant", content: data.summary || "Could not summarize.", type: "summary" },
                    ]);
                }
            } catch {
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: "Error connecting to the server.", type: "text" },
                ]);
            } finally {
                setIsLoading(false);
            }
        };

        window.addEventListener("copilotSummarize", handleCopilotSummarize);
        return () => window.removeEventListener("copilotSummarize", handleCopilotSummarize);
    }, []);

    // Listen for "BibTeX" clicks from PaperCard
    useEffect(() => {
        const handleCopilotBibtex = async (e: Event) => {
            const { paperId, title } = (e as CustomEvent).detail;
            setIsOpen(true);
            setMessages((prev) => [
                ...prev,
                { role: "user", content: `Generate BibTeX for "${title}"` },
            ]);
            setIsLoading(true);

            try {
                const res = await fetch(`${API_BASE}/api/copilot/generate-bibtex`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ paper_ids: [paperId] }),
                });
                const data = await res.json();
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: data.bibtex || "Could not generate BibTeX.", type: "bibtex" },
                ]);
            } catch {
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: "Error connecting to the server.", type: "text" },
                ]);
            } finally {
                setIsLoading(false);
            }
        };

        window.addEventListener("copilotBibtex", handleCopilotBibtex);
        return () => window.removeEventListener("copilotBibtex", handleCopilotBibtex);
    }, []);

    const parseIntent = (text: string) => {
        const lower = text.toLowerCase();
        if (lower.includes("bibtex") || lower.includes("bib tex") || lower.includes("citation") || lower.includes("bibliography")) {
            return "bibtex";
        }
        if (lower.includes("summarize") || lower.includes("summary") || lower.includes("explain paper") || lower.includes("what is paper")) {
            return "summary";
        }
        return "search";
    };

    const getBookmarkIds = (): string[] => {
        try {
            const stored = localStorage.getItem("paper_agg_bookmarks");
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);

        const intent = parseIntent(userMessage);

        try {
            if (intent === "bibtex") {
                const bookmarkIds = getBookmarkIds();
                if (bookmarkIds.length === 0) {
                    setMessages((prev) => [
                        ...prev,
                        { role: "assistant", content: "You don't have any bookmarked papers yet. Bookmark some papers first, then ask me to generate BibTeX.", type: "text" },
                    ]);
                } else {
                    const res = await fetch(`${API_BASE}/api/copilot/generate-bibtex`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ paper_ids: bookmarkIds }),
                    });
                    const data = await res.json();
                    setMessages((prev) => [
                        ...prev,
                        { role: "assistant", content: data.bibtex || "Could not generate BibTeX.", type: "bibtex" },
                    ]);
                }
            } else if (intent === "summary") {
                // Extract paper ID from the message
                const idMatch = userMessage.match(/\d+/);
                if (!idMatch) {
                    // No paper ID — list bookmarked papers so user can pick
                    const bookmarkIds = getBookmarkIds();
                    if (bookmarkIds.length > 0) {
                        try {
                            const res = await fetch(`${API_BASE}/api/papers/batch`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ ids: bookmarkIds }),
                            });
                            const data = await res.json();
                            if (data.papers && data.papers.length > 0) {
                                let content = `Here are your **bookmarked papers**. Tell me which one to summarize by saying its ID:\n\n`;
                                data.papers.forEach((p: { id: string; title: string; conference: string; year: number }, i: number) => {
                                    content += `**${i + 1}.** ${p.title}\n${p.conference} ${p.year} · ID: \`${p.id}\`\n\n`;
                                });
                                content += `_Say "Summarize paper \`ID\`" to get a summary._`;
                                setMessages((prev) => [...prev, { role: "assistant", content, type: "text" }]);
                            } else {
                                setMessages((prev) => [
                                    ...prev,
                                    { role: "assistant", content: "Please include a paper ID, e.g., _\"Summarize paper 44827\"_\n\n_You can find paper IDs in search results or on your bookmarks page._", type: "text" },
                                ]);
                            }
                        } catch {
                            setMessages((prev) => [
                                ...prev,
                                { role: "assistant", content: "Please include a paper ID, e.g., _\"Summarize paper 44827\"_", type: "text" },
                            ]);
                        }
                    } else {
                        setMessages((prev) => [
                            ...prev,
                            { role: "assistant", content: "Please include a paper ID, e.g., _\"Summarize paper 44827\"_\n\n_Search for papers first, then use the ID shown in the results._", type: "text" },
                        ]);
                    }
                } else {
                    const res = await fetch(`${API_BASE}/api/copilot/summarize-pdf`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ paper_id: idMatch[0], query: userMessage }),
                    });
                    const data = await res.json();
                    if (data.detail) {
                        setMessages((prev) => [
                            ...prev,
                            { role: "assistant", content: `${data.detail}`, type: "text" },
                        ]);
                    } else {
                        setMessages((prev) => [
                            ...prev,
                            { role: "assistant", content: data.summary || "Could not summarize.", type: "summary" },
                        ]);
                    }
                }
            } else {
                // Search
                const res = await fetch(`${API_BASE}/api/copilot/search`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query: userMessage, limit: 5 }),
                });
                const data = await res.json();
                if (data.papers && data.papers.length > 0) {
                    let content = `Found **${data.papers.length} papers** matching your query:\n\n`;
                    data.papers.forEach((p: { id: string; title: string; authors: string; conference: string; year: number }, i: number) => {
                        content += `**${i + 1}. ${p.title}**\n`;
                        content += `_${p.authors}_\n`;
                        content += `${p.conference} ${p.year} · ID: \`${p.id}\`\n\n`;
                    });
                    content += `_Tip: Say "Summarize paper ${data.papers[0].id}" to read the full paper._`;
                    setMessages((prev) => [...prev, { role: "assistant", content, type: "search" }]);
                } else {
                    setMessages((prev) => [
                        ...prev,
                        { role: "assistant", content: "No matching papers found. Try a different query!", type: "text" },
                    ]);
                }
            }
        } catch (error) {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: `Error connecting to the server. Please try again.`, type: "text" },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    // Simple markdown-like rendering
    const renderContent = (content: string) => {
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code style="background:#1e293b;padding:2px 6px;border-radius:4px;font-size:0.85em">$1</code>')
            .replace(/\n/g, '<br/>');
    };

    return (
        <>
            {/* Floating Chat Bubble - Copilot Logo */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: "fixed",
                    bottom: "24px",
                    right: "24px",
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "#000000",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "none",
                    zIndex: 9999,
                    transition: "transform 0.2s",
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.05)";
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                }}
            >
                {isOpen ? (
                    <X size={22} color="white" />
                ) : (
                    <img src="/copilot-logo.png" alt="Copilot" width={34} height={34} style={{ borderRadius: "4px" }} />
                )}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div
                    style={{
                        position: "fixed",
                        bottom: "96px",
                        right: "24px",
                        width: "420px",
                        maxWidth: "calc(100vw - 48px)",
                        height: "560px",
                        maxHeight: "calc(100vh - 120px)",
                        background: "#000000",
                        border: "1px solid #222222",
                        borderRadius: "16px",
                        display: "flex",
                        flexDirection: "column",
                        zIndex: 9998,
                        boxShadow: "0 8px 48px rgba(0,0,0,0.5)",
                        overflow: "hidden",
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            padding: "16px 20px",
                            background: "#111111",
                            borderBottom: "1px solid #222222",
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                        }}
                    >
                        <img src="/copilot-logo.png" alt="Copilot" width={36} height={36} style={{ borderRadius: "10px" }} />
                        <div>
                            <div style={{ fontWeight: 600, fontSize: "14px", color: "#e2e8f0" }}>
                                CosmosPapers Copilot Agent
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>
                                Powered by Microsoft Copilot
                            </div>
                        </div>
                    </div>

                    {/* Messages */}
                    <div
                        style={{
                            flex: 1,
                            overflowY: "auto",
                            padding: "16px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                        }}
                    >
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                style={{
                                    display: "flex",
                                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                                }}
                            >
                                <div
                                    style={{
                                        maxWidth: "85%",
                                        padding: "10px 14px",
                                        borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                                        background: msg.role === "user"
                                            ? "linear-gradient(135deg, #3b82f6, #2563eb)"
                                            : "#1a1a1a",
                                        color: "#e2e8f0",
                                        fontSize: "13px",
                                        lineHeight: "1.6",
                                        border: msg.role === "assistant" ? "1px solid #333333" : "none",
                                    }}
                                    dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }}
                                />
                            </div>
                        ))}

                        {isLoading && (
                            <div style={{ display: "flex", justifyContent: "flex-start" }}>
                                <div
                                    style={{
                                        padding: "10px 14px",
                                        borderRadius: "14px 14px 14px 4px",
                                        background: "#1a1a1a",
                                        border: "1px solid #333333",
                                        color: "#64748b",
                                        fontSize: "13px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                    }}
                                >
                                    <div className="animate-pulse" style={{ display: "flex", gap: "4px" }}>
                                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", animation: "bounce 1.4s infinite ease-in-out", animationDelay: "0s" }} />
                                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", animation: "bounce 1.4s infinite ease-in-out", animationDelay: "0.2s" }} />
                                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", animation: "bounce 1.4s infinite ease-in-out", animationDelay: "0.4s" }} />
                                    </div>
                                    Thinking...
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Action Buttons */}
                    <div
                        style={{
                            padding: "8px 16px",
                            display: "flex",
                            gap: "6px",
                            borderTop: "1px solid #222222",
                        }}
                    >
                        <button
                            onClick={() => { setInput("Find papers on "); }}
                            style={{
                                padding: "4px 10px",
                                borderRadius: "8px",
                                background: "#1a1a1a",
                                border: "1px solid #333333",
                                color: "#94a3b8",
                                fontSize: "11px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                            }}
                        >
                            Search
                        </button>
                        <button
                            onClick={() => {
                                setInput("Summarize my bookmarked papers");
                                setTimeout(() => {
                                    const btn = document.getElementById("copilot-send-btn");
                                    if (btn) btn.click();
                                }, 100);
                            }}
                            style={{
                                padding: "4px 10px",
                                borderRadius: "8px",
                                background: "#1e293b",
                                border: "1px solid #334155",
                                color: "#94a3b8",
                                fontSize: "11px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                            }}
                        >
                            Summarize
                        </button>
                        <button
                            onClick={() => {
                                setInput("Generate BibTeX for my bookmarks");
                                // Auto-send
                                setTimeout(() => {
                                    const btn = document.getElementById("copilot-send-btn");
                                    if (btn) btn.click();
                                }, 100);
                            }}
                            style={{
                                padding: "4px 10px",
                                borderRadius: "8px",
                                background: "#1e293b",
                                border: "1px solid #334155",
                                color: "#94a3b8",
                                fontSize: "11px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                            }}
                        >
                            BibTeX
                        </button>
                    </div>

                    {/* Input Bar */}
                    <div
                        style={{
                            padding: "12px 16px",
                            borderTop: "1px solid #222222",
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                            background: "#111111",
                        }}
                    >
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                            placeholder="Ask about papers, summarize PDFs..."
                            style={{
                                flex: 1,
                                padding: "10px 14px",
                                borderRadius: "10px",
                                border: "1px solid #333333",
                                background: "#000000",
                                color: "#e2e8f0",
                                fontSize: "13px",
                                outline: "none",
                            }}
                            disabled={isLoading}
                        />
                        <button
                            id="copilot-send-btn"
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            style={{
                                width: "38px",
                                height: "38px",
                                borderRadius: "10px",
                                background: input.trim() ? "#ffffff" : "#1a1a1a",
                                border: "none",
                                cursor: input.trim() ? "pointer" : "not-allowed",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "background 0.2s",
                            }}
                        >
                            <Send size={16} color={input.trim() ? "#000000" : "#64748b"} />
                        </button>
                    </div>
                </div>
            )}

            {/* Bounce animation keyframes */}
            <style jsx global>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
        </>
    );
}
