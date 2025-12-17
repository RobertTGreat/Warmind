'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Cookies from 'js-cookie';
import { exchangeAuthCode } from '@/desktop-app/lib/api-shim';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const code = searchParams.get('code');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!code) {
            router.push('/?error=no_code');
            return;
        }

        const handleAuth = async () => {
            try {
                const data = await exchangeAuthCode(code);

                if (data.error) {
                    throw new Error(data.error_description || 'Failed to exchange code');
                }

                const { access_token, refresh_token, membership_id } = data;

                // Set cookies
                Cookies.set('bungie_access_token', access_token, {
                    expires: 1/24, // 1 hour
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax'
                });

                Cookies.set('bungie_refresh_token', refresh_token, {
                    expires: 90, // 90 days
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax'
                    // cannot use httpOnly on client
                });

                Cookies.set('bungie_membership_id', membership_id, {
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax'
                });

                router.push('/');
            } catch (err: any) {
                console.error('Auth Error:', err);
                setError(err.message || 'Authentication failed');
                // Redirect after short delay or show error
                setTimeout(() => router.push('/?error=auth_failed'), 3000);
            }
        };

        handleAuth();
    }, [code, router]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
                <div className="text-red-500 font-bold mb-2">Authentication Failed</div>
                <div className="text-sm text-slate-400">{error}</div>
                <div className="mt-4 text-xs text-slate-600">Redirecting...</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-4" />
            <div className="text-slate-400">Authenticating with Bungie...</div>
        </div>
    );
}


