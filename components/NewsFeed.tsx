'use client';

import { useEffect, useState } from 'react';
import { Newspaper, ExternalLink, Calendar, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface NewsItem {
    title: string;
    link: string;
    pubDate: string;
    description: string;
    image: string;
}

export function NewsFeed() {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [page, setPage] = useState(0);
    const [direction, setDirection] = useState(0);
    const itemsPerPage = 5;

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

    const startIndex = page * itemsPerPage;
    const visibleNews = news.slice(startIndex, startIndex + itemsPerPage);
    const hasNext = startIndex + itemsPerPage < news.length;
    const hasPrev = page > 0;

    return (
        <div className="space-y-4">
            {/* Header with Navigation Controls */}
            <div className="w-full flex justify-between items-end gap-2 pb-2 border-b border-white/10">
                <h2 className="text-2xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Newspaper className="w-6 h-6 text-destiny-gold" />
                    Latest Intel
                </h2>
                
                <div className="flex items-center gap-4">
                    <div className="text-xs text-slate-500 uppercase tracking-wider hidden sm:block">
                        {startIndex + 1}-{Math.min(startIndex + itemsPerPage, news.length)} of {news.length}
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
            <div className="w-full grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 min-h-[300px] overflow-hidden">
                <AnimatePresence initial={false} mode="popLayout" custom={direction}>
                    {visibleNews.map((item, i) => {
                        // Handle Bungie relative links
                        const link = item.link.startsWith('/') ? `https://www.bungie.net${item.link}` : item.link;
                        
                        return (
                            <motion.a 
                                key={item.link} 
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                custom={direction}
                                initial={{ opacity: 0, x: direction > 0 ? 100 : -100 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: direction > 0 ? -100 : 100 }}
                                transition={{ 
                                    duration: 0.4, 
                                    ease: [0.32, 0.72, 0, 1],
                                    delay: i * 0.05 
                                }}
                                className="group relative flex flex-col overflow-hidden border border-white/5 hover:border-white/20 transition-colors duration-300 bg-gray-900/40 h-full"
                            >
                                {/* Image */}
                                <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                                    {item.image ? (
                                        <img 
                                            src={item.image} 
                                            alt={item.title}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
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
                                    <h3 
                                        className="text-lg font-bold text-white leading-tight group-hover:text-amber-400 transition-colors line-clamp-2"
                                        dangerouslySetInnerHTML={{ __html: item.title }}
                                    />
                                    
                                    {item.description && (
                                        <p 
                                            className="text-sm text-slate-400 line-clamp-2 leading-relaxed"
                                            dangerouslySetInnerHTML={{ __html: item.description }}
                                        />
                                    )}

                                    <div className="mt-auto pt-4 flex items-center text-xs font-bold text-slate-500 uppercase tracking-widest group-hover:text-white transition-colors">
                                        Read More <ExternalLink className="w-3 h-3 ml-2" />
                                    </div>
                                </div>
                            </motion.a>
                        )
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
}
