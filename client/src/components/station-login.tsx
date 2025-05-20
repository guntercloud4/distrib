import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StationType } from "@/hooks/use-station-login";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Operator } from "@shared/schema";

interface StationLoginProps {
  stationType: StationType;
  onLogin: (operatorName: string) => void;
  onBack: () => void;
}

export function StationLogin({ stationType, onLogin, onBack }: StationLoginProps) {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Fetch operators list for permission checking
  const { data: operators } = useQuery<Operator[]>({
    queryKey: ['/api/operators'],
    staleTime: 10000 // 10 seconds
  });
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      // Check if operator exists and has proper permissions
      const operator = operators?.find(op => op.name.toLowerCase() === name.toLowerCase());
      
      if (!operator) {
        setError("Operator not found. Please enter a valid operator name.");
        toast({
          title: "Authentication Error",
          description: "Operator not found. Please enter a valid operator name.",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }
      
      // Skip permission check for Ruby Station (admin access)
      if (stationType !== "ruby") {
        // Check if operator has permission for this station
        const permissions = operator.permissions || {};
        let hasPermission = false;
        
        // Check station-specific permission
        if (stationType === 'distribution' && permissions.distribution === true) {
          hasPermission = true;
        } else if (stationType === 'checker' && permissions.checker === true) {
          hasPermission = true;
        } else if (stationType === 'cash' && permissions.cash === true) {
          hasPermission = true;
        }
        
        if (!hasPermission) {
          setError(`You don't have permission to access the ${stationType} station.`);
          toast({
            title: "Access Denied",
            description: `You don't have permission to access the ${stationType} station.`,
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }
      }
      
      // If active status is false, deny access
      if (operator.active === false) {
        setError("Your account is inactive. Please contact an administrator.");
        toast({
          title: "Account Inactive",
          description: "Your account is inactive. Please contact an administrator.",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }
      
      // All checks passed, allow login
      onLogin(name);
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred during login. Please try again.");
      toast({
        title: "Login Error",
        description: "An error occurred during login. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const stationName = stationType 
    ? stationType.charAt(0).toUpperCase() + stationType.slice(1) + " Station"
    : "";

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-8 sm:py-12 fade-in responsive-container">
      <div className="bg-white shadow rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-neutral-800 mb-2 sm:mb-0">{stationName}</h2>
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
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded">
              {error}
            </div>
          )}
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="mr-2">Loading...</span>
                <span className="animate-spin">⏳</span>
              </>
            ) : "Log In"}
          </Button>
        </form>
      </div>
    </div>
  );
}
