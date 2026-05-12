// Central place to wire up model associations.
// Other modules can still require individual models directly.

const Admin = require('./Admin');
const Profile = require('./Profile');
const Work = require('./Work');
const Service = require('./Service');
const Booking = require('./Booking');
const Setting = require('./Setting');
const News = require('./News');
const User = require('./User');
const MessageTemplate = require('./MessageTemplate');
const LineWebhookEvent = require('./LineWebhookEvent');
const Broadcast = require('./Broadcast');

// ====== Associations ======

User.hasMany(Booking, { foreignKey: 'userId', as: 'bookings' });
Booking.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Booking.belongsTo(Admin, { foreignKey: 'createdByAdminId', as: 'createdByAdmin' });
User.belongsTo(Admin, { foreignKey: 'createdByAdminId', as: 'createdByAdmin' });

module.exports = {
  Admin,
  Profile,
  Work,
  Service,
  Booking,
  Setting,
  News,
  User,
  MessageTemplate,
  LineWebhookEvent,
  Broadcast
};
