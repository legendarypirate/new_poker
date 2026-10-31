module.exports = (app) => {
  const social = require("../controllers/social.controller.js");
  const { verifyToken } = require("../controllers/auth.controller");

  const router = require("express").Router();
  router.get("/contacts", verifyToken, social.contacts);
  router.get("/friends", verifyToken, social.friends);
  router.get("/users/search", verifyToken, social.searchUsers);
  router.get("/friend-requests", verifyToken, social.friendRequests);
  router.post("/friend-requests", verifyToken, social.sendFriendRequest);
  router.post("/friend-requests/:fromUserId/accept", verifyToken, social.acceptFriendRequest);
  router.post("/friend-requests/:fromUserId/decline", verifyToken, social.declineFriendRequest);
  router.get("/messages/:userId", verifyToken, social.messages);
  router.post("/messages", verifyToken, social.send);
  app.use("/api/social", router);
};
