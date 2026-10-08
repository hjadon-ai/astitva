const categories=Object.freeze({diet:'general',priorities:'general',family:'general',finance:'premium',chat:'premium',admin:'premium'});
const generalModules=features=>Object.keys(categories).filter(key=>categories[key]==='general'&&features[key]===true);
module.exports={categories,generalModules};
