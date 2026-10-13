const path = require("path");
const fs = require("fs");

const dialect = process.env.DB_DIALECT || "postgres";

if (dialect === "postgres") {
  module.exports = {
    HOST: process.env.DB_HOST || "localhost",
    USER: process.env.DB_USER || "postgres",
    PASSWORD: process.env.DB_PASSWORD || "Joker0328",
    DB: process.env.DB_NAME || "poker",
    dialect: "postgres",
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  };
} else {
  const storage =
    process.env.SQLITE_PATH ||
    path.join(__dirname, "../../data/poker.sqlite");
  fs.mkdirSync(path.dirname(storage), { recursive: true });
  module.exports = {
    dialect: "sqlite",
    storage,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  };
}
