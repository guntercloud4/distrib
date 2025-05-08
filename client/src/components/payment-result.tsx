import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Payment, Student } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";

interface PaymentResultProps {
  payment: Payment;
  student: Student | undefined;
  onNewPayment: () => void;
}

export function PaymentResult({ payment, student, onNewPayment }: PaymentResultProps) {
  // Format change bills breakdown
  const getChangeBillsDisplay = () => {
    if (!payment.changeBills) return null;
    
    const billLabels: Record<string, string> = {
      hundred: '$100',
      fifty: '$50',
      twenty: '$20',
      ten: '$10',
      five: '$5',
      one: '$1'
    };
    
    return Object.entries(payment.changeBills as Record<string, number>)
      .filter(([_, count]) => count > 0)
      .map(([bill, count]) => (
        <div key={bill} className="text-sm text-neutral-600">
          {billLabels[bill]} x {count}
        </div>
      ));
  };
  
  const changeBillsDisplay = getChangeBillsDisplay();
  const studentName = student ? `${student.firstName} ${student.lastName}` : payment.studentId;

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <h3 className="text-lg font-medium text-neutral-800 mb-4">Payment Summary</h3>
        <div className="space-y-4">
          <div className="bg-green-50 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="material-icons text-green-800">check_circle</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Payment Successful</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>Payment recorded for {studentName}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-neutral-700 mb-2">Transaction Details</h4>
            <div className="bg-neutral-50 p-3 rounded-md space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-neutral-600">Amount Due:</span>
                <span className="text-sm font-medium text-neutral-800">
                  {formatCurrency(Number(payment.amountPaid))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-600">Amount Received:</span>
                <span className="text-sm font-medium text-neutral-800">
                  {formatCurrency(Number(payment.amountPaid) + Number(payment.changeDue))}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-neutral-200">
                <span className="text-sm font-medium text-neutral-700">Change Due:</span>
                <span className="text-sm font-semibold text-neutral-800">
                  {formatCurrency(Number(payment.changeDue))}
                </span>
              </div>
            </div>
          </div>
          
          {changeBillsDisplay && changeBillsDisplay.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-neutral-700 mb-2">Change Breakdown</h4>
              <div className="bg-neutral-50 p-3 rounded-md grid grid-cols-2 gap-2">
                {changeBillsDisplay}
              </div>
            </div>
          )}
          
          <Button
            variant="outline"
            onClick={onNewPayment}
            className="w-full inline-flex justify-center items-center"
          >
            <span className="material-icons text-base mr-1">refresh</span>
            New Payment
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
