'use strict';

module.exports = {
    Language: 'en', // https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes
    App: {
        Name: 'MiroTalk',
        Logo: '../Images/logo.png',
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
};
