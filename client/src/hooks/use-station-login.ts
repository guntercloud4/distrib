import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { isAuthorizedRubyUser } from "@/lib/utils";

export type StationType = "distribution" | "checker" | "cash" | "ruby" | null;

export function useStationLogin() {
  const [selectedStation, setSelectedStation] = useState<StationType>(null);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [operatorName, setOperatorName] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [rubyLoginError, setRubyLoginError] = useState(false);
  const { toast } = useToast();

  // Check for saved login state on component mount
  useEffect(() => {
    const savedOperator = localStorage.getItem("currentOperator");
    const savedStation = localStorage.getItem("selectedStation") as StationType;
    
    if (savedOperator && savedStation) {
      setOperatorName(savedOperator);
      setSelectedStation(savedStation);
      setIsLoggedIn(true);
    }
  }, []);

  // Function to select a station
  const selectStation = (station: StationType) => {
    if (station === "ruby") {
      setSelectedStation("ruby");
      setShowLoginForm(true);
      setRubyLoginError(false);
    } else {
      setSelectedStation(station);
      setShowLoginForm(true);
    }
  };

  // Function to handle login
  const handleLogin = (name: string) => {
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Please enter your name",
        variant: "destructive"
      });
      return;
    }

    if (selectedStation === "ruby" && !isAuthorizedRubyUser(name)) {
      setRubyLoginError(true);
      return;
    }

    setOperatorName(name);
    setIsLoggedIn(true);
    localStorage.setItem("currentOperator", name);
    localStorage.setItem("selectedStation", selectedStation as string);
    
    toast({
      title: "Logged In",
      description: `You are now logged in as ${name}`,
    });
  };

  // Function to log out
  const handleLogout = () => {
    // Clear state
    setOperatorName("");
    setSelectedStation(null);
    setIsLoggedIn(false);
    setShowLoginForm(false);
    
    // Clear local storage
    localStorage.removeItem("currentOperator");
    localStorage.removeItem("selectedStation");
    
    toast({
      title: "Logged Out",
      description: "You have been logged out",
    });
  };

  // Function to go back to station selection
  const goToStationSelection = () => {
    setSelectedStation(null);
    setShowLoginForm(false);
    setRubyLoginError(false);
  };

  return {
    selectedStation,
    showLoginForm,
    operatorName,
    isLoggedIn,
    rubyLoginError,
    selectStation,
    handleLogin,
    handleLogout,
    goToStationSelection
  };
}
