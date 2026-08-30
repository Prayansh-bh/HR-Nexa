export function formatHeaderLabel(key: string): string {
  const dictionary: Record<string, string> = {
    companyId: 'Company ID',
    companyName: 'Company Name',
    plan: 'Subscription Plan',
    cycle: 'Billing Cycle',
    status: 'Status',
    ownerName: 'Owner Name',
    ownerEmail: 'Owner Email',
    employeesCount: 'Employee Count',
    storageUsed: 'Storage Used',
    createdAt: 'Created Date',
    subscriptionId: 'Subscription ID',
    billingCycle: 'Billing Cycle',
    amount: 'Amount (INR)',
    startDate: 'Start Date',
    expiryDate: 'Expiry Date',
    autoRenew: 'Auto Renew',
    employeeId: 'Employee ID',
    name: 'Full Name',
    email: 'Email Address',
    company: 'Company Name',
    department: 'Department',
    designation: 'Designation',
    joinedDate: 'Joined Date',
    monthlySalary: 'Monthly Salary (INR)',
    location: 'Office Location',
    userId: 'User ID',
    role: 'Assigned Role',
    type: 'Type',
    date: 'Date',
    tax: 'Tax',
    period: 'Billing Period',
    invoiceId: 'Invoice ID',
    issueDate: 'Issue Date',
    couponCode: 'Coupon Code',
    payrollId: 'Payroll ID',
    employeeName: 'Employee Name',
    month: 'Month',
    payDate: 'Pay Date',
    basicSalary: 'Basic Salary (INR)',
    netSalary: 'Net Salary (INR)',
    recordId: 'Record ID',
    inTime: 'Clock In Time',
    outTime: 'Clock Out Time',
    remarks: 'Remarks',
    requestId: 'Request ID',
    leaveType: 'Leave Type',
    fromDate: 'From Date',
    toDate: 'To Date',
    days: 'Days Count',
    candidateId: 'Candidate ID',
    jobTitle: 'Job Title',
    stage: 'Pipeline Stage',
    appliedDate: 'Applied Date',
    storageAllocation: 'Storage Allocation',
    logId: 'Log ID',
    userName: 'User Name',
    action: 'Action Taken',
    details: 'Audit Details',
    timestamp: 'Timestamp',
    notificationId: 'Notification ID',
    title: 'Notification Title',
    severity: 'Severity Level',
    category: 'Category',
    metric: 'System Metric',
    value: 'Current Value',
  };

  if (dictionary[key]) return dictionary[key];

  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

export function convertToCSV(data: any[]): string {
  if (!data || data.length === 0) {
    return 'No data available';
  }

  const keys = Object.keys(data[0]);
  const header = keys
    .map((k) => `"${formatHeaderLabel(k).replace(/"/g, '""')}"`)
    .join(',');

  const rows = data.map((row) =>
    keys
      .map((k) => {
        const val =
          row[k] !== undefined && row[k] !== null ? String(row[k]) : '';
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(','),
  );

  return [header, ...rows].join('\n');
}
