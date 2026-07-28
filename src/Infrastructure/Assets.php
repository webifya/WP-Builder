<?php
namespace Webifya\WPBuilder\Infrastructure;

use Webifya\WPBuilder\Contracts\Service;

defined( 'ABSPATH' ) || exit;

final class Assets implements Service {
	public function register(): void {
		add_action( 'wp_enqueue_scripts', array( $this, 'frontend' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'editor' ) );
	}

	public function frontend(): void {
		wp_register_style( 'wp-builder', WPB_URL . 'assets/css/frontend.css', array(), WPB_VERSION );
	}

	public function editor( string $hook ): void {
		if ( 'post.php' !== $hook && 'post-new.php' !== $hook ) {
			return;
		}
		$screen = get_current_screen();
		if ( ! $screen || ! post_type_supports( $screen->post_type, 'editor' ) ) {
			return;
		}
		wp_enqueue_style( 'wp-builder-editor', WPB_URL . 'assets/css/editor.css', array(), WPB_VERSION );
		wp_enqueue_script( 'wp-builder-editor', WPB_URL . 'assets/js/editor.js', array( 'wp-api-fetch', 'wp-element', 'wp-i18n' ), WPB_VERSION, true );
		wp_add_inline_script(
			'wp-builder-editor',
			'window.WPBuilder=' . wp_json_encode(
				array(
					'restPath' => '/wp-builder/v1/documents/',
					'postId'   => get_the_ID(),
					'nonce'    => wp_create_nonce( 'wp_rest' ),
				)
			) . ';',
			'before'
		);
	}
}
