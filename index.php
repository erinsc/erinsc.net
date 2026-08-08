<?php

ini_set('display_errors', 1);
error_reporting(E_ALL);

require __DIR__ . '/app/config.php';

$uri = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$uri = $uri === '' ? 'home' : $uri;

$uri = str_replace(['..', "\0"], '', $uri);

$page = __DIR__ . "/content/{$uri}.phtml";

if (!is_file($page)) {
    http_response_code(404);
    $page = __DIR__ . '/content/404.phtml';
}

include __DIR__ . '/content/template.phtml';