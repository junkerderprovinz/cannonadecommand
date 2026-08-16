<?php
/*
 * Read-only reader for Community Applications' own local template cache, so the
 * Apps-tab card can show a download count / last-updated month without a per-app
 * round trip. CA itself never puts this on the card face — only inside its own
 * Info popup, fetched one app at a time when that popup opens — but it already
 * caches the whole catalog (name/repo/downloads/last-update) in one file for its
 * own use, so this reads that same file instead of re-deriving the data.
 *
 * That cache is PHP serialize()'d, not JSON, despite its .json extension (a CA
 * implementation detail, confirmed live). This only ever READS it and degrades
 * to an empty map if CA isn't installed, hasn't populated its cache yet, or ever
 * changes its internal format: a future CA update just means the stat line stops
 * appearing on cards, not a broken Apps tab.
 */
header('Content-Type: application/json');

$path = '/tmp/community.applications/tempFiles/templates_new.json';
if (!is_file($path) || !is_readable($path)) {
    echo '{}';
    exit;
}

$raw = file_get_contents($path);
$data = $raw !== false ? @unserialize($raw, ['allowed_classes' => false]) : false;
if (!is_array($data)) {
    echo '{}';
    exit;
}

// Keyed exactly like .ca_holder's own data-appname/data-repository attributes,
// so the frontend can look a card up with no extra normalisation.
$out = [];
foreach ($data as $tmpl) {
    if (!is_array($tmpl) || empty($tmpl['Name']) || empty($tmpl['RepoName'])) {
        continue;
    }
    $downloads = isset($tmpl['downloads']) ? (int) $tmpl['downloads'] : null;
    $lastUpdate = isset($tmpl['LastUpdate']) ? (int) $tmpl['LastUpdate'] : null;
    if ($downloads === null && $lastUpdate === null) {
        continue;
    }
    $out[$tmpl['Name'] . '|' . $tmpl['RepoName']] = ['d' => $downloads, 'u' => $lastUpdate];
}
echo json_encode($out);
