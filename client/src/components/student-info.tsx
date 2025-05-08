import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Student, Distribution } from "@shared/schema";
import { formatCurrency, formatDateTime, getPaymentStatusColor } from "@/lib/utils";

interface StudentInfoProps {
  student: Student;
  distributionInfo?: Distribution;
  showActions?: boolean;
  showVerificationStatus?: boolean;
  actionButton?: React.ReactNode;
}

export function StudentInfo({ 
  student, 
  distributionInfo,
  showActions = false,
  showVerificationStatus = false,
  actionButton 
}: StudentInfoProps) {
  const isDistributed = !!distributionInfo;
  const isVerified = distributionInfo?.verified;
  
  let statusText = "Awaiting Distribution";
  let statusClass = "bg-gray-100 text-gray-800";
  
  if (showVerificationStatus) {
    if (isVerified) {
      statusText = "Verified";
      statusClass = "bg-green-100 text-green-800";
    } else {
      statusText = "Awaiting Verification";
      statusClass = "bg-yellow-100 text-yellow-800";
    }
  } else {
    statusClass = getPaymentStatusColor(student.paymentStatus);
    statusText = student.paymentStatus;
  }

  return (
    <Card className="overflow-hidden mb-6">
      <CardContent className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          {/* Student photo placeholder - would be replaced with actual photo */}
          <div className="bg-neutral-200 rounded-lg overflow-hidden h-48 flex items-center justify-center">
            <span className="material-icons text-neutral-500 text-5xl">person</span>
          </div>
        </div>
        
        <div className="md:col-span-3">
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-neutral-800">
                  {student.firstName} {student.lastName}
                </h3>
                <p className="text-sm text-neutral-600">ID: {student.studentId}</p>
              </div>
              <div>
                <Badge className={statusClass}>
                  {showVerificationStatus && !isVerified && (
                    <span className="material-icons text-xs mr-1">schedule</span>
                  )}
                  {statusText}
                </Badge>
              </div>
            </div>
            
            <div className="border-t border-neutral-200 pt-4">
              <h4 className="text-sm font-medium text-neutral-700 mb-2">Order Details</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="bg-neutral-50 p-3 rounded-md">
                  <p className="text-xs text-neutral-500">Yearbook</p>
                  <p className="font-medium text-neutral-800">{student.yearbook ? "Yes" : "No"}</p>
                </div>
                <div className="bg-neutral-50 p-3 rounded-md">
                  <p className="text-xs text-neutral-500">Personalization</p>
                  <p className="font-medium text-neutral-800">{student.personalization ? "Yes" : "No"}</p>
                </div>
                <div className="bg-neutral-50 p-3 rounded-md">
                  <p className="text-xs text-neutral-500">Signature Pkg</p>
                  <p className="font-medium text-neutral-800">{student.signaturePackage ? "Yes" : "No"}</p>
                </div>
                <div className="bg-neutral-50 p-3 rounded-md">
                  <p className="text-xs text-neutral-500">Clear Cover</p>
                  <p className="font-medium text-neutral-800">{student.clearCover ? "Yes" : "No"}</p>
                </div>
                <div className="bg-neutral-50 p-3 rounded-md">
                  <p className="text-xs text-neutral-500">Photo Pockets</p>
                  <p className="font-medium text-neutral-800">{student.photoPockets ? "Yes" : "No"}</p>
                </div>
              </div>
            </div>
            
            <div className="border-t border-neutral-200 pt-4">
              <div className={`flex ${showVerificationStatus ? 'flex-col sm:flex-row' : ''} items-center justify-between`}>
                <div>
                  <p className="text-sm font-medium text-neutral-700">
                    Order Number: <span className="text-neutral-800">{student.orderNumber}</span>
                  </p>
                  <p className="text-sm text-neutral-600">
                    Order Date: <span>{formatDateTime(student.orderEnteredDate)}</span>
                  </p>
                  
                  {showVerificationStatus && distributionInfo && (
                    <>
                      <p className="text-sm text-neutral-700 mt-2">
                        Distribution completed by: <span className="font-medium text-neutral-800">{distributionInfo.operatorName}</span>
                      </p>
                      <p className="text-sm text-neutral-600">
                        Distribution time: <span>{formatDateTime(distributionInfo.timestamp)}</span>
                      </p>
                    </>
                  )}
                  
                  {showVerificationStatus && isVerified && distributionInfo && (
                    <>
                      <p className="text-sm text-neutral-700 mt-2">
                        Verified by: <span className="font-medium text-neutral-800">{distributionInfo.verifiedBy}</span>
                      </p>
                      <p className="text-sm text-neutral-600">
                        Verification time: <span>{formatDateTime(distributionInfo.verifiedAt!)}</span>
                      </p>
                    </>
                  )}
                </div>
                
                {showActions && actionButton}
                {showVerificationStatus && actionButton}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
