import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Student, Payment } from "@shared/schema";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

interface PaymentResultProps {
  payment: Payment;
  student: Student | undefined;
  onNewPayment: () => void;
}

export function PaymentResult({ payment, student, onNewPayment }: PaymentResultProps) {
  // Get the change breakdown (bills to return)
  const changeBreakdown = payment.changeBreakdown as Record<string, number>;
  
  // Format the actual change (total amount)
  const changeAmount = payment.amountPaid - payment.amountDue;
  
  return (
    <div className="bg-white p-6 rounded-lg border border-neutral-200">
      <div className="text-center mb-6">
        <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FontAwesomeIcon icon="check-circle" className="text-green-600 text-3xl" />
        </div>
        <h3 className="text-xl font-medium text-green-800">Payment Successful</h3>
        <p className="text-neutral-600">
          Receipt #{payment.id} • {formatDateTime(payment.timestamp)}
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card className="p-4 border border-neutral-200 bg-neutral-50">
          <h4 className="text-sm font-medium text-neutral-700 mb-3">Payment Details</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Student Name:</span>
              <span className="font-medium text-neutral-800">{payment.studentName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-600">Student ID:</span>
              <span className="font-medium text-neutral-800">{payment.studentId}</span>
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
                <span className="font-medium text-neutral-800">{formatCurrency(payment.amountDue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Amount Paid:</span>
                <span className="font-medium text-green-700">{formatCurrency(payment.amountPaid)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium mt-1">
                <span className="text-neutral-700">Change:</span>
                <span className="text-green-700">{formatCurrency(changeAmount)}</span>
              </div>
            </div>
          </div>
        </Card>
        
        <Card className="p-4 border border-neutral-200 bg-neutral-50">
          <h4 className="text-sm font-medium text-neutral-700 mb-3">Give the Following Change</h4>
          {changeAmount > 0 ? (
            <div className="space-y-3">
              {Object.entries(changeBreakdown)
                .filter(([_, count]) => count > 0)
                .map(([denomination, count]) => (
                  <div key={denomination} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                        <FontAwesomeIcon icon="money-bill-alt" className="text-green-600" />
                      </div>
                      <div className="text-sm">
                        <p className="font-medium text-neutral-800">
                          ${denomination} {parseInt(denomination) === 1 ? 'Bill' : 'Bills'}
                        </p>
                      </div>
                    </div>
                    <div className="bg-white px-3 py-1 rounded-full border border-neutral-200 text-sm font-medium text-neutral-800">
                      {count} {count === 1 ? 'bill' : 'bills'}
                    </div>
                  </div>
                ))}
              
              <div className="pt-3 mt-3 border-t border-neutral-200 flex justify-between items-center">
                <span className="text-sm font-medium text-neutral-700">Total Change:</span>
                <span className="text-lg font-medium text-green-700">{formatCurrency(changeAmount)}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-32">
              <p className="text-neutral-600 text-center">
                <FontAwesomeIcon icon="check" className="text-green-600 mr-2" />
                Exact payment received. No change needed.
              </p>
            </div>
          )}
        </Card>
      </div>
      
      <div className="text-center space-y-4">
        <p className="text-sm text-neutral-600">
          The student's account has been updated and they may now proceed to the Distribution Station.
        </p>
        <Button 
          size="lg"
          onClick={onNewPayment}
          className="px-8"
        >
          <FontAwesomeIcon icon="redo" className="mr-2" />
          Process Another Payment
        </Button>
      </div>
    </div>
  );
}