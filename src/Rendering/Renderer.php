<?php
namespace Webifya\Pagevia\Rendering;

use Webifya\Pagevia\Contracts\Service;

defined( 'ABSPATH' ) || exit;

final class Renderer implements Service {
	public function register(): void {
		add_filter( 'the_content', array( $this, 'content' ), 20 );
		add_filter( 'pagevia/render_post', array( $this, 'render_post' ), 10, 2 );
	}

	public function content( string $content ): string {
		if ( ! is_singular() || ! in_the_loop() || ! is_main_query() ) {
			return $content;
		}
		$post_id = get_the_ID();
		return $this->render_post( '', $post_id );
	}

	public function render_post( string $fallback, int $post_id ): string {
		if ( '1' !== get_post_meta( $post_id, '_pagevia_enabled', true ) ) {
			return $fallback;
		}
		$document = get_post_meta( $post_id, '_pagevia_document', true );
		if ( ! is_array( $document ) ) {
			return $fallback;
		}
		wp_enqueue_style( 'pagevia' );
		wp_enqueue_style( 'pagevia-widgets' );
		wp_enqueue_script( 'pagevia-frontend' );
		$elements = (array) ( $document['elements'] ?? array() );
		$settings = (array) ( $document['settings'] ?? array() );
		$css      = $this->document_css( $elements, $settings );
		$tokens   = $this->design_tokens( $settings );
		return ( $css ? '<style id="pagevia-design-' . absint( $post_id ) . '">' . $css . '</style>' : '' )
			. '<div class="pagevia-page"' . $tokens . '>' . $this->elements( $elements ) . '</div>';
	}

	private function elements( array $elements ): string {
		$html = '';
		foreach ( $elements as $element ) {
			$type     = sanitize_key( $element['type'] ?? '' );
			$props    = (array) ( $element['props'] ?? array() );
			$props    = $this->resolve_dynamic( $props );
			$children = $this->elements( (array) ( $element['children'] ?? array() ) );
			$props['text'] = $props['text'] ?? '';
			$id            = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) ( $element['id'] ?? '' ) );
			$class         = 'pagevia-element pagevia-' . $type . ( $id ? ' pagevia-id-' . $id : '' );
			foreach ( preg_split( '/\s+/', (string) ( $props['cssClasses'] ?? '' ) ) as $custom_class ) {
				$custom_class = sanitize_html_class( $custom_class );
				if ( $custom_class ) {
					$class .= ' ' . $custom_class;
				}
			}
			foreach ( array( 'desktop', 'tablet', 'mobile' ) as $device ) {
				if ( ! empty( $props[ 'hide_' . $device ] ) ) {
					$class .= ' pagevia-hide-' . $device;
				}
			}
			$style = '';
			$custom = apply_filters( 'pagevia/render_element', '', $element, array( 'type' => $type, 'props' => $props, 'class' => $class, 'id' => $id, 'children' => $children ) );
			if ( is_string( $custom ) && '' !== $custom ) {
				$html .= $custom;
				continue;
			}
			switch ( $type ) {
				case 'heading':
					$tag   = in_array( $props['tag'] ?? 'h2', array( 'h1', 'h2', 'h3', 'h4', 'h5', 'h6' ), true ) ? $props['tag'] : 'h2';
					$html .= sprintf( '<%1$s class="%2$s"%3$s>%4$s</%1$s>', $tag, esc_attr( $class ), $style, wp_kses_post( $props['text'] ) );
					break;
				case 'text':
					$html .= '<div class="' . esc_attr( $class ) . '"' . $style . '>' . wp_kses_post( $props['text'] ) . '</div>';
					break;
				case 'image':
					$image = wp_get_attachment_image( absint( $props['attachmentId'] ?? 0 ), 'full', false, array( 'class' => $class ) );
					if ( ! $image && ! empty( $props['url'] ) ) {
						$image = sprintf( '<img class="%s" src="%s" alt="%s"%s>', esc_attr( $class ), esc_url( $props['url'] ), esc_attr( $props['alt'] ?? '' ), $style );
					}
					$html .= $image;
					break;
				case 'button':
					$html .= sprintf( '<a class="%s" href="%s"%s>%s</a>', esc_attr( $class ), esc_url( $props['url'] ?? '#' ), $style, esc_html( $props['text'] ?: __( 'Button', 'pagevia' ) ) );
					break;
				case 'video':
					$html .= '<div class="' . esc_attr( $class ) . '">' . wp_video_shortcode( array( 'src' => esc_url_raw( $props['url'] ?? '' ) ) ) . '</div>';
					break;
				case 'audio':
					$html .= '<div class="' . esc_attr( $class ) . '">' . wp_audio_shortcode( array( 'src' => esc_url_raw( $props['url'] ?? '' ) ) ) . '</div>';
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
				case 'accordion':
					$html .= '<div class="' . esc_attr( $class ) . '"' . $style . '>';
					foreach ( (array) ( $props['items'] ?? array() ) as $item ) {
						$html .= '<details><summary>' . esc_html( $item['title'] ?? '' ) . '</summary><div>' . wp_kses_post( $item['content'] ?? '' ) . '</div></details>';
					}
					$html .= '</div>';
					break;
				case 'toggle':
					$html .= '<details class="' . esc_attr( $class ) . '"' . $style . '><summary>' . esc_html( $props['title'] ?? __( 'More information', 'pagevia' ) ) . '</summary><div>' . wp_kses_post( $props['text'] ) . '</div></details>';
					break;
				case 'tabs':
					$tabs_id = 'pagevia-tabs-' . ( $id ?: wp_unique_id() );
					$html   .= '<div class="' . esc_attr( $class ) . '" data-pagevia-tabs' . $style . '><div role="tablist" aria-label="' . esc_attr__( 'Content tabs', 'pagevia' ) . '">';
					foreach ( (array) ( $props['items'] ?? array() ) as $index => $item ) {
						$selected = 0 === $index;
						$html .= sprintf(
							'<button type="button" role="tab" id="%1$s-tab-%2$d" aria-controls="%1$s-panel-%2$d" aria-selected="%3$s" tabindex="%4$d">%5$s</button>',
							esc_attr( $tabs_id ),
							absint( $index ),
							$selected ? 'true' : 'false',
							$selected ? 0 : -1,
							esc_html( $item['title'] ?? '' )
						);
					}
					$html .= '</div>';
					foreach ( (array) ( $props['items'] ?? array() ) as $index => $item ) {
						$html .= sprintf(
							'<div role="tabpanel" id="%1$s-panel-%2$d" aria-labelledby="%1$s-tab-%2$d"%3$s>%4$s</div>',
							esc_attr( $tabs_id ),
							absint( $index ),
							0 === $index ? '' : ' hidden',
							wp_kses_post( $item['content'] ?? '' )
						);
					}
					$html .= '</div>';
					break;
				case 'counter':
					$html .= '<span class="' . esc_attr( $class ) . '"' . $style . '><span class="pagevia-counter-value">' . esc_html( $props['value'] ?? 0 ) . '</span>' . esc_html( $props['suffix'] ?? '' ) . '</span>';
					break;
				case 'rating':
					$value = min( 10, max( 0, (float) ( $props['value'] ?? 0 ) ) );
					$max   = min( 10, max( 1, absint( $props['max'] ?? 5 ) ) );
					/* translators: 1: rating value, 2: maximum rating value. */
					$html .= sprintf( '<meter class="%s" min="0" max="%d" value="%s"%s aria-label="%s">%s/%d</meter>', esc_attr( $class ), $max, esc_attr( $value ), $style, esc_attr( sprintf( __( '%1$s out of %2$d stars', 'pagevia' ), $value, $max ) ), esc_html( $value ), $max );
					break;
				case 'icon':
					$html .= '<div class="' . esc_attr( $class ) . '"' . $style . '>' . esc_html( $props['text'] ) . '</div>';
					break;
				case 'icon-box':
					$html .= '<div class="' . esc_attr( $class ) . '"' . $style . '><span aria-hidden="true">' . esc_html( $props['icon'] ?? '' ) . '</span><h3>' . esc_html( $props['title'] ?? '' ) . '</h3><div>' . wp_kses_post( $props['text'] ) . '</div></div>';
					break;
				case 'gallery':
					$html .= '<div class="' . esc_attr( $class ) . '"' . $style . '>';
					foreach ( preg_split( '/\r\n|\r|\n/', (string) ( $props['urls'] ?? '' ) ) as $url ) {
						if ( $url ) {
							$html .= '<img src="' . esc_url( trim( $url ) ) . '" alt="" loading="lazy">';
						}
					}
					$html .= '</div>';
					break;
				case 'social-icons':
					$html .= '<nav class="' . esc_attr( $class ) . '" aria-label="' . esc_attr__( 'Social links', 'pagevia' ) . '"' . $style . '>';
					foreach ( preg_split( '/\r\n|\r|\n/', (string) ( $props['links'] ?? '' ) ) as $link ) {
						$parts = array_map( 'trim', explode( '|', $link, 2 ) );
						if ( ! empty( $parts[1] ) ) {
							$html .= '<a href="' . esc_url( $parts[1] ) . '" rel="noopener noreferrer">' . esc_html( $parts[0] ?: $parts[1] ) . '</a>';
						}
					}
					$html .= '</nav>';
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

	private function resolve_dynamic( array $props ): array {
		foreach ( $props as $key => $value ) {
			if ( is_array( $value ) ) $props[ $key ] = $this->resolve_dynamic( $value );
			if ( is_string( $value ) ) {
				$props[ $key ] = preg_replace_callback( '/\{\{\s*([a-z0-9_:-]+)\s*\}\}/i', static function ( array $match ): string {
					return (string) apply_filters( 'pagevia/dynamic_value', $match[0], $match[1], array( 'post_id' => get_the_ID() ) );
				}, $value );
			}
		}
		return $props;
	}

	private function rules_css( array $rules ): string {
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
			'flexWrap'       => 'flex-wrap',
			'gridTemplateColumns' => 'grid-template-columns',
			'gridAutoRows'   => 'grid-auto-rows',
		);
		$css = '';
		foreach ( $rules as $property => $value ) {
			if ( isset( $map[ $property ] ) && is_string( $value ) && ! preg_match( '/[;{}<>]|url\s*\(/i', $value ) ) {
				$css .= $map[ $property ] . ':' . $value . ';';
			}
		}
		return $css;
	}

	private function document_css( array $elements, array $settings ): string {
		$desktop = '';
		$tablet = '';
		$mobile = '';
		foreach ( (array) ( $settings['widgetStyles'] ?? array() ) as $type => $styles ) {
			$type = sanitize_key( $type );
			if ( ! $type || ! is_array( $styles ) ) continue;
			$this->append_css_rule( '.pagevia-page .pagevia-' . $type, (array) ( $styles['desktop'] ?? array() ), $desktop );
			$this->append_css_rule( '.pagevia-page .pagevia-' . $type, (array) ( $styles['tablet'] ?? array() ), $tablet );
			$this->append_css_rule( '.pagevia-page .pagevia-' . $type, (array) ( $styles['mobile'] ?? array() ), $mobile );
		}
		$this->collect_element_css( $elements, $desktop, $tablet, $mobile );
		$breakpoints = (array) ( $settings['breakpoints'] ?? array() );
		$tablet_width = min( 1600, max( 600, absint( $breakpoints['tablet'] ?? 1024 ) ) );
		$mobile_width = min( $tablet_width - 1, max( 320, absint( $breakpoints['mobile'] ?? 767 ) ) );
		$css = $desktop;
		$css .= $tablet ? '@media(max-width:' . $tablet_width . 'px){' . $tablet . '}' : '';
		$css .= $mobile ? '@media(max-width:' . $mobile_width . 'px){' . $mobile . '}' : '';
		return $css;
	}

	private function collect_element_css( array $elements, string &$desktop, string &$tablet, string &$mobile ): void {
		foreach ( $elements as $element ) {
			$id = preg_replace( '/[^a-zA-Z0-9_-]/', '', (string) ( $element['id'] ?? '' ) );
			if ( $id ) {
				$selector = '.pagevia-page .pagevia-id-' . $id;
				$this->append_css_rule( $selector, (array) ( $element['styles']['desktop'] ?? array() ), $desktop );
				$this->append_css_rule( $selector, (array) ( $element['styles']['tablet'] ?? array() ), $tablet );
				$this->append_css_rule( $selector, (array) ( $element['styles']['mobile'] ?? array() ), $mobile );
			}
			$this->collect_element_css( (array) ( $element['children'] ?? array() ), $desktop, $tablet, $mobile );
		}
	}

	private function append_css_rule( string $selector, array $rules, string &$css ): void {
		$declarations = $this->rules_css( $rules );
		if ( $declarations ) $css .= $selector . '{' . $declarations . '}';
	}

	private function design_tokens( array $settings ): string {
		$colors = (array) ( $settings['colors'] ?? array() );
		$type   = (array) ( $settings['typography'] ?? array() );
		$rules  = array();
		foreach ( array( 'primary', 'secondary', 'text', 'background' ) as $name ) {
			$value = (string) ( $colors[ $name ] ?? '' );
			if ( preg_match( '/^#[0-9a-fA-F]{3,8}$/', $value ) ) {
				$rules[] = '--pagevia-' . $name . ':' . $value;
			}
		}
		foreach ( array( 'xs', 'sm', 'md', 'lg', 'xl' ) as $name ) {
			$value = (string) ( $settings['spacing'][ $name ] ?? '' );
			if ( $this->safe_token_value( $value ) ) $rules[] = '--pagevia-space-' . $name . ':' . $value;
		}
		foreach ( (array) ( $settings['variables'] ?? array() ) as $name => $value ) {
			$name = sanitize_key( $name );
			$value = (string) $value;
			if ( $name && $this->safe_token_value( $value ) ) $rules[] = '--pagevia-' . $name . ':' . $value;
		}
		$family = (string) ( $type['fontFamily'] ?? '' );
		if ( $family && ! preg_match( '/[;{}]/', $family ) ) {
			$rules[] = '--pagevia-font-family:' . $family;
		}
		return $rules ? ' style="' . esc_attr( implode( ';', $rules ) ) . '"' : '';
	}

	private function safe_token_value( string $value ): bool {
		return '' !== trim( $value ) && ! preg_match( '/[;{}<>]|url\s*\(/i', $value );
	}
}
