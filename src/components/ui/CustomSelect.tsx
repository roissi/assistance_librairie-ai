"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

export const CustomSelect = ({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className,
}: SelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const selectRef = useRef<HTMLDivElement>(null);

  // Ferme quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  // Gestion clavier
  const onKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((idx) => (idx < options.length - 1 ? idx + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((idx) => (idx > 0 ? idx - 1 : options.length - 1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex >= 0) {
          onChange(options[focusedIndex].value);
        }
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
    }
  };

  // Scroll vers l’item focus si besoin
  useEffect(() => {
    if (isOpen && focusedIndex >= 0) {
      const container = selectRef.current?.querySelector(
        ".custom-select-options",
      ) as HTMLDivElement;
      const item = container?.children[focusedIndex] as HTMLDivElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex, isOpen]);

  return (
    <div
      className={cn("relative w-full", className)}
      ref={selectRef}
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          isOpen && "ring-2 ring-offset-1 ring-primary",
        )}
        onClick={() => {
          setIsOpen((o) => !o);
          setFocusedIndex(options.findIndex((o) => o.value === value));
        }}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 opacity-50 transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-activedescendant={
            focusedIndex >= 0 ? `option-${focusedIndex}` : undefined
          }
          tabIndex={-1}
          className="custom-select-options absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-input bg-popover shadow-lg transition ease-out duration-100"
        >
          <div className="max-h-60 overflow-y-auto p-1">
            {options.map((option, idx) => (
              <div
                id={`option-${idx}`}
                key={option.value}
                role="option"
                aria-selected={value === option.value}
                className={cn(
                  "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
                  "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                  value === option.value && "bg-accent text-accent-foreground",
                  idx === focusedIndex && "bg-primary/10",
                )}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                  setFocusedIndex(-1);
                }}
                onMouseEnter={() => setFocusedIndex(idx)}
              >
                {option.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
