const db = require("../models");
const User = db.users;
const { toPublicId } = require("../../utils/ids");

let cloudinary;
try {
  cloudinary = require("cloudinary").v2;
} catch (err) {
  console.warn("cloudinary package not installed:", err.message);
}

let cloudinaryReady = false;

function configureCloudinary() {
  if (!cloudinary) return false;
  if (cloudinaryReady) return true;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    return false;
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  cloudinaryReady = true;
  return true;
}

function profilePayload(user) {
  return {
    id: user.id,
    public_id: toPublicId(user.id),
    username: user.username,
    display_name: user.display_name || user.username,
    avatar_url: user.avatar_url || null,
    email: user.email,
    account_balance: parseFloat(user.account_balance || 0),
    role: user.role,
  };
}

exports.uploadStatus = (_req, res) => {
  res.json({
    success: true,
    cloudinaryConfigured: configureCloudinary(),
    maxBytes: 8 * 1024 * 1024,
    fieldName: "avatar",
  });
};

exports.uploadAvatar = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: "User not authenticated" });
  }
  if (!req.file?.buffer) {
    return res.status(400).json({ success: false, message: "Image file is required" });
  }
  if (!configureCloudinary()) {
    return res.status(503).json({
      success: false,
      message:
        "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
    });
  }
  try {
    const folder = process.env.CLOUDINARY_AVATAR_FOLDER || "togloo/avatars";
    const uploaded = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "image",
          public_id: `user_${userId}_${Date.now()}`,
          overwrite: true,
          transformation: [{ width: 512, height: 512, crop: "fill", gravity: "face" }],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
      stream.end(req.file.buffer);
    });
    const avatarUrl = uploaded.secure_url || uploaded.url;
    if (!avatarUrl) {
      return res.status(500).json({
        success: false,
        message: "Cloudinary did not return an image URL",
      });
    }
    await User.update({ avatar_url: avatarUrl }, { where: { id: userId } });
    const user = await User.findByPk(userId, {
      attributes: [
        "id",
        "username",
        "email",
        "account_balance",
        "display_name",
        "avatar_url",
        "role",
      ],
    });
    res.json({
      success: true,
      avatar_url: avatarUrl,
      url: avatarUrl,
      user: user ? profilePayload(user) : null,
    });
  } catch (err) {
    console.error("Avatar upload failed:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Could not upload avatar",
    });
  }
};
