import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface RubyStationLoginProps {
  onLogin: (name: string) => void;
  onBack: () => void;
  showError: boolean;
}

export function RubyStationLogin({ onLogin, onBack, showError }: RubyStationLoginProps) {
  const [name, setName] = useState("");
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(name);
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-12 fade-in">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-neutral-800">Ruby Station Login</h2>
          <button onClick={onBack} className="text-neutral-500 hover:text-neutral-700">
            <span className="material-icons">close</span>
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="ruby-username" className="block text-sm font-medium text-neutral-700 mb-1">
              Authorized Username
            </label>
            <Input
              id="ruby-username"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter authorized username"
              required
              className="w-full"
            />
          </div>
          
          {showError && (
            <div className="text-destructive text-sm mb-4">
              Only authorized personnel can access the Ruby Station.
            </div>
          )}
          
          <Button 
            type="submit" 
            className="w-full bg-destructive hover:bg-destructive/90"
          >
            Access Admin Hub
          </Button>
        </form>
      </div>
    </div>
  );
}
