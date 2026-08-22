<?php
/*
 * Same-origin proxy from the Unraid WebGUI to the CannonadeCommand host
 * supervisor's unix-socket API. Only whitelisted path+method pairs are
 * forwarded; nothing else reaches the engine, and the engine itself never
 * exposes Docker create/exec/build. The browser never touches the Docker socket.
 */
$sock  = getenv('CC_SOCK') ?: '/var/run/cannonadecommand.sock';
// state/stats: read-only; action: start|stop|restart|pause|unpause (the engine
// validates the container name against the live list and never exposes
// create/exec/build); plan/apply: the start-order plan. Nothing else is forwarded.
// vms: read-only VM list + current limits; vmlimits: apply CPU-pin/cap, RAM, bandwidth to
// ONE VM (the engine validates the name against the live libvirt domain list, uses only
// virsh --config/--live for CPU/RAM and host-side iptables physdev hashlimit for bandwidth,
// and never virsh-defines/undefines/creates a domain).
// icons: batch name -> icon-source lookup, answered from the engine's cache only
// (it never fetches on the request path); iconsvg: the cached SVG itself, served
// as real image/svg+xml so an <img> can point straight at it, same-origin.
$allow = ['state' => ['GET'], 'stats' => ['GET'], 'hostcpu' => ['GET'], 'hostnet' => ['GET'], 'action' => ['POST'], 'limits' => ['GET', 'POST'], 'restartpolicy' => ['POST'], 'limitlog' => ['GET'],
    'bwstatus' => ['GET'], 'plan' => ['GET', 'PUT'], 'apply' => ['POST'], 'config' => ['GET', 'PUT'], 'vms' => ['GET'], 'vmlimits' => ['POST'],
    'vmdisks' => ['GET'], 'vmdiskresize' => ['POST'], 'icons' => ['POST'], 'iconsvg' => ['GET']];

$path   = isset($_GET['path']) ? preg_replace('/[^a-z]/', '', $_GET['path']) : '';
$method = $_SERVER['REQUEST_METHOD'];

// iconsvg is the ONE path that does not answer JSON — it hands back SVG artwork,
// cached hard by the browser so 50 rows cost 50 requests once and none after that.
if ($path === 'iconsvg') {
    header('Content-Type: image/svg+xml');
    header('Cache-Control: public, max-age=86400');
} else {
    header('Content-Type: application/json');
}

if (!isset($allow[$path]) || !in_array($method, $allow[$path], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'not allowed']);
    exit;
}

// Forward only the query params each path explicitly needs (allowlist, like
// $allow) so no attacker-supplied param ever reaches the engine unfiltered.
$qallow = ['limits' => ['name'], 'bwstatus' => ['name'], 'vmdisks' => ['name'], 'iconsvg' => ['name']];
$extra = [];
if (isset($qallow[$path])) {
    foreach ($qallow[$path] as $k) {
        if (isset($_GET[$k])) {
            $extra[$k] = $_GET[$k];
        }
    }
}
$qs = http_build_query($extra);

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_UNIX_SOCKET_PATH => $sock,
    CURLOPT_URL            => 'http://localhost/api/' . $path . ($qs ? '?' . $qs : ''),
    CURLOPT_CUSTOMREQUEST  => $method,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 900,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Accept: application/json'],
]);
if ($method === 'PUT' || $method === 'POST') {
    // Writes arrive FORM-ENCODED (csrf_token=...&data=<json>) — Unraid's emhttp only
    // accepts POSTs whose csrf_token sits in the form body (the query-string variant is
    // dropped with an empty 200, which ate every save). Unwrap the JSON from `data`;
    // fall back to the raw body for old callers that still send plain JSON.
    $body = file_get_contents('php://input');
    if (isset($_POST['data'])) {
        $body = $_POST['data'];
    } else {
        parse_str($body, $form); // PUTs don't populate $_POST
        if (isset($form['data'])) {
            $body = $form['data'];
        }
    }
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$resp = curl_exec($ch);
$code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err  = curl_error($ch);
curl_close($ch);

if ($resp === false || $code === 0) {
    http_response_code(502);
    echo json_encode(['error' => 'engine unreachable: ' . $err]);
    exit;
}
http_response_code($code ?: 200);
echo $resp;
