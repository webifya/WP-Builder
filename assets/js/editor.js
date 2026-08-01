(function () {
	'use strict';

	if (!window.Pagevia || !window.wp || !wp.apiFetch) return;
	if (wp.apiFetch.createNonceMiddleware) {
		wp.apiFetch.use(wp.apiFetch.createNonceMiddleware(Pagevia.nonce));
	}

	var TYPES = [
		['section', 'Section'], ['container', 'Container'], ['row', 'Row'], ['column', 'Column'], ['inner-container', 'Inner Container'],
		['heading', 'Heading'], ['text', 'Text'], ['button', 'Button'], ['image', 'Image'],
		['icon', 'Icon'], ['icon-box', 'Icon Box'], ['gallery', 'Gallery'],
		['list', 'List'], ['video', 'Video'], ['audio', 'Audio'], ['alert', 'Alert'],
		['progress', 'Progress'], ['spacer', 'Spacer'], ['divider', 'Divider'],
		['accordion', 'Accordion'], ['tabs', 'Tabs'], ['toggle', 'Toggle'],
		['counter', 'Counter'], ['rating', 'Star Rating'], ['social-icons', 'Social Icons'],
		['html', 'HTML'], ['shortcode', 'Shortcode']
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
		dragged: null,
		clipboard: null,
		recoveryTimer: null,
		autosaveTimer: null,
		changeId: 0
	};
	var shell, canvas, navigator, inspector, status;
	var recoveryKey = 'pagevia-recovery-' + Pagevia.postId;

	function clone(value) {
		return JSON.parse(JSON.stringify(value));
	}

	function id() {
		return 'pagevia-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
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
		else if (type === 'counter') props = { value: 100, suffix: '+' };
		else if (type === 'rating') props = { value: 5, max: 5 };
		else if (type === 'icon-box') props = { icon: '★', title: 'Icon box', text: 'Describe this feature.' };
		else if (type === 'gallery') props = { urls: '' };
		else if (type === 'social-icons') props = { links: 'Website | https://example.com' };
		else if (type === 'accordion' || type === 'tabs') props = {
			items: [
				{ title: 'First item', content: 'First item content.' },
				{ title: 'Second item', content: 'Second item content.' }
			]
		};
		else if (type === 'toggle') props = { title: 'More information', text: 'Toggle content.' };
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
		state.changeId++;
		updateStatus('Unsaved');
		scheduleRecovery();
		scheduleAutosave();
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
		state.changeId++;
		render();
		updateStatus('Unsaved');
		scheduleRecovery();
		scheduleAutosave();
	}

	function redo() {
		if (!state.future.length) return;
		state.history.push(clone(state.document));
		state.document = state.future.pop();
		state.dirty = true;
		state.changeId++;
		render();
		updateStatus('Unsaved');
		scheduleRecovery();
		scheduleAutosave();
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

	function moveLayer(elementId, delta) {
		mutate(function () {
			walk(state.document.elements, elementId, function (element, siblings, index) {
				var destination = Math.max(0, Math.min(siblings.length - 1, index + delta));
				if (destination === index) return;
				siblings.splice(index, 1);
				siblings.splice(destination, 0, element);
			});
		});
	}

	function copySelected() {
		var element = selected();
		if (!element) return;
		state.clipboard = clone(element);
		try { localStorage.setItem('pagevia-clipboard', JSON.stringify(state.clipboard)); } catch (error) {}
		updateStatus('Copied');
	}

	function pasteElement() {
		if (!state.clipboard) {
			try { state.clipboard = JSON.parse(localStorage.getItem('pagevia-clipboard')); } catch (error) {}
		}
		if (!state.clipboard || !state.clipboard.type) return;
		mutate(function () {
			var copy = clone(state.clipboard);
			reidentify(copy);
			var target = selected();
			if (target && CONTAINERS.indexOf(target.type) >= 0) target.children.push(copy);
			else state.document.elements.push(copy);
			state.selected = copy.id;
		});
	}

	function reidentify(element) {
		element.id = id();
		(element.children || []).forEach(reidentify);
	}

	function move(sourceId, targetId) {
		if (!sourceId || !targetId || sourceId === targetId) return;
		var source, sourceSiblings, sourceIndex, target;
		walk(state.document.elements, sourceId, function (element, siblings, index) {
			source = element;
			sourceSiblings = siblings;
			sourceIndex = index;
		});
		walk(state.document.elements, targetId, function (element) { target = element; });
		if (!source || !target || containsElement(source, targetId)) return;
		sourceSiblings.splice(sourceIndex, 1);
		if (CONTAINERS.indexOf(target.type) >= 0) {
			target.children = target.children || [];
			target.children.push(source);
			return;
		}
		var inserted = walk(state.document.elements, targetId, function (target, siblings, index) {
			siblings.splice(index, 0, source);
			return true;
		});
		if (!inserted) state.document.elements.push(source);
	}

	function containsElement(element, targetId) {
		if (element.id === targetId) return true;
		return (element.children || []).some(function (child) { return containsElement(child, targetId); });
	}

	function scheduleRecovery() {
		window.clearTimeout(state.recoveryTimer);
		state.recoveryTimer = window.setTimeout(function () {
			try {
				localStorage.setItem(recoveryKey, JSON.stringify({
					savedAt: Date.now(),
					document: state.document
				}));
				updateStatus('Recovery saved');
			} catch (error) {
				updateStatus('Local recovery unavailable');
			}
		}, 1200);
	}

	function scheduleAutosave() {
		window.clearTimeout(state.autosaveTimer);
		state.autosaveTimer = window.setTimeout(function () { if (state.dirty) save(true); }, 15000);
	}

	function showContextMenu(x, y) {
		var old = document.querySelector('.pagevia-context-menu');
		if (old) old.remove();
		var menu = el('div', 'pagevia-context-menu');
		[
			['Copy', copySelected],
			['Paste inside', pasteElement],
			['Duplicate', duplicateSelected],
			['Delete', removeSelected]
		].forEach(function (item) {
			menu.append(button(item[0], function () {
				menu.remove();
				item[1]();
			}, 'pagevia-context-action'));
		});
		menu.style.left = Math.min(x, window.innerWidth - 170) + 'px';
		menu.style.top = Math.min(y, window.innerHeight - 170) + 'px';
		document.body.append(menu);
		window.setTimeout(function () {
			document.addEventListener('pointerdown', function close() {
				menu.remove();
				document.removeEventListener('pointerdown', close);
			});
		});
	}

	function download(name, data) {
		var blob = new Blob([data], { type: 'application/json' });
		var url = URL.createObjectURL(blob);
		var link = document.createElement('a');
		link.href = url;
		link.download = name;
		link.click();
		URL.revokeObjectURL(url);
	}

	function exportTemplate() {
		var payload = {
			format: 'pagevia-template',
			version: 1,
			exportedAt: new Date().toISOString(),
			document: state.document
		};
		download('pagevia-page-' + Pagevia.postId + '.json', JSON.stringify(payload, null, 2));
		updateStatus('Template exported');
	}

	function validTemplate(payload) {
		return payload && payload.format === 'pagevia-template' &&
			payload.version === 1 && payload.document &&
			Array.isArray(payload.document.elements);
	}

	function importTemplate() {
		var input = document.createElement('input');
		input.type = 'file';
		input.accept = 'application/json,.json';
		input.addEventListener('change', function () {
			var file = input.files && input.files[0];
			if (!file || file.size > 5 * 1024 * 1024) {
				updateStatus('Invalid or oversized template');
				return;
			}
			file.text().then(function (contents) {
				var payload;
				try { payload = JSON.parse(contents); } catch (error) {
					updateStatus('Template JSON is invalid');
					return;
				}
				if (!validTemplate(payload)) {
					updateStatus('Unsupported template format');
					return;
				}
				if (!window.confirm('Replace this page with the imported template?')) return;
				mutate(function () {
					state.document = clone(payload.document);
					state.document.elements.forEach(reidentify);
					state.selected = null;
				});
				updateStatus('Template imported · save to publish');
			});
		});
		input.click();
	}

	function showRevisions() {
		inspector.hidden = false;
		navigator.hidden = true;
		inspector.replaceChildren(el('p', 'pagevia-panel-empty', 'Loading revisions…'));
		wp.apiFetch({ path: Pagevia.restPath + Pagevia.postId + '/revisions' }).then(function (items) {
			inspector.replaceChildren(el('h2', '', 'Revision history'));
			if (!items.length) {
				inspector.append(el('p', 'pagevia-panel-empty', 'No builder revisions are available yet.'));
				return;
			}
			items.forEach(function (revision) {
				var row = el('div', 'pagevia-revision');
				var detail = el('div');
				detail.append(el('strong', '', revision.date), el('span', '', revision.author));
				row.append(detail, button('Restore', function () {
					if (!window.confirm('Restore this revision? Current unsaved changes will be replaced.')) return;
					wp.apiFetch({
						path: Pagevia.restPath + Pagevia.postId + '/revisions/' + revision.id + '/restore',
						method: 'POST'
					}).then(function (document) {
						state.document = document;
						state.selected = null;
						state.history = [];
						state.future = [];
						state.dirty = false;
						try { localStorage.removeItem(recoveryKey); } catch (error) {}
						updateStatus('Revision restored');
						render();
					}).catch(function (error) {
						updateStatus(error && error.message ? error.message : 'Restore failed');
					});
				}));
				inspector.append(row);
			});
		}).catch(function (error) {
			inspector.replaceChildren(el('p', 'pagevia-panel-empty', error && error.message ? error.message : 'Could not load revisions'));
		});
	}

	function saveToLibrary() {
		var name = window.prompt('Template name');
		if (!name || !name.trim()) return;
		updateStatus('Saving template…');
		wp.apiFetch({
			path: '/pagevia/v1/templates',
			method: 'POST',
			data: { name: name.trim(), document: state.document }
		}).then(function () {
			updateStatus('Template saved');
			showTemplates();
		}).catch(function (error) {
			updateStatus(error && error.message ? error.message : 'Template save failed');
		});
	}

	function showTemplates() {
		inspector.hidden = false;
		navigator.hidden = true;
		inspector.replaceChildren(el('h2', '', 'Template library'));
		inspector.append(button('Save current page', saveToLibrary, 'pagevia-ui-button pagevia-primary pagevia-wide'));
		var list = el('div', 'pagevia-template-list');
		list.append(el('p', 'pagevia-panel-empty', 'Loading templates…'));
		inspector.append(list);
		wp.apiFetch({ path: '/pagevia/v1/templates' }).then(function (items) {
			list.replaceChildren();
			if (!items.length) {
				list.append(el('p', 'pagevia-panel-empty', 'No saved templates yet.'));
				return;
			}
			items.forEach(function (template) {
				var row = el('div', 'pagevia-template');
				var detail = el('div');
				detail.append(el('strong', '', template.name), el('span', '', template.modified));
				var actions = el('div', 'pagevia-template-actions');
				actions.append(button('Insert', function () {
					wp.apiFetch({ path: '/pagevia/v1/templates/' + template.id }).then(function (item) {
						mutate(function () {
							var imported = clone(item.document);
							imported.elements.forEach(reidentify);
							state.document.elements = state.document.elements.concat(imported.elements);
							state.selected = null;
						});
						updateStatus('Template inserted · save to publish');
					}).catch(function (error) {
						updateStatus(error && error.message ? error.message : 'Template load failed');
					});
				}));
				actions.append(button('Delete', function () {
					if (!window.confirm('Permanently delete this saved template?')) return;
					wp.apiFetch({ path: '/pagevia/v1/templates/' + template.id, method: 'DELETE' }).then(showTemplates);
				}, 'pagevia-ui-button pagevia-danger'));
				row.append(detail, actions);
				list.append(row);
			});
		}).catch(function (error) {
			list.replaceChildren(el('p', 'pagevia-panel-empty', error && error.message ? error.message : 'Could not load templates'));
		});
	}

	function el(tag, className, text) {
		var node = document.createElement(tag);
		if (className) node.className = className;
		if (text !== undefined) node.textContent = text;
		return node;
	}

	function button(label, action, className, title) {
		var node = el('button', className || 'pagevia-ui-button', label);
		node.type = 'button';
		node.title = title || label;
		node.setAttribute('aria-label', title || label);
		node.addEventListener('click', action);
		return node;
	}

	function buildShell() {
		document.documentElement.classList.add('pagevia-editing');
		shell = el('div', 'pagevia-editor-shell');
		shell.innerHTML =
			'<header class="pagevia-toolbar" aria-label="Builder toolbar">' +
			'<strong class="pagevia-brand">Pagevia</strong>' +
			'<div class="pagevia-history"></div><div class="pagevia-devices"></div>' +
			'<span class="pagevia-status" role="status">Loading…</span><div class="pagevia-actions"></div>' +
			'</header><aside class="pagevia-panel pagevia-library"><h2>Elements</h2><input class="pagevia-search" type="search" placeholder="Search elements…"><div class="pagevia-element-list"></div></aside>' +
			'<main class="pagevia-stage"><div class="pagevia-canvas-frame"><div class="pagevia-live-canvas" data-device="desktop"></div></div></main>' +
			'<aside class="pagevia-panel pagevia-right"><div class="pagevia-panel-tabs"><button data-panel="inspect">Style</button><button data-panel="layers">Layers</button></div><div class="pagevia-inspector"></div><div class="pagevia-navigator" hidden></div></aside>';
		document.body.appendChild(shell);
		canvas = shell.querySelector('.pagevia-live-canvas');
		navigator = shell.querySelector('.pagevia-navigator');
		inspector = shell.querySelector('.pagevia-inspector');
		status = shell.querySelector('.pagevia-status');

		var history = shell.querySelector('.pagevia-history');
		history.append(button('↶', undo, 'pagevia-icon-button', 'Undo (Ctrl/Cmd+Z)'));
		history.append(button('↷', redo, 'pagevia-icon-button', 'Redo (Ctrl/Cmd+Shift+Z)'));
		var devices = shell.querySelector('.pagevia-devices');
		[['desktop', 'Desktop'], ['tablet', 'Tablet'], ['mobile', 'Mobile']].forEach(function (item) {
			devices.append(button(item[1], function () {
				state.device = item[0];
				canvas.dataset.device = item[0];
				renderInspector();
			}, 'pagevia-device'));
		});
		var actions = shell.querySelector('.pagevia-actions');
		if (Pagevia.upgradeUrl) actions.append(button('Upgrade', function () { window.open(Pagevia.upgradeUrl, '_blank', 'noopener'); }));
		actions.append(button('Design', function () { state.selected = null; render(); }));
		actions.append(button('Library', showTemplates));
		actions.append(button('Revisions', showRevisions));
		actions.append(button('Export', exportTemplate));
		actions.append(button('Import', importTemplate));
		actions.append(button('Exit', exitEditor));
		actions.append(button('Save', function () { save(false); }, 'pagevia-ui-button pagevia-primary'));
		buildLibrary();
		shell.querySelectorAll('.pagevia-panel-tabs button').forEach(function (tab) {
			tab.addEventListener('click', function () {
				var layers = tab.dataset.panel === 'layers';
				navigator.hidden = !layers;
				inspector.hidden = layers;
			});
		});
	}

	function buildLibrary() {
		var list = shell.querySelector('.pagevia-element-list');
		var search = shell.querySelector('.pagevia-search');
		function draw(query) {
			list.replaceChildren();
			TYPES.filter(function (item) {
				return item[1].toLowerCase().indexOf(query.toLowerCase()) >= 0;
			}).forEach(function (item) {
				var card = button(item[1], function () {
					var target = selected();
					add(item[0], target && CONTAINERS.indexOf(target.type) >= 0 ? target.id : null);
				}, 'pagevia-element-card', 'Add ' + item[1]);
				card.draggable = true;
				card.addEventListener('dragstart', function (event) {
					event.dataTransfer.setData('application/x-pagevia-type', item[0]);
				});
				list.append(card);
			});
		}
		search.addEventListener('input', function () { draw(search.value); });
		draw('');
	}

	function applyStyles(node, element) {
		var globalStyles = ((state.document.settings || {}).widgetStyles || {})[element.type] || {};
		var rules = Object.assign({}, globalStyles.desktop || {}, (element.styles || {}).desktop || {});
		if (state.device !== 'desktop') Object.assign(rules, globalStyles[state.device] || {}, (element.styles || {})[state.device] || {});
		Object.keys(rules).forEach(function (property) {
			if (/^[a-zA-Z]+$/.test(property)) node.style[property] = rules[property];
		});
	}

	function canvasElement(element) {
		var node = el('div', 'pagevia-canvas-element pagevia-canvas-' + element.type);
		node.dataset.id = element.id;
		node.draggable = true;
		node.tabIndex = 0;
		node.setAttribute('aria-label', element.type + ' element');
		if (element.id === state.selected) node.classList.add('is-selected');
		if (element.props && element.props['hide_' + state.device]) node.classList.add('is-device-hidden');
		applyStyles(node, element);

		var label = el('span', 'pagevia-element-label', element.type);
		node.append(label);
		var content = el('div', 'pagevia-element-content');
		if (element.type === 'heading') {
			var heading = el(element.props.tag || 'h2', '', element.props.text || 'Your heading');
			content.append(heading);
		} else if (element.type === 'text' || element.type === 'alert') {
			content.append(el('p', '', element.props.text || 'Add text'));
		} else if (element.type === 'button') {
			content.append(el('span', 'pagevia-preview-button', element.props.text || 'Button'));
		} else if (element.type === 'image') {
			if (element.props.url) {
				var image = document.createElement('img');
				image.src = element.props.url;
				image.alt = element.props.alt || '';
				content.append(image);
			} else content.append(el('div', 'pagevia-placeholder', 'Choose an image'));
		} else if (element.type === 'list') {
			var ul = el('ul');
			(element.props.text || '').split(/\r?\n/).forEach(function (item) {
				if (item.trim()) ul.append(el('li', '', item.trim()));
			});
			content.append(ul);
		} else if (element.type === 'divider') {
			content.append(document.createElement('hr'));
		} else if (element.type === 'spacer') {
			content.append(el('span', 'pagevia-placeholder', 'Spacer'));
		} else if (element.type === 'progress') {
			var progress = document.createElement('progress');
			progress.max = 100;
			progress.value = Number(element.props.value || 0);
			content.append(progress);
		} else if (element.type === 'accordion' || element.type === 'tabs') {
			(element.props.items || []).forEach(function (item) {
				var preview = el('div', 'pagevia-interactive-preview');
				preview.append(el('strong', '', item.title || 'Item'), el('span', '', item.content || ''));
				content.append(preview);
			});
		} else if (element.type === 'toggle') {
			var toggle = el('div', 'pagevia-interactive-preview');
			toggle.append(el('strong', '', element.props.title || 'More information'), el('span', '', element.props.text || ''));
			content.append(toggle);
		} else if (element.props && (element.props.text || element.props.url || element.props.code)) {
			content.append(el('div', '', element.props.text || element.props.url || element.props.code));
		}
		(element.children || []).forEach(function (child) { content.append(canvasElement(child)); });
		if (CONTAINERS.indexOf(element.type) >= 0 && !(element.children || []).length) {
			content.append(el('div', 'pagevia-drop-hint', 'Drop elements here'));
		}
		node.append(content);
		node.addEventListener('click', function (event) {
			event.stopPropagation();
			state.selected = element.id;
			render();
		});
		node.addEventListener('contextmenu', function (event) {
			event.preventDefault();
			event.stopPropagation();
			state.selected = element.id;
			render();
			showContextMenu(event.clientX, event.clientY);
		});
		node.addEventListener('dragstart', function (event) {
			event.stopPropagation();
			state.dragged = element.id;
			event.dataTransfer.setData('application/x-pagevia-id', element.id);
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
			var type = event.dataTransfer.getData('application/x-pagevia-type');
			if (type && CONTAINERS.indexOf(element.type) >= 0) add(type, element.id);
			else {
				var sourceId = event.dataTransfer.getData('application/x-pagevia-id');
				if (sourceId && sourceId !== element.id) mutate(function () { move(sourceId, element.id); });
			}
		});
		return node;
	}

	function renderCanvas() {
		canvas.replaceChildren();
		canvas.dataset.device = state.device;
		var settings = state.document.settings || {};
		var colors = settings.colors || {};
		canvas.style.setProperty('--pagevia-primary', colors.primary || '#6d5dfc');
		canvas.style.setProperty('--pagevia-secondary', colors.secondary || '#475467');
		canvas.style.setProperty('--pagevia-text', colors.text || '#101828');
		canvas.style.setProperty('--pagevia-background', colors.background || '#ffffff');
		canvas.style.fontFamily = (settings.typography || {}).fontFamily || '';
		Object.keys(settings.spacing || {}).forEach(function (name) { canvas.style.setProperty('--pagevia-space-' + name, settings.spacing[name]); });
		Object.keys(settings.variables || {}).forEach(function (name) { canvas.style.setProperty('--pagevia-' + name.replace(/[^a-z0-9-]/gi, '-').toLowerCase(), settings.variables[name]); });
		var breakpoints = settings.breakpoints || {};
		canvas.style.maxWidth = state.device === 'tablet' ? (breakpoints.tablet || 1024) + 'px' : state.device === 'mobile' ? (breakpoints.mobile || 767) + 'px' : '';
		if (!state.document.elements.length) {
			var empty = el('div', 'pagevia-empty-state');
			empty.append(el('h2', '', 'Start building'));
			empty.append(el('p', '', 'Add an element from the left panel or begin with a section.'));
			empty.append(button('Add section', function () { add('section'); }, 'pagevia-ui-button pagevia-primary'));
			canvas.append(empty);
		} else state.document.elements.forEach(function (element) { canvas.append(canvasElement(element)); });
		canvas.ondragover = function (event) { event.preventDefault(); };
		canvas.ondrop = function (event) {
			if (event.target !== canvas) return;
			event.preventDefault();
			var type = event.dataTransfer.getData('application/x-pagevia-type');
			if (type) add(type);
		};
	}

	function field(label, value, change, type) {
		var wrap = el('label', 'pagevia-field');
		wrap.append(el('span', '', label));
		var input = type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
		if (type && type !== 'textarea') input.type = type;
		input.value = value === undefined ? '' : value;
		input.addEventListener('change', function () { change(input.value); });
		wrap.append(input);
		return wrap;
	}

	function selectField(label, value, options, change) {
		var wrap = el('label', 'pagevia-field');
		wrap.append(el('span', '', label));
		var select = document.createElement('select');
		options.forEach(function (item) { var option = el('option', '', item[1]); option.value = item[0]; option.selected = item[0] === value; select.append(option); });
		select.addEventListener('change', function () { change(select.value); });
		wrap.append(select);
		return wrap;
	}

	function unitField(label, value, change) {
		var match = String(value || '').match(/^(-?\d*\.?\d+)(px|%|em|rem|vh|vw)?$/);
		var wrap = el('label', 'pagevia-field');
		wrap.append(el('span', '', label));
		var row = el('div', 'pagevia-unit-field');
		var input = document.createElement('input'); input.type = 'number'; input.step = 'any'; input.value = match ? match[1] : '';
		var unit = document.createElement('select');
		['px', '%', 'em', 'rem', 'vh', 'vw'].forEach(function (name) { var option = el('option', '', name); option.value = name; option.selected = name === (match && match[2] || 'px'); unit.append(option); });
		function update() { change(input.value === '' ? '' : input.value + unit.value); }
		input.addEventListener('change', update); unit.addEventListener('change', update); row.append(input, unit); wrap.append(row); return wrap;
	}

	function itemsToText(items) {
		return (items || []).map(function (item) {
			return (item.title || '').replace(/\|/g, '/') + ' | ' + (item.content || '').replace(/\r?\n/g, ' ');
		}).join('\n');
	}

	function textToItems(value) {
		return value.split(/\r?\n/).filter(function (line) { return line.trim(); }).map(function (line) {
			var split = line.indexOf('|');
			return {
				title: (split >= 0 ? line.slice(0, split) : line).trim(),
				content: (split >= 0 ? line.slice(split + 1) : '').trim()
			};
		}).slice(0, 30);
	}

	function renderInspector() {
		inspector.replaceChildren();
		var element = selected();
		if (!element) {
			renderGlobalInspector();
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
			inspector.append(button('Choose from Media Library', function () {
				if (!wp.media) {
					updateStatus('Media Library is unavailable');
					return;
				}
				var frame = wp.media({
					title: 'Choose an image',
					button: { text: 'Use image' },
					library: { type: 'image' },
					multiple: false
				});
				frame.on('select', function () {
					var attachment = frame.state().get('selection').first().toJSON();
					mutate(function () {
						element.props.attachmentId = attachment.id;
						element.props.url = attachment.url;
						element.props.alt = attachment.alt || '';
					});
				});
				frame.open();
			}, 'pagevia-ui-button pagevia-wide'));
		}
		if (element.type === 'progress') prop('value', 'Value (0–100)', 'number');
		if (element.type === 'counter') {
			prop('value', 'Value', 'number');
			prop('suffix', 'Suffix', 'text');
		}
		if (element.type === 'rating') {
			prop('value', 'Rating', 'number');
			prop('max', 'Maximum', 'number');
		}
		if (element.type === 'icon-box') {
			prop('icon', 'Icon or symbol', 'text');
			prop('title', 'Title', 'text');
			prop('text', 'Content', 'textarea');
		}
		if (element.type === 'gallery') prop('urls', 'Image URLs · one per line', 'textarea');
		if (element.type === 'social-icons') prop('links', 'Links · “Label | URL” per line', 'textarea');
		if (element.type === 'toggle') {
			prop('title', 'Title', 'text');
			prop('text', 'Content', 'textarea');
		}
		if (element.type === 'accordion' || element.type === 'tabs') {
			inspector.append(field('Items · one “Title | Content” per line', itemsToText(element.props.items), function (value) {
				mutate(function () { element.props.items = textToItems(value); });
			}, 'textarea'));
		}
		if (element.type === 'html') prop('html', 'HTML', 'textarea');
		if (element.type === 'shortcode') prop('code', 'Shortcode', 'text');
		prop('cssClasses', 'CSS classes', 'text');
		if (Pagevia.dynamicTags && Pagevia.dynamicTags.length) {
			var tagRow = el('div', 'pagevia-dynamic-tags');
			var tagSelect = document.createElement('select');
			Pagevia.dynamicTags.forEach(function (tag) { var option = el('option', '', tag); option.value = tag; tagSelect.append(option); });
			tagRow.append(tagSelect, button('Insert dynamic tag', function () {
				var property = Object.keys(element.props).find(function (key) { return typeof element.props[key] === 'string' && key !== 'tag'; });
				if (!property) return updateStatus('This element has no compatible text field');
				mutate(function () { element.props[property] = (element.props[property] || '') + '{{' + tagSelect.value + '}}'; });
			}, 'pagevia-ui-button'));
			inspector.append(el('h3', '', 'Dynamic content'), tagRow);
		}

		inspector.append(el('h3', '', 'Style · ' + state.device));
		var styles = element.styles[state.device] || (element.styles[state.device] = {});
		[
			['color', 'Text color', 'color'], ['backgroundColor', 'Background', 'color'],
			['padding', 'Padding', 'text'],
			['margin', 'Margin', 'text'], ['borderRadius', 'Radius', 'text'],
			['gridTemplateColumns', 'Grid columns', 'text']
		].forEach(function (setting) {
			inspector.append(field(setting[1], styles[setting[0]] || '', function (value) {
				mutate(function () {
					if (value) styles[setting[0]] = value;
					else delete styles[setting[0]];
				});
			}, setting[2]));
		});
		[['fontSize', 'Font size'], ['width', 'Width'], ['minHeight', 'Minimum height'], ['gap', 'Gap']].forEach(function (setting) {
			inspector.append(unitField(setting[1], styles[setting[0]] || '', function (value) { mutate(function () { if (value) styles[setting[0]] = value; else delete styles[setting[0]]; }); }));
		});
		[
			['display', 'Layout mode', [['', 'Default'], ['block', 'Block'], ['flex', 'Flex'], ['grid', 'Grid']]],
			['flexDirection', 'Flex direction', [['', 'Default'], ['row', 'Row'], ['column', 'Column'], ['row-reverse', 'Row reverse'], ['column-reverse', 'Column reverse']]],
			['flexWrap', 'Flex wrap', [['', 'Default'], ['nowrap', 'No wrap'], ['wrap', 'Wrap']]],
			['justifyContent', 'Justify content', [['', 'Default'], ['flex-start', 'Start'], ['center', 'Center'], ['flex-end', 'End'], ['space-between', 'Space between'], ['space-around', 'Space around']]],
			['alignItems', 'Align items', [['', 'Default'], ['stretch', 'Stretch'], ['flex-start', 'Start'], ['center', 'Center'], ['flex-end', 'End']]],
			['textAlign', 'Text alignment', [['', 'Default'], ['left', 'Left'], ['center', 'Center'], ['right', 'Right'], ['justify', 'Justify']]]
		].forEach(function (setting) { inspector.append(selectField(setting[1], styles[setting[0]] || '', setting[2], function (value) { mutate(function () { if (value) styles[setting[0]] = value; else delete styles[setting[0]]; }); })); });
		var visibility = el('label', 'pagevia-check');
		var checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.checked = !!element.props['hide_' + state.device];
		checkbox.addEventListener('change', function () {
			mutate(function () { element.props['hide_' + state.device] = checkbox.checked ? '1' : ''; });
		});
		visibility.append(checkbox, el('span', '', 'Hide on ' + state.device));
		inspector.append(visibility);
		state.document.settings = state.document.settings || {};
		state.document.settings.widgetStyles = state.document.settings.widgetStyles || {};
		state.document.settings.presets = state.document.settings.presets || {};
		inspector.append(el('h3', '', 'Reusable styles'));
		inspector.append(button('Set as global ' + element.type + ' style', function () {
			mutate(function () { state.document.settings.widgetStyles[element.type] = clone(element.styles); });
		}, 'pagevia-ui-button pagevia-wide'));
		if (state.document.settings.widgetStyles[element.type]) inspector.append(button('Clear global ' + element.type + ' style', function () {
			mutate(function () { delete state.document.settings.widgetStyles[element.type]; });
		}, 'pagevia-ui-button pagevia-wide'));
		var presetNames = Object.keys(state.document.settings.presets);
		if (presetNames.length) {
			var presetSelect = document.createElement('select');
			presetSelect.className = 'pagevia-preset-select';
			presetNames.forEach(function (name) { var option = el('option', '', name); option.value = name; presetSelect.append(option); });
			var presetRow = el('div', 'pagevia-preset-row');
			presetRow.append(presetSelect, button('Apply', function () { mutate(function () { element.styles = clone(state.document.settings.presets[presetSelect.value]); }); }, 'pagevia-ui-button'));
			inspector.append(presetRow);
		}
		inspector.append(button('Save style preset', function () {
			var name = window.prompt('Preset name');
			if (!name || !name.trim()) return;
			mutate(function () { state.document.settings.presets[name.trim().slice(0, 60)] = clone(element.styles); });
		}, 'pagevia-ui-button pagevia-wide'));
		var row = el('div', 'pagevia-inspector-actions');
		row.append(button('Duplicate', duplicateSelected), button('Delete', removeSelected, 'pagevia-ui-button pagevia-danger'));
		inspector.append(row);
	}

	function renderGlobalInspector() {
		state.document.settings = state.document.settings || {};
		state.document.settings.colors = state.document.settings.colors || {
			primary: '#6d5dfc',
			secondary: '#475467',
			text: '#101828',
			background: '#ffffff'
		};
		state.document.settings.typography = state.document.settings.typography || { fontFamily: '' };
		state.document.settings.breakpoints = state.document.settings.breakpoints || { tablet: 1024, mobile: 767 };
		state.document.settings.spacing = state.document.settings.spacing || { xs: '4px', sm: '8px', md: '16px', lg: '32px', xl: '64px' };
		state.document.settings.variables = state.document.settings.variables || {};
		inspector.append(el('h2', '', 'Global design'));
		inspector.append(el('p', 'pagevia-panel-empty', 'These tokens apply across the page and can be reused by widgets.'));
		[
			['primary', 'Primary color'],
			['secondary', 'Secondary color'],
			['text', 'Text color'],
			['background', 'Background color']
		].forEach(function (setting) {
			inspector.append(field(setting[1], state.document.settings.colors[setting[0]], function (value) {
				mutate(function () { state.document.settings.colors[setting[0]] = value; });
			}, 'color'));
		});
		inspector.append(field('Font family', state.document.settings.typography.fontFamily, function (value) {
			mutate(function () { state.document.settings.typography.fontFamily = value; });
		}, 'text'));
		inspector.append(el('h3', '', 'Responsive breakpoints'));
		[['tablet', 'Tablet maximum (px)'], ['mobile', 'Mobile maximum (px)']].forEach(function (setting) {
			inspector.append(field(setting[1], state.document.settings.breakpoints[setting[0]], function (value) {
				mutate(function () { state.document.settings.breakpoints[setting[0]] = Math.max(setting[0] === 'tablet' ? 600 : 320, parseInt(value, 10) || (setting[0] === 'tablet' ? 1024 : 767)); });
			}, 'number'));
		});
		inspector.append(el('h3', '', 'Spacing scale'));
		[['xs', 'Extra small'], ['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large'], ['xl', 'Extra large']].forEach(function (setting) {
			inspector.append(field(setting[1], state.document.settings.spacing[setting[0]], function (value) { mutate(function () { state.document.settings.spacing[setting[0]] = value; }); }, 'text'));
		});
		inspector.append(el('h3', '', 'Custom variables'));
		inspector.append(field('One “name | value” per line', variablesToText(state.document.settings.variables), function (value) {
			mutate(function () { state.document.settings.variables = textToVariables(value); });
		}, 'textarea'));
		inspector.append(el('h3', '', 'Page templates'));
		inspector.append(button('Export this page', exportTemplate, 'pagevia-ui-button pagevia-wide'));
		inspector.append(button('Import a page', importTemplate, 'pagevia-ui-button pagevia-wide'));
	}

	function variablesToText(variables) {
		return Object.keys(variables || {}).map(function (name) { return name + ' | ' + variables[name]; }).join('\n');
	}

	function textToVariables(value) {
		var variables = {};
		value.split(/\r?\n/).forEach(function (line) {
			var split = line.indexOf('|');
			if (split < 1) return;
			var name = line.slice(0, split).trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
			var token = line.slice(split + 1).trim();
			if (name && token && !/[;{}<>]|url\s*\(/i.test(token)) variables[name] = token;
		});
		return variables;
	}

	function navigatorItem(element, depth) {
		var item = el('button', 'pagevia-layer' + (element.id === state.selected ? ' is-selected' : ''), element.type);
		item.type = 'button';
		item.style.paddingLeft = (12 + depth * 16) + 'px';
		item.addEventListener('click', function () {
			state.selected = element.id;
			render();
		});
		var fragment = document.createDocumentFragment();
		var layerRow = el('div', 'pagevia-layer-row');
		layerRow.append(item, button('↑', function () { moveLayer(element.id, -1); }, 'pagevia-layer-move', 'Move layer up'), button('↓', function () { moveLayer(element.id, 1); }, 'pagevia-layer-move', 'Move layer down'));
		fragment.append(layerRow);
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

	function save(automatic) {
		if (state.saving) return;
		state.saving = true;
		var savedChangeId = state.changeId;
		var snapshot = clone(state.document);
		updateStatus(automatic ? 'Autosaving…' : 'Saving…');
		wp.apiFetch({
			path: Pagevia.restPath + Pagevia.postId,
			method: 'PUT',
			data: { document: snapshot }
		}).then(function (document) {
			if (savedChangeId === state.changeId) {
				state.document = document;
				state.dirty = false;
				try { localStorage.removeItem(recoveryKey); } catch (error) {}
				updateStatus(automatic ? 'Autosaved' : 'Saved');
				render();
			} else updateStatus('Unsaved changes');
		}).catch(function (error) {
			updateStatus(error && error.message ? error.message : 'Save failed');
		}).finally(function () { state.saving = false; if (state.dirty) scheduleAutosave(); });
	}

	function exitEditor() {
		if (state.dirty && !window.confirm('Leave without saving your changes?')) return;
		var url = new URL(window.location.href);
		url.searchParams.delete('pagevia-edit');
		window.location.href = url.toString();
	}

	function keyboard(event) {
		var modifier = event.ctrlKey || event.metaKey;
		if (modifier && event.key.toLowerCase() === 's') {
			event.preventDefault();
			save(false);
		} else if (modifier && event.key.toLowerCase() === 'z') {
			event.preventDefault();
			event.shiftKey ? redo() : undo();
		} else if (modifier && event.key.toLowerCase() === 'd') {
			event.preventDefault();
			duplicateSelected();
		} else if (modifier && event.key.toLowerCase() === 'c' && !/INPUT|TEXTAREA/.test(event.target.tagName)) {
			event.preventDefault();
			copySelected();
		} else if (modifier && event.key.toLowerCase() === 'v' && !/INPUT|TEXTAREA/.test(event.target.tagName)) {
			event.preventDefault();
			pasteElement();
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
		wp.apiFetch({ path: Pagevia.restPath + Pagevia.postId }).then(function (document) {
			state.document = document;
			var recovery;
			try { recovery = JSON.parse(localStorage.getItem(recoveryKey)); } catch (error) {}
			if (recovery && recovery.document && Array.isArray(recovery.document.elements) &&
				window.confirm('A local recovery copy was found. Restore it?')) {
				state.document = recovery.document;
				state.dirty = true;
				updateStatus('Recovery restored · save to publish');
			} else {
				if (recovery) {
					try { localStorage.removeItem(recoveryKey); } catch (error) {}
				}
				updateStatus('Ready');
			}
			render();
		}).catch(function (error) {
			updateStatus(error && error.message ? error.message : 'Could not load the document');
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
	else start();
})();
