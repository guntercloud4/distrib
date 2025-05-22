import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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
          {/* Student photo - always use hardcoded URL format */}
          <div className="bg-neutral-100 rounded-lg overflow-hidden h-48 flex items-center justify-center">
            <img 
              src={`https://cdn.gunter.cloud/faces/${student.lastName}_${student.firstName}.jpg`}
              alt={`${student.firstName} ${student.lastName}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.onerror = null; 
                e.currentTarget.src = ""; 
                e.currentTarget.parentElement!.innerHTML = `
                  <div class="flex flex-col items-center justify-center text-neutral-500 h-full w-full">
                    <svg class="h-12 w-12 mb-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"></path>
                    </svg>
                    <span class="text-sm">No photo available</span>
                  </div>
                `;
              }}
            />
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
                    <FontAwesomeIcon icon="clock" className="text-xs mr-1" />
                  )}
                  {statusText}
                </Badge>
              </div>
            </div>
            
            <div className="border-t border-neutral-200 pt-4">
              <h4 className="text-sm font-medium text-neutral-700 mb-2">Order Details</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className={`p-3 rounded-md ${student.yearbook ? 'bg-green-50' : 'bg-neutral-50'}`}>
                  <p className="text-xs text-neutral-500">Yearbook</p>
                  <p className="font-medium text-neutral-800">
                    {student.yearbook ? (
                      <span className="flex items-center text-green-600">
                        <FontAwesomeIcon icon="check" className="mr-1" />
                        Yes
                      </span>
                    ) : "No"}
                  </p>
                </div>
                <div className={`p-3 rounded-md ${student.personalization ? 'bg-green-50' : 'bg-neutral-50'}`}>
                  <p className="text-xs text-neutral-500">Personalization</p>
                  <p className="font-medium text-neutral-800">
                    {student.personalization ? (
                      <span className="flex items-center text-green-600">
                        <FontAwesomeIcon icon="check" className="mr-1" />
                        Yes
                      </span>
                    ) : "No"}
                  </p>
                </div>
                <div className={`p-3 rounded-md ${student.signaturePackage ? 'bg-green-50' : 'bg-neutral-50'}`}>
                  <p className="text-xs text-neutral-500">Signature Pkg</p>
                  <p className="font-medium text-neutral-800">
                    {student.signaturePackage ? (
                      <span className="flex items-center text-green-600">
                        <FontAwesomeIcon icon="check" className="mr-1" />
                        Yes
                      </span>
                    ) : "No"}
                  </p>
                </div>
                <div className={`p-3 rounded-md ${student.clearCover ? 'bg-green-50' : 'bg-neutral-50'}`}>
                  <p className="text-xs text-neutral-500">Clear Cover</p>
                  <p className="font-medium text-neutral-800">
                    {student.clearCover ? (
                      <span className="flex items-center text-green-600">
                        <FontAwesomeIcon icon="check" className="mr-1" />
                        Yes
                      </span>
                    ) : "No"}
                  </p>
                </div>
                <div className={`p-3 rounded-md ${student.photoPockets ? 'bg-green-50' : 'bg-neutral-50'}`}>
                  <p className="text-xs text-neutral-500">Photo Pockets</p>
                  <p className="font-medium text-neutral-800">
                    {student.photoPockets ? (
                      <span className="flex items-center text-green-600">
                        <FontAwesomeIcon icon="check" className="mr-1" />
                        Yes
                      </span>
                    ) : "No"}
                  </p>
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
