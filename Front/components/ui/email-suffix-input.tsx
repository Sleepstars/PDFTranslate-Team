'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Portal } from '@/components/ui/portal';
import { X } from 'lucide-react';

const COMMON_EMAIL_SUFFIXES = [
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'qq.com',
  '163.com',
  '126.com',
  'sina.com',
  'foxmail.com',
];

interface EmailSuffixInputProps {
  value: string[];
  onChange: (suffixes: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function EmailSuffixInput({
  value,
  onChange,
  placeholder = 'example.com',
  className,
}: EmailSuffixInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update dropdown position when it opens
  useEffect(() => {
    if (isDropdownOpen && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [isDropdownOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check if click is outside both container and dropdown
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  const addSuffix = (suffix: string) => {
    const trimmed = suffix.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
      setInputValue('');
    }
  };

  const removeSuffix = (suffix: string) => {
    onChange(value.filter((s) => s !== suffix));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) {
        addSuffix(inputValue);
        setIsDropdownOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  const handleSuffixClick = (suffix: string) => {
    addSuffix(suffix);
    setIsDropdownOpen(false);
    inputRef.current?.focus();
  };

  // Filter common suffixes that are not already selected
  const availableSuffixes = COMMON_EMAIL_SUFFIXES.filter((s) => !value.includes(s));

  return (
    <div ref={containerRef} className={cn('space-y-3', className)}>
      {/* Input field */}
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => setIsDropdownOpen(true)}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          className="w-full"
        />
      </div>

      {/* Dropdown menu */}
      {isDropdownOpen && availableSuffixes.length > 0 && (
        <Portal>
          <div
            ref={dropdownRef}
            className="fixed z-50 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
            }}
          >
            <div className="p-1">
              {availableSuffixes.map((suffix) => (
                <button
                  key={suffix}
                  type="button"
                  onClick={() => handleSuffixClick(suffix)}
                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-accent transition-colors"
                >
                  {suffix}
                </button>
              ))}
            </div>
          </div>
        </Portal>
      )}

      {/* Selected suffixes */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((suffix) => (
            <div
              key={suffix}
              className="flex items-center gap-1 px-3 py-1 text-sm rounded-md bg-secondary border border-border"
            >
              <span>{suffix}</span>
              <button
                type="button"
                onClick={() => removeSuffix(suffix)}
                className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={`Remove ${suffix}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

