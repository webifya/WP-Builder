<?php
namespace Webifya\Pagevia;

defined( 'ABSPATH' ) || exit;

final class Plugin {
	private static ?self $instance = null;

	public static function boot(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public static function activate(): void {
		update_option( 'pagevia_version', PAGEVIA_VERSION );
		flush_rewrite_rules();
	}

	private function __construct() {
		$services = array(
			new Infrastructure\LegacyMigration(),
			new Infrastructure\Meta(),
			new Infrastructure\Assets(),
			new Infrastructure\RestController(),
			new Infrastructure\RevisionController(),
			new Infrastructure\TemplateController(),
			new Infrastructure\Editor(),
			new Rendering\Renderer(),
		);
		foreach ( $services as $service ) {
			$service->register();
		}
		do_action( 'pagevia/loaded', $this );
	}
}
