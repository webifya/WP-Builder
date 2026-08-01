(function () {
	'use strict';
	document.querySelectorAll('[data-pagevia-tabs]').forEach(function (tabs) {
		var buttons = Array.from(tabs.querySelectorAll('[role="tab"]'));
		var panels = Array.from(tabs.querySelectorAll('[role="tabpanel"]'));
		function activate(button, focus) {
			buttons.forEach(function (item) {
				var active = item === button;
				item.setAttribute('aria-selected', active ? 'true' : 'false');
				item.tabIndex = active ? 0 : -1;
			});
			panels.forEach(function (panel) {
				panel.hidden = panel.id !== button.getAttribute('aria-controls');
			});
			if (focus) button.focus();
		}
		buttons.forEach(function (button, index) {
			button.addEventListener('click', function () { activate(button, false); });
			button.addEventListener('keydown', function (event) {
				var next = null;
				if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % buttons.length;
				if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
				if (event.key === 'Home') next = 0;
				if (event.key === 'End') next = buttons.length - 1;
				if (next !== null) {
					event.preventDefault();
					activate(buttons[next], true);
				}
			});
		});
	});
})();
