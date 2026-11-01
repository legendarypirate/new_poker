const bcrypt = require("bcryptjs");
const db = require("../app/models");

const DEMO_USERNAME = process.env.ADMIN_DEMO_USER || "admin";
const DEMO_PASSWORD = process.env.ADMIN_DEMO_PASSWORD || "admin123";

async function seedAdmin() {
  const User = db.users;
  const hashed = await bcrypt.hash(DEMO_PASSWORD, 10);
  const existing = await User.findOne({ where: { username: DEMO_USERNAME } });

  if (!existing) {
    await User.create({
      username: DEMO_USERNAME,
      display_name: "Admin",
      password: hashed,
      role: "admin",
      is_active: "1",
      account_balance: 0,
    });
    console.log(`✅ Created demo admin: ${DEMO_USERNAME} / ${DEMO_PASSWORD}`);
    return;
  }

  const updates = {
    role: "admin",
    is_active: "1",
    password: hashed,
  };
  if (!existing.display_name) updates.display_name = "Admin";
  await existing.update(updates);
  console.log(`✅ Reset demo admin: ${DEMO_USERNAME} / ${DEMO_PASSWORD}`);
}

if (require.main === module) {
  db.sequelize
    .sync()
    .then(() => seedAdmin())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Failed to seed admin:", err);
      process.exit(1);
    });
}

module.exports = { seedAdmin, DEMO_USERNAME, DEMO_PASSWORD };
