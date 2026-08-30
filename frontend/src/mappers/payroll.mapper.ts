export function mapApiPayrollToModel(p: any): any {
  return {
    id: p.id,
    employeeId: p.employeeId,
    employeeName: p.employee?.name || "Unknown",
    month: p.month,

    fixedBaseSalary: p.fixedBaseSalary,
    basicSalary: p.basicSalary,
    gross: p.gross,

    lopDays: p.lopDays,
    lopDeductAmount: p.lopDeductAmount,
    lopDivisorMode: p.lopDivisorMode,
    lopDivisor: p.lopDivisor,

    deductions: p.deductions,
    net: p.netSalary ?? p.net,
    status: p.status,
    generatedAt: p.createdAt ? p.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    components: p.components,
    adjustments: p.adjustments,
    calculationVersion: p.calculationVersion,
  };
}
