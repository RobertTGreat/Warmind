import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { bungieApi, endpoints, getBungieImage } from '@/lib/bungie';
import { Loader2, Sparkles, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RewardItem } from './RewardItem';
import { ScrollingText } from '@/components/ScrollingText';

const fetcher = (url: string) => bungieApi.get(url).then((res) => res.data);

interface EventCardProps {
    profile: any;
}

export function EventCard({ profile }: EventCardProps) {
    const eventCardHashes = profile?.profile?.data?.eventCardHashesOwned;
    
    if (!eventCardHashes || eventCardHashes.length === 0) return null;

    const eventCardHash = eventCardHashes[0];

    return <EventCardView eventCardHash={eventCardHash} />;
}

function EventCardView({ eventCardHash }: { eventCardHash: number }) {
    const { data: defData } = useSWR(
        endpoints.getEventCardDefinition(eventCardHash),
        fetcher
    );
    const def = defData?.Response;

    if (!def) return null;

    return (
        <div className="space-y-6">
             <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <div className="p-2 bg-purple-500/20 rounded-full">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white uppercase tracking-wide">{def.displayProperties.name}</h3>
                    <p className="text-xs text-purple-300">Event Active</p>
                </div>
             </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Hero Image */}
                <div className="lg:col-span-1 relative h-48 lg:h-auto rounded-sm overflow-hidden border border-white/10 group">
                    <img src={getBungieImage(def.displayProperties.icon)} alt="" className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-6">
                        <p className="text-sm text-slate-200 line-clamp-3">{def.displayProperties.description}</p>
                    </div>
                </div>

                {/* Challenges / Rewards Preview */}
                {/* Since we don't have easy access to the Ticket Vendor rewards without a vendor hash, 
                    we'll display the Triumphs (Challenges) associated with the event card which grant the tickets/rewards. */}
                <div className="lg:col-span-2 bg-black/20 border border-white/5 p-6 rounded-sm backdrop-blur-sm">
                    <h4 className="text-sm font-bold text-white uppercase mb-4 flex items-center gap-2">
                        <Ticket className="w-4 h-4 text-destiny-gold" />
                        Event Challenges
                    </h4>
                    <EventChallenges nodeHash={def.triumphsPresentationNodeHash} />
                </div>
            </div>
        </div>
    );
}

function EventChallenges({ nodeHash }: { nodeHash: number }) {
    const { data: nodeData } = useSWR(
        nodeHash ? endpoints.getPresentationNodeDefinition(nodeHash) : null,
        fetcher
    );
    const node = nodeData?.Response;

    if (!node) return <div className="h-20 flex items-center justify-center"><Loader2 className="animate-spin text-destiny-gold" /></div>;

    // Show first 4 challenges
    const records = node.children.records.slice(0, 4);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {records.map((child: any) => (
                <EventChallengeRecord key={child.recordHash} recordHash={child.recordHash} />
            ))}
        </div>
    );
}

function EventChallengeRecord({ recordHash }: { recordHash: number }) {
    const { data: recordDefData } = useSWR(
        endpoints.getRecordDefinition(recordHash),
        fetcher
    );
    const record = recordDefData?.Response;

    if (!record) return <div className="h-16 bg-white/5 animate-pulse rounded-sm" />;

    // Check rewards
    const rewardItems = record.rewardItems || [];

    return (
        <div className="flex items-center justify-between p-3 bg-white/5 rounded-sm border border-white/5 hover:bg-white/10 transition-colors group">
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-slate-800 rounded flex-shrink-0 border border-white/10 overflow-hidden">
                    <img src={getBungieImage(record.displayProperties.icon)} alt="" className="w-full h-full object-cover opacity-80" />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                    <ScrollingText className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                        {record.displayProperties.name}
                    </ScrollingText>
                    <div className="text-xs text-slate-500 truncate">
                        {record.displayProperties.description}
                    </div>
                </div>
            </div>

            {/* Rewards */}
            <div className="flex -space-x-2 shrink-0 ml-2">
                {rewardItems.map((reward: any, i: number) => (
                    <div key={i} className="scale-75 origin-right">
                        <RewardItem itemHash={reward.itemHash} quantity={reward.quantity} showLabel={false} />
                    </div>
                ))}
            </div>
        </div>
    );
}
