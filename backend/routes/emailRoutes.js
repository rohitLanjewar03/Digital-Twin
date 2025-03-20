const express = require("express");
const { fetchUnseenEmails } = require("../controllers/emailController");

const router = express.Router();

router.get("/unseen", fetchUnseenEmails);

module.exports = router;
