<?php
namespace Webifya\Pagevia\Infrastructure;

use Webifya\Pagevia\Contracts\Service;

defined( 'ABSPATH' ) || exit;

final class Editor implements Service {
	public function register(): void {
		add_action( 'add_meta_boxes', array( $this, 'add_meta_box' ) );
		add_action( 'template_redirect', array( $this, 'guard_frontend_editor' ) );
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
	}

	public function add_meta_box(): void {
		foreach ( get_post_types( array( 'show_ui' => true ), 'objects' ) as $type ) {
			if ( post_type_supports( $type->name, 'editor' ) ) {
				add_meta_box( 'pagevia-launcher', __( 'Pagevia', 'pagevia' ), array( $this, 'render' ), $type->name, 'side', 'high' );
			}
		}
	}

	public function render( \WP_Post $post ): void {
		$url = add_query_arg( array( 'pagevia-edit' => $post->ID ), get_preview_post_link( $post ) ?: get_permalink( $post ) ?: home_url( '/' ) );
		printf(
			'<p>%s</p><a class="button button-primary button-large" href="%s" target="_blank" rel="noopener">%s</a>',
			esc_html__( 'Open the visual editor in a new tab. Changes are saved through the authenticated REST API.', 'pagevia' ),
			esc_url( $url ),
			esc_html__( 'Edit with Pagevia', 'pagevia' )
		);
	}
}
