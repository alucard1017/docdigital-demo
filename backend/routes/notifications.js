// backend/routes/notifications.js
const express = require("express");
const { requireAuth } = require("./auth");
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
} = require("../controllers/notifications/notificationsController");

const router = express.Router();

router.get("/", requireAuth, getNotifications);
router.post("/:id/read", requireAuth, markAsRead);
router.post("/read-all", requireAuth, markAllAsRead);

module.exports = router;
