export type WishListMatchType = 'exact' | 'partial' | 'item' | 'none';

export function getWishListMatchTextClass(matchType: WishListMatchType): string {
    if (matchType === 'exact') {
        return 'text-destiny-gold';
    }

    if (matchType === 'partial') {
        return 'text-purple-400';
    }

    if (matchType === 'item') {
        return 'text-blue-400';
    }

    return 'text-slate-400';
}

export function getWishListMatchBorderClass(matchType: WishListMatchType): string {
    if (matchType === 'exact') {
        return 'border-destiny-gold/30';
    }

    if (matchType === 'partial') {
        return 'border-purple-500/30';
    }

    if (matchType === 'item') {
        return 'border-blue-500/30';
    }

    return 'border-white/10';
}
