import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StationType } from "@/hooks/use-station-login";

interface StationLoginProps {
  stationType: StationType;
  onLogin: (operatorName: string) => void;
  onBack: () => void;
}

export function StationLogin({ stationType, onLogin, onBack }: StationLoginProps) {
  const [name, setName] = useState("");
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(name);
  };

  const stationName = stationType 
    ? stationType.charAt(0).toUpperCase() + stationType.slice(1) + " Station"
    : "";

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-12 fade-in">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-neutral-800">{stationName}</h2>
          <button onClick={onBack} className="text-neutral-500 hover:text-neutral-700">
            <span className="material-icons">close</span>
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="operator-name" className="block text-sm font-medium text-neutral-700 mb-1">
              Operator Name
            </label>
            <Input
              id="operator-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              required
              className="w-full"
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full"
          >
            Log In
          </Button>
        </form>
      </div>
    </div>
  );
}
