<?php
/**
 * Plugin Name:       Pagevia – Visual Site Builder
 * Description:       A theme-friendly visual builder for WordPress content.
 * Version:           0.8.0
 * Requires at least: 6.5
 * Requires PHP:      8.1
 * Author:            Webifya
 * License:           GPL-2.0-or-later
 * Text Domain:       pagevia
 */

defined( 'ABSPATH' ) || exit;

define( 'PAGEVIA_VERSION', '0.8.0' );
define( 'PAGEVIA_FILE', __FILE__ );
define( 'PAGEVIA_PATH', plugin_dir_path( __FILE__ ) );
define( 'PAGEVIA_URL', plugin_dir_url( __FILE__ ) );

require_once PAGEVIA_PATH . 'src/Autoloader.php';
\Webifya\Pagevia\Autoloader::register();

register_activation_hook( __FILE__, array( \Webifya\Pagevia\Plugin::class, 'activate' ) );
add_action( 'plugins_loaded', array( \Webifya\Pagevia\Plugin::class, 'boot' ) );
