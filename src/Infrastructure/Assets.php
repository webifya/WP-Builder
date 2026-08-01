<?php
namespace Webifya\Pagevia\Infrastructure;

use Webifya\Pagevia\Contracts\Service;

defined( 'ABSPATH' ) || exit;

final class Assets implements Service {
	public function register(): void {
		add_action( 'wp_enqueue_scripts', array( $this, 'frontend' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'editor' ) );
	}

	public function frontend(): void {
		wp_register_style( 'pagevia', PAGEVIA_URL . 'assets/css/frontend.css', array(), PAGEVIA_VERSION );
		wp_register_style( 'pagevia-widgets', PAGEVIA_URL . 'assets/css/frontend-widgets.css', array( 'pagevia' ), PAGEVIA_VERSION );
		wp_register_script( 'pagevia-frontend', PAGEVIA_URL . 'assets/js/frontend.js', array(), PAGEVIA_VERSION, true );
		$view_id = is_singular() ? get_queried_object_id() : 0;
		if ( $view_id && '1' === get_post_meta( $view_id, '_pagevia_enabled', true ) ) {
			wp_enqueue_style( 'pagevia' );
			wp_enqueue_style( 'pagevia-widgets' );
			wp_enqueue_script( 'pagevia-frontend' );
		}
		if ( ! isset( $_GET['pagevia-edit'] ) ) {
			return;
		}
		$post_id = absint( wp_unslash( $_GET['pagevia-edit'] ) );
		if ( ! $post_id || ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}
		wp_enqueue_style( 'pagevia' );
		wp_enqueue_style( 'pagevia-widgets' );
		wp_enqueue_style( 'pagevia-editor', PAGEVIA_URL . 'assets/css/editor.css', array(), PAGEVIA_VERSION );
		wp_enqueue_style( 'pagevia-editor-upgrades', PAGEVIA_URL . 'assets/css/editor-upgrades.css', array( 'pagevia-editor' ), PAGEVIA_VERSION );
		wp_enqueue_media( array( 'post' => $post_id ) );
		wp_enqueue_script( 'pagevia-editor', PAGEVIA_URL . 'assets/js/editor.js', array( 'wp-api-fetch', 'wp-i18n', 'media-editor' ), PAGEVIA_VERSION, true );
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
		wp_enqueue_style( 'pagevia-editor', PAGEVIA_URL . 'assets/css/editor.css', array(), PAGEVIA_VERSION );
		wp_enqueue_style( 'pagevia-editor-upgrades', PAGEVIA_URL . 'assets/css/editor-upgrades.css', array( 'pagevia-editor' ), PAGEVIA_VERSION );
	}

	private function configuration( int $post_id ): void {
		$config = apply_filters( 'pagevia/editor_config', array(
			'restPath' => '/pagevia/v1/documents/', 'postId' => $post_id,
			'nonce' => wp_create_nonce( 'wp_rest' ), 'version' => PAGEVIA_VERSION,
			'locale' => determine_locale(), 'upgradeUrl' => 'https://www.webninjallc.com/plugins/pagevia',
		) );
		wp_add_inline_script(
			'pagevia-editor',
			'window.Pagevia=' . wp_json_encode( $config ) . ';',
			'before'
		);
	}
}
