import { DistributionStation } from "@/components/distribution-station";
import { CheckerStation } from "@/components/checker-station";
import { CashStation } from "@/components/cash-station";
import { RubyStation } from "@/components/ruby-station-new";
import { StationSelection } from "@/components/station-selection";
import { StationLogin } from "@/components/station-login";
import { RubyStationLogin } from "@/components/ruby-station-login";
import { useStationLogin } from "@/hooks/use-station-login";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import "@/lib/init-fa";

export default function HomePage() {
  const { 
    selectedStation,
    operatorName,
    selectStation,
    handleLogin,
    handleLogout,
    rubyLoginError
  } = useStationLogin();

  return (
    <div className="min-h-screen flex flex-col">
      <Header operatorName={operatorName} />
      
      <main className="flex-grow">
        {!selectedStation ? (
          <StationSelection onSelectStation={selectStation} />
        ) : !operatorName ? (
          selectedStation === "ruby" ? (
            <RubyStationLogin
              onLogin={handleLogin}
              onBack={() => selectStation(null)}
              showError={rubyLoginError}
            />
          ) : (
            <StationLogin
              stationType={selectedStation}
              onLogin={handleLogin}
              onBack={() => selectStation(null)}
            />
          )
        ) : selectedStation === "distribution" ? (
          <DistributionStation 
            operatorName={operatorName} 
            onLogout={handleLogout} 
          />
        ) : selectedStation === "checker" ? (
          <CheckerStation 
            operatorName={operatorName} 
            onLogout={handleLogout} 
          />
        ) : selectedStation === "cash" ? (
          <CashStation 
            operatorName={operatorName} 
            onLogout={handleLogout} 
          />
        ) : selectedStation === "ruby" ? (
          <RubyStation
            operatorName={operatorName}
            onLogout={handleLogout}
          />
        ) : null}
      </main>
      
      <Footer />
    </div>
  );
}