'use client';

import { useState, useRef, useEffect } from 'react';
import { useUserSearch, SearchUserResult } from '@/hooks/useUserSearch';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserSearchProps {
    onSelectUser: (membershipType: number, membershipId: string, displayName: string) => void;
    onClear: () => void;
    selectedUser: { membershipType: number; membershipId: string; displayName: string } | null;
}

export function UserSearch({ onSelectUser, onClear, selectedUser }: UserSearchProps) {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const { results, isLoading } = useUserSearch(query);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (user: SearchUserResult) => {
        const displayName = user.bungieGlobalDisplayName || user.displayName;
        onSelectUser(user.membershipType, user.membershipId, displayName);
        setQuery('');
        setIsOpen(false);
    };

    const handleClear = () => {
        setQuery('');
        setIsOpen(false);
        onClear();
    };

    return (
        <div ref={searchRef} className="relative w-full max-w-xs">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder={selectedUser ? selectedUser.displayName : "Search for a player..."}
                    className="w-full pl-10 pr-10 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-destiny-gold/50 focus:ring-1 focus:ring-destiny-gold/20"
                />
                {selectedUser && (
                    <button
                        onClick={handleClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded transition-colors"
                    >
                        <X className="w-4 h-4 text-slate-400" />
                    </button>
                )}
            </div>

            {isOpen && query.length >= 3 && (
                <div className="absolute top-full mt-2 w-full bg-slate-900 border border-white/10 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                    {isLoading ? (
                        <div className="p-4 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-destiny-gold" />
                            <span className="ml-2 text-sm text-slate-400">Searching...</span>
                        </div>
                    ) : results.length > 0 ? (
                        <div className="py-2">
                            {results.map((user, idx) => (
                                <button
                                    key={`${user.membershipId}-${user.membershipType}-${idx}`}
                                    onClick={() => handleSelect(user)}
                                    className="w-full px-4 py-2 text-left hover:bg-white/5 transition-colors"
                                >
                                    <div className="text-white font-medium">
                                        {user.bungieGlobalDisplayName || user.displayName}
                                        {user.bungieGlobalDisplayNameCode ? `#${user.bungieGlobalDisplayNameCode}` : ''}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        {user.membershipType === 1 ? 'Xbox' : user.membershipType === 2 ? 'PlayStation' : user.membershipType === 3 ? 'Steam' : 'Unknown'}
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : query.length >= 3 ? (
                        <div className="p-4 text-center text-slate-400 text-sm">No users found</div>
                    ) : null}
                </div>
            )}
        </div>
    );
}

