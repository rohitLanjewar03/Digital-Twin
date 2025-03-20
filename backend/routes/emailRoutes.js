const express = require("express");
const { fetchUnseenEmails, generateReply } = require("../controllers/emailController");

const router = express.Router();

router.get("/unseen", fetchUnseenEmails);
router.post("/generate-reply", generateReply);


module.exports = router;
