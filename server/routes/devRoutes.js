import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import {
	requireAnyPermission,
	requirePermissions,
} from "../middleware/permissionMiddleware.js";
import {
	getDevConfig,
	listCollections,
	backupCollection,
	listAuditLogs,
    exportAuditLogs,
    createAuditLog,
	listNotifications,
	updateNotification,
	deleteNotification,
	resyncDeveloperFlags,
	createBackupJob,
	listBackupJobs,
	downloadBackupJobResult,
	deleteBackupJob,
	clearBackupJobs,
    testSmtp,
	testDrive,
	getDeploymentNotes,
	normalizeAvatarUrls,
} from "../controllers/devController.js";

const router = express.Router();

// Public health check (no auth)
router.get('/health', (req, res) => {
	res.status(200).send('ok');
});

// Protected route; front-end can additionally gate to admins
router.use(verifyToken);

const requireDev = requireAnyPermission(["canAccessDeveloper", "canSeeDev"]);
const requireNotifView = requireAnyPermission([
	"canViewNotifications",
	"canManageNotifications",
	"canAccessNotifications",
]);

router.get("/config", requireDev, getDevConfig);
router.get('/collections', requireDev, listCollections);
router.get('/backup', requireDev, backupCollection);

// Audit logs
router.get('/audit-logs', requireDev, listAuditLogs);
router.get('/audit-logs/export', requireDev, exportAuditLogs);
router.post('/audit-logs', requireDev, createAuditLog);

// Notifications management
router.get('/notifications', requireNotifView, listNotifications);
router.put(
	'/notifications/:id',
	requirePermissions(["canManageNotifications"]),
	updateNotification
);
router.delete(
	'/notifications/:id',
	requirePermissions(["canManageNotifications"]),
	deleteNotification
);
router.post('/resync-developer-flags', requireDev, resyncDeveloperFlags);

// Backup jobs (async)
router.post('/backup-jobs', requireDev, createBackupJob);
router.get('/backup-jobs', requireDev, listBackupJobs);
router.get('/backup-jobs/:id/download', requireDev, downloadBackupJobResult);
router.delete('/backup-jobs/:id', requireDev, deleteBackupJob);
router.delete('/backup-jobs', requireDev, clearBackupJobs);

// SMTP test endpoint
router.post('/test-smtp', requireDev, testSmtp);
// Google Drive test endpoint
router.get('/test-drive', requireDev, testDrive);
// Deployment notes
router.get('/deployment-notes', requireDev, getDeploymentNotes);
// One-time maintenance utility
router.post('/normalize-avatars', requireDev, normalizeAvatarUrls);

export default router;
