import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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

export function PaymentForm({
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

  const handleBillChange = (type: string, value: number) => {
    setBills(prev => ({
      ...prev,
      [type]: Math.max(0, value) // Ensure values are not negative
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(bills);
  };

  const amountDue = student ? parseFloat(student.balanceDue.toString()) : 0;
  const isEnoughReceived = totalReceived >= amountDue;

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
                <span className="material-icons animate-spin mr-2">sync</span>
                Loading student data...
              </div>
            )}
            
            {isError && (
              <div className="bg-red-50 p-4 rounded-md mt-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <span className="material-icons text-red-400">error</span>
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
                <h3 className="text-lg font-medium text-neutral-800 mb-4">Cash Received</h3>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                  <div>
                    <label htmlFor="bills-1" className="block text-sm font-medium text-neutral-700 mb-1">
                      $1 Bills
                    </label>
                    <Input
                      type="number"
                      id="bills-1"
                      value={bills.one}
                      min={0}
                      onChange={(e) => handleBillChange('one', parseInt(e.target.value) || 0)}
                      disabled={isPending}
                    />
                  </div>
                  <div>
                    <label htmlFor="bills-5" className="block text-sm font-medium text-neutral-700 mb-1">
                      $5 Bills
                    </label>
                    <Input
                      type="number"
                      id="bills-5"
                      value={bills.five}
                      min={0}
                      onChange={(e) => handleBillChange('five', parseInt(e.target.value) || 0)}
                      disabled={isPending}
                    />
                  </div>
                  <div>
                    <label htmlFor="bills-10" className="block text-sm font-medium text-neutral-700 mb-1">
                      $10 Bills
                    </label>
                    <Input
                      type="number"
                      id="bills-10"
                      value={bills.ten}
                      min={0}
                      onChange={(e) => handleBillChange('ten', parseInt(e.target.value) || 0)}
                      disabled={isPending}
                    />
                  </div>
                  <div>
                    <label htmlFor="bills-20" className="block text-sm font-medium text-neutral-700 mb-1">
                      $20 Bills
                    </label>
                    <Input
                      type="number"
                      id="bills-20"
                      value={bills.twenty}
                      min={0}
                      onChange={(e) => handleBillChange('twenty', parseInt(e.target.value) || 0)}
                      disabled={isPending}
                    />
                  </div>
                  <div>
                    <label htmlFor="bills-50" className="block text-sm font-medium text-neutral-700 mb-1">
                      $50 Bills
                    </label>
                    <Input
                      type="number"
                      id="bills-50"
                      value={bills.fifty}
                      min={0}
                      onChange={(e) => handleBillChange('fifty', parseInt(e.target.value) || 0)}
                      disabled={isPending}
                    />
                  </div>
                  <div>
                    <label htmlFor="bills-100" className="block text-sm font-medium text-neutral-700 mb-1">
                      $100 Bills
                    </label>
                    <Input
                      type="number"
                      id="bills-100"
                      value={bills.hundred}
                      min={0}
                      onChange={(e) => handleBillChange('hundred', parseInt(e.target.value) || 0)}
                      disabled={isPending}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between border-t border-neutral-200 pt-6">
                <div>
                  <p className="text-sm font-medium text-neutral-600">
                    Amount Due: <span className="text-lg font-semibold text-neutral-800">{formatCurrency(amountDue)}</span>
                  </p>
                  <p className="text-sm text-neutral-600">
                    Total Received: <span className="font-medium">{formatCurrency(totalReceived)}</span>
                  </p>
                  {totalReceived > 0 && (
                    <p className="text-sm text-neutral-600">
                      Change Due: <span className={`font-medium ${isEnoughReceived ? 'text-green-600' : 'text-red-600'}`}>
                        {isEnoughReceived 
                          ? formatCurrency(totalReceived - amountDue)
                          : `Insufficient (${formatCurrency(amountDue - totalReceived)} more needed)`}
                      </span>
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={!isEnoughReceived || isPending || amountDue === 0}
                  className="inline-flex items-center bg-neutral-800 hover:bg-neutral-900"
                >
                  {isPending ? (
                    <>
                      <span className="material-icons text-base mr-1 animate-spin">sync</span>
                      Processing...
                    </>
                  ) : (
                    <>
                      <span className="material-icons text-base mr-1">payments</span>
                      Process Payment
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
