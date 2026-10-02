'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../frontend/js/tooltips.js'), 'utf8');

function tooltipElement(content, children = []) {
    return {
        nodeType: 1,
        isConnected: true,
        dataset: content === undefined ? {} : { tippyContent: content },
        matches() {
            return Object.hasOwn(this.dataset, 'tippyContent');
        },
        querySelectorAll() {
            return children.filter((child) => child.matches());
        },
    };
}

function loadTooltips(elements = [], readyState = 'complete', available = true) {
    const instances = [];
    const body = tooltipElement(undefined, elements);
    let ready;
    let notify;
    let observerOptions;
    const context = {
        document: {
            body,
            readyState,
            addEventListener(event, callback) {
                assert.equal(event, 'DOMContentLoaded');
                ready = callback;
            },
        },
        MutationObserver: class {
            constructor(callback) {
                notify = callback;
            }
            observe(target, options) {
                assert.equal(target, body);
                observerOptions = options;
            }
        },
    };
    if (available) {
        context.tippy = (element, options) => {
            const instance = {
                options,
                destroyed: false,
                setContent(content) {
                    this.options.content = content;
                },
                destroy() {
                    this.destroyed = true;
                    delete element._tippy;
                },
            };
            element._tippy = instance;
            instances.push(instance);
        };
    }
    vm.runInNewContext(source, context);
    return {
        body,
        instances,
        ready: () => ready(),
        notify: (records) => notify(records),
        observerOptions: () => observerOptions,
    };
}

test('initializes declarative tooltips as plain text above their controls', () => {
    const element = tooltipElement('<b>Help</b>');
    const { body, instances, observerOptions } = loadTooltips([element]);
    assert.equal(instances.length, 1);
    assert.equal(element._tippy.options.content, '<b>Help</b>');
    assert.equal(element._tippy.options.allowHTML, false);
    assert.equal(element._tippy.options.placement, 'top');
    assert.equal(element._tippy.options.appendTo(), body);
    assert.equal(observerOptions().attributeFilter[0], 'data-tippy-content');
});

test('waits for DOM readiness and tolerates an unavailable Tippy library', () => {
    const element = tooltipElement('Help');
    const state = loadTooltips([element], 'loading');
    assert.equal(state.instances.length, 0);
    state.ready();
    assert.equal(state.instances.length, 1);
    assert.doesNotThrow(() => loadTooltips([tooltipElement('Help')], 'complete', false));
});

test('initializes dynamic controls and updates text without duplicating instances', () => {
    const { instances, notify } = loadTooltips();
    const button = tooltipElement('Show password');
    const container = tooltipElement(undefined, [button]);
    notify([{ type: 'childList', addedNodes: [container, { nodeType: 3 }], removedNodes: [] }]);
    assert.equal(instances.length, 1);
    button.dataset.tippyContent = 'Hide password';
    notify([{ type: 'attributes', target: button }]);
    assert.equal(instances.length, 1);
    assert.equal(button._tippy.options.content, 'Hide password');
    delete button.dataset.tippyContent;
    notify([{ type: 'attributes', target: button }]);
    assert.equal(instances[0].destroyed, true);
});

test('destroys removed tooltips but preserves controls moved within the document', () => {
    const element = tooltipElement('Help');
    const { instances, notify } = loadTooltips([element]);
    notify([{ type: 'childList', addedNodes: [element], removedNodes: [element] }]);
    assert.equal(instances.length, 1);
    assert.equal(instances[0].destroyed, false);
    element.isConnected = false;
    notify([{ type: 'childList', addedNodes: [], removedNodes: [element] }]);
    assert.equal(instances[0].destroyed, true);
});
