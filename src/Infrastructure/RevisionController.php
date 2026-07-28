<?php
namespace Webifya\WPBuilder\Infrastructure;

use Webifya\WPBuilder\Contracts\Service;
use Webifya\WPBuilder\Schema\Document;

defined( 'ABSPATH' ) || exit;

final class RevisionController implements Service {
	public function register(): void {
		add_action( 'rest_api_init', array( $this, 'routes' ) );
	}

	public function routes(): void {
		register_rest_route(
			'wp-builder/v1',
			'/documents/(?P<id>\d+)/revisions',
			array(
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => array( $this, 'index' ),
				'permission_callback' => array( $this, 'can_edit' ),
				'args'                => array( 'id' => array( 'validate_callback' => 'is_numeric' ) ),
			)
		);
		register_rest_route(
			'wp-builder/v1',
			'/documents/(?P<id>\d+)/revisions/(?P<revision>\d+)/restore',
			array(
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'restore' ),
				'permission_callback' => array( $this, 'can_edit' ),
				'args'                => array(
					'id'       => array( 'validate_callback' => 'is_numeric' ),
					'revision' => array( 'validate_callback' => 'is_numeric' ),
				),
			)
		);
	}

	public function can_edit( \WP_REST_Request $request ): bool {
		return current_user_can( 'edit_post', absint( $request['id'] ) );
	}

	public function index( \WP_REST_Request $request ): \WP_REST_Response {
		$items = array();
		foreach ( wp_get_post_revisions( absint( $request['id'] ), array( 'posts_per_page' => 30 ) ) as $revision ) {
			$document = get_metadata( 'post', $revision->ID, '_wpb_document', true );
			if ( ! is_array( $document ) ) {
				continue;
			}
			$user    = get_userdata( (int) $revision->post_author );
			$items[] = array(
				'id'     => $revision->ID,
				'date'   => mysql2date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $revision->post_modified ),
				'author' => $user ? $user->display_name : __( 'Unknown', 'wp-builder' ),
			);
		}
		return new \WP_REST_Response( $items );
	}

	public function restore( \WP_REST_Request $request ) {
		$post_id     = absint( $request['id'] );
		$revision_id = absint( $request['revision'] );
		$revision    = get_post( $revision_id );
		if ( ! $revision || 'revision' !== $revision->post_type || $post_id !== (int) $revision->post_parent ) {
			return new \WP_Error( 'wpb_invalid_revision', __( 'That revision does not belong to this document.', 'wp-builder' ), array( 'status' => 400 ) );
		}
		$document = get_metadata( 'post', $revision_id, '_wpb_document', true );
		if ( ! is_array( $document ) ) {
			return new \WP_Error( 'wpb_missing_revision', __( 'That revision has no builder data.', 'wp-builder' ), array( 'status' => 404 ) );
		}
		$document = Document::sanitize( $document );
		if ( is_wp_error( $document ) ) {
			return $document;
		}
		update_post_meta( $post_id, '_wpb_document', $document );
		update_post_meta( $post_id, '_wpb_enabled', '1' );
		wp_save_post_revision( $post_id );
		return new \WP_REST_Response( $document );
	}
}
