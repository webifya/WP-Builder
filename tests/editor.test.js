const fs = require('fs');
const { JSDOM } = require('jsdom');

(async () => {
	const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/?pagevia-edit=1', runScripts: 'outside-only' });
	let writes = 0;
	const apiFetch = (request) => {
		if (request.method === 'PUT') { writes++; return Promise.resolve(request.data.document); }
		return Promise.resolve({ version: 1, settings: {}, elements: [] });
	};
	apiFetch.use = () => {};
	apiFetch.createNonceMiddleware = () => () => {};
	dom.window.Pagevia = { postId: 1, restPath: '/pagevia/v1/documents/', nonce: 'test', upgradeUrl: '', widgetTypes: [['test-product', 'Test Product']], widgetDefaults: { 'test-product': { limit: 4 } }, widgetControls: { 'test-product': [{ name: 'limit', label: 'Product limit', type: 'number' }] } };
	dom.window.wp = { apiFetch };
	dom.window.confirm = () => true;
	dom.window.eval(fs.readFileSync('assets/js/editor.js', 'utf8'));
	dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
	await new Promise((resolve) => setTimeout(resolve, 0));
	const heading = [...dom.window.document.querySelectorAll('.pagevia-element-card')].find((node) => node.textContent === 'Heading');
	if (!heading) throw new Error('Heading control missing');
	heading.click();
	if (!dom.window.document.querySelector('.pagevia-canvas-heading')) throw new Error('Heading was not added to the canvas');
	if (!dom.window.document.querySelector('.pagevia-unit-field')) throw new Error('Unit control missing');
	if (dom.window.document.querySelectorAll('.pagevia-layer-move').length < 2) throw new Error('Keyboard layer controls missing');
	const product = [...dom.window.document.querySelectorAll('.pagevia-element-card')].find((node) => node.textContent === 'Test Product');
	if (!product) throw new Error('Extension widget API control missing');
	product.click();
	if (![...dom.window.document.querySelectorAll('.pagevia-field span')].some((node) => node.textContent === 'Product limit')) throw new Error('Extension widget inspector control missing');
	const save = [...dom.window.document.querySelectorAll('.pagevia-actions button')].find((node) => node.textContent === 'Save');
	save.click();
	await new Promise((resolve) => setTimeout(resolve, 0));
	if (writes !== 1) throw new Error('Save did not reach the document API');
	console.log('Editor interaction tests passed');
	dom.window.close();
})();
