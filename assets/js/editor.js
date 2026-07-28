(function () {
	'use strict';

	if (!window.WPBuilder || !window.wp || !wp.apiFetch) return;
	if (wp.apiFetch.createNonceMiddleware) {
		wp.apiFetch.use(wp.apiFetch.createNonceMiddleware(WPBuilder.nonce));
	}

	var TYPES = [
		['section', 'Section'], ['container', 'Container'], ['row', 'Row'], ['column', 'Column'],
		['heading', 'Heading'], ['text', 'Text'], ['button', 'Button'], ['image', 'Image'],
		['list', 'List'], ['video', 'Video'], ['audio', 'Audio'], ['alert', 'Alert'],
		['progress', 'Progress'], ['spacer', 'Spacer'], ['divider', 'Divider'],
		['icon', 'Icon'], ['html', 'HTML'], ['shortcode', 'Shortcode']
	];
	var CONTAINERS = ['section', 'container', 'row', 'column', 'inner-container'];
	var state = {
		document: { version: 1, settings: {}, elements: [] },
		selected: null,
		device: 'desktop',
		history: [],
		future: [],
		saving: false,
		dirty: false,
		dragged: null
	};
	var shell, canvas, navigator, inspector, status;

	function clone(value) {
		return JSON.parse(JSON.stringify(value));
	}

	function id() {
		return 'wpb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
	}

	function defaults(type) {
		var props = {};
		if (type === 'heading') props = { text: 'Your heading', tag: 'h2' };
		else if (type === 'text') props = { text: 'Add your text here.' };
		else if (type === 'button') props = { text: 'Learn more', url: '#' };
		else if (type === 'image') props = { attachmentId: 0, url: '', alt: '' };
		else if (type === 'list') props = { text: 'First item\nSecond item\nThird item' };
		else if (type === 'alert') props = { text: 'Important information' };
		else if (type === 'progress') props = { value: 60 };
		else if (type === 'spacer') props = { text: '' };
		else if (type === 'icon') props = { text: '★' };
		else if (type === 'html') props = { html: '<p>Custom HTML</p>' };
		else if (type === 'shortcode') props = { code: '' };
		else if (type === 'video' || type === 'audio') props = { url: '' };
		return { id: id(), type: type, props: props, styles: { desktop: {} }, children: [] };
	}

	function walk(elements, target, callback, parent) {
		for (var i = 0; i < elements.length; i++) {
			if (elements[i].id === target) return callback(elements[i], elements, i, parent);
			var result = walk(elements[i].children || [], target, callback, elements[i]);
			if (result !== undefined) return result;
		}
	}

	function selected() {
		return walk(state.document.elements, state.selected, function (element) { return element; });
	}

	function checkpoint() {
		state.history.push(clone(state.document));
		if (state.history.length > 75) state.history.shift();
		state.future = [];
		state.dirty = true;
		updateStatus('Unsaved');
	}

	function mutate(callback) {
		checkpoint();
		callback();
		render();
	}

	function undo() {
		if (!state.history.length) return;
		state.future.push(clone(state.document));
		state.document = state.history.pop();
		if (state.selected && !selected()) state.selected = null;
		state.dirty = true;
		render();
		updateStatus('Unsaved');
	}

	function redo() {
		if (!state.future.length) return;
		state.history.push(clone(state.document));
		state.document = state.future.pop();
		state.dirty = true;
		render();
		updateStatus('Unsaved');
	}

	function add(type, parentId) {
		mutate(function () {
			var element = defaults(type);
			if (parentId) {
				walk(state.document.elements, parentId, function (parent) {
					if (CONTAINERS.indexOf(parent.type) >= 0) parent.children.push(element);
				});
			} else {
				state.document.elements.push(element);
			}
			state.selected = element.id;
		});
	}

	function removeSelected() {
		if (!state.selected) return;
		mutate(function () {
			walk(state.document.elements, state.selected, function (element, siblings, index) {
				siblings.splice(index, 1);
			});
			state.selected = null;
		});
	}

	function duplicateSelected() {
		if (!state.selected) return;
		mutate(function () {
			walk(state.document.elements, state.selected, function (element, siblings, index) {
				var copy = clone(element);
				reidentify(copy);
				siblings.splice(index + 1, 0, copy);
				state.selected = copy.id;
			});
		});
	}

	function reidentify(element) {
		element.id = id();
		(element.children || []).forEach(reidentify);
	}

	function move(sourceId, targetId) {
		if (!sourceId || !targetId || sourceId === targetId) return;
		var source;
		walk(state.document.elements, sourceId, function (element, siblings, index) {
			source = element;
			siblings.splice(index, 1);
		});
		if (!source) return;
		var inserted = walk(state.document.elements, targetId, function (target, siblings, index) {
			siblings.splice(index, 0, source);
			return true;
		});
		if (!inserted) state.document.elements.push(source);
	}

	function el(tag, className, text) {
		var node = document.createElement(tag);
		if (className) node.className = className;
		if (text !== undefined) node.textContent = text;
		return node;
	}

	function button(label, action, className, title) {
		var node = el('button', className || 'wpb-ui-button', label);
		node.type = 'button';
		node.title = title || label;
		node.addEventListener('click', action);
		return node;
	}

	function buildShell() {
		document.documentElement.classList.add('wpb-editing');
		shell = el('div', 'wpb-editor-shell');
		shell.innerHTML =
			'<header class="wpb-toolbar" aria-label="Builder toolbar">' +
			'<strong class="wpb-brand">WP Builder</strong>' +
			'<div class="wpb-history"></div><div class="wpb-devices"></div>' +
			'<span class="wpb-status" role="status">Loading…</span><div class="wpb-actions"></div>' +
			'</header><aside class="wpb-panel wpb-library"><h2>Elements</h2><input class="wpb-search" type="search" placeholder="Search elements…"><div class="wpb-element-list"></div></aside>' +
			'<main class="wpb-stage"><div class="wpb-canvas-frame"><div class="wpb-live-canvas" data-device="desktop"></div></div></main>' +
			'<aside class="wpb-panel wpb-right"><div class="wpb-panel-tabs"><button data-panel="inspect">Style</button><button data-panel="layers">Layers</button></div><div class="wpb-inspector"></div><div class="wpb-navigator" hidden></div></aside>';
		document.body.appendChild(shell);
		canvas = shell.querySelector('.wpb-live-canvas');
		navigator = shell.querySelector('.wpb-navigator');
		inspector = shell.querySelector('.wpb-inspector');
		status = shell.querySelector('.wpb-status');

		var history = shell.querySelector('.wpb-history');
		history.append(button('↶', undo, 'wpb-icon-button', 'Undo (Ctrl/Cmd+Z)'));
		history.append(button('↷', redo, 'wpb-icon-button', 'Redo (Ctrl/Cmd+Shift+Z)'));
		var devices = shell.querySelector('.wpb-devices');
		[['desktop', 'Desktop'], ['tablet', 'Tablet'], ['mobile', 'Mobile']].forEach(function (item) {
			devices.append(button(item[1], function () {
				state.device = item[0];
				canvas.dataset.device = item[0];
				renderInspector();
			}, 'wpb-device'));
		});
		var actions = shell.querySelector('.wpb-actions');
		actions.append(button('Exit', exitEditor));
		actions.append(button('Save', save, 'wpb-ui-button wpb-primary'));
		buildLibrary();
		shell.querySelectorAll('.wpb-panel-tabs button').forEach(function (tab) {
			tab.addEventListener('click', function () {
				var layers = tab.dataset.panel === 'layers';
				navigator.hidden = !layers;
				inspector.hidden = layers;
			});
		});
	}

	function buildLibrary() {
		var list = shell.querySelector('.wpb-element-list');
		var search = shell.querySelector('.wpb-search');
		function draw(query) {
			list.replaceChildren();
			TYPES.filter(function (item) {
				return item[1].toLowerCase().indexOf(query.toLowerCase()) >= 0;
			}).forEach(function (item) {
				var card = button(item[1], function () {
					var target = selected();
					add(item[0], target && CONTAINERS.indexOf(target.type) >= 0 ? target.id : null);
				}, 'wpb-element-card', 'Add ' + item[1]);
				card.draggable = true;
				card.addEventListener('dragstart', function (event) {
					event.dataTransfer.setData('application/x-wpb-type', item[0]);
				});
				list.append(card);
			});
		}
		search.addEventListener('input', function () { draw(search.value); });
		draw('');
	}

	function applyStyles(node, element) {
		var rules = Object.assign({}, (element.styles || {}).desktop || {});
		if (state.device !== 'desktop') Object.assign(rules, (element.styles || {})[state.device] || {});
		Object.keys(rules).forEach(function (property) {
			if (/^[a-zA-Z]+$/.test(property)) node.style[property] = rules[property];
		});
	}

	function canvasElement(element) {
		var node = el('div', 'wpb-canvas-element wpb-canvas-' + element.type);
		node.dataset.id = element.id;
		node.draggable = true;
		node.tabIndex = 0;
		node.setAttribute('aria-label', element.type + ' element');
		if (element.id === state.selected) node.classList.add('is-selected');
		if (element.props && element.props['hide_' + state.device]) node.classList.add('is-device-hidden');
		applyStyles(node, element);

		var label = el('span', 'wpb-element-label', element.type);
		node.append(label);
		var content = el('div', 'wpb-element-content');
		if (element.type === 'heading') {
			var heading = el(element.props.tag || 'h2', '', element.props.text || 'Your heading');
			content.append(heading);
		} else if (element.type === 'text' || element.type === 'alert') {
			content.append(el('p', '', element.props.text || 'Add text'));
		} else if (element.type === 'button') {
			content.append(el('span', 'wpb-preview-button', element.props.text || 'Button'));
		} else if (element.type === 'image') {
			if (element.props.url) {
				var image = document.createElement('img');
				image.src = element.props.url;
				image.alt = element.props.alt || '';
				content.append(image);
			} else content.append(el('div', 'wpb-placeholder', 'Choose an image'));
		} else if (element.type === 'list') {
			var ul = el('ul');
			(element.props.text || '').split(/\r?\n/).forEach(function (item) {
				if (item.trim()) ul.append(el('li', '', item.trim()));
			});
			content.append(ul);
		} else if (element.type === 'divider') {
			content.append(document.createElement('hr'));
		} else if (element.type === 'spacer') {
			content.append(el('span', 'wpb-placeholder', 'Spacer'));
		} else if (element.type === 'progress') {
			var progress = document.createElement('progress');
			progress.max = 100;
			progress.value = Number(element.props.value || 0);
			content.append(progress);
		} else if (element.props && (element.props.text || element.props.url || element.props.code)) {
			content.append(el('div', '', element.props.text || element.props.url || element.props.code));
		}
		(element.children || []).forEach(function (child) { content.append(canvasElement(child)); });
		if (CONTAINERS.indexOf(element.type) >= 0 && !(element.children || []).length) {
			content.append(el('div', 'wpb-drop-hint', 'Drop elements here'));
		}
		node.append(content);
		node.addEventListener('click', function (event) {
			event.stopPropagation();
			state.selected = element.id;
			render();
		});
		node.addEventListener('dragstart', function (event) {
			event.stopPropagation();
			state.dragged = element.id;
			event.dataTransfer.setData('application/x-wpb-id', element.id);
		});
		node.addEventListener('dragover', function (event) {
			event.preventDefault();
			event.stopPropagation();
			node.classList.add('is-drop-target');
		});
		node.addEventListener('dragleave', function () { node.classList.remove('is-drop-target'); });
		node.addEventListener('drop', function (event) {
			event.preventDefault();
			event.stopPropagation();
			node.classList.remove('is-drop-target');
			var type = event.dataTransfer.getData('application/x-wpb-type');
			if (type && CONTAINERS.indexOf(element.type) >= 0) add(type, element.id);
			else {
				var sourceId = event.dataTransfer.getData('application/x-wpb-id');
				if (sourceId && sourceId !== element.id) mutate(function () { move(sourceId, element.id); });
			}
		});
		return node;
	}

	function renderCanvas() {
		canvas.replaceChildren();
		canvas.dataset.device = state.device;
		if (!state.document.elements.length) {
			var empty = el('div', 'wpb-empty-state');
			empty.append(el('h2', '', 'Start building'));
			empty.append(el('p', '', 'Add an element from the left panel or begin with a section.'));
			empty.append(button('Add section', function () { add('section'); }, 'wpb-ui-button wpb-primary'));
			canvas.append(empty);
		} else state.document.elements.forEach(function (element) { canvas.append(canvasElement(element)); });
		canvas.ondragover = function (event) { event.preventDefault(); };
		canvas.ondrop = function (event) {
			if (event.target !== canvas) return;
			event.preventDefault();
			var type = event.dataTransfer.getData('application/x-wpb-type');
			if (type) add(type);
		};
	}

	function field(label, value, change, type) {
		var wrap = el('label', 'wpb-field');
		wrap.append(el('span', '', label));
		var input = type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
		if (type && type !== 'textarea') input.type = type;
		input.value = value === undefined ? '' : value;
		input.addEventListener('change', function () { change(input.value); });
		wrap.append(input);
		return wrap;
	}

	function renderInspector() {
		inspector.replaceChildren();
		var element = selected();
		if (!element) {
			inspector.append(el('p', 'wpb-panel-empty', 'Select an element to edit its content and style.'));
			return;
		}
		inspector.append(el('h2', '', element.type.charAt(0).toUpperCase() + element.type.slice(1)));
		function prop(name, label, type) {
			inspector.append(field(label, element.props[name], function (value) {
				mutate(function () { element.props[name] = value; });
			}, type));
		}
		if (['heading', 'text', 'button', 'list', 'alert', 'icon'].indexOf(element.type) >= 0) {
			prop('text', 'Content', element.type === 'text' || element.type === 'list' ? 'textarea' : 'text');
		}
		if (element.type === 'heading') prop('tag', 'HTML tag', 'text');
		if (['button', 'video', 'audio'].indexOf(element.type) >= 0) prop('url', 'URL', 'url');
		if (element.type === 'image') {
			prop('url', 'Image URL', 'url');
			prop('alt', 'Alternative text', 'text');
		}
		if (element.type === 'progress') prop('value', 'Value (0–100)', 'number');
		if (element.type === 'html') prop('html', 'HTML', 'textarea');
		if (element.type === 'shortcode') prop('code', 'Shortcode', 'text');

		inspector.append(el('h3', '', 'Style · ' + state.device));
		var styles = element.styles[state.device] || (element.styles[state.device] = {});
		[
			['color', 'Text color', 'color'], ['backgroundColor', 'Background', 'color'],
			['fontSize', 'Font size', 'text'], ['padding', 'Padding', 'text'],
			['margin', 'Margin', 'text'], ['borderRadius', 'Radius', 'text'],
			['width', 'Width', 'text'], ['minHeight', 'Minimum height', 'text'],
			['textAlign', 'Text alignment', 'text'], ['gap', 'Gap', 'text']
		].forEach(function (setting) {
			inspector.append(field(setting[1], styles[setting[0]] || '', function (value) {
				mutate(function () {
					if (value) styles[setting[0]] = value;
					else delete styles[setting[0]];
				});
			}, setting[2]));
		});
		var visibility = el('label', 'wpb-check');
		var checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.checked = !!element.props['hide_' + state.device];
		checkbox.addEventListener('change', function () {
			mutate(function () { element.props['hide_' + state.device] = checkbox.checked ? '1' : ''; });
		});
		visibility.append(checkbox, el('span', '', 'Hide on ' + state.device));
		inspector.append(visibility);
		var row = el('div', 'wpb-inspector-actions');
		row.append(button('Duplicate', duplicateSelected), button('Delete', removeSelected, 'wpb-ui-button wpb-danger'));
		inspector.append(row);
	}

	function navigatorItem(element, depth) {
		var item = el('button', 'wpb-layer' + (element.id === state.selected ? ' is-selected' : ''), element.type);
		item.type = 'button';
		item.style.paddingLeft = (12 + depth * 16) + 'px';
		item.addEventListener('click', function () {
			state.selected = element.id;
			render();
		});
		var fragment = document.createDocumentFragment();
		fragment.append(item);
		(element.children || []).forEach(function (child) { fragment.append(navigatorItem(child, depth + 1)); });
		return fragment;
	}

	function renderNavigator() {
		navigator.replaceChildren();
		navigator.append(el('h2', '', 'Layers'));
		state.document.elements.forEach(function (element) { navigator.append(navigatorItem(element, 0)); });
	}

	function render() {
		renderCanvas();
		renderInspector();
		renderNavigator();
	}

	function updateStatus(message) {
		if (status) status.textContent = message;
	}

	function save() {
		if (state.saving) return;
		state.saving = true;
		updateStatus('Saving…');
		wp.apiFetch({
			path: WPBuilder.restPath + WPBuilder.postId,
			method: 'PUT',
			data: { document: state.document }
		}).then(function (document) {
			state.document = document;
			state.history = [];
			state.future = [];
			state.dirty = false;
			updateStatus('Saved');
			render();
		}).catch(function (error) {
			updateStatus(error && error.message ? error.message : 'Save failed');
		}).finally(function () { state.saving = false; });
	}

	function exitEditor() {
		if (state.dirty && !window.confirm('Leave without saving your changes?')) return;
		var url = new URL(window.location.href);
		url.searchParams.delete('wpb-edit');
		window.location.href = url.toString();
	}

	function keyboard(event) {
		var modifier = event.ctrlKey || event.metaKey;
		if (modifier && event.key.toLowerCase() === 's') {
			event.preventDefault();
			save();
		} else if (modifier && event.key.toLowerCase() === 'z') {
			event.preventDefault();
			event.shiftKey ? redo() : undo();
		} else if (modifier && event.key.toLowerCase() === 'd') {
			event.preventDefault();
			duplicateSelected();
		} else if ((event.key === 'Delete' || event.key === 'Backspace') && !/INPUT|TEXTAREA/.test(event.target.tagName)) {
			removeSelected();
		}
	}

	function start() {
		buildShell();
		document.addEventListener('keydown', keyboard);
		window.addEventListener('beforeunload', function (event) {
			if (!state.dirty) return;
			event.preventDefault();
			event.returnValue = '';
		});
		wp.apiFetch({ path: WPBuilder.restPath + WPBuilder.postId }).then(function (document) {
			state.document = document;
			updateStatus('Ready');
			render();
		}).catch(function (error) {
			updateStatus(error && error.message ? error.message : 'Could not load the document');
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
	else start();
})();
