import { useAuth } from "@/features/auth/AuthContext";

export function usePermissions() {
  const { user, isAuthenticated, hasRole } = useAuth();

  const isAdmin = hasRole("Administrator") || hasRole("Admin");
  const isFacilityManager = hasRole("FacilityManager");
  const isPharmacist = hasRole("Pharmacist");
  const isProcurementManager = hasRole("ProcurementManager");

  return {
    isAuthenticated,
    user,
    isAdmin,
    isFacilityManager,
    isPharmacist,
    isProcurementManager,
    canApprovePurchaseOrders: isAdmin || isProcurementManager,
    canApproveTransfers: isAdmin || isFacilityManager,
    canReceiveStock: isAdmin || isFacilityManager || isPharmacist,
    canAdjustStock: isAdmin || isFacilityManager,
    canInitiateProcurement: isAdmin || isProcurementManager || isFacilityManager,
    canInitiateTransfer: isAdmin || isFacilityManager || isPharmacist,
  };
}
