import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { library } from '@fortawesome/fontawesome-svg-core';
import { 
  faUser, faQrcode, faCheck, faMoneyBill, faCog, faSignOutAlt, 
  faSearch, faTimes, faSync, faExclamationTriangle, faCircleCheck, 
  faFileUpload, faDownload, faEdit, faTrash, faPlus,
  faUserShield, faArrowLeft, faUserPlus, faHistory, faDatabase,
  faCreditCard, faListAlt, faTachometerAlt, faTools
} from '@fortawesome/free-solid-svg-icons';

// Add FontAwesome icons to the library for global use
library.add(
  faUser, faQrcode, faCheck, faMoneyBill, faCog, faSignOutAlt, 
  faSearch, faTimes, faSync, faExclamationTriangle, faCircleCheck, 
  faFileUpload, faDownload, faEdit, faTrash, faPlus,
  faUserShield, faArrowLeft, faUserPlus, faHistory, faDatabase,
  faCreditCard, faListAlt, faTachometerAlt, faTools
);

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <App />
      <Toaster />
    </TooltipProvider>
  </QueryClientProvider>
);
