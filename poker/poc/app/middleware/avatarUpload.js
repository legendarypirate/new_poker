const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith("image/")) {
      cb(new Error("Only image uploads are allowed"));
      return;
    }
    cb(null, true);
  },
});

function handleAvatarUpload(req, res, next) {
  upload.single("avatar")(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "Image must be 8 MB or smaller"
          : err.message || "Invalid upload";
      return res.status(400).json({ success: false, message });
    }
    return res.status(400).json({
      success: false,
      message: err.message || "Only image uploads are allowed",
    });
  });
}

module.exports = { handleAvatarUpload };
