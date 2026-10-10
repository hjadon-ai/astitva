const mongoose = require('mongoose');
const { Schema } = mongoose;
const options = collection => ({ collection, timestamps: true });
const client = new Schema({ clientId: { type: String, unique: true }, metadata: Schema.Types.Mixed, expiresAt: { type: Date, expires: 0 } }, options('mcpClients'));
const authorization = new Schema({ requestHash: { type: String, unique: true }, clientId: String, clientName: String, redirectUri: String, state: String, challenge: String, resource: String, userId: { type: Schema.Types.ObjectId, ref: 'User' }, codeHash: { type: String, index: true }, expiresAt: { type: Date, expires: 0 } }, options('mcpAuthorizations'));
const grant = new Schema({ userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, clientId: String, clientName: String, scope: String, resource: String, accessHash: { type: String, unique: true }, refreshHash: { type: String, unique: true }, accessExpiresAt: Date, expiresAt: { type: Date, expires: 0 }, revokedAt: { type: Date, default: null } }, options('mcpGrants'));
const bucket = new Schema({ key: { type: String, unique: true }, count: Number, expiresAt: { type: Date, expires: 0 } }, options('mcpRateLimits'));
module.exports = { Client: mongoose.model('McpClient', client), Authorization: mongoose.model('McpAuthorization', authorization), Grant: mongoose.model('McpGrant', grant), Bucket: mongoose.model('McpRateLimit', bucket) };
