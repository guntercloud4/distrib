import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Header } from "./header";
import { Footer } from "./footer";
import { DatabaseTab } from "./ruby-tabs/DatabaseTab";
import { ScannerTab } from "./ruby-tabs/ScannerTab";
import { PosTab } from "./ruby-tabs/PosTab";
import { CheckersTab } from "./ruby-tabs/CheckersTab";
import { FreeBookTab } from "./ruby-tabs/FreeBookTab";
import { LogsTab } from "./ruby-tabs/LogsTab";
import { DataTab } from "./ruby-tabs/DataTab";
import { OperatorsTab } from "./ruby-tabs/OperatorsTab";
import { OverviewTab } from "./ruby-tabs/OverviewTab";

interface RubyStationProps {
  operatorName: string;
  onLogout: () => void;
}

export function RubyStation({ operatorName, onLogout }: RubyStationProps) {
  const [activeTab, setActiveTab] = useState("database");

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 container mx-auto py-6 px-4">
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-neutral-800">Ruby Station</h2>
              
              <Button variant="outline" onClick={onLogout}>
                <FontAwesomeIcon icon="sign-out-alt" className="mr-2" />
                Logout
              </Button>
            </div>
            
            <Tabs 
              defaultValue="database" 
              value={activeTab} 
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                <TabsTrigger value="database">
                  <FontAwesomeIcon icon="database" className="mr-2" />
                  <span className="hidden md:inline">Database</span>
                </TabsTrigger>
                <TabsTrigger value="data">
                  <FontAwesomeIcon icon="table" className="mr-2" />
                  <span className="hidden md:inline font-normal">Data</span>
                </TabsTrigger>
                <TabsTrigger value="operators">
                  <FontAwesomeIcon icon="users-cog" className="mr-2" />
                  <span className="hidden md:inline">Operators</span>
                </TabsTrigger>
                <TabsTrigger value="scanner">
                  <FontAwesomeIcon icon="barcode" className="mr-2" />
                  <span className="hidden md:inline">Scanner</span>
                </TabsTrigger>
                <TabsTrigger value="pos">
                  <FontAwesomeIcon icon="cash-register" className="mr-2" />
                  <span className="hidden md:inline">POS</span>
                </TabsTrigger>
                <TabsTrigger value="checkers">
                  <FontAwesomeIcon icon="clipboard-check" className="mr-2" />
                  <span className="hidden md:inline">Checkers</span>
                </TabsTrigger>
                <TabsTrigger value="free-book">
                  <FontAwesomeIcon icon="gift" className="mr-2" />
                  <span className="hidden md:inline">Free Book</span>
                </TabsTrigger>
                <TabsTrigger value="logs">
                  <FontAwesomeIcon icon="history" className="mr-2" />
                  <span className="hidden md:inline">System Logs</span>
                </TabsTrigger>
              </TabsList>
              
              <div className="mt-6">
                <TabsContent value="database">
                  <DatabaseTab operatorName={operatorName} />
                </TabsContent>
                
                <TabsContent value="data">
                  <DataTab />
                </TabsContent>
                
                <TabsContent value="operators">
                  <OperatorsTab operatorName={operatorName} />
                </TabsContent>
                
                <TabsContent value="scanner">
                  <ScannerTab operatorName={operatorName} />
                </TabsContent>
                
                <TabsContent value="pos">
                  <PosTab operatorName={operatorName} />
                </TabsContent>
                
                <TabsContent value="checkers">
                  <CheckersTab operatorName={operatorName} />
                </TabsContent>
                
                <TabsContent value="free-book">
                  <FreeBookTab operatorName={operatorName} />
                </TabsContent>
                
                <TabsContent value="logs">
                  <LogsTab operatorName={operatorName} />
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}