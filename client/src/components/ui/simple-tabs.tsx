import React, { useState } from 'react';
import { cn } from "@/lib/utils";

interface TabsProps {
  className?: string;
  children: React.ReactNode;
  selectedIndex: number;
  onChange: (index: number) => void;
}

export function Tabs({ children, className, selectedIndex, onChange }: TabsProps) {
  return (
    <div className={cn("w-full", className)}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            selectedIndex,
            onChange
          });
        }
        return child;
      })}
    </div>
  );
}

interface TabListProps {
  className?: string;
  children: React.ReactNode;
  selectedIndex: number;
  onChange: (index: number) => void;
}

export function TabList({ className, children, selectedIndex, onChange }: TabListProps) {
  return (
    <div className={cn("flex flex-wrap border-b border-neutral-200", className)} role="tablist">
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            isSelected: index === selectedIndex,
            onSelect: () => onChange(index),
            index
          });
        }
        return child;
      })}
    </div>
  );
}

interface TabProps {
  className?: string;
  children: React.ReactNode;
  isSelected?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
}

export function Tab({ className, children, isSelected, onSelect, disabled }: TabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap px-3 py-2 text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        isSelected 
          ? "border-b-2 border-neutral-800 text-neutral-800" 
          : "text-neutral-500 hover:text-neutral-700 hover:border-b-2 hover:border-neutral-300",
        className
      )}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}

interface TabPanelProps {
  className?: string;
  children: React.ReactNode;
  selectedIndex: number;
  index: number;
}

export function TabPanel({ className, children, selectedIndex, index }: TabPanelProps) {
  if (selectedIndex !== index) return null;
  
  return (
    <div
      role="tabpanel"
      className={cn("mt-4", className)}
      tabIndex={0}
    >
      {children}
    </div>
  );
}