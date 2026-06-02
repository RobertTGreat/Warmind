'use client';

import { useEffect, useState } from 'react';
import { Newspaper, ExternalLink, Calendar, Loader2, ChevronRight, ChevronLeft, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

interface NewsItem {
    id?: string;
    title: string;
    link: string;
    pubDate: string;
    description: string;
    image: string;
    htmlContent?: string;
}

function getArticleLink(link: string) {
    return link.startsWith('/') ? `https://www.bungie.net${link}` : link;
}

export function NewsFeed() {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [page, setPage] = useState(0);
    const [direction, setDirection] = useState(0);
    const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null);
    const itemsPerPage = 4;
    const maxItems = 24;

    useEffect(() => {
        async function fetchNews() {
            try {
                const res = await fetch('/api/rss');
                if (!res.ok) throw new Error('Failed to fetch');
                const data = await res.json();
                setNews(data.items || []);
            } catch (e) {
                console.error(e);
                setError(true);
            } finally {
                setLoading(false);
            }
        }

        fetchNews();
    }, []);

    useEffect(() => {
        if (!selectedArticle) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setSelectedArticle(null);
            }
        };

        window.addEventListener('keydown', closeOnEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', closeOnEscape);
        };
    }, [selectedArticle]);

    const paginate = (newDirection: number) => {
        setDirection(newDirection);
        setPage((prev) => prev + newDirection);
    };

    if (loading) {
        return (
            <div className="w-full flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full text-center text-red-400 py-10">
                Failed to load latest intel.
            </div>
        );
    }

    const limitedNews = news.slice(0, maxItems);
    const startIndex = page * itemsPerPage;
    const visibleNews = limitedNews.slice(startIndex, startIndex + itemsPerPage);
    const hasNext = startIndex + itemsPerPage < limitedNews.length;
    const hasPrev = page > 0;
    const selectedArticleLink = selectedArticle ? getArticleLink(selectedArticle.link) : '';

    return (
        <div className="space-y-4">
            {/* Header with Navigation Controls */}
            <div className="w-full flex justify-between items-end gap-2 pb-2 border-b border-white/10">
                <h2 className="text-2xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Newspaper className="w-6 h-6 text-destiny-gold" />
                    <p className="text-lg font-bold text-white uppercase tracking-wider">Latest Intel</p>
                </h2>
                
                <div className="flex items-center gap-4">
                    <div className="text-xs text-slate-500 uppercase tracking-wider hidden sm:block">
                        {startIndex + 1}-{Math.min(startIndex + itemsPerPage, limitedNews.length)} of {limitedNews.length}
                    </div>
                    <div className="flex gap-1">
                        <button 
                            onClick={() => paginate(-1)}
                            disabled={!hasPrev}
                            className="p-1 hover:bg-white/10 rounded text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            title="Previous"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={() => paginate(1)}
                            disabled={!hasNext}
                            className="p-1 hover:bg-white/10 rounded text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            title="Next"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 min-h-[300px] overflow-hidden">
                <AnimatePresence initial={false} mode="popLayout" custom={direction}>
                    {visibleNews.map((item, i) => {
                        return (
                            <motion.button
                                key={item.id || item.link}
                                type="button"
                                onClick={() => setSelectedArticle(item)}
                                custom={direction}
                                initial={{ opacity: 0, x: direction > 0 ? 100 : -100 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: direction > 0 ? -100 : 100 }}
                                transition={{ 
                                    duration: 0.4, 
                                    ease: [0.32, 0.72, 0, 1],
                                    delay: i * 0.05 
                                }}
                                className="group relative flex h-full flex-col overflow-hidden border border-white/5 text-left hover:border-white/20 transition-colors duration-300"
                            >
                                {/* Image */}
                                <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                                    {item.image ? (
                                        <Image 
                                            src={item.image} 
                                            alt={item.title}
                                            fill
                                            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                                            // First image on first page is LCP.
                                            preload={page === 0 && i === 0}
                                            fetchPriority={page === 0 && i === 0 ? "high" : "auto"}
                                            loading={page === 0 && i === 0 ? "eager" : "lazy"}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-700">
                                            <Newspaper className="w-12 h-12" />
                                        </div>
                                    )}
                                    
                                    {/* Overlay Date */}
                                    <div className="absolute bottom-0 left-0 w-full bg-linear-to-t from-black/90 to-transparent p-4 pt-8 flex items-end">
                                        <div className="flex items-center gap-2 text-xs font-medium text-amber-400 uppercase tracking-wider">
                                            <Calendar className="w-3 h-3" />
                                            {item.pubDate ? format(new Date(item.pubDate), 'MMM d, yyyy') : ''}
                                        </div>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex flex-col flex-1 p-5 gap-3">
                                    <h3 className="text-lg font-bold text-white leading-tight group-hover:text-amber-400 transition-colors line-clamp-2">
                                        {item.title}
                                    </h3>
                                    
                                    {item.description && (
                                        <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
                                            {item.description}
                                        </p>
                                    )}

                                    <div className="mt-auto pt-4 flex items-center text-xs font-bold text-slate-500 uppercase tracking-widest group-hover:text-white transition-colors">
                                        Read More <ChevronRight className="w-3 h-3 ml-2" />
                                    </div>
                                </div>
                            </motion.button>
                        )
                    })}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {selectedArticle && (
                    <motion.div
                        className="fixed inset-0 z-100 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedArticle(null)}
                    >
                        <motion.article
                            className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden border border-white/10 bg-[#11151c] shadow-2xl"
                            initial={{ opacity: 0, y: 24, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 24, scale: 0.98 }}
                            transition={{ duration: 0.2 }}
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs font-medium text-amber-400 uppercase tracking-wider">
                                        <Calendar className="w-3 h-3" />
                                        {selectedArticle.pubDate ? format(new Date(selectedArticle.pubDate), 'MMM d, yyyy') : ''}
                                    </div>
                                    <h2 className="text-2xl font-bold leading-tight text-white">
                                        {selectedArticle.title}
                                    </h2>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setSelectedArticle(null)}
                                    className="shrink-0 p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                                    title="Close"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="overflow-y-auto p-5">
                                {selectedArticle.htmlContent ? (
                                    <div
                                        className="news-article-body"
                                        dangerouslySetInnerHTML={{ __html: selectedArticle.htmlContent }}
                                    />
                                ) : (
                                    <p className="text-sm leading-relaxed text-slate-300">
                                        {selectedArticle.description}
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-end border-t border-white/10 p-4">
                                <a
                                    href={selectedArticleLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 transition-colors hover:text-white"
                                >
                                    Open on Bungie
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </div>
                        </motion.article>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
