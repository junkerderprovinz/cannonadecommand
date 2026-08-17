<?php
/*
 * Read-only reader for Community Applications' own local template cache (the
 * SAME file castats.php reads), filtered to the "Language:" category — Unraid's
 * own official language packs (github.com/unraid/language-templates) are
 * ordinary CA catalog entries, not a separate system. This just lists them, so
 * the Display-Settings language dropdown can offer every AVAILABLE pack, not
 * only the ones already installed (the native <select> only ever lists those).
 *
 * "Installed" is deliberately NOT decided here: the frontend already has the
 * authoritative list via the native <select>'s own option values, and this
 * endpoint would otherwise have to duplicate CA's own installed-language
 * directory scan and could drift out of sync with it.
 */
header('Content-Type: application/json');

$path = '/tmp/community.applications/tempFiles/templates_new.json';
if (!is_file($path) || !is_readable($path)) {
    echo '[]';
    exit;
}

$raw = file_get_contents($path);
$data = $raw !== false ? @unserialize($raw, ['allowed_classes' => false]) : false;
if (!is_array($data)) {
    echo '[]';
    exit;
}

$out = [];
foreach ($data as $tmpl) {
    if (!is_array($tmpl) || empty($tmpl['LanguagePack']) || empty($tmpl['TemplateURL'])) {
        continue;
    }
    $cat = isset($tmpl['Category']) ? $tmpl['Category'] : '';
    if (strpos($cat, 'Language:') === false) {
        continue;
    }
    $out[] = [
        'code' => $tmpl['LanguagePack'],                                  // e.g. "de_DE" - matches the native <select>'s option value
        'name' => isset($tmpl['Language']) ? $tmpl['Language'] : $tmpl['Name'],       // e.g. "German"
        'local' => isset($tmpl['LanguageLocal']) ? $tmpl['LanguageLocal'] : '',       // e.g. "Deutsch"
        'templateUrl' => $tmpl['TemplateURL'],
    ];
}
usort($out, function ($a, $b) { return strcasecmp($a['name'], $b['name']); });
echo json_encode($out);
