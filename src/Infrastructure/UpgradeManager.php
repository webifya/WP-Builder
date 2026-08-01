<?php
namespace Webifya\Pagevia\Infrastructure;

use Webifya\Pagevia\Contracts\Service;

defined( 'ABSPATH' ) || exit;

final class UpgradeManager implements Service {
	public function register(): void {
		add_action( 'init', array( $this, 'upgrade' ), 5 );
	}

	public function upgrade(): void {
		$installed = (string) get_option( 'pagevia_version', '0.0.0' );
		if ( version_compare( $installed, PAGEVIA_VERSION, '>=' ) ) return;
		do_action( 'pagevia/before_upgrade', $installed, PAGEVIA_VERSION );
		update_option( 'pagevia_version', PAGEVIA_VERSION );
		do_action( 'pagevia/after_upgrade', $installed, PAGEVIA_VERSION );
	}
}
