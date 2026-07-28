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
		wp_register_style( 'wp-builder-widgets', WPB_URL . 'assets/css/frontend-widgets.css', array( 'wp-builder' ), WPB_VERSION );
		wp_register_script( 'wp-builder-frontend', WPB_URL . 'assets/js/frontend.js', array(), WPB_VERSION, true );
		$view_id = is_singular() ? get_queried_object_id() : 0;
		if ( $view_id && '1' === get_post_meta( $view_id, '_wpb_enabled', true ) ) {
			wp_enqueue_style( 'wp-builder' );
			wp_enqueue_style( 'wp-builder-widgets' );
			wp_enqueue_script( 'wp-builder-frontend' );
		}
		if ( ! isset( $_GET['wpb-edit'] ) ) {
			return;
		}
		$post_id = absint( wp_unslash( $_GET['wpb-edit'] ) );
		if ( ! $post_id || ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}
		wp_enqueue_style( 'wp-builder' );
		wp_enqueue_style( 'wp-builder-widgets' );
		wp_enqueue_style( 'wp-builder-editor', WPB_URL . 'assets/css/editor.css', array(), WPB_VERSION );
		wp_enqueue_style( 'wp-builder-editor-upgrades', WPB_URL . 'assets/css/editor-upgrades.css', array( 'wp-builder-editor' ), WPB_VERSION );
		wp_enqueue_media( array( 'post' => $post_id ) );
		wp_enqueue_script( 'wp-builder-editor', WPB_URL . 'assets/js/editor.js', array( 'wp-api-fetch', 'wp-i18n', 'media-editor' ), WPB_VERSION, true );
		$this->configuration( $post_id );
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
	}

	private function configuration( int $post_id ): void {
		wp_add_inline_script(
			'wp-builder-editor',
			'window.WPBuilder=' . wp_json_encode(
				array(
					'restPath' => '/wp-builder/v1/documents/',
					'postId'   => $post_id,
					'nonce'    => wp_create_nonce( 'wp_rest' ),
					'version'  => WPB_VERSION,
					'locale'   => determine_locale(),
				)
			) . ';',
			'before'
		);
	}
}
