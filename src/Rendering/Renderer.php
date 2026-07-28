<?php
namespace Webifya\WPBuilder\Rendering;

use Webifya\WPBuilder\Contracts\Service;

defined( 'ABSPATH' ) || exit;

final class Renderer implements Service {
	public function register(): void {
		add_filter( 'the_content', array( $this, 'content' ), 20 );
	}

	public function content( string $content ): string {
		if ( ! is_singular() || ! in_the_loop() || ! is_main_query() ) {
			return $content;
		}
		$post_id = get_the_ID();
		if ( '1' !== get_post_meta( $post_id, '_wpb_enabled', true ) ) {
			return $content;
		}
		$document = get_post_meta( $post_id, '_wpb_document', true );
		if ( ! is_array( $document ) ) {
			return $content;
		}
		wp_enqueue_style( 'wp-builder' );
		return '<div class="wpb-page">' . $this->elements( (array) ( $document['elements'] ?? array() ) ) . '</div>';
	}

	private function elements( array $elements ): string {
		$html = '';
		foreach ( $elements as $element ) {
			$type     = sanitize_key( $element['type'] ?? '' );
			$props    = (array) ( $element['props'] ?? array() );
			$children = $this->elements( (array) ( $element['children'] ?? array() ) );
			$class    = 'wpb-element wpb-' . $type;
			switch ( $type ) {
				case 'heading':
					$tag   = in_array( $props['tag'] ?? 'h2', array( 'h1', 'h2', 'h3', 'h4', 'h5', 'h6' ), true ) ? $props['tag'] : 'h2';
					$html .= sprintf( '<%1$s class="%2$s">%3$s</%1$s>', $tag, esc_attr( $class ), wp_kses_post( $props['text'] ?? '' ) );
					break;
				case 'text':
					$html .= '<div class="' . esc_attr( $class ) . '">' . wp_kses_post( $props['text'] ?? '' ) . '</div>';
					break;
				case 'image':
					$html .= wp_get_attachment_image( absint( $props['attachmentId'] ?? 0 ), 'full', false, array( 'class' => $class ) );
					break;
				case 'button':
					$html .= sprintf( '<a class="%s" href="%s">%s</a>', esc_attr( $class ), esc_url( $props['url'] ?? '#' ), esc_html( $props['text'] ?? __( 'Button', 'wp-builder' ) ) );
					break;
				case 'shortcode':
					$html .= '<div class="' . esc_attr( $class ) . '">' . do_shortcode( sanitize_text_field( $props['code'] ?? '' ) ) . '</div>';
					break;
				case 'html':
					$html .= '<div class="' . esc_attr( $class ) . '">' . wp_kses_post( $props['html'] ?? '' ) . '</div>';
					break;
				default:
					$html .= '<div class="' . esc_attr( $class ) . '">' . $children . '</div>';
			}
		}
		return $html;
	}
}
