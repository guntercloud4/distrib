import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Operator, InsertOperator, OperatorPermissions } from "@shared/schema";

interface OperatorsTabProps {
  operatorName: string;
}

export function OperatorsTab({ operatorName }: OperatorsTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<"operators" | "admin">("operators");
  
  // Admin authentication
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [secretPhrase, setSecretPhrase] = useState("");
  const [showAuthError, setShowAuthError] = useState(false);
  
  // Initialize with type-safe permissions object
  const defaultPermissions: OperatorPermissions = {
    distribution: false,
    checker: false,
    cash: false,
    ruby: false
  };

  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
  const [newOperator, setNewOperator] = useState<InsertOperator>({
    name: "",
    active: true,
    permissions: defaultPermissions
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch operators
  const { 
    data: operators, 
    isLoading: operatorsLoading,
    isError: operatorsError
  } = useQuery<Operator[]>({
    queryKey: ['/api/operators'],
    staleTime: 10000, // 10 seconds
    // Transform the data to ensure permissions object has correct structure
    select: (data) => data.map(operator => {
      // Ensure permissions is properly structured
      const permissions = operator.permissions || {};
      return {
        ...operator,
        permissions: {
          distribution: typeof permissions === 'object' && 'distribution' in permissions ? 
            !!permissions.distribution : false,
          checker: typeof permissions === 'object' && 'checker' in permissions ? 
            !!permissions.checker : false,
          cash: typeof permissions === 'object' && 'cash' in permissions ? 
            !!permissions.cash : false,
          ruby: typeof permissions === 'object' && 'ruby' in permissions ? 
            !!permissions.ruby : false
        }
      };
    })
  });

  // Filter operators
  const filteredOperators = operators?.filter(operator => {
    if (!searchTerm) return true;
    return operator.name.toLowerCase().includes(searchTerm.toLowerCase());
  }) || [];

  // Create operator mutation
  const createOperatorMutation = useMutation({
    mutationFn: async (operatorData: InsertOperator) => {
      const res = await apiRequest("POST", "/api/operators", {
        ...operatorData,
        createdBy: operatorName
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Operator created",
        description: "The operator has been added successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/operators'] });
      setShowAddDialog(false);
      resetNewOperator();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create operator",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Update operator mutation
  const updateOperatorMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<InsertOperator> }) => {
      const res = await apiRequest("PUT", `/api/operators/${id}`, {
        ...data,
        updatedBy: operatorName
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Operator updated",
        description: "The operator has been updated successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/operators'] });
      setShowEditDialog(false);
      setSelectedOperator(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update operator",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete operator mutation
  const deleteOperatorMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/operators/${id}`, {
        deletedBy: operatorName
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Operator deleted",
        description: "The operator has been deleted successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/operators'] });
      setSelectedOperator(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete operator",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Reset new operator form
  const resetNewOperator = () => {
    setNewOperator({
      name: "",
      active: true,
      permissions: {
        distribution: false,
        checker: false,
        cash: false,
        ruby: false
      }
    });
  };

  // Handle opening edit dialog
  const handleEditOperator = (operator: Operator) => {
    setSelectedOperator(operator);
    setShowEditDialog(true);
  };

  // Handle updating permissions
  const handlePermissionChange = (stationType: string, checked: boolean) => {
    if (selectedOperator) {
      // Create a safe copy of current permissions
      const currentPermissions = selectedOperator.permissions || {
        distribution: false,
        checker: false,
        cash: false,
        ruby: false
      };
      
      // Create updated permissions object with type safety
      const updatedPermissions: OperatorPermissions = {
        distribution: stationType === 'distribution' ? checked : !!currentPermissions.distribution,
        checker: stationType === 'checker' ? checked : !!currentPermissions.checker,
        cash: stationType === 'cash' ? checked : !!currentPermissions.cash,
        ruby: stationType === 'ruby' ? checked : !!currentPermissions.ruby
      };
      
      setSelectedOperator({
        ...selectedOperator,
        permissions: updatedPermissions
      });
    }
  };

  // Handle updating new operator permissions
  const handleNewPermissionChange = (stationType: string, checked: boolean) => {
    // Create a safe copy of current permissions
    const currentPermissions = newOperator.permissions || {
      distribution: false,
      checker: false,
      cash: false,
      ruby: false
    };
    
    // Create updated permissions object with type safety
    const updatedPermissions: OperatorPermissions = {
      distribution: stationType === 'distribution' ? checked : !!currentPermissions.distribution,
      checker: stationType === 'checker' ? checked : !!currentPermissions.checker,
      cash: stationType === 'cash' ? checked : !!currentPermissions.cash,
      ruby: stationType === 'ruby' ? checked : !!currentPermissions.ruby
    };
    
    setNewOperator({
      ...newOperator,
      permissions: updatedPermissions
    });
  };

  // Handle admin authentication
  const handleAdminAuthenticate = () => {
    if (secretPhrase === "ThisIsSuperSecure@1") {
      setIsAdminAuthenticated(true);
      setShowAuthError(false);
      toast({
        title: "Ruby Admin Access Granted",
        description: "You now have Ruby administrator privileges.",
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-neutral-800">Management Console</h3>
        <div className="flex space-x-2">
          <Button 
            variant={activeTab === "operators" ? "default" : "outline"}
            onClick={() => setActiveTab("operators")}
          >
            <FontAwesomeIcon icon="users" className="mr-2" />
            Operators
          </Button>
          <Button 
            variant={activeTab === "admin" ? "default" : "outline"}
            onClick={() => setActiveTab("admin")}
          >
            <FontAwesomeIcon icon="hammer" className="mr-2" />
            Ruby Admin
          </Button>
        </div>
      </div>

      {activeTab === "operators" ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-neutral-800">Operators Management</h3>
              <Button onClick={() => setShowAddDialog(true)}>
                <FontAwesomeIcon icon="plus" className="mr-2" />
                Add Operator
              </Button>
            </div>

            <div className="mb-4">
              <div className="relative">
                <Input
                  placeholder="Search operators..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
                <FontAwesomeIcon
                  icon="search"
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                    onClick={() => setSearchTerm("")}
                  >
                    <FontAwesomeIcon icon="times" />
                  </Button>
                )}
              </div>
            </div>

            {operatorsLoading ? (
              <div className="flex justify-center items-center py-12">
                <FontAwesomeIcon icon="spinner" className="animate-spin text-2xl text-neutral-400" />
              </div>
            ) : operatorsError ? (
              <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
                <FontAwesomeIcon icon="exclamation-circle" className="text-3xl mb-4 text-red-500" />
                <p>Failed to load operators</p>
              </div>
            ) : filteredOperators.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
                <FontAwesomeIcon icon="user-slash" className="text-3xl mb-4 text-neutral-300" />
                <p>No operators found</p>
                {searchTerm && <p className="text-sm mt-2">Try a different search term</p>}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOperators.map((operator) => (
                      <TableRow key={operator.id}>
                        <TableCell className="font-medium">{operator.name}</TableCell>
                        <TableCell>
                          {operator.active ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-neutral-50 text-neutral-700 border-neutral-200">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 flex-wrap">
                            {operator.permissions?.distribution && (
                              <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                                Distribution
                              </Badge>
                            )}
                            {operator.permissions?.checker && (
                              <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200">
                                Checker
                              </Badge>
                            )}
                            {operator.permissions?.cash && (
                              <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                                Cash
                              </Badge>
                            )}
                            {operator.permissions?.ruby && (
                              <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200">
                                Ruby Admin
                              </Badge>
                            )}
                            {!operator.permissions?.distribution && 
                             !operator.permissions?.checker && 
                             !operator.permissions?.cash &&
                             !operator.permissions?.ruby && (
                              <span className="text-neutral-400 text-sm">
                                None
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleEditOperator(operator)}
                            >
                              <FontAwesomeIcon icon="edit" className="mr-2" />
                              Edit
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-red-600 hover:text-red-700"
                              onClick={() => {
                                setSelectedOperator(operator);
                                if (confirm(`Are you sure you want to delete operator "${operator.name}"?`)) {
                                  deleteOperatorMutation.mutate(operator.id);
                                }
                              }}
                            >
                              <FontAwesomeIcon icon="trash-alt" className="mr-2" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="mb-8">
              <h3 className="text-lg font-medium text-neutral-800 mb-4">Ruby Administration</h3>
              
              {!isAdminAuthenticated ? (
                <div className="max-w-md mx-auto">
                  <div className="bg-neutral-50 p-6 rounded-lg border border-neutral-200">
                    <h4 className="text-md font-medium mb-4">Authentication Required</h4>
                    <p className="text-neutral-600 mb-4">
                      Enter the admin secret phrase to manage Ruby administration settings:
                    </p>
                    
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="secretPhrase">Secret Phrase</Label>
                        <Input
                          id="secretPhrase"
                          type="password"
                          value={secretPhrase}
                          onChange={(e) => {
                            setSecretPhrase(e.target.value);
                            setShowAuthError(false);
                          }}
                          className={showAuthError ? "border-red-500" : ""}
                        />
                        {showAuthError && (
                          <p className="text-red-500 text-sm mt-1">
                            Incorrect secret phrase. Please try again.
                          </p>
                        )}
                      </div>
                      
                      <Button onClick={handleAdminAuthenticate}>
                        <FontAwesomeIcon icon="key" className="mr-2" />
                        Authenticate
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-6">
                    <div className="flex items-center">
                      <FontAwesomeIcon icon="check-circle" className="text-green-500 mr-3 text-xl" />
                      <div>
                        <h4 className="font-medium text-green-800">Authenticated as Admin</h4>
                        <p className="text-green-700 text-sm">
                          You have full access to Ruby administration settings
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="bg-white border rounded-lg p-4">
                      <h4 className="font-medium mb-3">Secret Access Management</h4>
                      <p className="text-neutral-600 text-sm mb-4">
                        The system is currently using the hardcoded operator "ThisIsSuperSecure@1" for Ruby access.
                      </p>
                      <div className="flex items-center">
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                          <FontAwesomeIcon icon="lock" className="mr-1" />
                          Hardcoded Authentication
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Operator Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Operator</DialogTitle>
            <DialogDescription>
              Add a new operator with specific permissions for different stations.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Operator Name</Label>
              <Input
                id="name"
                value={newOperator.name || ""}
                onChange={(e) => setNewOperator({ ...newOperator, name: e.target.value })}
                placeholder="Enter name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="status"
                  checked={newOperator.active}
                  onCheckedChange={(checked) => setNewOperator({ ...newOperator, active: checked })}
                />
                <Label htmlFor="status" className="cursor-pointer">
                  {newOperator.active ? "Active" : "Inactive"}
                </Label>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Station Permissions</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="distribution"
                    checked={newOperator.permissions?.distribution}
                    onCheckedChange={(checked) => 
                      handleNewPermissionChange("distribution", checked as boolean)
                    }
                  />
                  <Label htmlFor="distribution" className="cursor-pointer">
                    Distribution Station
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="checker"
                    checked={newOperator.permissions?.checker}
                    onCheckedChange={(checked) => 
                      handleNewPermissionChange("checker", checked as boolean)
                    }
                  />
                  <Label htmlFor="checker" className="cursor-pointer">
                    Checker Station
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="cash"
                    checked={newOperator.permissions?.cash}
                    onCheckedChange={(checked) => 
                      handleNewPermissionChange("cash", checked as boolean)
                    }
                  />
                  <Label htmlFor="cash" className="cursor-pointer">
                    Cash Station
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="ruby"
                    checked={newOperator.permissions?.ruby}
                    onCheckedChange={(checked) => 
                      handleNewPermissionChange("ruby", checked as boolean)
                    }
                  />
                  <Label htmlFor="ruby" className="cursor-pointer">
                    Ruby Administration
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newOperator.name) {
                  toast({
                    title: "Name required",
                    description: "Please enter a name for the operator.",
                    variant: "destructive"
                  });
                  return;
                }
                createOperatorMutation.mutate(newOperator);
              }}
              disabled={createOperatorMutation.isPending}
            >
              {createOperatorMutation.isPending ? (
                <>
                  <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Operator Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Operator</DialogTitle>
            <DialogDescription>
              Modify operator details and permissions.
            </DialogDescription>
          </DialogHeader>

          {selectedOperator && (
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={selectedOperator.name}
                  onChange={(e) => setSelectedOperator({ ...selectedOperator, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="edit-status"
                    checked={selectedOperator.active}
                    onCheckedChange={(checked) => 
                      setSelectedOperator({ ...selectedOperator, active: checked })
                    }
                  />
                  <Label htmlFor="edit-status" className="cursor-pointer">
                    {selectedOperator.active ? "Active" : "Inactive"}
                  </Label>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Station Permissions</Label>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="edit-distribution"
                      checked={selectedOperator.permissions?.distribution}
                      onCheckedChange={(checked) => 
                        handlePermissionChange("distribution", checked as boolean)
                      }
                    />
                    <Label htmlFor="edit-distribution" className="cursor-pointer">
                      Distribution Station
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="edit-checker"
                      checked={selectedOperator.permissions?.checker}
                      onCheckedChange={(checked) => 
                        handlePermissionChange("checker", checked as boolean)
                      }
                    />
                    <Label htmlFor="edit-checker" className="cursor-pointer">
                      Checker Station
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="edit-cash"
                      checked={selectedOperator.permissions?.cash}
                      onCheckedChange={(checked) => 
                        handlePermissionChange("cash", checked as boolean)
                      }
                    />
                    <Label htmlFor="edit-cash" className="cursor-pointer">
                      Cash Station
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="edit-ruby"
                      checked={selectedOperator.permissions?.ruby}
                      onCheckedChange={(checked) => 
                        handlePermissionChange("ruby", checked as boolean)
                      }
                    />
                    <Label htmlFor="edit-ruby" className="cursor-pointer">
                      Ruby Administration
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedOperator) {
                  if (!selectedOperator.name) {
                    toast({
                      title: "Name required",
                      description: "Please enter a name for the operator.",
                      variant: "destructive"
                    });
                    return;
                  }
                  updateOperatorMutation.mutate({
                    id: selectedOperator.id,
                    data: {
                      name: selectedOperator.name,
                      active: selectedOperator.active,
                      permissions: selectedOperator.permissions
                    }
                  });
                }
              }}
              disabled={updateOperatorMutation.isPending}
            >
              {updateOperatorMutation.isPending ? (
                <>
                  <FontAwesomeIcon icon="spinner" className="animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                "Update"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}