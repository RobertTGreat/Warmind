import { NextResponse } from 'next/server';
import { getServerBungieApiKey } from '@/lib/serverBungie';

const BUNGIE_NEWS_URL = 'https://www.bungie.net/Platform/Content/Rss/NewsArticles/0/?includebody=true';
const DESTINY_ARTICLE_PATTERN = /destiny|this week in destiny|\btwid\b|\bd2[_-]|crucible|pantheon|monument of triumph|zavala|iron banner|guardian games|aotw|motw|lawless|renegades/i;
const MARATHON_ARTICLE_PATTERN = /marathon|runner|rook|night marsh|tau ceti|cyberacme|oni|uesc|warden hunt|cryo archive|sponsored kits|grenade stacks|overflow items/i;

type BungieNewsArticle = {
    Title?: string;
    Link?: string;
    PubDate?: string;
    UniqueIdentifier?: string;
    Description?: string;
    HtmlContent?: string;
    ImagePath?: string;
    OptionalMobileImagePath?: string;
};

function cleanText(text: string | null | undefined) {
    if (!text) return "";

    return text
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, "")
        .trim();
}

function sanitizeArticleHtml(htmlContent: string | null | undefined) {
    if (!htmlContent) return "";

    return htmlContent
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
        .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
        .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "")
        .replace(/<embed[\s\S]*?>/gi, "")
        .replace(/\s+on[a-z]+\s*=\s*(["']).*?\1/gi, "")
        .replace(/\s+style\s*=\s*(["']).*?\1/gi, "")
        .replace(/\s+(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, ' $1="#"')
        .replace(/\s+href\s*=\s*(["'])\/([^"']*)\1/gi, ' href="https://www.bungie.net/$2"')
        .replace(/\s+src\s*=\s*(["'])\/([^"']*)\1/gi, ' src="https://www.bungie.net/$2"')
        .trim();
}

function isMarathonArticle(article: BungieNewsArticle) {
    const articleMetadata = [
        article.Title,
        article.Link,
        article.Description,
        article.ImagePath,
        article.OptionalMobileImagePath,
    ].join(' ');

    return MARATHON_ARTICLE_PATTERN.test(articleMetadata);
}

function isDestinyArticle(article: BungieNewsArticle) {
    const articleText = [
        article.Title,
        article.Link,
        article.Description,
        article.ImagePath,
        article.OptionalMobileImagePath,
        article.HtmlContent,
    ].join(' ');

    return DESTINY_ARTICLE_PATTERN.test(articleText) && !isMarathonArticle(article);
}

export async function GET() {
    try {
        const apiKey = getServerBungieApiKey();

        if (!apiKey) {
            return NextResponse.json({ error: "Missing Bungie API key" }, { status: 500 });
        }

        const response = await fetch(BUNGIE_NEWS_URL, {
            headers: {
                'X-API-Key': apiKey,
            },
            next: { revalidate: 300 } // Cache for 5 minutes
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch Bungie news');
        }

        const data = await response.json();
        const articles: BungieNewsArticle[] = data?.Response?.NewsArticles ?? [];
        const items = articles
            .filter(isDestinyArticle)
            .map((article) => ({
                id: cleanText(article.UniqueIdentifier),
                title: cleanText(article.Title),
                link: cleanText(article.Link),
                pubDate: cleanText(article.PubDate),
                description: cleanText(article.Description),
                image: cleanText(article.OptionalMobileImagePath || article.ImagePath),
                htmlContent: sanitizeArticleHtml(article.HtmlContent),
            }));

        return NextResponse.json({ items });

    } catch (error) {
        console.error("RSS Fetch Error:", error);
        return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 });
    }
}

