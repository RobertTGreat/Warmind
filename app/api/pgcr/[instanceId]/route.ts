import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ instanceId: string }> }
) {
    const { instanceId } = await params;
    const apiKey = process.env.NEXT_PUBLIC_BUNGIE_API_KEY;

    if (!apiKey) {
        console.error("Missing NEXT_PUBLIC_BUNGIE_API_KEY environment variable");
        return NextResponse.json({ error: 'Server configuration error: API Key missing' }, { status: 500 });
    }

    if (!instanceId) {
        return NextResponse.json({ error: 'Missing instanceId' }, { status: 400 });
    }

    try {
        // Fetch from Bungie
        const response = await axios.get(
            `https://www.bungie.net/Platform/Destiny2/Stats/PostGameCarnageReport/${instanceId}/`,
            {
                headers: {
                    'X-API-Key': apiKey
                }
            }
        );
        
        return NextResponse.json(response.data);
    } catch (error: any) {
        console.error('PGCR Fetch Error for instance:', instanceId, error.message);
        
        // Handle Bungie API errors
        if (error.response) {
             console.error('Bungie API Response:', error.response.status, error.response.data);
             return NextResponse.json(error.response.data, { status: error.response.status });
        }
        
        return NextResponse.json(
            { error: 'Failed to fetch PGCR from Bungie' },
            { status: 500 }
        );
    }
}
