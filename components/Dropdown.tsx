"use client";

import { useState, useRef, useEffect } from "react";
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
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find((opt) => opt.value === value);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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

    return (
        <div ref={dropdownRef} className={cn("relative", className)}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={cn(
                    "flex items-center justify-between gap-2 min-w-[140px] px-3 py-2",
                    "bg-slate-800/80 backdrop-blur-sm border border-white/10 rounded-lg",
                    "text-sm text-white font-medium",
                    "transition-all duration-200",
                    "hover:bg-slate-700/80 hover:border-white/20",
                    "focus:outline-none focus:ring-2 focus:ring-destiny-gold/50 focus:border-destiny-gold/50",
                    isOpen && "ring-2 ring-destiny-gold/50 border-destiny-gold/50 bg-slate-700/80",
                    disabled && "opacity-50 cursor-not-allowed hover:bg-slate-800/80 hover:border-white/10"
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
            {isOpen && !disabled && (
                <div
                    className={cn(
                        "absolute z-50 mt-1 w-full min-w-[160px]",
                        "bg-slate-800/95 backdrop-blur-md border border-white/10 rounded-lg",
                        "shadow-xl shadow-black/40",
                        "py-1 overflow-hidden",
                        "animate-in fade-in-0 zoom-in-95 duration-150"
                    )}
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
                                        "flex items-center justify-between w-full px-3 py-2 text-sm text-left",
                                        "transition-colors duration-100",
                                        isSelected
                                            ? "bg-destiny-gold/15 text-destiny-gold"
                                            : "text-slate-200 hover:bg-white/5 hover:text-white"
                                    )}
                                >
                                    <span>{option.label}</span>
                                    {isSelected && (
                                        <Check className="w-4 h-4 text-destiny-gold" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

