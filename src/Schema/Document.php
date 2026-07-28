<?php
namespace Webifya\WPBuilder\Schema;

defined( 'ABSPATH' ) || exit;

final class Document {
	private const TYPES = array( 'section', 'container', 'row', 'column', 'heading', 'text', 'image', 'button', 'spacer', 'divider', 'html', 'shortcode' );

	public static function normalize( array $document ): array {
		return array(
			'version'  => 1,
			'settings' => isset( $document['settings'] ) && is_array( $document['settings'] ) ? $document['settings'] : array(),
			'elements' => isset( $document['elements'] ) && is_array( $document['elements'] ) ? $document['elements'] : array(),
		);
	}

	public static function sanitize( array $document ) {
		$document = self::normalize( $document );
		$elements = self::sanitize_elements( $document['elements'], 0 );
		if ( is_wp_error( $elements ) ) {
			return $elements;
		}
		$document['elements'] = $elements;
		$document['settings'] = map_deep( $document['settings'], 'sanitize_text_field' );
		return $document;
	}

	private static function sanitize_elements( array $elements, int $depth ) {
		if ( $depth > 12 || count( $elements ) > 1000 ) {
			return new \WP_Error( 'wpb_invalid_document', __( 'The builder document is too deeply nested or too large.', 'wp-builder' ), array( 'status' => 400 ) );
		}
		$clean = array();
		foreach ( $elements as $element ) {
			if ( ! is_array( $element ) || ! in_array( $element['type'] ?? '', self::TYPES, true ) ) {
				continue;
			}
			$children = self::sanitize_elements( (array) ( $element['children'] ?? array() ), $depth + 1 );
			if ( is_wp_error( $children ) ) {
				return $children;
			}
			$clean[] = array(
				'id'       => preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) ( $element['id'] ?? wp_generate_uuid4() ) ),
				'type'     => sanitize_key( $element['type'] ),
				'props'    => self::sanitize_props( (array) ( $element['props'] ?? array() ) ),
				'styles'   => map_deep( (array) ( $element['styles'] ?? array() ), 'sanitize_text_field' ),
				'children' => $children,
			);
		}
		return $clean;
	}

	private static function sanitize_props( array $props ): array {
		foreach ( $props as $key => $value ) {
			$props[ sanitize_key( $key ) ] = is_string( $value ) ? wp_kses_post( $value ) : $value;
			if ( sanitize_key( $key ) !== $key ) {
				unset( $props[ $key ] );
			}
		}
		return $props;
	}
}
