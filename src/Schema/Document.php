<?php
namespace Webifya\WPBuilder\Schema;

defined( 'ABSPATH' ) || exit;

final class Document {
	private const TYPES = array(
		'section', 'container', 'row', 'column', 'inner-container', 'spacer', 'divider',
		'heading', 'text', 'image', 'button', 'icon', 'icon-box', 'video', 'audio',
		'gallery', 'list', 'accordion', 'tabs', 'toggle', 'progress', 'counter',
		'alert', 'social-icons', 'rating', 'html', 'shortcode',
	);

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
				'styles'   => self::sanitize_styles( (array) ( $element['styles'] ?? array() ) ),
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

	private static function sanitize_styles( array $styles ): array {
		$allowed = array(
			'margin', 'padding', 'color', 'backgroundColor', 'borderColor', 'borderWidth',
			'borderRadius', 'fontSize', 'fontWeight', 'textAlign', 'width', 'minHeight',
			'display', 'flexDirection', 'justifyContent', 'alignItems', 'gap',
		);
		$clean = array();
		foreach ( $styles as $device => $rules ) {
			if ( ! in_array( $device, array( 'desktop', 'tablet', 'mobile' ), true ) || ! is_array( $rules ) ) {
				continue;
			}
			foreach ( $rules as $property => $value ) {
				if ( in_array( $property, $allowed, true ) && is_scalar( $value ) ) {
					$clean[ $device ][ $property ] = sanitize_text_field( (string) $value );
				}
			}
		}
		return $clean;
	}
}
