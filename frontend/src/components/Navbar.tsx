"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";

interface NavbarProps {
    onRefresh: () => void;
}

export function Navbar({ onRefresh }: NavbarProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await onRefresh();
        setTimeout(() => setIsRefreshing(false), 2000);
    };

    return (
        <nav
            className="bg-bg-secondary"
            style={{
                borderBottom: '1px solid rgba(51, 65, 85, 0.6)',
            }}
        >
            <div
                className="flex items-center justify-between px-4 py-3 lg:px-8 lg:py-4"
                style={{ maxWidth: '1400px', margin: '0 auto' }}
            >
                {/* Logo + Title */}
                <div className="flex items-center" style={{ gap: '10px' }}>
                    <img src="/cosmospaper-logo.png" alt="CosmosPapers" className="w-8 h-8 lg:w-9 lg:h-9" style={{ borderRadius: '10px' }} />
                    <div>
                        <h1
                            className="text-text-primary text-base lg:text-lg"
                            style={{
                                fontWeight: 700,
                                letterSpacing: '-0.02em',
                                lineHeight: 1.2,
                            }}
                        >
                            CosmosPapers
                        </h1>
                        <p
                            className="text-text-muted hidden sm:block"
                            style={{ fontSize: '11px', letterSpacing: '0.02em' }}
                        >
                            The Universe of Research
                        </p>
                    </div>
                </div>

                {/* Right actions */}
                <div className="flex items-center gap-1.5 lg:gap-2.5">
                    <a
                        href="/bookmarks"
                        className="text-text-secondary hover:text-text-primary transition-colors"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(51, 65, 85, 0.5)',
                            fontSize: '13px',
                        }}
                    >
                        <svg style={{ width: '15px', height: '15px', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                        <span className="hidden md:inline">Bookmarks</span>
                    </a>
                    <a
                        href="/trends"
                        className="text-text-secondary hover:text-text-primary transition-colors"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(51, 65, 85, 0.5)',
                            fontSize: '13px',
                        }}
                    >
                        <svg style={{ width: '15px', height: '15px', flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                        <span className="hidden md:inline">Trends</span>
                    </a>
                    <a
                        href="https://github.com/RunWang123/cosmospaper"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-text-secondary hover:text-text-primary transition-colors"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(51, 65, 85, 0.5)',
                            fontSize: '13px',
                        }}
                    >
                        <svg style={{ width: '15px', height: '15px', flexShrink: 0 }} fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                        <span className="hidden md:inline">GitHub</span>
                    </a>
                    <a
                        href="https://discord.gg/jumjZZVB"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-text-secondary hover:text-text-primary transition-colors"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(51, 65, 85, 0.5)',
                            fontSize: '13px',
                        }}
                    >
                        <svg style={{ width: '15px', height: '15px', flexShrink: 0 }} fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286z" /></svg>
                        <span className="hidden md:inline">Discord</span>
                    </a>
                    <button
                        onClick={handleRefresh}
                        className="transition-colors"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'linear-gradient(135deg, #22c55e, #10b981)',
                            padding: '7px 10px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'black',
                            border: 'none',
                            cursor: 'pointer',
                        }}
                    >
                        <RefreshCw
                            style={{ width: '14px', height: '14px', flexShrink: 0 }}
                            className={isRefreshing ? "animate-spin" : ""}
                        />
                        <span className="hidden sm:inline">Update</span>
                    </button>
                </div>
            </div>
        </nav>
    );
}
