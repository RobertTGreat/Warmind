"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropdownOption<T extends string> {
    value: T;
    label: string;
}

interface DropdownProps<T extends string> {
    value: T;
    onChange: (value: T) => void;
    options: DropdownOption<T>[];
    disabled?: boolean;
    placeholder?: string;
    className?: string;
}

export function Dropdown<T extends string>({
    value,
    onChange,
    options,
    disabled = false,
    placeholder = "Select...",
    className,
}: DropdownProps<T>) {
    const [isOpen, setIsOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState<{
        left: number;
        top: number;
        width: number;
    } | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find((opt) => opt.value === value);
    const updateMenuPosition = useCallback(() => {
        if (!buttonRef.current) return;

        const rect = buttonRef.current.getBoundingClientRect();
        setMenuPosition({
            left: rect.left,
            top: rect.bottom + 4,
            width: Math.max(rect.width, 160),
        });
    }, []);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const clickedTrigger = dropdownRef.current?.contains(target);
            const clickedMenu = menuRef.current?.contains(target);

            if (!clickedTrigger && !clickedMenu) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useLayoutEffect(() => {
        if (!isOpen) return;

        updateMenuPosition();

        window.addEventListener("resize", updateMenuPosition);
        window.addEventListener("scroll", updateMenuPosition, true);

        return () => {
            window.removeEventListener("resize", updateMenuPosition);
            window.removeEventListener("scroll", updateMenuPosition, true);
        };
    }, [isOpen, updateMenuPosition]);

    // Close on escape
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, []);

    const handleSelect = (optionValue: T) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    const dropdownMenu = isOpen && !disabled && menuPosition && typeof document !== "undefined"
        ? createPortal(
            <div
                ref={menuRef}
                className={cn(
                    "fixed z-[1000]",
                    "isolate bg-[#111827] border border-white/10 rounded-sm",
                    "shadow-2xl shadow-black/60",
                    "py-1 overflow-hidden",
                    "animate-in fade-in-0 zoom-in-95 duration-150"
                )}
                style={{
                    left: menuPosition.left,
                    top: menuPosition.top,
                    width: menuPosition.width,
                }}
            >
                <div className="max-h-60 overflow-y-auto">
                    {options.map((option) => {
                        const isSelected = option.value === value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => handleSelect(option.value)}
                                className={cn(
                                    "flex items-center justify-between gap-3 w-full px-3 py-2 text-sm text-left",
                                    "transition-colors duration-100",
                                    isSelected
                                        ? "bg-destiny-gold/15 text-destiny-gold"
                                        : "text-slate-200 hover:bg-white/5 hover:text-white"
                                )}
                            >
                                <span className="truncate">{option.label}</span>
                                {isSelected && (
                                    <Check className="w-4 h-4 shrink-0 text-destiny-gold" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>,
            document.body
        )
        : null;

    return (
        <div ref={dropdownRef} className={cn("relative", className)}>
            {/* Trigger Button */}
            <button
                ref={buttonRef}
                type="button"
                onClick={() => {
                    if (disabled) return;
                    updateMenuPosition();
                    setIsOpen((currentValue) => !currentValue);
                }}
                disabled={disabled}
                className={cn(
                    "flex items-center justify-between gap-2 min-w-[140px] px-3 py-2",
                    "bg-[#111827] border border-white/10 rounded-sm",
                    "text-sm text-white font-medium",
                    "transition-all duration-200",
                    "hover:bg-[#152033] hover:border-white/20",
                    "focus:outline-none focus:ring-2 focus:ring-destiny-gold/50 focus:border-destiny-gold/50",
                    isOpen && "ring-2 ring-destiny-gold/50 border-destiny-gold/50 bg-[#152033]",
                    disabled && "opacity-50 cursor-not-allowed hover:bg-[#111827] hover:border-white/10"
                )}
            >
                <span className={cn(!selectedOption && "text-slate-400")}>
                    {selectedOption?.label || placeholder}
                </span>
                <ChevronDown
                    className={cn(
                        "w-4 h-4 text-slate-400 transition-transform duration-200",
                        isOpen && "rotate-180 text-destiny-gold"
                    )}
                />
            </button>

            {/* Dropdown Menu */}
            {dropdownMenu}
        </div>
    );
}

