import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Operator } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface AdminsTabProps {
  operatorName: string;
}

export function AdminsTab({ operatorName }: AdminsTabProps) {
  // State for authentication
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [secretPhrase, setSecretPhrase] = useState("");
  const [showAuthError, setShowAuthError] = useState(false);
  
  // State for ruby admin management
  const [rubyAdmins, setRubyAdmins] = useState<Array<string>>([]);
  const [newAdminName, setNewAdminName] = useState("");
  const [showAddAdminDialog, setShowAddAdminDialog] = useState(false);
  const [showDeleteAdminDialog, setShowDeleteAdminDialog] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all operators 
  const { data: operators, isLoading } = useQuery<Operator[]>({
    queryKey: ['/api/operators'],
    queryFn: async () => {
      const res = await fetch('/api/operators');
      if (!res.ok) throw new Error('Failed to fetch operators');
      return res.json();
    },
    enabled: isAuthenticated,
  });

  // Effect to extract Ruby admins
  useEffect(() => {
    if (operators) {
      const filteredRubyAdmins = operators
        .filter(op => op.permissions?.ruby === true)
        .map(op => op.name);
      setRubyAdmins(filteredRubyAdmins);
    }
  }, [operators]);

  // Handle authentication
  const handleAuthenticate = () => {
    if (secretPhrase === "ThisIsSuperSecure@1") {
      setIsAuthenticated(true);
      setShowAuthError(false);
      toast({
        title: "Admin Access Granted",
        description: "You now have full administrator privileges.",
      });
    } else {
      setShowAuthError(true);
      toast({
        title: "Authentication Failed",
        description: "The secret phrase is incorrect.",
        variant: "destructive",
      });
    }
  };

  // Update operator mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const response = await fetch(`/api/operators/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update operator');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/operators'] });
      toast({
        title: "Operator Updated",
        description: "The operator's Ruby access has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle Ruby access toggle
  const handleRubyAccessToggle = (operator: Operator, allowAccess: boolean) => {
    // Clone permissions and update
    const updatedPermissions = { ...(operator.permissions || {}) };
    updatedPermissions.ruby = allowAccess;
    
    updateMutation.mutate({
      id: operator.id,
      data: {
        ...operator,
        permissions: updatedPermissions,
      },
    });
  };

  // Create new admin mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/operators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create operator');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/operators'] });
      setNewAdminName("");
      setShowAddAdminDialog(false);
      toast({
        title: "Admin Added",
        description: "New Ruby admin access granted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Admin",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete operator mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/operators/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete operator');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/operators'] });
      setSelectedAdmin(null);
      setShowDeleteAdminDialog(false);
      toast({
        title: "Admin Removed",
        description: "Ruby admin access has been revoked.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Remove Admin",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle add admin form submission
  const handleAddAdmin = () => {
    if (!newAdminName.trim()) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid admin name.",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      name: newAdminName,
      permissions: {
        ruby: true,
        database: true,
        data: true,
        operators: true,
        scanner: true,
        pos: true,
        checkers: true,
        freeBook: true,
        logs: true,
      },
    });
  };

  // Handle delete admin
  const handleDeleteAdmin = () => {
    if (!selectedAdmin || !operators) return;
    
    const operatorToDelete = operators.find(op => op.name === selectedAdmin);
    if (operatorToDelete) {
      deleteMutation.mutate(operatorToDelete.id);
    }
  };

  // If not authenticated, show the authentication screen
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-amber-100 p-4 rounded-full">
                <FontAwesomeIcon 
                  icon="hammer" 
                  className="text-4xl text-amber-600" 
                />
              </div>
            </div>
            
            <h3 className="text-xl font-bold text-center mb-4">
              Administrator Authentication Required
            </h3>
            
            <p className="text-neutral-600 text-center mb-6">
              This area is restricted to system administrators. 
              Please enter the secret phrase to proceed.
            </p>
            
            <div className="space-y-4">
              <div>
                <Input
                  type="password"
                  placeholder="Enter secret phrase"
                  value={secretPhrase}
                  onChange={(e) => setSecretPhrase(e.target.value)}
                  className={showAuthError ? "border-red-500" : ""}
                />
                {showAuthError && (
                  <p className="text-sm text-red-500 mt-1">
                    Incorrect secret phrase. Please try again.
                  </p>
                )}
              </div>
              
              <Button 
                className="w-full" 
                onClick={handleAuthenticate}
              >
                Authenticate
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Ruby Station Access Management</h3>
          <Badge variant="outline" className="py-1">
            <FontAwesomeIcon icon="shield-alt" className="text-green-500 mr-2" />
            Administrator Mode
          </Badge>
        </div>
        <p className="text-neutral-600 mt-2">
          Control who can access the Ruby Station with administrator privileges.
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-medium">Current Ruby Administrators</h4>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowAddAdminDialog(true)}
            >
              <FontAwesomeIcon icon="plus" className="mr-2" />
              Add Admin
            </Button>
          </div>
          
          {isLoading ? (
            <div className="text-center py-8">
              <FontAwesomeIcon icon="circle-notch" className="text-neutral-400 text-4xl animate-spin" />
              <p className="mt-2 text-neutral-600">Loading administrators...</p>
            </div>
          ) : (
            <div>
              {operators && operators.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Ruby Access</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operators.map((operator) => (
                      <TableRow key={operator.id}>
                        <TableCell className="font-medium">{operator.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id={`ruby-access-${operator.id}`}
                              checked={operator.permissions?.ruby === true}
                              onCheckedChange={(checked) => 
                                handleRubyAccessToggle(operator, checked)
                              }
                            />
                            <Label htmlFor={`ruby-access-${operator.id}`}>
                              {operator.permissions?.ruby ? (
                                <span className="text-green-600 font-medium">Enabled</span>
                              ) : (
                                <span className="text-neutral-500">Disabled</span>
                              )}
                            </Label>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(operator.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500"
                            onClick={() => {
                              setSelectedAdmin(operator.name);
                              setShowDeleteAdminDialog(true);
                            }}
                          >
                            <FontAwesomeIcon icon="trash-alt" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 border rounded-md bg-neutral-50">
                  <FontAwesomeIcon icon="user-slash" className="text-neutral-400 text-4xl mb-2" />
                  <p className="text-neutral-600">No operators found</p>
                  <p className="text-neutral-500 text-sm mt-1">Add an operator to grant Ruby access</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="pt-6">
          <h4 className="text-lg font-medium mb-4">Security Guidelines</h4>
          <div className="space-y-3 text-neutral-700">
            <div className="flex items-start space-x-3">
              <FontAwesomeIcon icon="check-circle" className="text-green-500 mt-1" />
              <p>Ruby access should only be granted to authorized administrators.</p>
            </div>
            <div className="flex items-start space-x-3">
              <FontAwesomeIcon icon="check-circle" className="text-green-500 mt-1" />
              <p>Ruby administrators have full access to the system, including database management.</p>
            </div>
            <div className="flex items-start space-x-3">
              <FontAwesomeIcon icon="check-circle" className="text-green-500 mt-1" />
              <p>Review the list of administrators regularly to ensure only authorized personnel have access.</p>
            </div>
            <div className="flex items-start space-x-3">
              <FontAwesomeIcon icon="exclamation-triangle" className="text-amber-500 mt-1" />
              <p>Keep the admin secret phrase secure. Change it if you suspect it has been compromised.</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Add Admin Dialog */}
      <AlertDialog open={showAddAdminDialog} onOpenChange={setShowAddAdminDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add Ruby Administrator</AlertDialogTitle>
            <AlertDialogDescription>
              Enter the username for the new Ruby administrator. They will have full access to all Ruby Station features.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              placeholder="Administrator username"
              value={newAdminName}
              onChange={(e) => setNewAdminName(e.target.value)}
              className="mb-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAddAdmin}>Add Administrator</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Delete Admin Dialog */}
      <AlertDialog open={showDeleteAdminDialog} onOpenChange={setShowDeleteAdminDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Administrator</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {selectedAdmin} from Ruby administrators? 
              They will no longer be able to access Ruby Station functions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteAdmin}
              className="bg-red-500 hover:bg-red-600"
            >
              Remove Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}