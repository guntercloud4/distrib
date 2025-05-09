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
    loginOperator,
    logoutOperator,
    showError
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
              onLogin={loginOperator}
              onBack={() => selectStation(null)}
              showError={showError}
            />
          ) : (
            <StationLogin
              stationType={selectedStation}
              onLogin={loginOperator}
              onBack={() => selectStation(null)}
            />
          )
        ) : selectedStation === "distribution" ? (
          <DistributionStation 
            operatorName={operatorName} 
            onLogout={logoutOperator} 
          />
        ) : selectedStation === "checker" ? (
          <CheckerStation 
            operatorName={operatorName} 
            onLogout={logoutOperator} 
          />
        ) : selectedStation === "cash" ? (
          <CashStation 
            operatorName={operatorName} 
            onLogout={logoutOperator} 
          />
        ) : selectedStation === "ruby" ? (
          <RubyStation
            operatorName={operatorName}
            onLogout={logoutOperator}
          />
        ) : null}
      </main>
      
      <Footer />
    </div>
  );
}