// Central registry of demo-controllable write actions.
// Each entry defines: key (stable id), label, methods, urlPatterns (regex list).
// Interceptor + settings.allowedActions decide if a demo user can perform the write while submissions are OFF.

const demoActions = [
  // Users (access / demo flag)
  { key: 'users.access.update', label: 'Users • Update Access / Demo Flag', desc: 'Update user roles, permissions, and demo participation (isDemo).', methods: ['PUT','PATCH'], urlPatterns: [/^\/api\/users\/.+\/access$/] },

  // Employees CRUD
  { key: 'employees.create', label: 'Employees • Create', desc: 'Add a new employee profile.', methods: ['POST'], urlPatterns: [/^\/api\/employees\/?$/] },
  { key: 'employees.update', label: 'Employees • Update', desc: 'Edit employee details and records.', methods: ['PUT','PATCH'], urlPatterns: [/^\/api\/employees\/(?!upload-employees).+/] },
  { key: 'employees.delete', label: 'Employees • Delete', desc: 'Remove an employee (cascade delete).', methods: ['DELETE'], urlPatterns: [/^\/api\/employees\/(?!upload-employees).+/] },
  { key: 'employees.resign', label: 'Employees • Mark Resigned', desc: 'Set employee status to resigned.', methods: ['PUT'], urlPatterns: [/^\/api\/employees\/.+\/resign$/] },
  { key: 'employees.undoResign', label: 'Employees • Undo Resign', desc: 'Revert resignation status.', methods: ['PUT'], urlPatterns: [/^\/api\/employees\/.+\/undo-resign$/] },

  // Employee bulk upload
  { key: 'employees.bulkUpload', label: 'Employees • Bulk Upload', desc: 'Create multiple employees via file upload.', methods: ['POST'], urlPatterns: [/^\/api\/employees\/upload-employees$/] },

  // Employee Documents
  { key: 'employeeDocs.create', label: 'Employee Docs • Create', desc: 'Add an employee document entry (e.g., payslip, certificate).', methods: ['POST'], urlPatterns: [/^\/api\/employee-docs\/?$/] },
  { key: 'employeeDocs.delete', label: 'Employee Docs • Delete', desc: 'Delete an employee document entry.', methods: ['DELETE'], urlPatterns: [/^\/api\/employee-docs\/.+/] },

  // Employee Salaries CRUD
  { key: 'employeeSalaries.create', label: 'Employee Salaries • Create', desc: 'Add a new salary record for an employee.', methods: ['POST'], urlPatterns: [/^\/api\/employee-salaries\/?$/] },
  { key: 'employeeSalaries.update', label: 'Employee Salaries • Update', desc: 'Edit an existing salary record.', methods: ['PUT','PATCH'], urlPatterns: [/^\/api\/employee-salaries\/.+/] },
  { key: 'employeeSalaries.delete', label: 'Employee Salaries • Delete', desc: 'Remove a salary record.', methods: ['DELETE'], urlPatterns: [/^\/api\/employee-salaries\/.+/] },

  // Trainings CRUD
  { key: 'trainings.create', label: 'Trainings • Create', desc: 'Create a new training record.', methods: ['POST'], urlPatterns: [/^\/api\/trainings\/?$/] },
  { key: 'trainings.update', label: 'Trainings • Update', desc: 'Edit a training record.', methods: ['PUT','PATCH'], urlPatterns: [/^\/api\/trainings\/.+/] },
  { key: 'trainings.delete', label: 'Trainings • Delete', desc: 'Delete a training record.', methods: ['DELETE'], urlPatterns: [/^\/api\/trainings\/.+/] },

  // Local Holidays CRUD
  { key: 'localHolidays.create', label: 'Local Holidays • Create', desc: 'Add a local holiday.', methods: ['POST'], urlPatterns: [/^\/api\/local-holidays\/?$/] },
  { key: 'localHolidays.update', label: 'Local Holidays • Update', desc: 'Edit a local holiday.', methods: ['PUT','PATCH'], urlPatterns: [/^\/api\/local-holidays\/.+/] },
  { key: 'localHolidays.delete', label: 'Local Holidays • Delete', desc: 'Remove a local holiday.', methods: ['DELETE'], urlPatterns: [/^\/api\/local-holidays\/.+/] },

  // Suspensions CRUD
  { key: 'suspensions.create', label: 'Suspensions • Create', desc: 'Create a work suspension/closure.', methods: ['POST'], urlPatterns: [/^\/api\/suspensions\/?$/] },
  { key: 'suspensions.update', label: 'Suspensions • Update', desc: 'Edit a suspension entry.', methods: ['PUT','PATCH'], urlPatterns: [/^\/api\/suspensions\/.+/] },
  { key: 'suspensions.delete', label: 'Suspensions • Delete', desc: 'Delete a suspension entry.', methods: ['DELETE'], urlPatterns: [/^\/api\/suspensions\/.+/] },

  // Deduction Types CRUD
  { key: 'deductionTypes.create', label: 'Deduction Types • Create', desc: 'Create a payroll deduction type.', methods: ['POST'], urlPatterns: [/^\/api\/deduction-types\/?$/] },
  { key: 'deductionTypes.update', label: 'Deduction Types • Update', desc: 'Edit a deduction type.', methods: ['PUT','PATCH'], urlPatterns: [/^\/api\/deduction-types\/.+/] },
  { key: 'deductionTypes.delete', label: 'Deduction Types • Delete', desc: 'Delete a deduction type.', methods: ['DELETE'], urlPatterns: [/^\/api\/deduction-types\/.+/] },

  // Payslip Requests CRUD
  { key: 'payslipRequests.create', label: 'Payslip Requests • Create', desc: 'Create a payslip request notification.', methods: ['POST'], urlPatterns: [/^\/api\/payslip-requests\/?$/] },
  { key: 'payslipRequests.update', label: 'Payslip Requests • Update', desc: 'Update a payslip request entry.', methods: ['PUT','PATCH'], urlPatterns: [/^\/api\/payslip-requests\/.+/] },
  { key: 'payslipRequests.delete', label: 'Payslip Requests • Delete', desc: 'Delete a payslip request entry.', methods: ['DELETE'], urlPatterns: [/^\/api\/payslip-requests\/.+/] },

  // DTR Requests CRUD
  { key: 'dtrRequests.create', label: 'DTR Requests • Create', desc: 'Create a DTR request entry.', methods: ['POST'], urlPatterns: [/^\/api\/dtr-requests\/?$/] },
  { key: 'dtrRequests.update', label: 'DTR Requests • Update', desc: 'Edit a DTR request entry.', methods: ['PUT','PATCH'], urlPatterns: [/^\/api\/dtr-requests\/.+/] },
  { key: 'dtrRequests.delete', label: 'DTR Requests • Delete', desc: 'Delete a DTR request entry.', methods: ['DELETE'], urlPatterns: [/^\/api\/dtr-requests\/.+/] },

  // DTR Generate/Logs
  { key: 'dtr.generate', label: 'DTR • Generate/Upload', desc: 'Upload biometrics and/or log generation activity.', methods: ['POST'], urlPatterns: [/^\/api\/dtr\/upload$/,/^\/api\/dtr\/log-generation$/] },

  // Feature Suggestions / Send Feature Email
  { key: 'features.suggest', label: 'Features • Suggest / Send Email', desc: 'Submit a feature suggestion email.', methods: ['POST'], urlPatterns: [/^\/api\/features\/suggest$/] },

  // Payslip Request Email Sending
  { key: 'payslipRequests.sendEmail', label: 'Payslip Requests • Send Email', desc: 'Send payslip email with generated PDF attachment.', methods: ['POST'], urlPatterns: [/^\/api\/payslip-requests\/.+\/send-email$/] },

  // Reminder Notifications (sending emails)
  { key: 'notifications.sendNoTimeRecord', label: 'Notifications • Send No Time Record Reminder', desc: 'Send a single no time record reminder email.', methods: ['POST'], urlPatterns: [/^\/api\/notifications\/no-time-record$/] },
  { key: 'notifications.sendNoTimeRecordBulk', label: 'Notifications • Send No Time Record Bulk', desc: 'Send bulk no time record reminder emails.', methods: ['POST'], urlPatterns: [/^\/api\/notifications\/no-time-record\/bulk$/] },

  // Notifications CRUD
  { key: 'notifications.create', label: 'Notifications • Create', desc: 'Send or queue a notification.', methods: ['POST'], urlPatterns: [/^\/api\/notifications\/?$/] },
  { key: 'notifications.update', label: 'Notifications • Update', desc: 'Edit an existing notification.', methods: ['PUT','PATCH'], urlPatterns: [/^\/api\/notifications\/.+/] },
  { key: 'notifications.delete', label: 'Notifications • Delete', desc: 'Delete a notification.', methods: ['DELETE'], urlPatterns: [/^\/api\/notifications\/.+/] },

  // Read-status mutations (mark items read) – treat as writes that can be selectively enabled
  { key: 'dtrLogs.markRead', label: 'DTR Logs • Mark Single Read', desc: 'Mark one DTR log notification as read.', methods: ['PUT'], urlPatterns: [/^\/api\/dtr-logs\/.+\/read$/] },
  { key: 'dtrLogs.markAllRead', label: 'DTR Logs • Mark All Read', desc: 'Mark all DTR log notifications as read.', methods: ['PUT'], urlPatterns: [/^\/api\/dtr-logs\/read-all$/] },
  { key: 'dtrGenerationLogs.markRead', label: 'DTR Generation Logs • Mark Single Read', desc: 'Mark one DTR generation log as read.', methods: ['PUT'], urlPatterns: [/^\/api\/dtr-generation-logs\/.+\/read$/] },
  { key: 'dtrGenerationLogs.markAllRead', label: 'DTR Generation Logs • Mark All Read', desc: 'Mark all DTR generation logs as read.', methods: ['PUT'], urlPatterns: [/^\/api\/dtr-generation-logs\/read-all$/] },
  { key: 'dtrRequests.markRead', label: 'DTR Requests • Mark Single Read', desc: 'Mark one DTR request as read.', methods: ['PUT'], urlPatterns: [/^\/api\/dtr-requests\/.+\/read$/] },
  { key: 'dtrRequests.markAllRead', label: 'DTR Requests • Mark All Read', desc: 'Mark all DTR requests as read.', methods: ['PUT'], urlPatterns: [/^\/api\/dtr-requests\/read-all$/] },
  { key: 'payslipRequests.markRead', label: 'Payslip Requests • Mark Single Read', desc: 'Mark one payslip request as read.', methods: ['PUT'], urlPatterns: [/^\/api\/payslip-requests\/.+\/read$/] },
  { key: 'payslipRequests.markAllRead', label: 'Payslip Requests • Mark All Read', desc: 'Mark all payslip requests as read.', methods: ['PUT'], urlPatterns: [/^\/api\/payslip-requests\/read-all$/] },
];

// UI-only demo action keys (no direct API endpoint; used for disabling/hiding purely client-side buttons)
demoActions.push(
  { key: 'ui.payslips.generatePDF', label: 'UI • Generate Payslip Button', desc: 'Client-side payslip PDF generation/open actions.', methods: [], urlPatterns: [] },
  { key: 'ui.dtr.reports.generate', label: 'UI • Generate DTR Report Button', desc: 'Client-side DTR report generation actions.', methods: [], urlPatterns: [] },
  { key: 'ui.notifications.quickSend', label: 'UI • Quick Send Notification', desc: 'Frontend quick-send notification shortcuts.', methods: [], urlPatterns: [] },
);

export default demoActions;
