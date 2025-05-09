import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatabaseTab } from "./ruby-tabs/DatabaseTab";
import { ScannerTab } from "./ruby-tabs/ScannerTab";
import { PosTab } from "./ruby-tabs/PosTab";
import { AdminTab } from "./ruby-tabs/AdminTab";
import { LogsTab } from "./ruby-tabs/LogsTab";

interface RubyStationProps {
  operatorName: string;
  onLogout: () => void;
}

export function RubyStation({ operatorName, onLogout }: RubyStationProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-neutral-800">Ruby Station (Admin Hub)</h2>
        <Button 
          variant="outline" 
          onClick={onLogout}
          className="text-neutral-600 hover:text-neutral-800"
        >
          <FontAwesomeIcon icon="sign-out-alt" className="mr-2" />
          Exit Station
        </Button>
      </div>
      
      <Tabs defaultValue="database" className="w-full">
        <TabsList className="mb-4 w-full justify-start">
          <TabsTrigger value="database" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <FontAwesomeIcon icon="database" className="mr-2" />
            Student Database
          </TabsTrigger>
          <TabsTrigger value="scanner" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <FontAwesomeIcon icon="qrcode" className="mr-2" />
            Scanner
          </TabsTrigger>
          <TabsTrigger value="pos" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <FontAwesomeIcon icon="credit-card" className="mr-2" />
            Cash POS
          </TabsTrigger>
          <TabsTrigger value="admin" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <FontAwesomeIcon icon="tools" className="mr-2" />
            Administration
          </TabsTrigger>
          <TabsTrigger value="logs" className="data-[state=active]:bg-primary data-[state=active]:text-white">
            <FontAwesomeIcon icon="list-alt" className="mr-2" />
            System Logs
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="database" className="border-none p-0 mt-0">
          <DatabaseTab operatorName={operatorName} />
        </TabsContent>
        
        <TabsContent value="scanner" className="border-none p-0 mt-0">
          <ScannerTab operatorName={operatorName} />
        </TabsContent>
        
        <TabsContent value="pos" className="border-none p-0 mt-0">
          <PosTab operatorName={operatorName} />
        </TabsContent>
        
        <TabsContent value="admin" className="border-none p-0 mt-0">
          <AdminTab operatorName={operatorName} />
        </TabsContent>
        
        <TabsContent value="logs" className="border-none p-0 mt-0">
          <LogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}