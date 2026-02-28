import { useState, useEffect } from 'react';

const BOOKMARKS_KEY = 'paper_agg_bookmarks';

export function useBookmarks() {
    const [bookmarks, setBookmarks] = useState<string[]>([]);
    // isMounted helps avoid hydration mismatches in Next.js Server Components
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const stored = localStorage.getItem(BOOKMARKS_KEY);
        if (stored) {
            try {
                setBookmarks(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse bookmarks from localStorage", e);
            }
        }

        // Handle updates across different browser tabs
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === BOOKMARKS_KEY && e.newValue) {
                try {
                    setBookmarks(JSON.parse(e.newValue));
                } catch {
                    // Ignore parsing errors from other tabs
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const toggleBookmark = (paperId: string) => {
        setBookmarks(prev => {
            let newBookmarks;
            if (prev.includes(paperId)) {
                // Remove bookmark
                newBookmarks = prev.filter(id => id !== paperId);
            } else {
                // Add bookmark
                newBookmarks = [...prev, paperId];
            }

            // Persist to local storage
            localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(newBookmarks));

            // Dispatch a custom event to sync other components in the same tab
            window.dispatchEvent(new Event('bookmarksUpdated'));

            return newBookmarks;
        });
    };

    // Listen for custom dispatch events to sync components in the same window
    useEffect(() => {
        const handleLocalUpdate = () => {
            const stored = localStorage.getItem(BOOKMARKS_KEY);
            if (stored) {
                try {
                    setBookmarks(JSON.parse(stored));
                } catch {
                    // Ignore
                }
            }
        };
        window.addEventListener('bookmarksUpdated', handleLocalUpdate);
        return () => window.removeEventListener('bookmarksUpdated', handleLocalUpdate);
    }, []);

    const isBookmarked = (paperId: string) => bookmarks.includes(paperId);

    return { bookmarks, toggleBookmark, isBookmarked, isMounted };
}
