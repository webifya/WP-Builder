<?php
defined( 'ABSPATH' ) || exit;
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width,initial-scale=1">
	<?php wp_head(); ?>
</head>
<body <?php body_class( 'pagevia-editor-canvas' ); ?>>
	<?php wp_body_open(); ?>
	<main id="pagevia-editor-root" aria-label="<?php esc_attr_e( 'Pagevia visual editor', 'pagevia' ); ?>"></main>
	<?php wp_footer(); ?>
</body>
</html>
