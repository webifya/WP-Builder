const fs = require('fs');

const editor = fs.readFileSync('src/Infrastructure/Editor.php', 'utf8');
const canvas = fs.readFileSync('templates/editor-canvas.php', 'utf8');
const launcher = fs.readFileSync('assets/js/admin-launcher.js', 'utf8');

if (!editor.includes("home_url( '/' )") || editor.includes('get_preview_post_link')) throw new Error('Launcher still depends on a preview permalink');
if (!editor.includes("status_header( 200 )") || !editor.includes("templates/editor-canvas.php")) throw new Error('Virtual editor route is incomplete');
if (editor.includes('add_meta_box')) throw new Error('Sidebar launcher was not removed');
if (!editor.includes('edit_form_after_title') || !launcher.includes('editor-post-title')) throw new Error('Below-title launcher placement is incomplete');
if (!canvas.includes('wp_head()') || !canvas.includes('wp_footer()')) throw new Error('Editor canvas cannot load WordPress assets');
console.log('Editor route and launcher tests passed');
