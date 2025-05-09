import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Student, PaymentProcess } from "@shared/schema";
import { formatCurrency, handleScannerEnter, calculateTotalFromBills } from "@/lib/utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { socketProvider } from "@/lib/socket";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";

interface PosTabProps {
  operatorName: string;
}

type BillsDenomination = {
  one: number;
  five: number;
  ten: number;
  twenty: number;
  fifty: number;
  hundred: number;
};

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
  
  // Refs for auto-focus
  const studentIdInputRef = useRef<HTMLInputElement>(null);
  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const lastNameInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  
  const { toast } = useToast();
  
  // Focus the appropriate input when form step changes
  useEffect(() => {
    setTimeout(() => {
      if (formStep === 0 && studentIdInputRef.current) {
        studentIdInputRef.current.focus();
      } else if (formStep === 1 && firstNameInputRef.current) {
        firstNameInputRef.current.focus();
      } else if (formStep === 2 && priceInputRef.current) {
        priceInputRef.current.focus();
      }
    }, 100);
  }, [formStep]);
  
  // Find student query
  const {
    data: student,
    isLoading: studentLoading,
    isError: studentError,
    refetch: refetchStudent
  } = useQuery<Student>({
    queryKey: ['/api/students', studentId],
    queryFn: async () => {
      if (!studentId) return null;
      const res = await fetch(`/api/students/${studentId}`);
      if (!res.ok) {
        // Don't throw an error - we might be manually entering a student
        return null;
      }
      return res.json();
    },
    enabled: !!studentId && studentId.length > 0,
    staleTime: 10000, // 10 seconds
    retry: false
  });
  
  // Process payment mutation
  const paymentMutation = useMutation({
    mutationFn: async (paymentData: PaymentProcess) => {
      const res = await apiRequest('POST', '/api/payments/process', paymentData);
      return await res.json();
    },
    onSuccess: (data) => {
      // Set receipt data
      setReceiptData(data);
      
      // Set change
      setChange(data.change);
      
      // Show the receipt
      setShowReceiptDialog(true);
      
      // Log the payment via WebSocket
      socketProvider.send({
        type: 'LOG_ACTION',
        data: {
          id: Date.now(),
          timestamp: new Date(),
          studentId: studentId,
          action: 'PAYMENT',
          details: { 
            amount: data.amountPaid,
            change: data.changeAmount
          },
          stationName: 'Ruby Station',
          operatorName
        }
      });
      
      // Broadcast the new payment via WebSocket
      socketProvider.send({
        type: 'NEW_PAYMENT',
        data: data
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  // When a student is found, populate the name fields
  useEffect(() => {
    if (student) {
      setFirstName(student.firstName);
      setLastName(student.lastName);
      
      // If we have a student and are in step 0, auto-advance to step 1
      if (formStep === 0) {
        setFormStep(1);
      }
    }
  }, [student, formStep]);
  
  // Calculate total amount given from bills
  const totalGiven = calculateTotalFromBills(billsGiven);
  
  // Calculate change due
  const changeDue = Math.max(0, totalGiven - parseFloat(price || "0"));
  
  // Process the payment
  const processPayment = () => {
    if (!studentId || !firstName || !lastName || !price || totalGiven <= 0) {
      toast({
        title: "Missing Information",
        description: "Please fill out all required fields.",
        variant: "destructive"
      });
      return;
    }
    
    if (totalGiven < parseFloat(price)) {
      toast({
        title: "Insufficient Payment",
        description: "The amount given is less than the price.",
        variant: "destructive"
      });
      return;
    }
    
    const paymentData: PaymentProcess = {
      studentId,
      firstName,
      lastName,
      amountDue: parseFloat(price),
      amountPaid: totalGiven,
      bills: billsGiven,
      operatorName
    };
    
    paymentMutation.mutate(paymentData);
  };
  
  // Handle bill updates
  const updateBill = (denomination: keyof BillsDenomination, value: number) => {
    setBillsGiven(prev => ({
      ...prev,
      [denomination]: Math.max(0, value)
    }));
  };
  
  // Reset the form
  const resetForm = () => {
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
    setFormStep(0);
    setShowReceiptDialog(false);
    setReceiptData(null);
    
    // Focus the student ID input
    setTimeout(() => {
      if (studentIdInputRef.current) {
        studentIdInputRef.current.focus();
      }
    }, 100);
  };
  
  // Handle student ID scanning
  const handleScan = (value: string) => {
    setStudentId(value);
    refetchStudent();
  };
  
  // Go to next form step
  const goToNextStep = () => {
    if (formStep < 2) {
      setFormStep(formStep + 1);
    }
  };
  
  // Go to previous form step
  const goToPrevStep = () => {
    if (formStep > 0) {
      setFormStep(formStep - 1);
    }
  };

  return (
    <div>
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-neutral-800">Cash POS System</h3>
          </div>
          
          <div className="bg-white border border-neutral-200 rounded-lg p-6 shadow-sm">
            {/* Form Steps Indicator */}
            <div className="mb-8">
              <div className="flex items-center justify-center">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    formStep >= 0 ? 'bg-primary text-white' : 'bg-neutral-200 text-neutral-500'
                  }`}
                >
                  1
                </div>
                <div className={`w-16 h-1 ${formStep >= 1 ? 'bg-primary' : 'bg-neutral-200'}`}></div>
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    formStep >= 1 ? 'bg-primary text-white' : 'bg-neutral-200 text-neutral-500'
                  }`}
                >
                  2
                </div>
                <div className={`w-16 h-1 ${formStep >= 2 ? 'bg-primary' : 'bg-neutral-200'}`}></div>
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    formStep >= 2 ? 'bg-primary text-white' : 'bg-neutral-200 text-neutral-500'
                  }`}
                >
                  3
                </div>
              </div>
              <div className="flex items-center justify-center mt-2">
                <div className="w-8 text-center text-xs font-medium">ID</div>
                <div className="w-16"></div>
                <div className="w-8 text-center text-xs font-medium">Name</div>
                <div className="w-16"></div>
                <div className="w-8 text-center text-xs font-medium">Payment</div>
              </div>
            </div>
            
            {/* Step 1: Student ID */}
            {formStep === 0 && (
              <form onSubmit={(e) => { e.preventDefault(); goToNextStep(); }}>
                <div className="text-center mb-6">
                  <h4 className="text-xl font-medium mb-2">Enter Student ID</h4>
                  <p className="text-neutral-600 mb-4">
                    Scan a barcode or manually enter the student ID
                  </p>
                  
                  <div className="max-w-md mx-auto">
                    <div className="relative mb-4">
                      <Input
                        ref={studentIdInputRef}
                        type="text"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        onKeyDown={(e) => handleScannerEnter(e, () => { if (studentId) goToNextStep(); })}
                        placeholder="Enter or scan student ID"
                        className="w-full text-center py-6 text-lg"
                        autoFocus
                      />
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="flex-1" 
                        onClick={resetForm}
                      >
                        <FontAwesomeIcon icon="times" className="mr-2" />
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        className="flex-1" 
                        disabled={!studentId}
                        ref={nextButtonRef}
                      >
                        Continue
                        <FontAwesomeIcon icon="arrow-right" className="ml-2" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                {studentLoading && (
                  <div className="text-center mt-4">
                    <FontAwesomeIcon icon="sync" className="animate-spin text-primary" />
                    <p className="text-sm text-neutral-500 mt-1">Searching for student...</p>
                  </div>
                )}
                
                {studentError && (
                  <div className="text-center mt-4 text-amber-600">
                    <FontAwesomeIcon icon="exclamation-triangle" className="mr-1" />
                    <p className="text-sm mt-1">Student not found. Please check ID or enter manually.</p>
                  </div>
                )}
              </form>
            )}
            
            {/* Step 2: Student Name */}
            {formStep === 1 && (
              <form onSubmit={(e) => { e.preventDefault(); goToNextStep(); }}>
                <div className="text-center mb-6">
                  <h4 className="text-xl font-medium mb-2">Student Information</h4>
                  <p className="text-neutral-600 mb-4">
                    Verify or enter student information
                  </p>
                  
                  <div className="max-w-md mx-auto">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1 text-left">
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <Input
                          ref={firstNameInputRef}
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="First name"
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1 text-left">
                          Last Name <span className="text-red-500">*</span>
                        </label>
                        <Input
                          ref={lastNameInputRef}
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Last name"
                          className="w-full"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && firstName && lastName) {
                              e.preventDefault();
                              goToNextStep();
                            }
                          }}
                        />
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="flex-1" 
                        onClick={goToPrevStep}
                      >
                        <FontAwesomeIcon icon="arrow-left" className="mr-2" />
                        Back
                      </Button>
                      <Button 
                        type="submit" 
                        className="flex-1" 
                        disabled={!firstName || !lastName}
                      >
                        Continue
                        <FontAwesomeIcon icon="arrow-right" className="ml-2" />
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            )}
            
            {/* Step 3: Payment */}
            {formStep === 2 && (
              <div>
                <div className="text-center mb-6">
                  <h4 className="text-xl font-medium mb-2">Payment Information</h4>
                  <p className="text-neutral-600 mb-4">
                    Enter payment details and process transaction
                  </p>
                </div>
                
                <div className="max-w-2xl mx-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column: Customer & Price Info */}
                    <div>
                      <div className="bg-neutral-50 p-4 rounded-lg mb-4">
                        <h5 className="font-medium mb-2">Student Information</h5>
                        <div className="grid grid-cols-3 gap-2 mb-2">
                          <div className="text-sm text-neutral-500">ID:</div>
                          <div className="text-sm font-medium col-span-2">{studentId}</div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="text-sm text-neutral-500">Name:</div>
                          <div className="text-sm font-medium col-span-2">{firstName} {lastName}</div>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                          Price ($) <span className="text-red-500">*</span>
                        </label>
                        <Input
                          ref={priceInputRef}
                          type="number"
                          min="0"
                          step="0.01"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          placeholder="Price"
                          className="w-full text-lg font-medium"
                        />
                      </div>
                      
                      <div className="mb-4 p-4 border border-primary bg-primary-50 rounded-lg">
                        <div className="flex justify-between mb-1">
                          <div className="text-sm font-medium">Price:</div>
                          <div className="text-sm font-medium">{formatCurrency(parseFloat(price || "0"))}</div>
                        </div>
                        <div className="flex justify-between mb-1">
                          <div className="text-sm font-medium">Cash Given:</div>
                          <div className="text-sm font-medium">{formatCurrency(totalGiven)}</div>
                        </div>
                        <div className="h-px bg-neutral-200 my-2"></div>
                        <div className="flex justify-between">
                          <div className="text-base font-bold">Change Due:</div>
                          <div className="text-base font-bold">{formatCurrency(changeDue)}</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Right Column: Bill Selection */}
                    <div>
                      <h5 className="font-medium mb-3">Bills Received</h5>
                      <div className="space-y-3">
                        {/* $1 Bills */}
                        <div className="flex items-center justify-between p-2 border rounded-lg">
                          <div className="flex items-center">
                            <div className="w-10 h-10 flex items-center justify-center bg-green-100 rounded-full mr-3">
                              <FontAwesomeIcon icon="dollar-sign" />
                            </div>
                            <div className="font-medium">$1 Bills</div>
                          </div>
                          <div className="flex items-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={() => updateBill('one', billsGiven.one - 1)}
                              disabled={billsGiven.one === 0}
                            >
                              <FontAwesomeIcon icon="minus" />
                            </Button>
                            <Input
                              type="number"
                              value={billsGiven.one}
                              onChange={(e) => updateBill('one', parseInt(e.target.value || "0"))}
                              className="w-16 mx-2 text-center"
                              min="0"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={() => updateBill('one', billsGiven.one + 1)}
                            >
                              <FontAwesomeIcon icon="plus" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* $5 Bills */}
                        <div className="flex items-center justify-between p-2 border rounded-lg">
                          <div className="flex items-center">
                            <div className="w-10 h-10 flex items-center justify-center bg-blue-100 rounded-full mr-3">
                              <FontAwesomeIcon icon="money-bill-alt" />
                            </div>
                            <div className="font-medium">$5 Bills</div>
                          </div>
                          <div className="flex items-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={() => updateBill('five', billsGiven.five - 1)}
                              disabled={billsGiven.five === 0}
                            >
                              <FontAwesomeIcon icon="minus" />
                            </Button>
                            <Input
                              type="number"
                              value={billsGiven.five}
                              onChange={(e) => updateBill('five', parseInt(e.target.value || "0"))}
                              className="w-16 mx-2 text-center"
                              min="0"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={() => updateBill('five', billsGiven.five + 1)}
                            >
                              <FontAwesomeIcon icon="plus" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* $10 Bills */}
                        <div className="flex items-center justify-between p-2 border rounded-lg">
                          <div className="flex items-center">
                            <div className="w-10 h-10 flex items-center justify-center bg-yellow-100 rounded-full mr-3">
                              <FontAwesomeIcon icon="money-bill-alt" />
                            </div>
                            <div className="font-medium">$10 Bills</div>
                          </div>
                          <div className="flex items-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={() => updateBill('ten', billsGiven.ten - 1)}
                              disabled={billsGiven.ten === 0}
                            >
                              <FontAwesomeIcon icon="minus" />
                            </Button>
                            <Input
                              type="number"
                              value={billsGiven.ten}
                              onChange={(e) => updateBill('ten', parseInt(e.target.value || "0"))}
                              className="w-16 mx-2 text-center"
                              min="0"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={() => updateBill('ten', billsGiven.ten + 1)}
                            >
                              <FontAwesomeIcon icon="plus" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* $20 Bills */}
                        <div className="flex items-center justify-between p-2 border rounded-lg">
                          <div className="flex items-center">
                            <div className="w-10 h-10 flex items-center justify-center bg-green-100 rounded-full mr-3">
                              <FontAwesomeIcon icon="money-bill-alt" />
                            </div>
                            <div className="font-medium">$20 Bills</div>
                          </div>
                          <div className="flex items-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={() => updateBill('twenty', billsGiven.twenty - 1)}
                              disabled={billsGiven.twenty === 0}
                            >
                              <FontAwesomeIcon icon="minus" />
                            </Button>
                            <Input
                              type="number"
                              value={billsGiven.twenty}
                              onChange={(e) => updateBill('twenty', parseInt(e.target.value || "0"))}
                              className="w-16 mx-2 text-center"
                              min="0"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={() => updateBill('twenty', billsGiven.twenty + 1)}
                            >
                              <FontAwesomeIcon icon="plus" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* $50 Bills */}
                        <div className="flex items-center justify-between p-2 border rounded-lg">
                          <div className="flex items-center">
                            <div className="w-10 h-10 flex items-center justify-center bg-amber-100 rounded-full mr-3">
                              <FontAwesomeIcon icon="money-bill-alt" />
                            </div>
                            <div className="font-medium">$50 Bills</div>
                          </div>
                          <div className="flex items-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={() => updateBill('fifty', billsGiven.fifty - 1)}
                              disabled={billsGiven.fifty === 0}
                            >
                              <FontAwesomeIcon icon="minus" />
                            </Button>
                            <Input
                              type="number"
                              value={billsGiven.fifty}
                              onChange={(e) => updateBill('fifty', parseInt(e.target.value || "0"))}
                              className="w-16 mx-2 text-center"
                              min="0"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={() => updateBill('fifty', billsGiven.fifty + 1)}
                            >
                              <FontAwesomeIcon icon="plus" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* $100 Bills */}
                        <div className="flex items-center justify-between p-2 border rounded-lg">
                          <div className="flex items-center">
                            <div className="w-10 h-10 flex items-center justify-center bg-purple-100 rounded-full mr-3">
                              <FontAwesomeIcon icon="money-bill-alt" />
                            </div>
                            <div className="font-medium">$100 Bills</div>
                          </div>
                          <div className="flex items-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={() => updateBill('hundred', billsGiven.hundred - 1)}
                              disabled={billsGiven.hundred === 0}
                            >
                              <FontAwesomeIcon icon="minus" />
                            </Button>
                            <Input
                              type="number"
                              value={billsGiven.hundred}
                              onChange={(e) => updateBill('hundred', parseInt(e.target.value || "0"))}
                              className="w-16 mx-2 text-center"
                              min="0"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-full"
                              onClick={() => updateBill('hundred', billsGiven.hundred + 1)}
                            >
                              <FontAwesomeIcon icon="plus" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 mt-6">
                    <Button 
                      variant="outline" 
                      className="flex-1" 
                      onClick={goToPrevStep}
                    >
                      <FontAwesomeIcon icon="arrow-left" className="mr-2" />
                      Back
                    </Button>
                    <Button 
                      className="flex-1" 
                      disabled={!studentId || !firstName || !lastName || !price || totalGiven <= 0 || totalGiven < parseFloat(price) || paymentMutation.isPending}
                      onClick={processPayment}
                    >
                      {paymentMutation.isPending ? (
                        <>
                          <FontAwesomeIcon icon="sync" className="mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon="check" className="mr-2" />
                          Complete Payment
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Receipt Dialog */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl text-green-600">
              <FontAwesomeIcon icon="check-circle" className="mr-2" />
              Sale Entered
            </DialogTitle>
            <DialogDescription className="text-center">
              Payment processed successfully
            </DialogDescription>
          </DialogHeader>
          
          {receiptData && (
            <div className="py-4">
              <div className="bg-neutral-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-y-2">
                  <div className="text-neutral-600">Student ID:</div>
                  <div className="font-medium">{studentId}</div>
                  <div className="text-neutral-600">Name:</div>
                  <div className="font-medium">{firstName} {lastName}</div>
                  <div className="text-neutral-600">Order Date:</div>
                  <div className="font-medium">{new Date().toLocaleDateString()}</div>
                  <div className="text-neutral-600">Amount Due:</div>
                  <div className="font-medium">{formatCurrency(parseFloat(price))}</div>
                  <div className="text-neutral-600">Amount Paid:</div>
                  <div className="font-medium">{formatCurrency(totalGiven)}</div>
                  <div className="text-neutral-600 font-medium">Change Due:</div>
                  <div className="font-medium">{formatCurrency(changeDue)}</div>
                </div>
              </div>
              
              {changeDue > 0 && (
                <div className="border border-green-200 rounded-lg p-4 mb-4 bg-green-50">
                  <h5 className="font-medium text-green-800 mb-2">Change Breakdown</h5>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {Object.entries(change).map(([bill, count]) => (
                      <React.Fragment key={bill}>
                        {count > 0 && (
                          <>
                            <div className="text-sm text-green-700">${bill} bills:</div>
                            <div className="text-sm font-medium text-green-700">{count}</div>
                          </>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button 
              onClick={resetForm} 
              className="w-full"
            >
              <FontAwesomeIcon icon="receipt" className="mr-2" />
              New Sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}