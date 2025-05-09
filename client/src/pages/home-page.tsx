import { RubyStation } from "@/components/ruby-station";
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
        ) : selectedStation === "ruby" ? (
          <RubyStation
            operatorName={operatorName}
            onLogout={handleLogout}
          />
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