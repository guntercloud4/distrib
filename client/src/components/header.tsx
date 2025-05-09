import { formatDateTime } from "@/lib/utils";
import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

interface HeaderProps {
  operatorName: string;
}

export function Header({ operatorName }: HeaderProps) {
  const [currentDateTime, setCurrentDateTime] = useState(formatDateTime(new Date()));

  // Update the date/time every minute
  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentDateTime(formatDateTime(new Date()));
    }, 60000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
        <div className="flex items-center">
          <h1 className="text-xl sm:text-2xl font-semibold text-neutral-800 text-center sm:text-left">Yearbook Distribution System</h1>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
          <span className="text-sm text-neutral-600">{currentDateTime}</span>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-neutral-700">{operatorName || "Not logged in"}</span>
            <span className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white">
              <FontAwesomeIcon icon="user" />
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
