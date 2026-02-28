"use client";

import { Paper } from "../types";
import { ExternalLink, Download, Bookmark, Sparkles, BookOpen } from "lucide-react";
import { useBookmarks } from "../hooks/useBookmarks";

interface PaperCardProps {
    paper: Paper;
}

function getConferenceBadgeClass(conference: string): string {
    const conf = conference?.toUpperCase() || "";
    if (conf.includes("IEEE S&P") || conf.includes("IEEE SP")) return "badge-ieee-sp";
    if (conf.includes("ACM CCS") || conf.includes("CCS")) return "badge-acm-ccs";
    if (conf.includes("NDSS")) return "badge-ndss";
    if (conf.includes("USENIX")) return "badge-usenix";
    if (conf.includes("CVPR")) return "badge-cvpr";
    if (conf.includes("ICCV")) return "badge-iccv";
    if (conf.includes("ECCV")) return "badge-eccv";
    if (conf.includes("NEURIPS") || conf.includes("NIPS")) return "badge-neurips";
    if (conf.includes("ICML")) return "badge-icml";
    if (conf.includes("ICLR")) return "badge-iclr";
    if (conf.includes("IEEE VIS") || conf.includes("VIS")) return "badge-ieee-vis";
    return "badge-default";
}

export function PaperCard({ paper }: PaperCardProps) {
    const { isBookmarked, toggleBookmark, isMounted } = useBookmarks();
    const bookmarked = isMounted ? isBookmarked(paper.id.toString()) : false;

    const handleBookmarkClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        toggleBookmark(paper.id.toString());
    };

    const handleAskAI = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(
            new CustomEvent("copilotSummarize", { detail: { paperId: paper.id.toString(), title: paper.title } })
        );
    };

    const handleBibtex = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(
            new CustomEvent("copilotBibtex", { detail: { paperId: paper.id.toString(), title: paper.title } })
        );
    };

    return (
        <a
            href={paper.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-border/60 bg-bg-card transition-all duration-200 hover:bg-bg-card-hover hover:border-accent-blue/30 cursor-pointer relative"
            style={{ padding: '16px 20px', textDecoration: 'none' }}
        >
            {/* Title */}
            <h3 className="text-lg lg:text-xl font-semibold text-text-primary leading-snug pr-0 lg:pr-28" style={{ transition: 'color 0.15s' }}>
                {paper.title}
            </h3>

            {/* Action Buttons - desktop: absolute top-right; mobile: hidden here */}
            <div className="hidden lg:flex absolute top-4 right-4 z-10 items-center gap-1">
                <button
                    onClick={handleAskAI}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
                    title="Ask AI about this paper"
                >
                    <Sparkles
                        size={18}
                        className="text-accent-purple hover:text-accent-pink transition-colors duration-200"
                    />
                </button>
                <button
                    onClick={handleBibtex}
                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
                    title="Generate BibTeX for this paper"
                >
                    <BookOpen
                        size={18}
                        className="text-accent-cyan hover:text-accent-blue transition-colors duration-200"
                    />
                </button>
                <button
                    onClick={handleBookmarkClick}
                    className="p-2 -mr-2 rounded-full hover:bg-white/5 transition-colors"
                    title={bookmarked ? "Remove Bookmark" : "Bookmark Paper"}
                >
                    <Bookmark
                        size={22}
                        className={`transition-colors duration-200 ${bookmarked ? "fill-accent-blue text-accent-blue" : "text-text-secondary hover:text-white"}`}
                    />
                </button>
            </div>

            {/* Conference Badge + Year + Mobile Actions */}
            <div className="flex items-center gap-3 mt-4 flex-wrap">
                <span
                    className={`${getConferenceBadgeClass(paper.conference)} inline-block rounded-md text-sm font-bold tracking-wide`}
                    style={{ padding: '4px 6px' }}
                >
                    {paper.conference}
                </span>
                <span className="text-base text-text-secondary">{paper.year}</span>
                {paper.tags && (
                    <span
                        className="inline-block rounded-md text-xs font-bold tracking-wide"
                        style={{ padding: '3px 8px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}
                    >
                        {paper.tags}
                    </span>
                )}
                {paper.similarity && (
                    <span className="text-sm font-semibold text-accent-green">
                        {Math.round(paper.similarity)}% match
                    </span>
                )}

                {/* Mobile-only action buttons */}
                <div className="flex lg:hidden items-center gap-0 ml-auto">
                    <button
                        onClick={handleAskAI}
                        className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                        title="Ask AI about this paper"
                    >
                        <Sparkles size={16} className="text-accent-purple" />
                    </button>
                    <button
                        onClick={handleBibtex}
                        className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                        title="Generate BibTeX"
                    >
                        <BookOpen size={16} className="text-accent-cyan" />
                    </button>
                    <button
                        onClick={handleBookmarkClick}
                        className="p-1.5 rounded-full hover:bg-white/5 transition-colors"
                        title={bookmarked ? "Remove Bookmark" : "Bookmark Paper"}
                    >
                        <Bookmark
                            size={18}
                            className={`transition-colors duration-200 ${bookmarked ? "fill-accent-blue text-accent-blue" : "text-text-secondary"}`}
                        />
                    </button>
                </div>
            </div>

            {/* Authors */}
            <p className="mt-4 text-[15px] text-text-secondary leading-relaxed">
                {paper.authors}
            </p>
        </a>
    );
}
