'use-strict';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function isAdmin(email, username, password) {
    return email == ADMIN_EMAIL && username == ADMIN_USERNAME && password == ADMIN_PASSWORD;
}

module.exports = {
    isAdmin,
};
