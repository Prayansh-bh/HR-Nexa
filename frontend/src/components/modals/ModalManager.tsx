import React, { Suspense } from "react";
import { useToast } from "../../hooks";
import { ConfirmModal } from "../ui";
import { AuthUser, Employee } from "../../types";

const AddEmployeeModal = React.lazy(() =>
  import("../../features/employees/modals/AddEmployeeModal").then((m) => ({
    default: m.AddEmployeeModal,
  })),
);
const SeatLimitModal = React.lazy(() =>
  import("../../features/employees/modals/SeatLimitModal").then((m) => ({
    default: m.SeatLimitModal,
  })),
);
const ApplyLeaveModal = React.lazy(() =>
  import("../../features/leave/modals/ApplyLeaveModal").then((m) => ({
    default: m.ApplyLeaveModal,
  })),
);
const ViewEmployeeDrawer = React.lazy(() =>
  import("../../features/employees/components/ViewEmployeeDrawer").then((m) => ({
    default: m.ViewEmployeeDrawer,
  })),
);
const MessageModal = React.lazy(() =>
  import("../../features/messaging/modals/MessageModal").then((m) => ({ default: m.MessageModal })),
);
const DocumentViewerModal = React.lazy(() =>
  import("../../features/documents/pages/DocumentsPage").then((m) => ({
    default: m.DocumentViewerModal,
  })),
);

import { useUIStore, useMessagingStore } from "../../store";
import { useEmployeesQuery } from "../../hooks/useEmployeesQuery";
import { useDepartmentsQuery, useDesignationsQuery } from "../../hooks/useOrgQuery";
import { useLeaveTypesQuery, useLeaveMutations } from "../../hooks/useLeavesQuery";
import { saveEmployee } from "../../store/actions/employeeActions";

interface ModalManagerProps {
  user: AuthUser;
}

function AddEmployeeModalWrapper({ toast, empModal, setEmpModal }: any) {
  const { data: employeesData, employees: employeesProp } = useEmployeesQuery();
  const employees: Employee[] = Array.isArray(employeesProp) && employeesProp.length > 0
    ? employeesProp
    : (Array.isArray(employeesData)
        ? employeesData
        : (employeesData && Array.isArray((employeesData as any).data)
            ? (employeesData as any).data
            : (Array.isArray(employeesProp) ? employeesProp : [])));
  const { data: departmentsData } = useDepartmentsQuery();
  const departments = departmentsData || [];
  const { data: designationsData } = useDesignationsQuery();
  const designations = designationsData || [];

  return (
    <AddEmployeeModal
      onClose={() => setEmpModal({ open: false })}
      onSave={(e, isEdit) => saveEmployee(e, isEdit, toast)}
      departments={departments.map((d) => d.name)}
      designations={designations.map((d) => d.name)}
      editing={empModal.editing}
      employeeCount={employees.length}
    />
  );
}

function ApplyLeaveModalWrapper({ user, toast, setLeaveModal }: any) {
  const { data: employeesData, employees: employeesProp } = useEmployeesQuery();
  const employees: Employee[] = Array.isArray(employeesProp) && employeesProp.length > 0
    ? employeesProp
    : (Array.isArray(employeesData)
        ? employeesData
        : (employeesData && Array.isArray((employeesData as any).data)
            ? (employeesData as any).data
            : (Array.isArray(employeesProp) ? employeesProp : [])));
  const { data: leaveTypesData } = useLeaveTypesQuery();
  const leaveTypes = leaveTypesData || [];
  const { createLeave } = useLeaveMutations();

  return (
    <ApplyLeaveModal
      onClose={() => setLeaveModal(false)}
      employees={employees}
      leaveTypes={leaveTypes}
      currentUser={user}
      onSubmit={async (l) => {
        const isEmployee = user.role === "Employee";
        const emp = isEmployee ? null : employees.find((e) => e.name === l.employee);
        const employeeId = isEmployee ? user.employeeId : (emp ? emp.id : "EMP001");
        await createLeave.mutateAsync({
          employeeId,
          type: l.type,
          from: l.from,
          to: l.to,
          days: Number(l.days),
          reason: l.reason || "",
          department: l.department || (isEmployee ? user.department : (emp?.department || "")),
        });
        toast.push("Leave request submitted");
      }}
    />
  );
}

export function ModalManager({ user }: ModalManagerProps) {
  const toast = useToast();

  const empModal = useUIStore((s) => s.empModal);
  const setEmpModal = useUIStore((s) => s.setEmpModal);
  const leaveModal = useUIStore((s) => s.leaveModal);
  const setLeaveModal = useUIStore((s) => s.setLeaveModal);
  const viewEmp = useUIStore((s) => s.viewEmp);
  const setViewEmp = useUIStore((s) => s.setViewEmp);
  const messageEmp = useUIStore((s) => s.messageEmp);
  const setMessageEmp = useUIStore((s) => s.setMessageEmp);
  const viewDoc = useUIStore((s) => s.viewDoc);
  const setViewDoc = useUIStore((s) => s.setViewDoc);
  const confirmState = useUIStore((s) => s.confirmState);
  const setConfirmState = useUIStore((s) => s.setConfirmState);
  const seatLimitModal = useUIStore((s) => s.seatLimitModal);
  const setSeatLimitModal = useUIStore((s) => s.setSeatLimitModal);
  const company = user?.companyName || user?.company || useUIStore.getState().company || "";

  return (
    <Suspense fallback={null}>
      {empModal.open && (
        <AddEmployeeModalWrapper toast={toast} empModal={empModal} setEmpModal={setEmpModal} />
      )}

      {leaveModal && (
        <ApplyLeaveModalWrapper user={user} toast={toast} setLeaveModal={setLeaveModal} />
      )}

      {viewEmp && (
        <ViewEmployeeDrawer
          emp={viewEmp}
          onClose={() => setViewEmp(null)}
          onEdit={() => {
            setEmpModal({ open: true, editing: viewEmp });
            setViewEmp(null);
          }}
          onMessage={() => {
            setMessageEmp(viewEmp);
            setViewEmp(null);
          }}
          canEdit={user.role !== "Viewer"}
        />
      )}

      {messageEmp && (
        <MessageModal
          emp={messageEmp}
          onClose={() => setMessageEmp(null)}
          onSent={async (subject, body) => {
            try {
              const receiverId = (messageEmp as any).user?.id;
              if (!receiverId) throw new Error("No user ID found for this employee");
              await useMessagingStore.getState().sendMessage(receiverId, subject, body);
              toast.push(`Message sent to ${messageEmp.name}`);
            } catch (err) {
              toast.push(`Failed to send message`, "error");
            }
          }}
        />
      )}

      {viewDoc && (
        <DocumentViewerModal doc={viewDoc} company={company} onClose={() => setViewDoc(null)} />
      )}

      {confirmState.open && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          confirmText={confirmState.confirmText}
          cancelText={confirmState.cancelText}
          confirmVariant={confirmState.confirmVariant}
          onConfirm={() => {
            confirmState.onConfirm();
            setConfirmState({ ...confirmState, open: false });
          }}
          onCancel={() => setConfirmState({ ...confirmState, open: false })}
        />
      )}

      {seatLimitModal.open && (
        <SeatLimitModal
          onClose={() => setSeatLimitModal({ open: false })}
          message={seatLimitModal.message}
          purchasedSeats={seatLimitModal.purchasedSeats}
          usedSeats={seatLimitModal.usedSeats}
        />
      )}
    </Suspense>
  );
}
