<?php
namespace Webifya\Pagevia\Infrastructure;

use Webifya\Pagevia\Contracts\Service;

defined( 'ABSPATH' ) || exit;

final class LegacyMigration implements Service {
	public function register(): void {
		add_action( 'init', array( $this, 'migrate' ), 20 );
	}

	public function migrate(): void {
		if ( get_option( 'pagevia_legacy_migrated' ) ) return;
		$templates = get_posts( array( 'post_type' => 'wpb_template', 'post_status' => 'any', 'numberposts' => 100, 'fields' => 'ids' ) );
		foreach ( $templates as $template_id ) {
			wp_update_post( array( 'ID' => $template_id, 'post_type' => 'pagevia_template' ) );
			$legacy = get_post_meta( $template_id, '_wpb_document', true );
			if ( is_array( $legacy ) ) update_post_meta( $template_id, '_pagevia_document', $legacy );
		}
		$posts = get_posts( array( 'post_type' => 'any', 'post_status' => 'any', 'numberposts' => 100, 'fields' => 'ids', 'meta_query' => array( 'relation' => 'AND', array( 'key' => '_wpb_enabled', 'compare' => 'EXISTS' ), array( 'key' => '_pagevia_legacy_migrated', 'compare' => 'NOT EXISTS' ) ) ) );
		foreach ( $posts as $post_id ) {
			$document = get_post_meta( $post_id, '_wpb_document', true );
			if ( is_array( $document ) && ! metadata_exists( 'post', $post_id, '_pagevia_document' ) ) {
				update_post_meta( $post_id, '_pagevia_document', $document );
				update_post_meta( $post_id, '_pagevia_enabled', '1' );
			}
			update_post_meta( $post_id, '_pagevia_legacy_migrated', '1' );
		}
		if ( count( $posts ) < 100 && count( $templates ) < 100 ) update_option( 'pagevia_legacy_migrated', time(), false );
	}
}
