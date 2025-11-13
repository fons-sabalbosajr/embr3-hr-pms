import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
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

router.get("/config", getDevConfig);
router.get('/collections', listCollections);
router.get('/backup', backupCollection);

// Audit logs
router.get('/audit-logs', listAuditLogs);
router.get('/audit-logs/export', exportAuditLogs);
router.post('/audit-logs', createAuditLog);

// Notifications management
router.get('/notifications', listNotifications);
router.put('/notifications/:id', updateNotification);
router.delete('/notifications/:id', deleteNotification);
router.post('/resync-developer-flags', resyncDeveloperFlags);

// Backup jobs (async)
router.post('/backup-jobs', createBackupJob);
router.get('/backup-jobs', listBackupJobs);
router.get('/backup-jobs/:id/download', downloadBackupJobResult);
router.delete('/backup-jobs/:id', deleteBackupJob);
router.delete('/backup-jobs', clearBackupJobs);

// SMTP test endpoint
router.post('/test-smtp', testSmtp);
// Google Drive test endpoint
router.get('/test-drive', testDrive);
// Deployment notes
router.get('/deployment-notes', getDeploymentNotes);
// One-time maintenance utility
router.post('/normalize-avatars', normalizeAvatarUrls);

export default router;
