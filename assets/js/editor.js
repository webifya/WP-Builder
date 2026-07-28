(function () {
	'use strict';
	if (!window.WPBuilder) return;
	window.WPBuilder.api = {
		load: function () {
			return wp.apiFetch({ path: WPBuilder.restPath + WPBuilder.postId });
		},
		save: function (document) {
			return wp.apiFetch({
				path: WPBuilder.restPath + WPBuilder.postId,
				method: 'PUT',
				data: { document: document }
			});
		}
	};
})();
