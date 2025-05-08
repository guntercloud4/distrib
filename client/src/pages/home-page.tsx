import { useState } from "react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { StationSelection } from "@/components/station-selection";
import { StationLogin } from "@/components/station-login";
import { RubyStationLogin } from "@/components/ruby-station-login";
import { DistributionStation } from "@/components/distribution-station";
import { CheckerStation } from "@/components/checker-station";
import { CashStation } from "@/components/cash-station";
import { RubyStation } from "@/components/ruby-station";
import { useStationLogin } from "@/hooks/use-station-login";

export default function HomePage() {
  const {
    selectedStation,
    showLoginForm,
    operatorName,
    isLoggedIn,
    rubyLoginError,
    selectStation,
    handleLogin,
    handleLogout,
    goToStationSelection
  } = useStationLogin();

  return (
    <>
      <Header operatorName={operatorName} />
      
      <main className="flex-1">
        {/* Show station selection if not logged in and not showing login form */}
        {!isLoggedIn && !showLoginForm && (
          <StationSelection onSelectStation={selectStation} />
        )}
        
        {/* Show login form for regular stations */}
        {!isLoggedIn && showLoginForm && selectedStation !== "ruby" && (
          <StationLogin 
            stationType={selectedStation} 
            onLogin={handleLogin} 
            onBack={goToStationSelection}
          />
        )}
        
        {/* Show Ruby station login form */}
        {!isLoggedIn && showLoginForm && selectedStation === "ruby" && (
          <RubyStationLogin 
            onLogin={handleLogin} 
            onBack={goToStationSelection} 
            showError={rubyLoginError}
          />
        )}
        
        {/* Show selected station when logged in */}
        {isLoggedIn && selectedStation === "distribution" && (
          <DistributionStation 
            operatorName={operatorName} 
            onLogout={handleLogout}
          />
        )}
        
        {isLoggedIn && selectedStation === "checker" && (
          <CheckerStation 
            operatorName={operatorName} 
            onLogout={handleLogout}
          />
        )}
        
        {isLoggedIn && selectedStation === "cash" && (
          <CashStation 
            operatorName={operatorName} 
            onLogout={handleLogout}
          />
        )}
        
        {isLoggedIn && selectedStation === "ruby" && (
          <RubyStation 
            operatorName={operatorName} 
            onLogout={handleLogout}
          />
        )}
      </main>
      
      <Footer />
    </>
  );
}
