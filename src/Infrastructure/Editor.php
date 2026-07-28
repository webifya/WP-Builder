<?php
namespace Webifya\WPBuilder\Infrastructure;

use Webifya\WPBuilder\Contracts\Service;

defined( 'ABSPATH' ) || exit;

final class Editor implements Service {
	public function register(): void {
		add_action( 'add_meta_boxes', array( $this, 'add_meta_box' ) );
	}

	public function add_meta_box(): void {
		foreach ( get_post_types( array( 'show_ui' => true ), 'objects' ) as $type ) {
			if ( post_type_supports( $type->name, 'editor' ) ) {
				add_meta_box( 'wpb-launcher', __( 'WP Builder', 'wp-builder' ), array( $this, 'render' ), $type->name, 'side', 'high' );
			}
		}
	}

	public function render( \WP_Post $post ): void {
		$url = add_query_arg( array( 'wpb-edit' => $post->ID ), get_permalink( $post ) ?: home_url( '/' ) );
		printf(
			'<p>%s</p><a class="button button-primary button-large" href="%s" target="_blank" rel="noopener">%s</a>',
			esc_html__( 'Open the visual editor in a new tab. Changes are saved through the authenticated REST API.', 'wp-builder' ),
			esc_url( $url ),
			esc_html__( 'Edit with WP Builder', 'wp-builder' )
		);
	}
}
