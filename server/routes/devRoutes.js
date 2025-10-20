import express from "express";
import verifyToken from "../middleware/authMiddleware.js";
import {
	getDevConfig,
	listCollections,
	backupCollection,
	listAuditLogs,
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
} from "../controllers/devController.js";

const router = express.Router();

// Protected route; front-end can additionally gate to admins
router.use(verifyToken);

router.get("/config", getDevConfig);
router.get('/collections', listCollections);
router.get('/backup', backupCollection);

// Audit logs
router.get('/audit-logs', listAuditLogs);
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

export default router;
