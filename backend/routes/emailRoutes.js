const express = require("express");
const { fetchUnseenEmails, generateReply, markEmailAsRead } = require("../controllers/emailController");

const router = express.Router();

router.get("/unseen", fetchUnseenEmails);
router.post("/generate-reply", generateReply);
router.post("/mark-as-read/:emailId", markEmailAsRead);


module.exports = router;
