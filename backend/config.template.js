'use strict';

module.exports = {
    Language: 'en', // https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes
    App: {
        Name: 'MiroTalk WEB',
        Logo: '../Images/logo.png',
        Image: '../Images/mirotalk-web.png',
    },
    OG: {
        type: 'app-webrtc',
        siteName: 'MiroTalk WebRTC',
        title: 'Click the link to schedule the Meeting',
        description: 'MiroTalk WEB Easy Room Scheduler for Meetings & Video Conferencing.',
        image: 'https://webrtc.mirotalk.com/Images/mirotalk-web.png',
        url: 'https://webrtc.mirotalk.com',
    },
    Author: {
        Email: 'miroslav.pejic.85@gmail.com',
        Profile: 'https://www.linkedin.com/in/miroslav-pejic-976a07101/',
        Support: 'https://github.com/sponsors/miroslavpejic85',
    },
    MiroTalk: {
        P2P: {
            Visible: true,
            Label: 'MiroTalk P2P',
            Home: 'https://p2p.mirotalk.com',
            Room: 'https://p2p.mirotalk.com/newcall',
            Join: 'https://p2p.mirotalk.com/join/',
            GitHub: {
                Visible: true,
                Repo: 'https://github.com/miroslavpejic85/mirotalk',
                Star: 'https://github.com/miroslavpejic85/mirotalk/stargazers',
                Shields: 'https://img.shields.io/github/stars/miroslavpejic85/mirotalk?style=flat',
            },
        },
        SFU: {
            Visible: true,
            Protected: false, // host_protected or user_auth enabled
            Label: 'MiroTalk SFU',
            Home: 'https://sfu.mirotalk.com',
            Room: 'https://sfu.mirotalk.com/newroom',
            Join: 'https://sfu.mirotalk.com/join/',
            GitHub: {
                Visible: true,
                Repo: 'https://github.com/miroslavpejic85/mirotalksfu',
                Star: 'https://github.com/miroslavpejic85/mirotalksfu/stargazers',
                Shields: 'https://img.shields.io/github/stars/miroslavpejic85/mirotalksfu?style=flat',
            },
        },
        C2C: {
            Visible: true,
            Label: 'MiroTalk C2C',
            Home: 'https://c2c.mirotalk.com',
            Room: 'https://c2c.mirotalk.com/?room=',
            GitHub: {
                Visible: true,
                Repo: 'https://github.com/miroslavpejic85/mirotalkc2c',
                Star: 'https://github.com/miroslavpejic85/mirotalkc2c/stargazers',
                Shields: 'https://img.shields.io/github/stars/miroslavpejic85/mirotalkc2c?style=flat',
            },
        },
        BRO: {
            Visible: true,
            Label: 'MiroTalk BRO',
            Home: 'https://bro.mirotalk.com',
            Broadcast: 'https://bro.mirotalk.com/broadcast?id=',
            Viewer: 'https://bro.mirotalk.com/viewer?id=',
            GitHub: {
                Visible: true,
                Repo: 'https://github.com/miroslavpejic85/mirotalkbro',
                Star: 'https://github.com/miroslavpejic85/mirotalkbro/stargazers',
                Shields: 'https://img.shields.io/github/stars/miroslavpejic85/mirotalkbro?style=flat',
            },
        },
        CME: {
            Visible: true,
            Label: 'MiroTalk CME',
            Home: 'https://cme.mirotalk.com',
            GitHub: {
                Visible: true,
                Repo: 'https://github.com/miroslavpejic85/call-me',
                Star: 'https://github.com/miroslavpejic85/call-me/stargazers',
                Shields: 'https://img.shields.io/github/stars/miroslavpejic85/call-me?style=flat',
            },
        },
    },
    HTML: {
        support: true,
        profile: true,
        projects: true,
        //...
    },
    BUTTONS: {
        setRandomRoom: true,
        copyRoom: true,
        shareRoom: true,
        sendEmail: true,
        sendSmSInvitation: true,
        joinInternal: true,
        joinExternal: true,
        updateRow: true,
        delRow: true,
    },
    EMAIL_INVITATION: {
        // Feature flag exposed to the frontend so it can render the
        // "Send Invitation (Server)" action alongside the existing mailto: "Send Email".
        // Reads from process.env so a single env var controls behavior end-to-end.
        serverSide: process.env.EMAIL_INVITATION_SERVER_SIDE === 'true' || false,
        maxRecipients: Number(process.env.EMAIL_INVITATION_MAX_RECIPIENTS) || 50,
        // Recurring weekly invitations. Requires serverSide=true and the email queue worker.
        recurring:
            (process.env.EMAIL_INVITATION_SERVER_SIDE === 'true' &&
                process.env.EMAIL_INVITATION_RECURRING !== 'false') ||
            false,
    },
    SAAS: {
        // SaaS (paid subscription) mode. When disabled, the platform behaves
        // exactly as a self-hosted install (no subscription checks, no Stripe).
        // Only non-secret values are exposed here, since the whole config object
        // is served to the frontend via GET /config. The Stripe secret key and
        // webhook secret are read directly from process.env in backend/lib/stripe.js.
        enabled: process.env.SAAS === 'true' || false,
        stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
        monthlyPriceId: process.env.STRIPE_MONTHLY_PRICE_ID || '',
        lifetimePriceId: process.env.STRIPE_LIFETIME_PRICE_ID || '',
        pricing: {
            monthly: '$9',
            lifetime: '$199',
        },
    },
};
