import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Student, PaymentProcess } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PosTabProps {
  operatorName: string;
}

interface BillsDenomination {
  one: number;
  five: number;
  ten: number;
  twenty: number;
  fifty: number;
  hundred: number;
}

export function PosTab({ operatorName }: PosTabProps) {
  // Form state
  const [studentId, setStudentId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [price, setPrice] = useState("90.00");
  const [cashGiven, setCashGiven] = useState("");
  
  // Cash denomination state
  const [billsGiven, setBillsGiven] = useState<BillsDenomination>({
    one: 0,
    five: 0,
    ten: 0,
    twenty: 0,
    fifty: 0,
    hundred: 0
  });
  
  // UI state
  const [formStep, setFormStep] = useState(0);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [change, setChange] = useState<Record<string, number>>({});
  const [receiptData, setReceiptData] = useState<any>(null);
  const [foundStudent, setFoundStudent] = useState<Student | null>(null);
  
  // Refs for auto-focus
  const studentIdInputRef = useRef<HTMLInputElement>(null);
  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const lastNameInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Focus the appropriate input when form step changes
  useEffect(() => {
    setTimeout(() => {
      if (formStep === 0 && studentIdInputRef.current) {
        studentIdInputRef.current.focus();
      } else if (formStep === 1 && firstNameInputRef.current) {
        firstNameInputRef.current.focus();
      } else if (formStep === 2 && priceInputRef.current) {
        priceInputRef.current.focus();
      } else if (formStep === 3 && nextButtonRef.current) {
        nextButtonRef.current.focus();
      }
    }, 100);
  }, [formStep]);
  
  // Lookup student
  const lookupStudent = async () => {
    if (!studentId.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a student ID.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const res = await fetch(`/api/students/${studentId}`);
      if (res.ok) {
        const student = await res.json();
        setFoundStudent(student);
        setFirstName(student.firstName);
        setLastName(student.lastName);
        setFormStep(1);
      } else {
        setFoundStudent(null);
        setFormStep(1);
      }
    } catch (error) {
      console.error("Error looking up student:", error);
      setFoundStudent(null);
      setFormStep(1);
    }
  };
  
  // Handle bill buttons
  const handleBillButton = (denomination: keyof BillsDenomination) => {
    setBillsGiven(prev => ({
      ...prev,
      [denomination]: prev[denomination] + 1
    }));
  };
  
  // Handle removing bills
  const handleRemoveBill = (denomination: keyof BillsDenomination) => {
    setBillsGiven(prev => ({
      ...prev,
      [denomination]: Math.max(0, prev[denomination] - 1)
    }));
  };
  
  // Calculate total cash given
  const calculateTotalCash = (): number => {
    return (
      billsGiven.one * 1 +
      billsGiven.five * 5 +
      billsGiven.ten * 10 +
      billsGiven.twenty * 20 +
      billsGiven.fifty * 50 +
      billsGiven.hundred * 100
    );
  };
  
  // Process payment mutation
  const paymentMutation = useMutation({
    mutationFn: async (paymentData: PaymentProcess) => {
      const res = await apiRequest('POST', '/api/payments/process', paymentData);
      return res.json();
    },
    onSuccess: (data) => {
      // Set receipt data for modal
      setReceiptData({
        student: {
          id: studentId,
          firstName,
          lastName,
          orderDate: foundStudent?.orderEnteredDate || new Date().toISOString(),
          balanceDue: foundStudent?.balanceDue || "0"
        },
        payment: data
      });
      
      // Create a distribution and mark it as verified immediately
      // This way the student will show as "Confirmed" in the Data tab
      const confirmDistribution = async () => {
        try {
          // First create a distribution
          const distRes = await apiRequest('POST', '/api/distributions', {
            studentId: studentId,
            operatorName: operatorName,
            timestamp: new Date()
          });
          
          if (distRes.ok) {
            const distData = await distRes.json();
            
            // Then verify it immediately
            await apiRequest('PUT', `/api/distributions/${distData.id}/verify`, {
              verifiedBy: operatorName
            });
            
            // Invalidate distributions query to refresh data
            queryClient.invalidateQueries({ queryKey: ['/api/distributions'] });
          }
        } catch (error) {
          console.error("Error creating/confirming distribution:", error);
        }
      };
      
      // Call the function to create and confirm distribution
      confirmDistribution();
      
      // Show receipt dialog
      setShowReceiptDialog(true);
      
      // Reset form after a short delay
      setTimeout(() => {
        setChange(data.changeBills);
      }, 100);
    },
    onError: (error: Error) => {
      toast({
        title: "Payment Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // Handle form steps
  const handleNext = () => {
    if (formStep === 0) {
      lookupStudent();
    } else if (formStep === 1) {
      if (!firstName.trim() || !lastName.trim()) {
        toast({
          title: "Missing Information",
          description: "Please enter both first and last name.",
          variant: "destructive"
        });
        return;
      }
      setFormStep(2);
    } else if (formStep === 2) {
      if (!price.trim() || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
        toast({
          title: "Invalid Price",
          description: "Please enter a valid price greater than 0.",
          variant: "destructive"
        });
        return;
      }
      setFormStep(3);
    } else if (formStep === 3) {
      // Process payment
      const totalCash = calculateTotalCash();
      const priceValue = parseFloat(price);
      
      if (totalCash < priceValue) {
        toast({
          title: "Insufficient Payment",
          description: "The amount given is less than the price.",
          variant: "destructive"
        });
        return;
      }
      
      paymentMutation.mutate({
        studentId,
        studentName: `${firstName} ${lastName}`,
        amountDue: priceValue,
        bills: billsGiven,
        operatorName
      });
    }
  };
  
  // Handle back button
  const handleBack = () => {
    if (formStep > 0) {
      setFormStep(prev => prev - 1);
    }
  };
  
  // Handle new transaction
  const handleNewTransaction = () => {
    setShowReceiptDialog(false);
    setStudentId("");
    setFirstName("");
    setLastName("");
    setPrice("90.00");
    setCashGiven("");
    setBillsGiven({
      one: 0,
      five: 0,
      ten: 0,
      twenty: 0,
      fifty: 0,
      hundred: 0
    });
    setChange({});
    setReceiptData(null);
    setFoundStudent(null);
    setFormStep(0);
  };
  
  // Handle scanner enter key press
  const handleScannerEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      lookupStudent();
    }
  };

  return (
    <div>
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-neutral-800">Cash POS System</h3>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-neutral-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-neutral-800 mb-4">
                  {formStep === 0 
                    ? "Enter Student Information" 
                    : formStep === 1 
                    ? "Verify Name" 
                    : formStep === 2 
                    ? "Enter Price" 
                    : "Payment"}
                </h4>
                
                {/* Step 1: Enter Student ID */}
                {formStep === 0 && (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="student-id" className="block text-sm font-medium text-neutral-700 mb-1">
                        Student ID
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                          <FontAwesomeIcon icon="id-card" />
                        </span>
                        <Input
                          id="student-id"
                          ref={studentIdInputRef}
                          className="pl-10"
                          placeholder="Enter or scan student ID"
                          value={studentId}
                          onChange={(e) => setStudentId(e.target.value)}
                          onKeyDown={handleScannerEnter}
                        />
                      </div>
                    </div>
                    
                    <Button 
                      onClick={handleNext}
                      className="w-full"
                    >
                      <FontAwesomeIcon icon="arrow-right" className="mr-2" />
                      Next
                    </Button>
                  </div>
                )}
                
                {/* Step 2: Enter/Verify Name */}
                {formStep === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="first-name" className="block text-sm font-medium text-neutral-700 mb-1">
                        First Name
                      </label>
                      <Input
                        id="first-name"
                        ref={firstNameInputRef}
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="last-name" className="block text-sm font-medium text-neutral-700 mb-1">
                        Last Name
                      </label>
                      <Input
                        id="last-name"
                        ref={lastNameInputRef}
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline"
                        onClick={handleBack}
                        className="flex-1"
                      >
                        <FontAwesomeIcon icon="arrow-left" className="mr-2" />
                        Back
                      </Button>
                      
                      <Button 
                        onClick={handleNext}
                        className="flex-1"
                      >
                        <FontAwesomeIcon icon="arrow-right" className="mr-2" />
                        Next
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Step 3: Enter Price */}
                {formStep === 2 && (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="price" className="block text-sm font-medium text-neutral-700 mb-1">
                        Price
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                          $
                        </span>
                        <Input
                          id="price"
                          ref={priceInputRef}
                          className="pl-6"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          type="number"
                          step="0.01"
                          min="0"
                        />
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline"
                        onClick={handleBack}
                        className="flex-1"
                      >
                        <FontAwesomeIcon icon="arrow-left" className="mr-2" />
                        Back
                      </Button>
                      
                      <Button 
                        onClick={handleNext}
                        className="flex-1"
                      >
                        <FontAwesomeIcon icon="arrow-right" className="mr-2" />
                        Next
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Step 4: Payment */}
                {formStep === 3 && (
                  <div className="space-y-4">
                    <div className="bg-white p-3 rounded-md border border-neutral-200">
                      <div className="text-sm font-medium text-neutral-700 mb-1">Order Summary</div>
                      <div className="text-sm text-neutral-600">
                        {firstName} {lastName}
                      </div>
                      <div className="text-sm text-neutral-600">
                        ID: {studentId || "N/A"}
                      </div>
                      <div className="text-lg font-bold text-neutral-800 mt-2">
                        ${parseFloat(price).toFixed(2)}
                      </div>
                    </div>
                    
                    <div className="bg-white p-3 rounded-md border border-neutral-200">
                      <div className="text-sm font-medium text-neutral-700 mb-1">Cash Received</div>
                      <div className="text-lg font-bold text-neutral-800">
                        ${calculateTotalCash().toFixed(2)}
                      </div>
                      
                      <div className="mt-2 flex flex-wrap gap-1">
                        {billsGiven.one > 0 && (
                          <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center">
                            $1 × {billsGiven.one}
                            <button 
                              className="ml-1 text-green-700 hover:text-green-900"
                              onClick={() => handleRemoveBill('one')}
                            >
                              <FontAwesomeIcon icon="times-circle" />
                            </button>
                          </div>
                        )}
                        {billsGiven.five > 0 && (
                          <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center">
                            $5 × {billsGiven.five}
                            <button 
                              className="ml-1 text-green-700 hover:text-green-900"
                              onClick={() => handleRemoveBill('five')}
                            >
                              <FontAwesomeIcon icon="times-circle" />
                            </button>
                          </div>
                        )}
                        {billsGiven.ten > 0 && (
                          <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center">
                            $10 × {billsGiven.ten}
                            <button 
                              className="ml-1 text-green-700 hover:text-green-900"
                              onClick={() => handleRemoveBill('ten')}
                            >
                              <FontAwesomeIcon icon="times-circle" />
                            </button>
                          </div>
                        )}
                        {billsGiven.twenty > 0 && (
                          <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center">
                            $20 × {billsGiven.twenty}
                            <button 
                              className="ml-1 text-green-700 hover:text-green-900"
                              onClick={() => handleRemoveBill('twenty')}
                            >
                              <FontAwesomeIcon icon="times-circle" />
                            </button>
                          </div>
                        )}
                        {billsGiven.fifty > 0 && (
                          <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center">
                            $50 × {billsGiven.fifty}
                            <button 
                              className="ml-1 text-green-700 hover:text-green-900"
                              onClick={() => handleRemoveBill('fifty')}
                            >
                              <FontAwesomeIcon icon="times-circle" />
                            </button>
                          </div>
                        )}
                        {billsGiven.hundred > 0 && (
                          <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center">
                            $100 × {billsGiven.hundred}
                            <button 
                              className="ml-1 text-green-700 hover:text-green-900"
                              onClick={() => handleRemoveBill('hundred')}
                            >
                              <FontAwesomeIcon icon="times-circle" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline"
                        onClick={handleBack}
                        className="flex-1"
                      >
                        <FontAwesomeIcon icon="arrow-left" className="mr-2" />
                        Back
                      </Button>
                      
                      <Button 
                        onClick={handleNext}
                        className="flex-1"
                        disabled={paymentMutation.isPending || calculateTotalCash() < parseFloat(price)}
                        ref={nextButtonRef}
                      >
                        {paymentMutation.isPending ? (
                          <>
                            <FontAwesomeIcon icon="spinner" className="mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon="check" className="mr-2" />
                            Complete Sale
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="lg:col-span-2">
              {formStep === 3 ? (
                <div className="bg-neutral-50 p-6 rounded-lg">
                  <h4 className="text-lg font-medium text-neutral-800 mb-4">Add Cash</h4>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <Button 
                      variant="outline" 
                      className="h-16 text-lg"
                      onClick={() => handleBillButton('one')}
                    >
                      $1
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-16 text-lg"
                      onClick={() => handleBillButton('five')}
                    >
                      $5
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-16 text-lg"
                      onClick={() => handleBillButton('ten')}
                    >
                      $10
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-16 text-lg"
                      onClick={() => handleBillButton('twenty')}
                    >
                      $20
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-16 text-lg"
                      onClick={() => handleBillButton('fifty')}
                    >
                      $50
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-16 text-lg"
                      onClick={() => handleBillButton('hundred')}
                    >
                      $100
                    </Button>
                  </div>
                  
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-sm font-medium text-neutral-700">Amount Due:</div>
                      <div className="text-xl font-bold">${parseFloat(price).toFixed(2)}</div>
                    </div>
                    
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-sm font-medium text-neutral-700">Cash Received:</div>
                      <div className="text-xl font-bold">${calculateTotalCash().toFixed(2)}</div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="text-sm font-medium text-neutral-700">Change Due:</div>
                      <div className="text-xl font-bold text-green-600">
                        ${Math.max(0, calculateTotalCash() - parseFloat(price)).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-neutral-50 p-6 rounded-lg flex flex-col items-center justify-center min-h-[300px]">
                  <div className="text-6xl text-neutral-300 mb-4">
                    <FontAwesomeIcon icon="cash-register" />
                  </div>
                  <div className="text-xl font-medium text-neutral-600 mb-2">Cash Point of Sale</div>
                  <div className="text-neutral-500 text-center max-w-md">
                    Enter student information and complete the transaction by collecting payment.
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Receipt Modal */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center text-xl">
              <FontAwesomeIcon icon="receipt" className="mr-2" />
              Sale Entered
            </DialogTitle>
          </DialogHeader>
          
          {receiptData && (
            <div className="py-4">
              <div className="border-b pb-3 mb-3">
                <div className="text-center mb-3">
                  <div className="text-lg font-bold">
                    {receiptData.student.firstName} {receiptData.student.lastName}
                  </div>
                  <div className="text-sm text-neutral-500">
                    ID: {receiptData.student.id}
                  </div>
                </div>
                
                <div className="flex justify-between text-sm mb-1">
                  <span>Order Date:</span>
                  <span>{new Date(receiptData.student.orderDate).toLocaleDateString()}</span>
                </div>
                
                <div className="flex justify-between text-sm font-semibold">
                  <span>Balance Due:</span>
                  <span>${parseFloat(receiptData.student.balanceDue).toFixed(2)}</span>
                </div>
              </div>
              
              <div className="mb-4">
                <div className="text-sm font-medium mb-2">Payment Details</div>
                
                <div className="flex justify-between text-sm mb-1">
                  <span>Amount Paid:</span>
                  <span>${parseFloat(receiptData.payment.amountPaid).toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between text-sm mb-1">
                  <span>Change Due:</span>
                  <span>${parseFloat(receiptData.payment.changeDue).toFixed(2)}</span>
                </div>
              </div>
              
              {parseFloat(receiptData.payment.changeDue) > 0 && (
                <div className="bg-green-50 p-3 rounded-md mb-4">
                  <div className="text-sm font-medium text-green-800 mb-2">Change Breakdown</div>
                  <div className="grid grid-cols-3 gap-y-1 text-sm">
                    {receiptData.payment.changeBills.hundred > 0 && (
                      <>
                        <div className="text-green-700">$100 bills:</div>
                        <div className="text-green-700">{receiptData.payment.changeBills.hundred}</div>
                        <div className="text-green-700 text-right">${receiptData.payment.changeBills.hundred * 100}</div>
                      </>
                    )}
                    {receiptData.payment.changeBills.fifty > 0 && (
                      <>
                        <div className="text-green-700">$50 bills:</div>
                        <div className="text-green-700">{receiptData.payment.changeBills.fifty}</div>
                        <div className="text-green-700 text-right">${receiptData.payment.changeBills.fifty * 50}</div>
                      </>
                    )}
                    {receiptData.payment.changeBills.twenty > 0 && (
                      <>
                        <div className="text-green-700">$20 bills:</div>
                        <div className="text-green-700">{receiptData.payment.changeBills.twenty}</div>
                        <div className="text-green-700 text-right">${receiptData.payment.changeBills.twenty * 20}</div>
                      </>
                    )}
                    {receiptData.payment.changeBills.ten > 0 && (
                      <>
                        <div className="text-green-700">$10 bills:</div>
                        <div className="text-green-700">{receiptData.payment.changeBills.ten}</div>
                        <div className="text-green-700 text-right">${receiptData.payment.changeBills.ten * 10}</div>
                      </>
                    )}
                    {receiptData.payment.changeBills.five > 0 && (
                      <>
                        <div className="text-green-700">$5 bills:</div>
                        <div className="text-green-700">{receiptData.payment.changeBills.five}</div>
                        <div className="text-green-700 text-right">${receiptData.payment.changeBills.five * 5}</div>
                      </>
                    )}
                    {receiptData.payment.changeBills.one > 0 && (
                      <>
                        <div className="text-green-700">$1 bills:</div>
                        <div className="text-green-700">{receiptData.payment.changeBills.one}</div>
                        <div className="text-green-700 text-right">${receiptData.payment.changeBills.one * 1}</div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button 
              className="w-full" 
              onClick={handleNewTransaction}
            >
              <FontAwesomeIcon icon="plus" className="mr-2" />
              New Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}