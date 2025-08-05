"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
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
  placeholder = "Select…",
  className,
}: SelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!isOpen) {
      if (["Enter", " ", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(options.findIndex((o) => o.value === value) || 0);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((i) => (i < options.length - 1 ? i + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((i) => (i > 0 ? i - 1 : options.length - 1));
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

  useEffect(() => {
    if (isOpen && focusedIndex >= 0) {
      const container = selectRef.current?.querySelector(
        ".custom-select-options",
      ) as HTMLDivElement;
      const item = container?.children[focusedIndex] as HTMLDivElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [isOpen, focusedIndex]);

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
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-white px-3 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          isOpen && "ring-2 ring-offset-1 ring-primary",
        )}
        onClick={() => {
          setIsOpen((open) => !open);
          setFocusedIndex(options.findIndex((o) => o.value === value));
        }}
      >
        <span
          className={cn(
            selectedOption ? "text-gray-900" : "text-gray-500",
            "truncate",
          )}
        >
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
          className="custom-select-options absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-input bg-white shadow-lg"
        >
          <div className="max-h-60 overflow-y-auto p-1">
            {options.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isFocused = idx === focusedIndex;
              return (
                <div
                  id={`option-${idx}`}
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm",
                    "hover:bg-gray-100",
                    isFocused && "bg-gray-100",
                  )}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setFocusedIndex(-1);
                  }}
                  onMouseEnter={() => setFocusedIndex(idx)}
                >
                  {isSelected && (
                    <Check className="absolute left-2 h-4 w-4 text-[#9542e3]" />
                  )}
                  <span className={isSelected ? "font-medium" : ""}>
                    {opt.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
