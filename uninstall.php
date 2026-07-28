<?php
defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_option( 'wpb_version' );
// Content is intentionally preserved. Site owners must opt in to destructive data removal.
