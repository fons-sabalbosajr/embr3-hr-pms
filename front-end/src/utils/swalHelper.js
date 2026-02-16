import Swal from "sweetalert2";

/* ──────────────────────────────────────────────
 *  SweetAlert2 — centralized helpers
 *  Replaces Ant Design message.*, Modal.confirm,
 *  and Popconfirm across the entire app
 * ────────────────────────────────────────────── */

// ─── Toast (auto-dismiss) ─────────────────────
const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer;
    toast.onmouseleave = Swal.resumeTimer;
  },
});

export const swalSuccess = (msg) =>
  Toast.fire({ icon: "success", title: msg });

export const swalError = (msg) =>
  Toast.fire({ icon: "error", title: msg });

export const swalWarning = (msg) =>
  Toast.fire({ icon: "warning", title: msg });

export const swalInfo = (msg) =>
  Toast.fire({ icon: "info", title: msg });

// ─── Confirmation dialog (replaces Modal.confirm & Popconfirm) ──
export const swalConfirm = ({
  title = "Are you sure?",
  text = "",
  icon = "warning",
  confirmText = "Yes",
  cancelText = "Cancel",
  confirmColor = "#1677ff",
  cancelColor = "#d9d9d9",
  dangerMode = false,
} = {}) =>
  Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: dangerMode ? "#ff4d4f" : confirmColor,
    cancelButtonColor: cancelColor,
    reverseButtons: true,
  });

// ─── Alert-style popup (replaces Modal.info / Modal.warning) ──
export const swalAlert = ({
  title = "",
  text = "",
  html = "",
  icon = "info",
  confirmText = "OK",
} = {}) =>
  Swal.fire({
    title,
    text: html ? undefined : text,
    html: html || undefined,
    icon,
    confirmButtonText: confirmText,
    confirmButtonColor: "#1677ff",
  });

export default Swal;
