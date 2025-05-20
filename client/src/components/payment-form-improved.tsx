import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Student } from "@shared/schema";
import { handleScannerEnter, formatCurrency } from "@/lib/utils";

interface PaymentFormProps {
  studentId: string;
  student: Student | undefined;
  studentName: string;
  setStudentName: (name: string) => void;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  onScan: (value: string) => void;
  onSubmit: (bills: Record<string, number>) => void;
  isPending: boolean;
}

export function PaymentFormImproved({
  studentId,
  student,
  studentName,
  setStudentName,
  isLoading,
  isError,
  error,
  onScan,
  onSubmit,
  isPending
}: PaymentFormProps) {
  const [bills, setBills] = useState({
    one: 0,
    five: 0,
    ten: 0,
    twenty: 0,
    fifty: 0,
    hundred: 0
  });
  const [totalReceived, setTotalReceived] = useState(0);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // Calculate total received when bills change
  useEffect(() => {
    const total = 
      (bills.one * 1) +
      (bills.five * 5) +
      (bills.ten * 10) +
      (bills.twenty * 20) +
      (bills.fifty * 50) +
      (bills.hundred * 100);
    
    setTotalReceived(total);
  }, [bills]);

  // Handle direct input of bill quantities
  const handleBillChange = (type: string, value: number) => {
    setBills(prev => ({
      ...prev,
      [type]: Math.max(0, value) // Ensure values are not negative
    }));
  };
  
  // Quick add functionality for adding preset amounts
  const handleQuickAdd = (amount: number) => {
    // Determine which denominations to add based on the amount
    let remainingAmount = amount;
    const newBills = { ...bills };
    
    // Try to use larger bills first for larger amounts
    if (remainingAmount >= 100) {
      const count = Math.floor(remainingAmount / 100);
      newBills.hundred += count;
      remainingAmount -= count * 100;
    }
    
    if (remainingAmount >= 50) {
      const count = Math.floor(remainingAmount / 50);
      newBills.fifty += count;
      remainingAmount -= count * 50;
    }
    
    if (remainingAmount >= 20) {
      const count = Math.floor(remainingAmount / 20);
      newBills.twenty += count;
      remainingAmount -= count * 20;
    }
    
    if (remainingAmount >= 10) {
      const count = Math.floor(remainingAmount / 10);
      newBills.ten += count;
      remainingAmount -= count * 10;
    }
    
    if (remainingAmount >= 5) {
      const count = Math.floor(remainingAmount / 5);
      newBills.five += count;
      remainingAmount -= count * 5;
    }
    
    if (remainingAmount >= 1) {
      newBills.one += remainingAmount;
    }
    
    setBills(newBills);
  };
  
  // Reset all bills to zero
  const handleClearAll = () => {
    setBills({
      one: 0,
      five: 0,
      ten: 0,
      twenty: 0,
      fifty: 0,
      hundred: 0
    });
  };
  
  // Add/Remove buttons for each bill denomination
  const handleAddBill = (type: string) => {
    setBills(prev => ({
      ...prev,
      [type]: prev[type as keyof typeof prev] + 1
    }));
  };
  
  const handleRemoveBill = (type: string) => {
    setBills(prev => ({
      ...prev,
      [type]: Math.max(0, prev[type as keyof typeof prev] - 1) // Ensure it doesn't go below 0
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(bills);
  };

  const amountDue = student ? parseFloat(student.balanceDue.toString()) : 0;
  const isEnoughReceived = totalReceived >= amountDue;
  
  // Create a bill row with consistent styling
  const renderBillRow = (label: string, type: string, value: number) => (
    <div className="flex flex-col">
      <label className="block text-sm font-medium text-neutral-700 mb-1">
        {label}
      </label>
      <div className="flex rounded-md shadow-sm">
        <Button 
          type="button" 
          size="icon" 
          variant="outline" 
          className="rounded-r-none border-r-0" 
          onClick={() => handleRemoveBill(type)}
          disabled={value === 0 || isPending}
        >
          -
        </Button>
        <Input
          type="number"
          value={value}
          min={0}
          onChange={(e) => handleBillChange(type, parseInt(e.target.value) || 0)}
          disabled={isPending}
          className="rounded-none text-center w-12 h-9 p-1 border-x-0"
        />
        <Button 
          type="button" 
          size="icon" 
          variant="outline" 
          className="rounded-l-none border-l-0" 
          onClick={() => handleAddBill(type)}
          disabled={isPending}
        >
          +
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <h3 className="text-lg font-medium text-neutral-800 mb-4">Payment Entry</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cash-student-id" className="block text-sm font-medium text-neutral-700 mb-1">
                  Student ID
                </label>
                <div className="relative">
                  <Input
                    id="cash-student-id"
                    className="scanner-input w-full"
                    placeholder="Enter Student ID"
                    onKeyDown={(e) => handleScannerEnter(e, onScan)}
                    disabled={isLoading || isPending}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="cash-student-name" className="block text-sm font-medium text-neutral-700 mb-1">
                  Student Name
                </label>
                <Input
                  id="cash-student-name"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Enter Student Name"
                  disabled={isLoading || isPending}
                />
              </div>
            </div>
            
            {isLoading && (
              <div className="flex items-center justify-center mt-4 text-neutral-600">
                <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                Loading student data...
              </div>
            )}
            
            {isError && (
              <div className="bg-red-50 p-4 rounded-md mt-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <FontAwesomeIcon icon="circle-exclamation" className="text-red-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{error?.message || "Failed to load student data"}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {student && !isLoading && !isError && (
            <>
              <div className="border-t border-neutral-200 pt-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-neutral-800">Cash Received</h3>
                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowQuickAdd(!showQuickAdd)}
                      className="text-xs"
                    >
                      <FontAwesomeIcon icon="bolt" className="mr-1" />
                      Quick Add
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleClearAll}
                      className="text-xs"
                      disabled={Object.values(bills).every(v => v === 0)}
                    >
                      <FontAwesomeIcon icon="trash" className="mr-1" />
                      Clear All
                    </Button>
                  </div>
                </div>
                
                {showQuickAdd && (
                  <div className="bg-neutral-50 p-3 rounded-md mb-4">
                    <p className="text-sm text-neutral-700 mb-2">Quick Add Presets:</p>
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleQuickAdd(1)}
                        className="text-xs"
                      >
                        +$1
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleQuickAdd(5)}
                        className="text-xs"
                      >
                        +$5
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleQuickAdd(10)}
                        className="text-xs"
                      >
                        +$10
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleQuickAdd(20)}
                        className="text-xs"
                      >
                        +$20
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleQuickAdd(50)}
                        className="text-xs"
                      >
                        +$50
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleQuickAdd(100)}
                        className="text-xs"
                      >
                        +$100
                      </Button>
                      {student && amountDue > 0 && (
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleQuickAdd(amountDue)}
                          className="text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                        >
                          +Exact Amount ({formatCurrency(amountDue)})
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                  {renderBillRow("$1 Bills", "one", bills.one)}
                  {renderBillRow("$5 Bills", "five", bills.five)}
                  {renderBillRow("$10 Bills", "ten", bills.ten)}
                  {renderBillRow("$20 Bills", "twenty", bills.twenty)}
                  {renderBillRow("$50 Bills", "fifty", bills.fifty)}
                  {renderBillRow("$100 Bills", "hundred", bills.hundred)}
                </div>
                
                <div className="mt-4 p-3 bg-neutral-50 rounded-md">
                  <h4 className="text-sm font-medium text-neutral-800 mb-1">Bill Summary</h4>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-sm">
                    {bills.one > 0 && <div className="text-neutral-600">$1 x {bills.one}</div>}
                    {bills.five > 0 && <div className="text-neutral-600">$5 x {bills.five}</div>}
                    {bills.ten > 0 && <div className="text-neutral-600">$10 x {bills.ten}</div>}
                    {bills.twenty > 0 && <div className="text-neutral-600">$20 x {bills.twenty}</div>}
                    {bills.fifty > 0 && <div className="text-neutral-600">$50 x {bills.fifty}</div>}
                    {bills.hundred > 0 && <div className="text-neutral-600">$100 x {bills.hundred}</div>}
                    {Object.values(bills).every(v => v === 0) && <div className="text-neutral-500">No bills added yet</div>}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col md:flex-row md:items-center md:justify-between border-t border-neutral-200 pt-6">
                <div className="mb-4 md:mb-0">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <p className="text-sm font-medium text-neutral-600">Amount Due:</p>
                    <p className="text-lg font-semibold text-neutral-800">{formatCurrency(amountDue)}</p>
                    
                    <p className="text-sm font-medium text-neutral-600">Total Received:</p>
                    <p className="text-lg font-semibold text-neutral-800">{formatCurrency(totalReceived)}</p>
                    
                    {totalReceived > 0 && (
                      <>
                        <p className="text-sm font-medium text-neutral-600">Change Due:</p>
                        <p className={`text-lg font-semibold ${isEnoughReceived ? 'text-green-600' : 'text-red-600'}`}>
                          {isEnoughReceived 
                            ? formatCurrency(totalReceived - amountDue)
                            : `(${formatCurrency(amountDue - totalReceived)} more needed)`}
                        </p>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClearAll}
                    disabled={Object.values(bills).every(v => v === 0) || isPending}
                  >
                    <FontAwesomeIcon icon="trash" className="mr-2" />
                    Reset
                  </Button>
                  
                  <Button
                    type="submit"
                    disabled={!isEnoughReceived || isPending || amountDue === 0}
                    className="bg-neutral-800 hover:bg-neutral-900"
                  >
                    {isPending ? (
                      <>
                        <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon="check" className="mr-2" />
                        Process Payment
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  );
}