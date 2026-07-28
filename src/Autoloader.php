<?php
namespace Webifya\WPBuilder;

defined( 'ABSPATH' ) || exit;

final class Autoloader {
	public static function register(): void {
		spl_autoload_register(
			static function ( string $class ): void {
				$prefix = __NAMESPACE__ . '\\';
				if ( ! str_starts_with( $class, $prefix ) ) {
					return;
				}
				$file = WPB_PATH . 'src/' . str_replace( '\\', '/', substr( $class, strlen( $prefix ) ) ) . '.php';
				if ( is_readable( $file ) ) {
					require_once $file;
				}
			}
		);
	}
}
