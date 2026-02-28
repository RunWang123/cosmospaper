"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { PaperCard } from "@/components/PaperCard";
import { Paper } from "@/types";
import { useBookmarks } from "@/hooks/useBookmarks";
import { Loader2, Bookmark, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export default function BookmarksPage() {
    const { bookmarks, isMounted } = useBookmarks();

    const [savedPapers, setSavedPapers] = useState<Paper[]>([]);
    const [recommendedPapers, setRecommendedPapers] = useState<Paper[]>([]);
    const [loadingSaved, setLoadingSaved] = useState(false);
    const [loadingRecs, setLoadingRecs] = useState(false);
    const [showRecommendations, setShowRecommendations] = useState(false);
    const [hasFetchedRecs, setHasFetchedRecs] = useState(false);

    const fetchSavedPapers = async () => {
        if (!isMounted || bookmarks.length === 0) {
            setSavedPapers([]);
            return;
        }
        setLoadingSaved(true);
        try {
            const body = JSON.stringify({ ids: bookmarks });
            const res = await fetch(`${API_BASE}/api/papers/batch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body
            });
            if (res.ok) {
                const data = await res.json();
                setSavedPapers(data.papers || []);
            }
        } catch (error) {
            console.error("Error fetching saved papers:", error);
        } finally {
            setLoadingSaved(false);
        }
    };

    const fetchRecommendations = async () => {
        if (!isMounted || bookmarks.length === 0) {
            setRecommendedPapers([]);
            return;
        }
        setLoadingRecs(true);
        try {
            const res = await fetch(`${API_BASE}/api/recommendations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: bookmarks })
            });
            if (res.ok) {
                const data = await res.json();
                setRecommendedPapers(data.papers || []);
            }
        } catch (error) {
            console.error("Error fetching recommendations:", error);
        } finally {
            setLoadingRecs(false);
        }
    };

    useEffect(() => {
        fetchSavedPapers();
        setHasFetchedRecs(false);
        if (showRecommendations) {
            fetchRecommendations();
            setHasFetchedRecs(true);
        }
    }, [bookmarks, isMounted]);

    const handleToggleRecommendations = () => {
        if (!showRecommendations && !hasFetchedRecs && bookmarks.length > 0) {
            fetchRecommendations();
            setHasFetchedRecs(true);
        }
        setShowRecommendations(!showRecommendations);
    };

    if (!isMounted) return null;

    return (
        <div className="min-h-screen bg-bg-primary text-text-primary font-sans flex flex-col">
            <Navbar onRefresh={fetchSavedPapers} />

            <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 lg:px-8 py-6 lg:py-8 flex flex-col items-center">

                {/* Header */}
                <div className="w-full text-center mt-6 lg:mt-12 mb-8 lg:mb-16 space-y-4">
                    <div className="inline-flex items-center justify-center p-4 bg-accent-blue/10 rounded-2xl mb-4">
                        <Bookmark size={40} className="text-accent-blue" />
                    </div>
                    <h2 className="text-2xl md:text-2xl font-bold tracking-tight text-white mb-4">
                        Your Reading List
                    </h2>
                    {/* <p className="text-lg text-text-muted max-w-2xl mx-auto">
                        Papers you've saved directly to your browser cache.
                    </p> */}
                </div>

                <div className="w-full max-w-[1120px] flex flex-col gap-16 pb-24">

                    {/* Bookmarked Papers Section */}
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border/50">
                            <Bookmark size={24} className="text-accent-blue fill-accent-blue/20" />
                            <h3 className="text-2xl font-bold text-white">Saved Papers</h3>
                            <span className="ml-2 bg-border text-text-secondary px-3 py-1 rounded-full text-sm font-medium">
                                {bookmarks.length}
                            </span>
                        </div>

                        {loadingSaved ? (
                            <div className="flex justify-center p-12">
                                <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
                            </div>
                        ) : savedPapers.length > 0 ? (
                            <div className="flex flex-col gap-8">
                                {savedPapers.map(paper => (
                                    <PaperCard key={`saved-${paper.id}`} paper={paper} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center p-16 border border-dashed border-border rounded-xl">
                                <p className="text-text-secondary text-lg">No papers saved yet.</p>
                                <p className="text-text-muted mt-2">Click the bookmark icon on any paper to add it here.</p>
                                <a href="/" className="mt-6 inline-block bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-lg font-medium transition-colors border border-white/10">
                                    Browse Papers
                                </a>
                            </div>
                        )}
                    </div>

                    {/* Recommendations Section */}
                    <div className="flex flex-col mt-4">
                        <button
                            onClick={handleToggleRecommendations}
                            className="flex items-center justify-between w-full pb-4 border-b border-border/50 hover:bg-white/5 transition-colors rounded-t-lg px-4 pt-4 -mx-4 text-left"
                        >
                            <div className="flex flex-col">
                                <div className="flex items-center gap-3 mb-2">
                                    <Sparkles size={24} className="text-accent-purple" />
                                    <h3 className="text-2xl font-bold text-white">Recommended</h3>
                                </div>
                                <p className="text-sm text-text-muted">
                                    Based on the semantic similarity of your current bookmarks
                                </p>
                            </div>
                            <div className="text-text-secondary">
                                {showRecommendations ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                            </div>
                        </button>

                        {showRecommendations && (
                            <div className="mt-8">
                                {bookmarks.length === 0 ? (
                                    <div className="text-center p-8 bg-bg-secondary border border-border/50 rounded-2xl">
                                        <p className="text-text-secondary mb-2">Build your library first.</p>
                                        <p className="text-sm text-text-muted">
                                            Save a few papers, and our AI will analyze their embeddings to recommend similar research.
                                        </p>
                                    </div>
                                ) : loadingRecs ? (
                                    <div className="flex justify-center p-12">
                                        <Loader2 className="w-8 h-8 animate-spin text-accent-purple" />
                                    </div>
                                ) : recommendedPapers.length > 0 ? (
                                    <div className="flex flex-col gap-8">
                                        {recommendedPapers.map(paper => (
                                            <PaperCard key={`rec-${paper.id}`} paper={paper} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center p-8 bg-bg-secondary border border-border/50 rounded-2xl">
                                        <p className="text-text-secondary">No recommendations found.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

            </main>
        </div>
    );
}
