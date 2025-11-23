import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const response = await fetch('https://www.bungie.net/en/rss/News', {
            next: { revalidate: 300 } // Cache for 5 minutes
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch RSS feed');
        }

        const xml = await response.text();
        
        // Simple Regex Parser for RSS Items
        // Captures: Title, Link, PubDate, Description, Image
        const items: any[] = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;

        while ((match = itemRegex.exec(xml)) !== null) {
            const itemContent = match[1];
            
            const getTag = (tag: string) => {
                const regex = new RegExp(`<${tag}>(.*?)<\/${tag}>`, 's');
                const m = itemContent.match(regex);
                return m ? m[1].trim() : null;
            };

            // Image is often in <image> or <description> as img tag
            // Bungie RSS has <image> tag
            const image = getTag('image') || getTag('mobile_image');
            
            // Remove CDATA if present
            const clean = (str: string | null) => {
                if (!str) return "";
                return str.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');
            };

            items.push({
                title: clean(getTag('title')),
                link: clean(getTag('link')),
                pubDate: clean(getTag('pubDate')),
                description: clean(getTag('description')),
                image: clean(image)
            });
        }

        return NextResponse.json({ items });

    } catch (error) {
        console.error("RSS Fetch Error:", error);
        return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 });
    }
}

