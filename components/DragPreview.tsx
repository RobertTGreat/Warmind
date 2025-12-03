'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { getBungieImage } from '@/lib/bungie';
import { cn } from '@/lib/utils';

interface DragPreviewProps {
    itemDef: any;
    instanceData?: any;
    size?: 'small' | 'medium' | 'large';
}

const SIZE_MAP = {
    small: 64,
    medium: 80,
    large: 96
};

/**
 * DragPreview - Renders a floating clone of the item being dragged
 * Used as a custom drag image with drop shadow effect
 */
export function DragPreview({ itemDef, instanceData, size = 'medium' }: DragPreviewProps) {
    const pixelSize = SIZE_MAP[size];
    const icon = itemDef ? getBungieImage(itemDef.displayProperties?.icon) : null;
    const rarity = itemDef?.inventory?.tierTypeName;
    
    const rarityBorder = {
        'Exotic': 'border-yellow-500',
        'Legendary': 'border-purple-500',
        'Rare': 'border-blue-500',
        'Common': 'border-green-500',
        'Basic': 'border-white/20'
    }[rarity as string] || 'border-white/20';

    return (
        <div 
            className={cn(
                "relative border-2 bg-slate-900 shadow-2xl",
                "transform scale-110 opacity-90",
                rarityBorder
            )}
            style={{ 
                width: pixelSize, 
                height: pixelSize,
                boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 8px 16px rgba(0,0,0,0.3)'
            }}
        >
            {icon && (
                <Image 
                    src={icon} 
                    alt={itemDef?.displayProperties?.name || "Item"} 
                    fill
                    sizes={`${pixelSize}px`}
                    className="object-cover"
                    priority
                />
            )}
            
            {/* Seasonal Watermark */}
            {(itemDef?.iconWatermark || itemDef?.iconWatermarkShelved) && (
                <div className="absolute inset-0 z-10 pointer-events-none">
                    <Image 
                        src={getBungieImage(itemDef.iconWatermark || itemDef.iconWatermarkShelved)} 
                        alt="Season"
                        fill
                        sizes={`${pixelSize}px`}
                        className="object-cover"
                        priority
                    />
                </div>
            )}
            
            {/* Glow effect */}
            <div className="absolute -inset-1 bg-destiny-gold/20 blur-md -z-10" />
        </div>
    );
}

/**
 * Custom drag layer that follows the cursor
 * More performant than default browser drag preview
 */
export function useDragLayer() {
    const [dragState, setDragState] = useState<{
        isDragging: boolean;
        position: { x: number; y: number };
        itemDef: any;
        instanceData: any;
        size: 'small' | 'medium' | 'large';
    } | null>(null);
    
    const rafRef = useRef<number | undefined>(undefined);
    
    useEffect(() => {
        const handleDragStart = (e: DragEvent) => {
            // Custom drag data will be set by the component
        };
        
        const handleDrag = (e: DragEvent) => {
            if (e.clientX === 0 && e.clientY === 0) return; // Browser sometimes sends 0,0
            
            // Use RAF for smooth updates
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => {
                setDragState(prev => prev ? {
                    ...prev,
                    position: { x: e.clientX, y: e.clientY }
                } : null);
            });
        };
        
        const handleDragEnd = () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            setDragState(null);
        };
        
        document.addEventListener('dragstart', handleDragStart);
        document.addEventListener('drag', handleDrag);
        document.addEventListener('dragend', handleDragEnd);
        
        return () => {
            document.removeEventListener('dragstart', handleDragStart);
            document.removeEventListener('drag', handleDrag);
            document.removeEventListener('dragend', handleDragEnd);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);
    
    return {
        dragState,
        setDragState
    };
}

/**
 * Global drag overlay portal component
 */
export function DragOverlay() {
    const [dragItem, setDragItem] = useState<{
        itemDef: any;
        position: { x: number; y: number };
        size: 'small' | 'medium' | 'large';
    } | null>(null);
    
    const [mounted, setMounted] = useState(false);
    
    useEffect(() => {
        setMounted(true);
        
        const handleCustomDrag = (e: CustomEvent) => {
            setDragItem(e.detail);
        };
        
        const handleDragEnd = () => {
            setDragItem(null);
        };
        
        window.addEventListener('item-drag-move' as any, handleCustomDrag);
        window.addEventListener('dragend', handleDragEnd);
        
        return () => {
            window.removeEventListener('item-drag-move' as any, handleCustomDrag);
            window.removeEventListener('dragend', handleDragEnd);
        };
    }, []);
    
    if (!mounted || !dragItem) return null;
    
    return createPortal(
        <div 
            className="fixed pointer-events-none z-[9999]"
            style={{
                left: dragItem.position.x - SIZE_MAP[dragItem.size] / 2,
                top: dragItem.position.y - SIZE_MAP[dragItem.size] / 2,
                transform: 'translate3d(0,0,0)'
            }}
        >
            <DragPreview 
                itemDef={dragItem.itemDef} 
                size={dragItem.size}
            />
        </div>,
        document.body
    );
}

export default DragPreview;

