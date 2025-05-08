import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Student } from "@shared/schema";
import { formatCurrency, calculateTotalFromBills } from "@/lib/utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

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
  // Bill denomination inputs
  const [billInputs, setBillInputs] = useState<Record<string, number>>({
    "1": 0,   // $1 bills
    "5": 0,   // $5 bills
    "10": 0,  // $10 bills
    "20": 0,  // $20 bills
    "50": 0,  // $50 bills
    "100": 0, // $100 bills
  });
  
  // Calculate total amount being paid
  const totalAmount = calculateTotalFromBills(billInputs);
  
  // Calculate amount due
  const amountDue = student?.balanceDue 
    ? parseFloat(student.balanceDue.toString()) 
    : 0;
  
  // Calculate change due
  const changeDue = Math.max(0, totalAmount - amountDue);
  const insufficientAmount = totalAmount < amountDue;
  
  // Update student name if we have a student record
  useEffect(() => {
    if (student) {
      setStudentName(`${student.firstName} ${student.lastName}`);
    }
  }, [student, setStudentName]);
  
  // Handle bill input changes
  const handleBillChange = (denomination: string, value: string) => {
    const numValue = parseInt(value) || 0;
    
    // Enforce non-negative values
    if (numValue < 0) return;
    
    setBillInputs(prev => ({
      ...prev,
      [denomination]: numValue
    }));
  };
  
  // Handle payment submission
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (insufficientAmount) {
      return; // Don't submit if payment is insufficient
    }
    
    onSubmit(billInputs);
  };
  
  // Reset form
  const handleReset = () => {
    setBillInputs({
      "1": 0,
      "5": 0,
      "10": 0,
      "20": 0,
      "50": 0,
      "100": 0,
    });
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-neutral-200">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h4 className="text-md font-medium text-neutral-700 mb-1">Payment Details</h4>
          <p className="text-sm text-neutral-600">
            Student: <span className="font-medium">{studentName}</span>
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => onScan("")}
        >
          <FontAwesomeIcon icon="arrow-left" className="mr-2" />
          Back
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card className="p-4 border border-neutral-200 bg-neutral-50">
          <h5 className="text-sm font-medium text-neutral-700 mb-3">Payment Summary</h5>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Student ID:</span>
              <span className="font-medium text-neutral-800">{studentId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Student Name:</span>
              <span className="font-medium text-neutral-800">{studentName}</span>
            </div>
            {student && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Order Number:</span>
                  <span className="font-medium text-neutral-800">{student.orderNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Order Type:</span>
                  <span className="font-medium text-neutral-800">{student.orderType}</span>
                </div>
              </>
            )}
            <div className="mt-3 pt-3 border-t border-neutral-200">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Amount Due:</span>
                <span className="font-medium text-neutral-800">{formatCurrency(amountDue)}</span>
              </div>
            </div>
          </div>
        </Card>
        
        <Card className="p-4 border border-neutral-200 bg-neutral-50">
          <h5 className="text-sm font-medium text-neutral-700 mb-3">Current Transaction</h5>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Amount Received:</span>
              <span className="font-medium text-green-700">{formatCurrency(totalAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Amount Due:</span>
              <span className="font-medium text-red-700">{formatCurrency(amountDue)}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-neutral-200">
              <div className="flex justify-between text-sm font-medium">
                <span className={changeDue > 0 ? "text-green-700" : "text-neutral-600"}>
                  Change Due:
                </span>
                <span className={`${changeDue > 0 ? "text-green-700" : "text-neutral-800"} text-lg`}>
                  {formatCurrency(changeDue)}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
      
      <form onSubmit={handlePaymentSubmit}>
        <h5 className="text-sm font-medium text-neutral-700 mb-3">Enter Bills Received</h5>
        <div className="bg-white p-4 border border-neutral-200 rounded-lg mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {Object.entries({
              "1": "$1 Bills",
              "5": "$5 Bills",
              "10": "$10 Bills",
              "20": "$20 Bills",
              "50": "$50 Bills",
              "100": "$100 Bills"
            }).map(([denomination, label]) => (
              <div key={denomination}>
                <label className="block text-xs font-medium text-neutral-600 mb-1">
                  {label}
                </label>
                <Input
                  type="number"
                  min="0"
                  value={billInputs[denomination]}
                  onChange={(e) => handleBillChange(denomination, e.target.value)}
                  className="text-center"
                />
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-between space-y-3 sm:space-y-0 sm:space-x-3">
          <Button
            type="button"
            variant="outline"
            className="sm:flex-1"
            onClick={handleReset}
          >
            <FontAwesomeIcon icon="times" className="mr-2" />
            Reset
          </Button>
          <Button
            type="submit"
            className="sm:flex-1 bg-green-600 hover:bg-green-700"
            disabled={isPending || totalAmount === 0 || insufficientAmount}
          >
            {isPending ? (
              <>
                <FontAwesomeIcon icon="sync" className="mr-2 animate-spin" />
                Processing...
              </>
            ) : insufficientAmount ? (
              <>
                <FontAwesomeIcon icon="exclamation-triangle" className="mr-2" />
                Insufficient Amount
              </>
            ) : (
              <>
                <FontAwesomeIcon icon="check" className="mr-2" />
                Process Payment
              </>
            )}
          </Button>
        </div>
        
        {insufficientAmount && (
          <p className="text-sm text-red-600 text-center mt-3">
            <FontAwesomeIcon icon="exclamation-triangle" className="mr-1" />
            The amount received ({formatCurrency(totalAmount)}) is less than the amount due ({formatCurrency(amountDue)}).
          </p>
        )}
      </form>
    </div>
  );
}