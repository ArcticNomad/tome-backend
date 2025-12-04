const express = require("express");
const { getRecommendations } = require("../controllers/recommendController");
const authFirebaseUid = require("../middleware/authFirebaseUid");

const router = express.Router();

router.get("/", authFirebaseUid, getRecommendations);

module.exports = router;
