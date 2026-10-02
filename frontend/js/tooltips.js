'use strict';

(() => {
    const selector = '[data-tippy-content]';

    function visitTooltips(root, callback) {
        if (root.nodeType !== 1) return;
        if (root.matches(selector)) callback(root);
        root.querySelectorAll(selector).forEach(callback);
    }

    function updateTooltip(element) {
        const content = element.dataset.tippyContent;
        if (!content) {
            element._tippy?.destroy();
        } else if (element._tippy) {
            element._tippy.setContent(content);
        } else {
            tippy(element, {
                content,
                placement: 'top',
                allowHTML: false,
                appendTo: () => document.body,
                zIndex: 10000,
            });
        }
    }

    function initTooltips() {
        if (typeof tippy !== 'function') return;
        visitTooltips(document.body, updateTooltip);
        new MutationObserver((records) => {
            records.forEach((record) => {
                if (record.type === 'attributes') {
                    updateTooltip(record.target);
                    return;
                }
                record.addedNodes.forEach((node) => visitTooltips(node, updateTooltip));
                record.removedNodes.forEach((node) => {
                    visitTooltips(node, (element) => {
                        if (!element.isConnected) element._tippy?.destroy();
                    });
                });
            });
        }).observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-tippy-content'],
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTooltips);
    } else {
        initTooltips();
    }
})();
