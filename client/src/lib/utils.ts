import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

// Format date
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Format time
export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Format date and time
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${formatDate(d)} - ${formatTime(d)}`;
}

// Calculate change from bills
export function calculateTotalFromBills(bills: Record<string, number>): number {
  return (
    (bills.one || 0) * 1 +
    (bills.five || 0) * 5 +
    (bills.ten || 0) * 10 +
    (bills.twenty || 0) * 20 +
    (bills.fifty || 0) * 50 +
    (bills.hundred || 0) * 100
  );
}

// Get payment status color
export function getPaymentStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "paid":
      return "bg-green-100 text-green-800";
    case "unpaid":
      return "bg-yellow-100 text-yellow-800";
    case "free":
      return "bg-blue-100 text-blue-800";
    case "partial":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

// Handle barcode scanner input
export function handleScannerEnter(
  e: React.KeyboardEvent<HTMLInputElement>,
  onScan: (value: string) => void
) {
  if (e.key === "Enter") {
    e.preventDefault();
    const value = e.currentTarget.value.trim();
    if (value) {
      onScan(value);
      e.currentTarget.value = "";
    }
  }
}

// Check if a user is authorized for Ruby Station
export function isAuthorizedRubyUser(username: string): boolean {
  const authorizedUsers = [
    "Ruby",
    "Joshua Gunter",
    "Eitan Rubinstein",
    "Cole Broumas",
  ];
  return authorizedUsers.includes(username);
}

// Parse CSV data
export function parseCSV(csvText: string): any[] {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',').map(header => header.trim());
  
  const results = [];
  
  for(let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const obj: Record<string, string> = {};
    const currentLine = lines[i].split(',');
    
    for(let j = 0; j < headers.length; j++) {
      obj[headers[j]] = currentLine[j]?.trim() || '';
    }
    
    results.push(obj);
  }
  
  return results;
}
