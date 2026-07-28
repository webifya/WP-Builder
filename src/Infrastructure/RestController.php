<?php
namespace Webifya\WPBuilder\Infrastructure;

use Webifya\WPBuilder\Contracts\Service;
use Webifya\WPBuilder\Schema\Document;

defined( 'ABSPATH' ) || exit;

final class RestController implements Service {
	public function register(): void {
		add_action( 'rest_api_init', array( $this, 'routes' ) );
	}

	public function routes(): void {
		register_rest_route(
			'wp-builder/v1',
			'/documents/(?P<id>\d+)',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'read' ),
					'permission_callback' => array( $this, 'can_edit' ),
					'args'                => array( 'id' => array( 'validate_callback' => 'is_numeric' ) ),
				),
				array(
					'methods'             => \WP_REST_Server::EDITABLE,
					'callback'            => array( $this, 'save' ),
					'permission_callback' => array( $this, 'can_edit' ),
					'args'                => array(
						'document' => array( 'required' => true, 'type' => 'object' ),
					),
				),
			)
		);
	}

	public function can_edit( \WP_REST_Request $request ): bool {
		return current_user_can( 'edit_post', absint( $request['id'] ) );
	}

	public function read( \WP_REST_Request $request ): \WP_REST_Response {
		$document = get_post_meta( absint( $request['id'] ), '_wpb_document', true );
		return new \WP_REST_Response( Document::normalize( is_array( $document ) ? $document : array() ) );
	}

	public function save( \WP_REST_Request $request ) {
		$post_id  = absint( $request['id'] );
		$document = Document::sanitize( (array) $request->get_param( 'document' ) );
		if ( is_wp_error( $document ) ) {
			return $document;
		}
		update_post_meta( $post_id, '_wpb_document', $document );
		update_post_meta( $post_id, '_wpb_enabled', '1' );
		wp_save_post_revision( $post_id );
		return new \WP_REST_Response( $document, 200 );
	}
}
