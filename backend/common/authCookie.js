'use strict';

const AUTH_COOKIE_NAME = 'mirotalk_auth';

function getAuthToken(req) {
    return (
        req?.body?.token ||
        req?.query?.token ||
        req?.headers['x-access-token'] ||
        req?.headers['authorization'] ||
        req?.headers['Authorization'] ||
        req?.cookies?.[AUTH_COOKIE_NAME]
    );
}

function getCookieOptions() {
    return {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
    };
}

function setAuthCookie(res, token) {
    res.cookie(AUTH_COOKIE_NAME, token, getCookieOptions());
}

function clearAuthCookie(res) {
    res.clearCookie(AUTH_COOKIE_NAME, getCookieOptions());
}

module.exports = {
    AUTH_COOKIE_NAME,
    getAuthToken,
    setAuthCookie,
    clearAuthCookie,
};
