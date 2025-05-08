import { StationType } from "@/hooks/use-station-login";

interface StationSelectionProps {
  onSelectStation: (station: StationType) => void;
}

export function StationSelection({ onSelectStation }: StationSelectionProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 fade-in">
      <h2 className="text-xl font-semibold text-neutral-800 mb-6">Select Station</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Distribution Station */}
        <div 
          className="station-card bg-white rounded-lg shadow p-6 cursor-pointer"
          onClick={() => onSelectStation('distribution')}
        >
          <div className="flex items-center justify-center h-12 w-12 rounded-md bg-primary text-white mb-4">
            <span className="material-icons">qr_code_scanner</span>
          </div>
          <h3 className="text-lg font-medium text-neutral-800">Distribution Station</h3>
          <p className="mt-2 text-sm text-neutral-600">Scan student IDs and distribute yearbooks</p>
        </div>

        {/* Checkers Station */}
        <div 
          className="station-card bg-white rounded-lg shadow p-6 cursor-pointer"
          onClick={() => onSelectStation('checker')}
        >
          <div className="flex items-center justify-center h-12 w-12 rounded-md bg-secondary text-white mb-4">
            <span className="material-icons">fact_check</span>
          </div>
          <h3 className="text-lg font-medium text-neutral-800">Checkers Station</h3>
          <p className="mt-2 text-sm text-neutral-600">Verify yearbook deliveries and record checkoffs</p>
        </div>

        {/* Cash Station */}
        <div 
          className="station-card bg-white rounded-lg shadow p-6 cursor-pointer"
          onClick={() => onSelectStation('cash')}
        >
          <div className="flex items-center justify-center h-12 w-12 rounded-md bg-neutral-700 text-white mb-4">
            <span className="material-icons">payments</span>
          </div>
          <h3 className="text-lg font-medium text-neutral-800">Cash Station</h3>
          <p className="mt-2 text-sm text-neutral-600">Process cash payments and calculate change</p>
        </div>

        {/* Ruby Station */}
        <div 
          className="station-card bg-white rounded-lg shadow p-6 cursor-pointer"
          onClick={() => onSelectStation('ruby')}
        >
          <div className="flex items-center justify-center h-12 w-12 rounded-md bg-destructive text-white mb-4">
            <span className="material-icons">admin_panel_settings</span>
          </div>
          <h3 className="text-lg font-medium text-neutral-800">Ruby Station</h3>
          <p className="mt-2 text-sm text-neutral-600">Admin access for system management</p>
        </div>
      </div>
    </div>
  );
}
