'use client';

import { useEffect, useState } from 'react';
import { Newspaper, ExternalLink, Calendar, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

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

    return (
        <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.slice(0, 3).map((item, i) => {
                // Handle Bungie relative links
                const link = item.link.startsWith('/') ? `https://www.bungie.net${item.link}` : item.link;
                
                return (
                    <a 
                        key={i} 
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative flex flex-col overflow-hidden border border-white/5 hover:border-white/20 transition-all duration-300"
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
                            <h3 className="text-lg font-bold text-white leading-tight group-hover:text-amber-400 transition-colors">
                                {item.title}
                            </h3>
                            
                            {item.description && (
                                <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
                                    {item.description}
                                </p>
                            )}

                            <div className="mt-auto pt-4 flex items-center text-xs font-bold text-slate-500 uppercase tracking-widest group-hover:text-white transition-colors">
                                Read More <ExternalLink className="w-3 h-3 ml-2" />
                            </div>
                        </div>
                    </a>
                )
            })}
        </div>
    );
}

