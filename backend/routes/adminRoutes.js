const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const adminController = require("../controllers/adminController");

// Restrict all routes in this file to Verified Admin
router.use(verifyToken, allowRoles("Admin"));

router.get("/users", adminController.getAllUsers);
router.put("/users/:userId/verify", adminController.toggleUserVerification);
router.get("/stats", adminController.getAdminStats);

module.exports = router;
