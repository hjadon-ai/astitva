const NotificationSetting = require('../models/NotificationSetting');
async function notificationSettings() {
  const record = await NotificationSetting.findOne({ key: 'web' }).lean();
  return { webEnabled: record?.enabled === true, expectedVersion: record?.version || null };
}
module.exports = { notificationSettings };
