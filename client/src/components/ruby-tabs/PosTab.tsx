import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CashStation } from "../cash-station";

interface PosTabProps {
  operatorName: string;
}

export function PosTab({ operatorName }: PosTabProps) {
  // We're using the existing CashStation component, but in a wrapper
  // to make it fit the tab interface

  return (
    <div>
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-neutral-800">Cash POS System</h3>
          </div>
          
          <CashStation 
            operatorName={operatorName} 
            onLogout={() => {}} // Empty function since logout is handled by parent
          />
        </CardContent>
      </Card>
    </div>
  );
}