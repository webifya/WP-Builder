<?php
namespace Webifya\Pagevia\Infrastructure;

use Webifya\Pagevia\Contracts\Service;

defined( 'ABSPATH' ) || exit;

final class Editor implements Service {
	public function register(): void {
		add_action( 'edit_form_after_title', array( $this, 'render' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'launcher_assets' ) );
		add_action( 'template_redirect', array( $this, 'guard_frontend_editor' ) );
		add_filter( 'template_include', array( $this, 'editor_template' ), 999 );
		add_filter( 'redirect_canonical', array( $this, 'disable_editor_canonical' ) );
	}

	public function guard_frontend_editor(): void {
		if ( ! isset( $_GET['pagevia-edit'] ) ) {
			return;
		}
		$post_id = absint( wp_unslash( $_GET['pagevia-edit'] ) );
		if ( ! is_user_logged_in() ) {
			auth_redirect();
		}
		if ( ! $post_id || ! current_user_can( 'edit_post', $post_id ) ) {
			wp_die( esc_html__( 'You are not allowed to edit this content.', 'pagevia' ), 403 );
		}
		global $wp_query;
		if ( $wp_query instanceof \WP_Query ) {
			$wp_query->is_404 = false;
		}
		status_header( 200 );
		nocache_headers();
	}

	public function editor_template( string $template ): string {
		return $this->editor_post_id() ? PAGEVIA_PATH . 'templates/editor-canvas.php' : $template;
	}

	public function disable_editor_canonical( $redirect ) {
		return isset( $_GET['pagevia-edit'] ) ? false : $redirect;
	}

	public function launcher_assets( string $hook ): void {
		if ( ! in_array( $hook, array( 'post.php', 'post-new.php' ), true ) ) return;
		wp_enqueue_script( 'pagevia-admin-launcher', PAGEVIA_URL . 'assets/js/admin-launcher.js', array(), PAGEVIA_VERSION, true );
	}

	public function render( \WP_Post $post ): void {
		if ( ! post_type_supports( $post->post_type, 'editor' ) || ! current_user_can( 'edit_post', $post->ID ) ) return;
		$url = add_query_arg( array( 'pagevia-edit' => $post->ID ), home_url( '/' ) );
		printf(
			'<div id="pagevia-title-launcher" class="pagevia-title-launcher"><a class="button button-primary button-large" href="%s" target="_blank" rel="noopener">%s</a><span>%s</span></div>',
			esc_url( $url ),
			esc_html__( 'Edit with Pagevia', 'pagevia' ),
			esc_html__( 'Opens the live editor in a new tab.', 'pagevia' )
		);
	}

	private function editor_post_id(): int {
		if ( ! isset( $_GET['pagevia-edit'] ) ) return 0;
		$post_id = absint( wp_unslash( $_GET['pagevia-edit'] ) );
		return $post_id && current_user_can( 'edit_post', $post_id ) ? $post_id : 0;
	}
}
