<?php
namespace Webifya\Pagevia\Infrastructure;

use Webifya\Pagevia\Contracts\Service;

defined( 'ABSPATH' ) || exit;

final class Meta implements Service {
	public function register(): void {
		add_action( 'init', array( $this, 'register_meta' ) );
	}

	public function register_meta(): void {
		register_post_type(
			'pagevia_template',
			array(
				'labels'       => array(
					'name'          => __( 'Builder Templates', 'pagevia' ),
					'singular_name' => __( 'Builder Template', 'pagevia' ),
				),
				'public'       => false,
				'show_ui'      => true,
				'show_in_menu' => 'tools.php',
				'supports'     => array( 'title', 'author', 'editor' ),
				'map_meta_cap' => true,
				'capability_type' => 'post',
			)
		);
		foreach ( get_post_types( array( 'show_ui' => true ) ) as $post_type ) {
			if ( ! post_type_supports( $post_type, 'editor' ) ) {
				continue;
			}
			register_post_meta(
				$post_type,
				'_pagevia_document',
				array(
					'type'              => 'object',
					'single'            => true,
					'show_in_rest'      => false,
					'revisions_enabled' => true,
					'auth_callback'     => static fn(): bool => current_user_can( 'edit_posts' ),
				)
			);
			register_post_meta(
				$post_type,
				'_pagevia_enabled',
				array(
					'type'              => 'string',
					'single'            => true,
					'show_in_rest'      => false,
					'revisions_enabled' => true,
					'auth_callback'     => static fn(): bool => current_user_can( 'edit_posts' ),
				)
			);
		}
	}
}
