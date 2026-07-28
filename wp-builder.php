<?php
/**
 * Plugin Name:       WP Builder
 * Description:       A theme-friendly visual builder for WordPress content.
 * Version:           0.4.0
 * Requires at least: 6.5
 * Requires PHP:      8.1
 * Author:            Webifya
 * License:           GPL-2.0-or-later
 * Text Domain:       wp-builder
 */

defined( 'ABSPATH' ) || exit;

define( 'WPB_VERSION', '0.4.0' );
define( 'WPB_FILE', __FILE__ );
define( 'WPB_PATH', plugin_dir_path( __FILE__ ) );
define( 'WPB_URL', plugin_dir_url( __FILE__ ) );

require_once WPB_PATH . 'src/Autoloader.php';
\Webifya\WPBuilder\Autoloader::register();

register_activation_hook( __FILE__, array( \Webifya\WPBuilder\Plugin::class, 'activate' ) );
add_action( 'plugins_loaded', array( \Webifya\WPBuilder\Plugin::class, 'boot' ) );
