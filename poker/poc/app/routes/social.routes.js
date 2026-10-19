module.exports = (app) => {
  const social = require("../controllers/social.controller.js");
  const { verifyToken } = require("../controllers/auth.controller");

  const router = require("express").Router();
  router.get("/contacts", verifyToken, social.contacts);
  router.get("/messages/:userId", verifyToken, social.messages);
  router.post("/messages", verifyToken, social.send);
  app.use("/api/social", router);
};
