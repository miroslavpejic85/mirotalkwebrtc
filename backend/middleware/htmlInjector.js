const fs = require('fs');

const logs = require('../common/logs');

const log = new logs('HtmlInjector');

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function getUrlOrigin(value) {
    try {
        return new URL(value).origin;
    } catch {
        return '';
    }
}

class HtmlInjector {
    constructor(filesPath, config) {
        this.filesPath = filesPath; // Array of file paths to cache
        this.cache = {}; // Object to store cached files
        this.config = config; // Configuration containing metadata (OG, title, etc.)
        this.injectData = this.getInjectData(); // Initialize dynamic injection data
        this.preloadPages(filesPath); // Preload pages at startup
        this.watchFiles(filesPath); // Watch files for changes
        log.info('filesPath cached', this.filesPath);
    }

    // Function to get dynamic data for injection (e.g., OG data, title, etc.)
    getInjectData() {
        const legal = this.config?.LEGAL || {};
        const analytics = this.config?.ANALYTICS || {};
        return {
            OG_TYPE: this.config?.OG?.type || 'app-webrtc',
            OG_SITE_NAME: this.config?.OG?.siteName || 'MiroTalk WEB',
            OG_TITLE: this.config?.OG?.title || 'MiroTalk WEB - Open Source WebRTC Video SaaS Platform',
            OG_DESCRIPTION:
                this.config?.OG?.description ||
                'Build your own video SaaS with MiroTalk WEB, an open-source self-hosted WebRTC platform for user accounts, meeting scheduling, dashboards, subscription plans, customer management and branded video communication.',
            OG_IMAGE: this.config?.OG?.image || 'https://webrtc.mirotalk.com/Images/mirotalk-web.png',
            OG_URL: this.config?.OG?.url || 'https://webrtc.mirotalk.com',
            LEGAL_POLICY_VERSION: escapeHtml(legal.policyVersion || '2026-09-18'),
            LEGAL_OPERATOR_NAME: escapeHtml(legal.operatorName || 'MiroTalk WEB deployment operator'),
            LEGAL_CONTACT_EMAIL: escapeHtml(legal.contactEmail || 'miroslav.pejic.85@gmail.com'),
            LEGAL_FORUM_URL: escapeHtml(legal.forumUrl || 'https://discord.gg/rgGYfeYW3N'),
            LEGAL_GOVERNING_LAW: escapeHtml(
                legal.governingLaw ||
                    'the laws applicable in the jurisdiction where the deployment operator is established'
            ),
            ANALYTICS_ORIGIN: escapeHtml(getUrlOrigin(analytics.scriptUrl)),
        };
    }

    // Function to load a file into the cache
    loadFileToCache(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            this.cache[filePath] = content; // Store the content in cache
            return true;
        } catch (err) {
            log.error(`Error reading file: ${filePath}`, err);
            return false;
        }
    }

    // Function to preload pages into the cache
    preloadPages(filePaths) {
        filePaths.forEach((filePath) => this.loadFileToCache(filePath));
    }

    // Function to watch a file for changes and reload the cache
    watchFileForChanges(filePath) {
        fs.watch(filePath, (eventType) => {
            if (eventType === 'change') {
                log.debug(`File changed: ${filePath}`);
                this.loadFileToCache(filePath);
                log.debug(`Reload the file ${filePath} into cache`);
            }
        });
    }

    // Function to watch all files for changes
    watchFiles(filePaths) {
        filePaths.forEach((filePath) => this.watchFileForChanges(filePath));
    }

    // Function to inject dynamic data (e.g., OG, TITLE, etc.) into a given file
    injectHtml(filePath, res) {
        // return res.send(this.cache[filePath]);

        if (!this.cache[filePath] && !this.loadFileToCache(filePath)) {
            log.error(`File not cached: ${filePath}`);
            if (!res.headersSent) {
                return res.status(500).send('Server Error');
            }
            return;
        }

        try {
            // Replace configured metadata and legal placeholders.
            const modifiedHTML = this.cache[filePath].replace(/{{((?:OG|LEGAL|ANALYTICS)_[A-Z_]+)}}/g, (_, key) => {
                return this.injectData[key] || '';
            });

            if (!res.headersSent) {
                res.send(modifiedHTML);
            }
        } catch (error) {
            log.error('Error injecting HTML data:', error);
            if (!res.headersSent) {
                res.status(500).send('Server Error');
            }
        }
    }
}

module.exports = HtmlInjector;
