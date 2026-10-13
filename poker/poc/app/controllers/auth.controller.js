const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("../models");
const User = db.users;
const { Op } = db.Sequelize;
const secretKey = process.env.JWT_SECRET || "your_secret_key";
const axios = require("axios");
const TOKEN_TTL = "7d";
const STARTING_BALANCE = 50000;

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    secretKey,
    { expiresIn: TOKEN_TTL }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name || user.username,
    role: user.role,
    email: user.email,
    phone: user.phone,
    account_balance: parseFloat(user.account_balance || 0),
  };
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

exports.register = async (req, res) => {
  const { username, password, passwordConfirm, role, email, phone } = req.body;
  const name = (username || "").trim();

  if (!name || !password) {
    return res.status(400).json({ message: "Username and password are required!" });
  }

  const confirm = passwordConfirm || password;
  if (password !== confirm) {
    return res.status(400).json({ message: "Passwords do not match!" });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters long!" });
  }

  try {
    const phoneDigits = phone ? normalizePhone(phone) : null;
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { username: name },
          email ? { email } : null,
          phoneDigits ? { phone: phoneDigits } : null,
        ].filter(Boolean),
      },
    });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists!" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username: name,
      display_name: name,
      password: hashedPassword,
      role: role || "user",
      email: email || null,
      phone: phoneDigits || null,
      account_balance: STARTING_BALANCE,
    });

    const token = signToken(newUser);
    res.status(201).json({
      success: true,
      message: "User registered successfully!",
      token,
      user: publicUser(newUser),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.login = async (req, res) => {
  const { username, password, email, phone } = req.body;
  const identity = (username || email || phone || "").trim();

  if (!identity || !password) {
    return res.status(400).json({ message: "Username and password are required!" });
  }

  try {
    const phoneDigits = normalizePhone(identity);
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { username: identity },
          { email: identity },
          phoneDigits ? { phone: phoneDigits } : null,
        ].filter(Boolean),
      },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials!" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid credentials!" });
    }

    const token = signToken(user);
    res.json({
      success: true,
      token,
      user: publicUser(user),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.mobile_login = async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ message: "phone and password are required!" });
  }

  try {
    const user = await User.findOne({ where: { phone } });

    if (!user || user.role !== "user") {
      return res.status(401).json({ message: "Invalid credentials!" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid credentials!" });
    }

    const token = jwt.sign({ id: user.id, phone: user.phone, role: user.role }, secretKey, { expiresIn: "30m" });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
        account_balance: parseFloat(user.account_balance || 0)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};
// Verify the JWT token
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];

  if (!authHeader) {
    return res.status(401).json({ message: "Token is missing!" });
  }

  // Extract token from "Bearer <token>" format or use as-is
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Token is invalid!" });
    }
    req.user = decoded;
    next();
  });
};


exports.mobile_register = async (req, res) => {
  const { username, email, phone } = req.body;
  console.log(req.body);

  if (!username || !email || !phone) {
    return res.status(400).json({ message: "Username, email, and phone are required!" });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists!" });
    }

    // Generate a 4-digit OTP
    const randomOTP = Math.floor(1000 + Math.random() * 9000);

    // Create user with OTP
    const newUser = await User.create({
      username,
      email,
      phone,
      otp: randomOTP,
      role: "user", // Setting role as "user"
      account_balance: 0.00,  // Default balance for new users
    });

    console.log("Inserted user:", newUser.toJSON());

    // Generate JWT token
    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, phone: newUser.phone },
      secretKey,
      { expiresIn: "30m" }
    );

    // Send OTP via SMS
    const smsUrl = `https://api.messagepro.mn/send?from=72278880&to=${phone}&text=Tanii neg udaagiin nuuts code ${randomOTP}`;
    
    const headers = {
      "x-api-key": "d1856eb0c137cb4dc7e43dc2efdfd43a", // Your API key
      "Content-Type": "application/json",
    };

    try {
      const smsResponse = await axios.get(smsUrl, { headers });
      console.log("SMS API Response:", smsResponse.data);
    } catch (smsError) {
      console.error(
        "Error sending SMS:",
        smsError.response ? smsError.response.data : smsError.message
      );
    }

    // Respond to the client
    res.status(201).json({
      success: true,
      message: "User registered successfully! OTP sent via SMS.",
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        phone: newUser.phone,
        email: newUser.email,
        account_balance: parseFloat(newUser.account_balance || 0)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.forgot_pass = async (req, res) => {
  const { phone } = req.body;
  console.log(req.body);

  if (!phone) {
    return res.status(400).json({ message: "Phone number is required!" });
  }

  try {
    // Check if user exists
    const user = await User.findOne({ where: { phone } });
    if (!user) {
      return res.status(404).json({ message: "User not found with this phone number!" });
    }

    // Generate a 4-digit OTP
    const randomOTP = Math.floor(1000 + Math.random() * 9000);

    // Update the user's OTP
    user.otp = randomOTP;
    await user.save();

    console.log("Updated user OTP:", user.toJSON());

    // Send OTP via SMS
    const smsUrl = `https://api.messagepro.mn/send?from=72278880&to=${phone}&text=Tanii neg udaagiin nuuts code ${randomOTP}`;
    
    const headers = {
      "x-api-key": "d1856eb0c137cb4dc7e43dc2efdfd43a",
      "Content-Type": "application/json",
    };

    try {
      const smsResponse = await axios.get(smsUrl, { headers });
      console.log("SMS API Response:", smsResponse.data);
    } catch (smsError) {
      console.error(
        "Error sending SMS:",
        smsError.response ? smsError.response.data : smsError.message
      );
    }

    res.status(200).json({
      success: true,
      message: "OTP sent successfully via SMS.",
      phone: user.phone
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.verifyOtp = async (req, res) => {
  const { id, otp } = req.body;

  if (!id || !otp) {
    return res.status(400).json({ message: "User ID and OTP are required!" });
  }

  try {
    // Find user by ID
    const user = await User.findOne({ where: { id: id } });
    
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    // Check if OTP matches
    if (user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP!" });
    }

    // Update user as verified
    await User.update({ otp: null, phone_verified: true }, { where: { id: id } });

    res.json({ success: true, message: "Phone verified successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.verifyOtpForgot = async (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ message: "User phone and OTP are required!" });
  }

  try {
    // Find user by phone
    const user = await User.findOne({ where: { phone } });

    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    // Check if OTP matches
    if (user.otp != otp) {
      return res.status(400).json({ message: "Invalid OTP!" });
    }

    // Update user: clear OTP and mark phone as verified
    await User.update(
      { otp: null, phone_verified: true },
      { where: { phone } }
    );

    res.json({
      success: true,
      message: "Phone verified successfully!",
      user: {
        id: user.id,
        username: user.username,
        phone: user.phone,
        email: user.email,
        account_balance: parseFloat(user.account_balance || 0)
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};



exports.updateInfo = async (req, res) => {
  try {
    const { id, password, school, gender } = req.body;

    // Validate required fields
    if (!id || !gender) {
      return res.status(400).json({ message: "User ID and gender are required!" });
    }

    // Find user by ID
    const user = await User.findOne({ where: { id: id } });

    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    // Prepare data for update
    const updatedData = { school, gender };

    // If a new password is provided, hash it before saving
    if (password) {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      updatedData.password = hashedPassword;
    }

    // Update user information
    await User.update(updatedData, { where: { id: id } });

    res.json({ success: true, message: "User info updated successfully!" });
  } catch (err) {
    console.error("Error updating user info:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateForgotPass = async (req, res) => {
  try {
    const { phone, password } = req.body;

    // Validate required fields
    if (!phone || !password) {
      return res.status(400).json({ message: "Phone and password are required!" });
    }

    // Find user by phone
    const user = await User.findOne({ where: { phone } });

    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update the user's password
    await User.update(
      { password: hashedPassword },
      { where: { phone } }
    );

    res.json({ success: true, message: "Password updated successfully!" });
  } catch (err) {
    console.error("Error updating password:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Social login (Google, Apple, etc.)
exports.socialLogin = async (req, res) => {
  try {
    const { firebase_uid, email, display_name, provider, avatar_url } = req.body;

    // Validate required fields
    if (!firebase_uid) {
      return res.status(400).json({ 
        success: false,
        message: "Firebase UID is required!" 
      });
    }

    // Check if user exists by firebase_uid
    let user = await User.findOne({ where: { firebase_uid } });

    if (user) {
      // User exists, update their information
      await user.update({
        email: email || user.email,
        display_name: display_name || user.display_name,
        avatar_url: avatar_url || user.avatar_url,
      });

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        secretKey,
        { expiresIn: "30m" }
      );

      return res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          display_name: user.display_name,
          role: user.role,
          account_balance: parseFloat(user.account_balance || 0)
        }
      });
    }

    // User doesn't exist, create new user
    // Generate username from display_name or email
    let username = '';
    if (display_name) {
      username = display_name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    }
    if (!username && email) {
      username = email.split('@')[0];
    }
    if (!username) {
      username = `user_${Date.now()}`;
    }

    // Ensure username is unique
    let uniqueUsername = username;
    let counter = 1;
    while (await User.findOne({ where: { username: uniqueUsername } })) {
      uniqueUsername = `${username}${counter}`;
      counter++;
    }

    // Create new user
    const newUser = await User.create({
      firebase_uid,
      username: uniqueUsername,
      email: email || null,
      display_name: display_name || null,
      provider: provider || null,
      avatar_url: avatar_url || null,
      role: "user",
      account_balance: 0.00,
    });

    // Generate JWT token
    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, role: newUser.role },
      secretKey,
      { expiresIn: "30m" }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        display_name: newUser.display_name,
        role: newUser.role,
        account_balance: parseFloat(newUser.account_balance || 0)
      }
    });
  } catch (err) {
    console.error("Error in social login:", err);
    res.status(500).json({ 
      success: false,
      message: "Internal server error",
      error: err.message 
    });
  }
};

// Get current user info (requires authentication)
exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ 
        success: false,
        message: "User not authenticated" 
      });
    }

    const user = await User.findByPk(userId, {
      attributes: ['id', 'username', 'email', 'account_balance', 'display_name', 'avatar_url', 'role']
    });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        account_balance: parseFloat(user.account_balance || 0),
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        role: user.role
      }
    });
  } catch (err) {
    console.error("Error getting current user:", err);
    res.status(500).json({ 
      success: false,
      message: "Internal server error",
      error: err.message 
    });
  }
};
