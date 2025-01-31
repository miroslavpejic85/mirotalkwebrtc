const fs = require('fs');

const logs = require('../common/logs');

const log = new logs('HtmlInjector');

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
        return {
            OG_TYPE: this.config?.OG?.type || 'app-webrtc',
            OG_SITE_NAME: this.config?.OG?.siteName || 'MiroTalk WEB',
            OG_TITLE: this.config?.OG?.title || 'Click the link to schedule the Meeting',
            OG_DESCRIPTION:
                this.config?.OG?.description || 'MiroTalk WEB Easy Room Scheduler for Meetings & Video Conferencing.',
            OG_IMAGE: this.config?.OG?.image || 'https://webrtc.mirotalk.com/Images/mirotalk-web.png',
            OG_URL: this.config?.OG?.url || 'https://webrtc.mirotalk.com',
            // Add more data here as needed with fallbacks
        };
    }

    // Function to load a file into the cache
    loadFileToCache(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            this.cache[filePath] = content; // Store the content in cache
        } catch (err) {
            log.error(`Error reading file: ${filePath}`, err);
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

        if (!this.cache[filePath]) {
            log.error(`File not cached: ${filePath}`);
            if (!res.headersSent) {
                return res.status(500).send('Server Error');
            }
            return;
        }

        try {
            // Replace placeholders with dynamic data (OG, TITLE, etc.)
            const modifiedHTML = this.cache[filePath].replace(
                /{{(OG_[A-Z_]+)}}/g,
                (_, key) => this.injectData[key] || '',
            );

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
