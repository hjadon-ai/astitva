const InvitedEmail = require('../models/InvitedEmail');

const defaultFeatures = Object.freeze({
  priorities: false, diet: false, finance: false, family: true, chat: false, mcp: false
});

async function featuresForEmail(email) {
  const invitation = await InvitedEmail.findOne({ email: email.toLowerCase() });
  return Object.fromEntries(Object.keys(defaultFeatures).map((feature) => [
    feature, typeof invitation?.[feature] === 'boolean' ? invitation[feature] : defaultFeatures[feature]
  ]));
}

function requireFeature(feature) {
  return async (request, response, next) => {
    const features = await featuresForEmail(request.featureUser.email);
    request.features = features;
    if (!features[feature]) return response.status(403).json({
      error: 'This feature is not enabled for your account.', code: 'FEATURE_NOT_ENABLED', feature
    });
    try{await require('../services/managedWorkspace').resolveRequest(request,feature);}catch(error){if(error.status)return response.status(error.status).json({error:error.message});return next(error);}
    next();
  };
}

module.exports = { defaultFeatures, featuresForEmail, requireFeature };
