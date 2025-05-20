import { RubyStation } from "@/components/ruby-station";
import { StationSelection } from "@/components/station-selection";
import { StationLogin } from "@/components/station-login";
import { RubyStationLogin } from "@/components/ruby-station-login";
import { useStationLogin } from "@/hooks/use-station-login";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ScannerTab } from "@/components/ruby-tabs/ScannerTab";
import { PosTab } from "@/components/ruby-tabs/PosTab";
import { CheckersTab } from "@/components/ruby-tabs/CheckersTab";
import { CashStationImproved } from "@/components/cash-station-improved";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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
        ) : selectedStation === "ruby" ? (
          <RubyStation
            operatorName={operatorName}
            onLogout={handleLogout}
          />
        ) : selectedStation === "distribution" ? (
          <div className="flex flex-col min-h-screen">
            <main className="flex-1 container mx-auto py-6 px-4">
              <Card className="mb-6">
                <CardContent className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-neutral-800">Scanner Station</h2>
                    <Button variant="outline" onClick={handleLogout}>
                      <FontAwesomeIcon icon="sign-out-alt" className="mr-2" />
                      Logout
                    </Button>
                  </div>
                  <ScannerTab operatorName={operatorName} />
                </CardContent>
              </Card>
            </main>
          </div>
        ) : selectedStation === "cash" ? (
          <CashStationImproved 
            operatorName={operatorName} 
            onLogout={handleLogout}
          />
        ) : selectedStation === "checker" ? (
          <div className="flex flex-col min-h-screen">
            <main className="flex-1 container mx-auto py-6 px-4">
              <Card className="mb-6">
                <CardContent className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-neutral-800">Checkers Station</h2>
                    <Button variant="outline" onClick={handleLogout}>
                      <FontAwesomeIcon icon="sign-out-alt" className="mr-2" />
                      Logout
                    </Button>
                  </div>
                  <CheckersTab operatorName={operatorName} />
                </CardContent>
              </Card>
            </main>
          </div>
        ) : (
          <div className="container mx-auto my-10 p-4 sm:p-6 text-center responsive-container">
            <h2 className="text-xl font-semibold text-red-500 mb-4">This station is temporarily unavailable</h2>
            <p className="mb-6">We're currently working on improving this section.</p>
            <button 
              onClick={handleLogout}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Return to Station Selection
            </button>
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
}