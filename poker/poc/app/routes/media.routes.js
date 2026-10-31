const { handleAvatarUpload } = require("../middleware/avatarUpload");

module.exports = (app) => {
  const media = require("../controllers/media.controller.js");
  const { verifyToken } = require("../controllers/auth.controller");

  const router = require("express").Router();
  router.get("/avatar/status", verifyToken, media.uploadStatus);
  router.post("/avatar", handleAvatarUpload, verifyToken, media.uploadAvatar);
  app.use("/api/media", router);
};
