<?php
namespace Webifya\Pagevia\Infrastructure;

use Webifya\Pagevia\Contracts\Service;
use Webifya\Pagevia\Schema\Document;

defined( 'ABSPATH' ) || exit;

final class TemplateController implements Service {
	public function register(): void {
		add_action( 'rest_api_init', array( $this, 'routes' ) );
	}

	public function routes(): void {
		register_rest_route(
			'pagevia/v1',
			'/templates',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'index' ),
					'permission_callback' => static fn(): bool => current_user_can( 'publish_posts' ),
				),
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'create' ),
					'permission_callback' => static fn(): bool => current_user_can( 'publish_posts' ),
					'args'                => array(
						'name'     => array( 'required' => true, 'type' => 'string' ),
						'document' => array( 'required' => true, 'type' => 'object' ),
					),
				),
			)
		);
		register_rest_route(
			'pagevia/v1',
			'/templates/(?P<id>\d+)',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'read' ),
					'permission_callback' => array( $this, 'can_access' ),
				),
				array(
					'methods'             => \WP_REST_Server::DELETABLE,
					'callback'            => array( $this, 'delete' ),
					'permission_callback' => array( $this, 'can_delete' ),
				),
			)
		);
	}

	public function can_access( \WP_REST_Request $request ): bool {
		return current_user_can( 'edit_post', absint( $request['id'] ) );
	}

	public function can_delete( \WP_REST_Request $request ): bool {
		return current_user_can( 'delete_post', absint( $request['id'] ) );
	}

	public function index(): \WP_REST_Response {
		$items = array();
		$query = new \WP_Query(
			array(
				'post_type'      => 'pagevia_template',
				'post_status'    => 'private',
				'posts_per_page' => 100,
				'orderby'        => 'modified',
				'order'          => 'DESC',
				'no_found_rows'  => true,
			)
		);
		foreach ( $query->posts as $template ) {
			$items[] = $this->summary( $template );
		}
		return new \WP_REST_Response( $items );
	}

	public function create( \WP_REST_Request $request ) {
		$name = sanitize_text_field( (string) $request->get_param( 'name' ) );
		if ( '' === $name ) {
			return new \WP_Error( 'pagevia_template_name_required', __( 'Enter a template name.', 'pagevia' ), array( 'status' => 400 ) );
		}
		$document = Document::sanitize( (array) $request->get_param( 'document' ) );
		if ( is_wp_error( $document ) ) {
			return $document;
		}
		$post_id = wp_insert_post(
			array(
				'post_type'   => 'pagevia_template',
				'post_status' => 'private',
				'post_title'  => $name,
				'post_author' => get_current_user_id(),
			),
			true
		);
		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}
		update_post_meta( $post_id, '_pagevia_document', $document );
		return new \WP_REST_Response( $this->summary( get_post( $post_id ) ), 201 );
	}

	public function read( \WP_REST_Request $request ) {
		$template = get_post( absint( $request['id'] ) );
		if ( ! $template || 'pagevia_template' !== $template->post_type ) {
			return new \WP_Error( 'pagevia_template_not_found', __( 'Template not found.', 'pagevia' ), array( 'status' => 404 ) );
		}
		return new \WP_REST_Response(
			array(
				'id'       => $template->ID,
				'name'     => $template->post_title,
				'document' => Document::normalize( (array) get_post_meta( $template->ID, '_pagevia_document', true ) ),
			)
		);
	}

	public function delete( \WP_REST_Request $request ) {
		$template = get_post( absint( $request['id'] ) );
		if ( ! $template || 'pagevia_template' !== $template->post_type ) {
			return new \WP_Error( 'pagevia_template_not_found', __( 'Template not found.', 'pagevia' ), array( 'status' => 404 ) );
		}
		$deleted = wp_delete_post( $template->ID, true );
		return new \WP_REST_Response( array( 'deleted' => (bool) $deleted ) );
	}

	private function summary( \WP_Post $template ): array {
		return array(
			'id'       => $template->ID,
			'name'     => $template->post_title,
			'modified' => mysql2date( get_option( 'date_format' ), $template->post_modified ),
		);
	}
}
