import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  selectedIndex: number;
  onChange: (index: number) => void;
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

function useTabs() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs compound components must be used within a Tabs component");
  }
  return context;
}

const TabsIndexContext = React.createContext<number>(0);

interface TabsProps {
  children: React.ReactNode;
  selectedIndex: number;
  onChange: (index: number) => void;
  className?: string;
}

export function Tabs({ children, selectedIndex, onChange, className }: TabsProps) {
  return (
    <TabsContext.Provider value={{ selectedIndex, onChange }}>
      <div className={cn("w-full", className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

interface TabListProps {
  children: React.ReactNode;
  className?: string;
}

export function TabList({ children, className }: TabListProps) {
  return (
    <div 
      className={cn(
        "flex flex-wrap border-b border-neutral-200", 
        className
      )}
      role="tablist"
    >
      <TabsContent>{children}</TabsContent>
    </div>
  );
}

interface TabProps {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function Tab({ children, className, disabled = false }: TabProps & React.HTMLAttributes<HTMLButtonElement>) {
  const { selectedIndex, onChange } = useTabs();
  const tabRef = React.useRef<HTMLButtonElement>(null);
  const index = React.useContext(TabsIndexContext);

  const isSelected = selectedIndex === index;

  const handleClick = () => {
    if (!disabled) {
      onChange(index);
    }
  };

  return (
    <button
      ref={tabRef}
      type="button"
      role="tab"
      aria-selected={isSelected}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap px-3 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isSelected 
          ? "border-b-2 border-neutral-800 text-neutral-800" 
          : "text-neutral-500 hover:text-neutral-700 hover:border-b-2 hover:border-neutral-300",
        className
      )}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}

interface TabPanelProps {
  children: React.ReactNode;
  className?: string;
  index?: number;
}

export function TabPanel({ children, className }: TabPanelProps) {
  const { selectedIndex } = useTabs();
  const index = React.useContext(TabsIndexContext);
  const isSelected = selectedIndex === index;

  if (!isSelected) return null;

  return (
    <div
      role="tabpanel"
      className={cn("mt-2", className)}
    >
      {children}
    </div>
  );
}

// This is a wrapper to provide index context to Tab and TabPanel
export function TabsContent({ children }: { children: React.ReactNode }) {
  return React.Children.map(children, (child, index) => (
    <TabsIndexContext.Provider value={index}>
      {child}
    </TabsIndexContext.Provider>
  ));
}