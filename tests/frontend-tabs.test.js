const fs = require('fs');
const { JSDOM } = require('jsdom');

const dom = new JSDOM(
	'<div data-pagevia-tabs><div role="tablist"><button role="tab" aria-controls="p1" aria-selected="true">One</button><button role="tab" aria-controls="p2" aria-selected="false" tabindex="-1">Two</button></div><div id="p1" role="tabpanel">A</div><div id="p2" role="tabpanel" hidden>B</div></div>',
	{ runScripts: 'outside-only' }
);
dom.window.eval(fs.readFileSync('assets/js/frontend.js', 'utf8'));
const buttons = dom.window.document.querySelectorAll('[role="tab"]');
const panels = dom.window.document.querySelectorAll('[role="tabpanel"]');
buttons[1].click();
if (buttons[1].getAttribute('aria-selected') !== 'true' || !panels[0].hidden || panels[1].hidden) {
	throw new Error('Click activation failed');
}
buttons[1].dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
if (buttons[0].getAttribute('aria-selected') !== 'true' || panels[0].hidden || !panels[1].hidden) {
	throw new Error('Keyboard activation failed');
}
console.log('Frontend tabs tests passed');
