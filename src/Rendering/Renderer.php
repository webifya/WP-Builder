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
		$elements = (array) ( $document['elements'] ?? array() );
		$css      = $this->responsive_css( $elements );
		$tokens   = $this->design_tokens( (array) ( $document['settings'] ?? array() ) );
		return ( $css ? '<style id="wpb-responsive-' . absint( $post_id ) . '">' . $css . '</style>' : '' )
			. '<div class="wpb-page"' . $tokens . '>' . $this->elements( $elements ) . '</div>';
	}

	private function elements( array $elements ): string {
		$html = '';
		foreach ( $elements as $element ) {
			$type     = sanitize_key( $element['type'] ?? '' );
			$props    = (array) ( $element['props'] ?? array() );
			$children = $this->elements( (array) ( $element['children'] ?? array() ) );
			$props['text'] = $props['text'] ?? '';
			$id            = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) ( $element['id'] ?? '' ) );
			$class         = 'wpb-element wpb-' . $type . ( $id ? ' wpb-id-' . $id : '' );
			foreach ( array( 'desktop', 'tablet', 'mobile' ) as $device ) {
				if ( ! empty( $props[ 'hide_' . $device ] ) ) {
					$class .= ' wpb-hide-' . $device;
				}
			}
			$style = $this->style_attribute( (array) ( $element['styles']['desktop'] ?? array() ) );
			switch ( $type ) {
				case 'heading':
					$tag   = in_array( $props['tag'] ?? 'h2', array( 'h1', 'h2', 'h3', 'h4', 'h5', 'h6' ), true ) ? $props['tag'] : 'h2';
					$html .= sprintf( '<%1$s class="%2$s"%3$s>%4$s</%1$s>', $tag, esc_attr( $class ), $style, wp_kses_post( $props['text'] ) );
					break;
				case 'text':
					$html .= '<div class="' . esc_attr( $class ) . '"' . $style . '>' . wp_kses_post( $props['text'] ) . '</div>';
					break;
				case 'image':
					$html .= wp_get_attachment_image( absint( $props['attachmentId'] ?? 0 ), 'full', false, array( 'class' => $class ) );
					break;
				case 'button':
					$html .= sprintf( '<a class="%s" href="%s"%s>%s</a>', esc_attr( $class ), esc_url( $props['url'] ?? '#' ), $style, esc_html( $props['text'] ?: __( 'Button', 'wp-builder' ) ) );
					break;
				case 'video':
					$html .= wp_video_shortcode( array( 'src' => esc_url_raw( $props['url'] ?? '' ) ) );
					break;
				case 'audio':
					$html .= wp_audio_shortcode( array( 'src' => esc_url_raw( $props['url'] ?? '' ) ) );
					break;
				case 'list':
					$items = preg_split( '/\r\n|\r|\n/', wp_strip_all_tags( $props['text'] ) );
					$html .= '<ul class="' . esc_attr( $class ) . '"' . $style . '>';
					foreach ( $items as $item ) {
						if ( '' !== trim( $item ) ) {
							$html .= '<li>' . esc_html( trim( $item ) ) . '</li>';
						}
					}
					$html .= '</ul>';
					break;
				case 'divider':
					$html .= '<hr class="' . esc_attr( $class ) . '"' . $style . '>';
					break;
				case 'spacer':
					$html .= '<div class="' . esc_attr( $class ) . '" aria-hidden="true"' . $style . '></div>';
					break;
				case 'alert':
					$html .= '<div class="' . esc_attr( $class ) . '" role="status"' . $style . '>' . esc_html( $props['text'] ) . '</div>';
					break;
				case 'progress':
					$value = min( 100, max( 0, absint( $props['value'] ?? 0 ) ) );
					$html .= sprintf( '<progress class="%s" max="100" value="%d"%s>%d%%</progress>', esc_attr( $class ), $value, $style, $value );
					break;
				case 'counter':
				case 'rating':
				case 'icon':
					$html .= '<div class="' . esc_attr( $class ) . '"' . $style . '>' . esc_html( $props['text'] ) . '</div>';
					break;
				case 'shortcode':
					$html .= '<div class="' . esc_attr( $class ) . '">' . do_shortcode( sanitize_text_field( $props['code'] ?? '' ) ) . '</div>';
					break;
				case 'html':
					$html .= '<div class="' . esc_attr( $class ) . '">' . wp_kses_post( $props['html'] ?? '' ) . '</div>';
					break;
				default:
					$html .= '<div class="' . esc_attr( $class ) . '"' . $style . '>' . ( $children ?: wp_kses_post( $props['text'] ) ) . '</div>';
			}
		}
		return $html;
	}

	private function style_attribute( array $rules ): string {
		$map = array(
			'margin'         => 'margin',
			'padding'        => 'padding',
			'color'          => 'color',
			'backgroundColor'=> 'background-color',
			'borderColor'    => 'border-color',
			'borderWidth'    => 'border-width',
			'borderRadius'   => 'border-radius',
			'fontSize'       => 'font-size',
			'fontWeight'     => 'font-weight',
			'textAlign'      => 'text-align',
			'width'          => 'width',
			'minHeight'      => 'min-height',
			'display'        => 'display',
			'flexDirection'  => 'flex-direction',
			'justifyContent' => 'justify-content',
			'alignItems'     => 'align-items',
			'gap'            => 'gap',
		);
		$css = '';
		foreach ( $rules as $property => $value ) {
			if ( isset( $map[ $property ] ) && is_string( $value ) && ! preg_match( '/[;{}]|url\s*\(/i', $value ) ) {
				$css .= $map[ $property ] . ':' . $value . ';';
			}
		}
		return $css ? ' style="' . esc_attr( $css ) . '"' : '';
	}

	private function responsive_css( array $elements ): string {
		$tablet = '';
		$mobile = '';
		$this->collect_responsive_css( $elements, $tablet, $mobile );
		$css = $tablet ? '@media(max-width:1024px){' . $tablet . '}' : '';
		$css .= $mobile ? '@media(max-width:767px){' . $mobile . '}' : '';
		return $css;
	}

	private function collect_responsive_css( array $elements, string &$tablet, string &$mobile ): void {
		foreach ( $elements as $element ) {
			$id = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) ( $element['id'] ?? '' ) );
			if ( $id ) {
				$tablet_rules = $this->style_attribute( (array) ( $element['styles']['tablet'] ?? array() ) );
				$mobile_rules = $this->style_attribute( (array) ( $element['styles']['mobile'] ?? array() ) );
				if ( $tablet_rules ) {
					$tablet .= '.wpb-id-' . $id . '{' . substr( $tablet_rules, 8, -1 ) . '}';
				}
				if ( $mobile_rules ) {
					$mobile .= '.wpb-id-' . $id . '{' . substr( $mobile_rules, 8, -1 ) . '}';
				}
			}
			$this->collect_responsive_css( (array) ( $element['children'] ?? array() ), $tablet, $mobile );
		}
	}

	private function design_tokens( array $settings ): string {
		$colors = (array) ( $settings['colors'] ?? array() );
		$type   = (array) ( $settings['typography'] ?? array() );
		$rules  = array();
		foreach ( array( 'primary', 'secondary', 'text', 'background' ) as $name ) {
			$value = (string) ( $colors[ $name ] ?? '' );
			if ( preg_match( '/^#[0-9a-fA-F]{3,8}$/', $value ) ) {
				$rules[] = '--wpb-' . $name . ':' . $value;
			}
		}
		$family = (string) ( $type['fontFamily'] ?? '' );
		if ( $family && ! preg_match( '/[;{}]/', $family ) ) {
			$rules[] = '--wpb-font-family:' . $family;
		}
		return $rules ? ' style="' . esc_attr( implode( ';', $rules ) ) . '"' : '';
	}
}
