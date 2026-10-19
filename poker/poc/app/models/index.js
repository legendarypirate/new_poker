const dbConfig = require("../config/db.config.js");

const Sequelize = require("sequelize");

const sequelize =
  dbConfig.dialect === "sqlite"
    ? new Sequelize({
        dialect: "sqlite",
        storage: dbConfig.storage,
        logging: false,
      })
    : new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
        host: dbConfig.HOST,
        dialect: dbConfig.dialect,
        logging: false,
        pool: {
          max: dbConfig.pool.max,
          min: dbConfig.pool.min,
          acquire: dbConfig.pool.acquire,
          idle: dbConfig.pool.idle,
        },
      });

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.roles = require("./role.model.js")(sequelize, Sequelize);
db.infos = require("./info.model.js")(sequelize, Sequelize);
db.Categories = require("./category.model.js")(sequelize, Sequelize);
db.users = require("./user.model.js")(sequelize, Sequelize);
db.words = require("./word.model.js")(sequelize, Sequelize);
db.products = require("./product.model.js")(sequelize, Sequelize);
db.banners = require("./banner.model.js")(sequelize, Sequelize);
db.productImages = require("./productImage.model.js")(sequelize, Sequelize);
db.ages = require("./age.model.js")(sequelize, Sequelize);
db.doctors = require("./doctor.model.js")(sequelize, Sequelize);
db.profiles = require("./profile.model.js")(sequelize, Sequelize);
db.privacies = require("./privacy.model.js")(sequelize, Sequelize);
db.questions = require("./question.model.js")(sequelize, Sequelize);
db.games = require("./game.model.js")(sequelize, Sequelize);
db.user_statistics = require("./user_statistics.model.js")(sequelize, Sequelize);
db.tournaments = require("./tournament.model.js")(sequelize, Sequelize);
db.withdrawals = require("./withdrawal.model.js")(sequelize, Sequelize);
db.player_states = require("./player_state.model.js")(sequelize, Sequelize);
db.platform_charges = require("./platform_charge.model.js")(sequelize, Sequelize);
db.direct_messages = require("./direct_message.model.js")(sequelize, Sequelize);



db.infos.belongsTo(db.Categories, { foreignKey: "cat_id" });
db.Categories.hasMany(db.infos, { foreignKey: "cat_id" });
db.infos.belongsTo(db.doctors, { foreignKey: "doctor_id", as: "doctorInfo" });
db.doctors.hasMany(db.infos, { foreignKey: "doctor_id", as: "infos" });
db.withdrawals.belongsTo(db.users, { foreignKey: "user_id", as: "user" });
db.users.hasMany(db.withdrawals, { foreignKey: "user_id", as: "withdrawals" });
db.player_states.belongsTo(db.users, { foreignKey: "user_id", as: "user" });
db.users.hasMany(db.player_states, { foreignKey: "user_id", as: "playerStates" });
db.player_states.belongsTo(db.games, { foreignKey: "game_id", as: "game" });
db.games.hasMany(db.player_states, { foreignKey: "game_id", as: "playerStates" });
db.platform_charges.belongsTo(db.games, { foreignKey: "game_id", as: "game" });
db.games.hasMany(db.platform_charges, { foreignKey: "game_id", as: "platformCharges" });
db.games.belongsTo(db.users, { foreignKey: "winner", as: "winnerUser" });
db.users.hasMany(db.games, { foreignKey: "winner", as: "wonGames" });
db.direct_messages.belongsTo(db.users, { foreignKey: "from_user_id", as: "fromUser" });
db.direct_messages.belongsTo(db.users, { foreignKey: "to_user_id", as: "toUser" });
db.users.hasMany(db.direct_messages, { foreignKey: "from_user_id", as: "sentMessages" });
db.users.hasMany(db.direct_messages, { foreignKey: "to_user_id", as: "receivedMessages" });

module.exports = db;
