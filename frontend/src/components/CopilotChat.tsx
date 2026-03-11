"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Sparkles, FileText, BookOpen, Settings } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface Message {
    role: "user" | "assistant";
    content: string;
    type?: "search" | "bibtex" | "summary" | "text" | "error";
}

const PROVIDERS = [
    { id: "nvidia", name: "NVIDIA NIM" },
    { id: "microsoft", name: "Microsoft AI Foundry" }
];

const MODELS: Record<string, { id: string, name: string }[]> = {
    "nvidia": [
        { id: "nvidia/meta/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct" },
        { id: "nvidia/nvidia/llama-3.1-nemotron-70b-instruct", name: "Nemotron 70B Instruct" },
        { id: "nvidia/meta/llama-3.1-405b-instruct", name: "Llama 3.1 405B" },
        { id: "nvidia/microsoft/phi-4", name: "Phi-4" },
        { id: "nvidia/nvidia/usdcode-llama3-70b-instruct", name: "USDCode Llama3 70B" },
        { id: "nvidia/meta/llama-3.2-3b-instruct", name: "Llama 3.2 3B Instruct" },
        { id: "nvidia/meta/llama-3.2-1b-instruct", name: "Llama 3.2 1B Instruct" }
    ],
    "microsoft": [
        { id: "github/gpt-4o", name: "GPT-4o" },
        { id: "github/o1", name: "o1" },
        { id: "github/phi-4", name: "Phi-4" },
        { id: "github/meta-llama-3-8b-instruct", name: "Llama-3-8B-Instruct" }
    ]
};

export function CopilotChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Settings state
    const [provider, setProvider] = useState("nvidia");
    const [model, setModel] = useState("gpt-4o-mini");
    const [apiKey, setApiKey] = useState("");

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

    // Load settings on mount
    useEffect(() => {
        const storedProvider = localStorage.getItem("copilot_provider");
        const storedModel = localStorage.getItem("copilot_model");
        const storedKey = localStorage.getItem("copilot_api_key");

        if (storedProvider) setProvider(storedProvider);
        if (storedModel) setModel(storedModel);
        if (storedKey) setApiKey(storedKey);

        // If no API key is set, automatically show settings when opened
        if (!storedKey) {
            setShowSettings(true);
        }
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, showSettings]);

    const saveSettings = () => {
        localStorage.setItem("copilot_provider", provider);
        localStorage.setItem("copilot_model", model);
        localStorage.setItem("copilot_api_key", apiKey.trim());
        setShowSettings(false);
    };

    const getHeaders = () => {
        return {
            "Content-Type": "application/json",
            "X-LLM-Provider": provider,
            "X-LLM-Model": model,
            "X-LLM-API-Key": apiKey.trim()
        };
    };

    const checkSettings = () => {
        if (!apiKey || !provider || !model) {
            setShowSettings(true);
            return false;
        }
        return true;
    };

    const formatErrorDetail = (detail: string | any) => {
        if (!detail) return "An unknown error occurred.";
        const str = typeof detail === 'string' ? detail : JSON.stringify(detail);
        
        // Exact match checking for error classes first
        if (str.includes("AuthenticationError") || str.includes("Incorrect API key") || str.includes("API key not valid") || str.includes("invalid api key")) {
            return "Invalid API Key. Please click the gear icon to check your settings and ensure your key is valid.";
        }
        if (str.includes("RateLimitError") || str.includes("exceeded your current quota") || str.includes("RESOURCE_EXHAUSTED") || str.includes("429 Too Many Requests")) {
            return "You have exceeded your API quota for this provider. Please check your plan and billing details.";
        }
        if (str.includes("NotFoundError") || str.includes("does not exist") || str.includes("model_not_found")) {
            return "The selected model is currently unavailable or doesn't exist. Please try another model in Settings.";
        }
        
        // Return a truncated version if it's a massive JSON dump
        if (str.length > 200) {
            return str.substring(0, 200) + "...";
        }
        return str;
    };

    // Listen for "Ask AI" clicks from PaperCard
    useEffect(() => {
        const handleCopilotSummarize = async (e: Event) => {
            const { paperId, title } = (e as CustomEvent).detail;
            setIsOpen(true);
            if (!checkSettings()) return;

            setMessages((prev) => [
                ...prev,
                { role: "user", content: `Summarize paper ${paperId}` },
            ]);
            setIsLoading(true);

            try {
                const res = await fetch(`${API_BASE}/api/copilot/summarize-pdf`, {
                    method: "POST",
                    headers: getHeaders(),
                    body: JSON.stringify({ paper_id: paperId, query: `Summarize the paper "${title}"` }),
                });
                const data = await res.json();
                if (res.status === 401) {
                    setMessages(prev => [...prev, { role: "assistant", content: `**Authentication Error:** ${formatErrorDetail(data.detail)}\n\nPlease check your settings.`, type: "error" }]);
                    setShowSettings(true);
                } else if (data.detail) {
                    setMessages((prev) => [...prev, { role: "assistant", content: `**Error:** ${formatErrorDetail(data.detail)}`, type: "error" }]);
                } else {
                    setMessages((prev) => [...prev, { role: "assistant", content: data.summary || "Could not summarize.", type: "summary" }]);
                }
            } catch {
                setMessages((prev) => [...prev, { role: "assistant", content: "Error connecting to the server.", type: "text" }]);
            } finally {
                setIsLoading(false);
            }
        };

        window.addEventListener("copilotSummarize", handleCopilotSummarize);
        return () => window.removeEventListener("copilotSummarize", handleCopilotSummarize);
    }, [provider, model, apiKey]);

    // Listen for "BibTeX" clicks from PaperCard
    useEffect(() => {
        const handleCopilotBibtex = async (e: Event) => {
            const { paperId, title } = (e as CustomEvent).detail;
            setIsOpen(true);
            if (!checkSettings()) return;

            setMessages((prev) => [
                ...prev,
                { role: "user", content: `Generate BibTeX for "${title}"` },
            ]);
            setIsLoading(true);

            try {
                const res = await fetch(`${API_BASE}/api/copilot/generate-bibtex`, {
                    method: "POST",
                    headers: getHeaders(),
                    body: JSON.stringify({ paper_ids: [paperId] }),
                });
                const data = await res.json();
                if (res.status === 401) {
                    setMessages(prev => [...prev, { role: "assistant", content: `**Authentication Error:** ${formatErrorDetail(data.detail)}\n\nPlease check your settings.`, type: "error" }]);
                    setShowSettings(true);
                } else if (data.detail) {
                    setMessages((prev) => [...prev, { role: "assistant", content: `**Error:** ${formatErrorDetail(data.detail)}`, type: "error" }]);
                } else {
                    setMessages((prev) => [...prev, { role: "assistant", content: data.bibtex || "Could not generate BibTeX.", type: "bibtex" }]);
                }
            } catch {
                setMessages((prev) => [...prev, { role: "assistant", content: "Error connecting to the server.", type: "text" }]);
            } finally {
                setIsLoading(false);
            }
        };

        window.addEventListener("copilotBibtex", handleCopilotBibtex);
        return () => window.removeEventListener("copilotBibtex", handleCopilotBibtex);
    }, [provider, model, apiKey]);

    const parseIntent = (text: string) => {
        const lower = text.toLowerCase();
        if (lower.includes("bibtex") || lower.includes("bib tex") || lower.includes("citation") || lower.includes("bibliography")) {
            return "bibtex";
        }
        if (lower.startsWith("summarize") || lower.startsWith("summary") || lower.startsWith("explain paper") || lower.startsWith("what is paper")) {
            return "summary";
        }
        if (lower.startsWith("find") || lower.startsWith("search") || lower.startsWith("look for")) {
            return "search";
        }
        return "chat";
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
        if (!checkSettings()) return;

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
                        headers: getHeaders(),
                        body: JSON.stringify({ paper_ids: bookmarkIds }),
                    });
                    const data = await res.json();
                    if (res.status === 401) {
                        setMessages(prev => [...prev, { role: "assistant", content: `**Authentication Error:** ${formatErrorDetail(data.detail)}\n\nPlease check your settings.`, type: "error" }]);
                        setShowSettings(true);
                    } else if (data.detail) {
                        setMessages((prev) => [...prev, { role: "assistant", content: `**Error:** ${formatErrorDetail(data.detail)}`, type: "error" }]);
                    } else {
                        setMessages((prev) => [...prev, { role: "assistant", content: data.bibtex || "Could not generate BibTeX.", type: "bibtex" }]);
                    }
                }
            } else if (intent === "summary") {
                // Extract paper ID from the message
                const idMatch = userMessage.match(/\d+/);
                if (!idMatch) {
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
                                setMessages((prev) => [...prev, { role: "assistant", content: "Please include a paper ID, e.g., _\"Summarize paper 44827\"_", type: "text" }]);
                            }
                        } catch {
                            setMessages((prev) => [...prev, { role: "assistant", content: "Please include a paper ID, e.g., _\"Summarize paper 44827\"_", type: "text" }]);
                        }
                    } else {
                        setMessages((prev) => [...prev, { role: "assistant", content: "Please include a paper ID, e.g., _\"Summarize paper 44827\"_\n\n_Search for papers first, then use the ID shown in the results._", type: "text" }]);
                    }
                } else {
                    const res = await fetch(`${API_BASE}/api/copilot/summarize-pdf`, {
                        method: "POST",
                        headers: getHeaders(),
                        body: JSON.stringify({ paper_id: idMatch[0], query: userMessage }),
                    });
                    const data = await res.json();
                    if (res.status === 401) {
                        setMessages(prev => [...prev, { role: "assistant", content: `**Authentication Error:** ${formatErrorDetail(data.detail)}\n\nPlease check your settings.`, type: "error" }]);
                        setShowSettings(true);
                    } else if (data.detail) {
                        setMessages((prev) => [...prev, { role: "assistant", content: `**Error:** ${formatErrorDetail(data.detail)}`, type: "error" }]);
                    } else {
                        setMessages((prev) => [...prev, { role: "assistant", content: data.summary || "Could not summarize.", type: "summary" }]);
                    }
                }
            } else if (intent === "search") {
                // Search
                const res = await fetch(`${API_BASE}/api/copilot/search`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" }, // Search doesn't currently require LLM in the backend if using pgvector, so headers are optional, but we can pass them.
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
            } else {
                // General Chat
                const chatHistory = messages
                    .filter(m => m.type !== "error" && m.type !== "search") // exclude search results and errors
                    .map(m => ({ role: m.role, content: m.content }));

                chatHistory.push({ role: "user", content: userMessage });

                const res = await fetch(`${API_BASE}/api/copilot/chat`, {
                    method: "POST",
                    headers: getHeaders(),
                    body: JSON.stringify({ messages: chatHistory }),
                });
                const data = await res.json();
                if (res.status === 401) {
                    setMessages(prev => [...prev, { role: "assistant", content: `**Authentication Error:** ${formatErrorDetail(data.detail)}\n\nPlease check your settings.`, type: "error" }]);
                    setShowSettings(true);
                } else if (data.reply) {
                    setMessages((prev) => [...prev, { role: "assistant", content: data.reply, type: "text" }]);
                } else if (data.detail) {
                    setMessages((prev) => [...prev, { role: "assistant", content: `**Error:** ${formatErrorDetail(data.detail)}`, type: "error" }]);
                } else {
                    setMessages((prev) => [...prev, { role: "assistant", content: "I'm sorry, I couldn't process that response.", type: "error" }]);
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
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen && !apiKey) setShowSettings(true);
                }}
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
                            justifyContent: "space-between",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <img src="/copilot-logo.png" alt="Copilot" width={36} height={36} style={{ borderRadius: "10px" }} />
                            <div>
                                <div style={{ fontWeight: 600, fontSize: "14px", color: "#e2e8f0" }}>
                                    CosmosPapers Copilot Agent
                                </div>
                                <div style={{ fontSize: "11px", color: "#64748b" }}>
                                    {apiKey ? `Using ${MODELS[provider]?.find(m => m.id === model)?.name || model}` : "Setup Required"}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            style={{
                                background: "none", border: "none", cursor: "pointer",
                                color: showSettings ? "#3b82f6" : "#64748b", padding: "4px"
                            }}
                            title="LLM Settings"
                        >
                            <Settings size={18} />
                        </button>
                    </div>

                    {showSettings ? (
                        /* Settings View */
                        <div style={{ flex: 1, padding: "24px", overflowY: "auto", background: "#0a0a0a" }}>
                            <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", color: "#e2e8f0" }}>LLM Configuration</h3>
                            <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "24px", lineHeight: "1.5" }}>
                                Choose an AI provider and enter your API key to use Copilot features like PDF Summarization and BibTeX generation. Your key is stored locally in your browser and never saved on our servers.
                            </p>

                            <div style={{ marginBottom: "16px" }}>
                                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#cbd5e1", marginBottom: "8px" }}>Provider</label>
                                <select
                                    value={provider}
                                    onChange={(e) => {
                                        setProvider(e.target.value);
                                        setModel(MODELS[e.target.value][0].id); // Auto-select first model of new provider
                                    }}
                                    style={{ width: "100%", padding: "10px", background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", color: "#fff", outline: "none" }}
                                >
                                    {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>

                            <div style={{ marginBottom: "16px" }}>
                                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#cbd5e1", marginBottom: "8px" }}>Model</label>
                                <select
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    style={{ width: "100%", padding: "10px", background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", color: "#fff", outline: "none" }}
                                >
                                    {MODELS[provider]?.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>

                            <div style={{ marginBottom: "24px" }}>
                                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#cbd5e1", marginBottom: "8px" }}>API Key</label>
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder={provider === "openai" ? "sk-..." : provider === "anthropic" ? "sk-ant-..." : "Paste your API key"}
                                    style={{ width: "100%", padding: "10px", background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", color: "#fff", outline: "none" }}
                                />
                                <p style={{ fontSize: "11px", color: "#64748b", marginTop: "8px", fontStyle: "italic" }}>
                                    {provider === "nvidia" && <>Get your free API key at <a href="https://build.nvidia.com" target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6", textDecoration: "none" }}>build.nvidia.com</a></>}
                                    {provider === "microsoft" && <>Get your free API key at <a href="https://ai.azure.com/" target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6", textDecoration: "none" }}>ai.azure.com</a></>}
                                </p>
                            </div>

                            <button
                                onClick={saveSettings}
                                disabled={!apiKey.trim()}
                                style={{
                                    width: "100%", padding: "12px", background: apiKey.trim() ? "#3b82f6" : "#1e293b",
                                    color: apiKey.trim() ? "#fff" : "#64748b", border: "none", borderRadius: "8px",
                                    fontWeight: 600, cursor: apiKey.trim() ? "pointer" : "not-allowed", transition: "0.2s"
                                }}
                            >
                                Save & Continue
                            </button>

                            {localStorage.getItem("copilot_api_key") && (
                                <button
                                    onClick={() => {
                                        setApiKey("");

                                        localStorage.removeItem("copilot_api_key");
                                    }}
                                    style={{
                                        width: "100%", padding: "12px", background: "transparent", marginTop: "8px",
                                        color: "#ef4444", border: "1px solid #7f1d1d", borderRadius: "8px",
                                        fontWeight: 500, cursor: "pointer"
                                    }}
                                >
                                    Clear Saved Key
                                </button>
                            )}
                        </div>
                    ) : (
                        /* Chat View */
                        <>
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
                                                    : msg.type === "error" ? "#450a0a" : "#1a1a1a",
                                                color: msg.type === "error" ? "#fca5a5" : "#e2e8f0",
                                                fontSize: "13px",
                                                lineHeight: "1.6",
                                                border: msg.role === "assistant" && msg.type !== "error" ? "1px solid #333333" :
                                                    msg.type === "error" ? "1px solid #7f1d1d" : "none",
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
                                            Generating...
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
                        </>
                    )}
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
